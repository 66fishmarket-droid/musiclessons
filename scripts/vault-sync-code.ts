/**
 * Generates the code knowledge graph in the Obsidian vault (mirrors Bill's scripts/vault_sync_code.py).
 *   node scripts/vault-sync-code.ts [--dry-run] [--quiet]
 * One note per top-level function/method, a hub per source file, an action hub per entry file and
 * _meta/Code Map.base. .githooks/ runs it in the background after every commit, merge and checkout.
 */
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { execFileSync, execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import { REPO_ROOT, VAULT, isMain, posix, syncNotes, today, type Note } from './vault/lib.ts';

export const CODE_DIR = 'Codebase';
const SOURCE_ROOTS = ['src', 'supabase/functions', 'scripts'];
const EXTS = ['.ts', '.tsx'];
// ponytail: top-level functions and class methods only; nested closures are folded into their parent.

export interface Fn {
  id: string; module: string; name: string; file: string; line: number; loc: number; signature: string;
  summary: string; bodyHash: string; exported: boolean; layer: string; calls: Set<string>; calledBy: Set<string>;
  unresolved: number; tables: Set<string>; testedBy: string[]; duplicates: number; history?: Change[];
}
export interface Change { date: string; sha: string; subject: string }
export interface Action { id: string; module: string; file: string; handlers: string[]; reaches: string[] }
export interface Graph { fns: Fn[]; actions: Action[] }

function listFiles(root: string, dirs: string[], accept: (name: string) => boolean): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p); else if (accept(e.name)) out.push(p);
    }
  };
  dirs.forEach(d => walk(join(root, d)));
  return out.sort();
}

/** Architectural layer of a repo-relative source path. */
export function layerOf(rel: string): string {
  if (rel.startsWith('supabase/functions/_shared/engine/')) return 'engine';
  if (rel.startsWith('supabase/functions/')) return 'edge';
  if (rel.startsWith('src/')) return 'ui';
  return 'script';
}

/** Short unique module names: basename, parent folder for index files, folder-prefixed on collision. */
export function moduleNames(rels: string[]): Map<string, string> {
  const short = (r: string) => { const b = basename(r, extname(r)); return b === 'index' ? basename(dirname(r)) : b; };
  const counts = new Map<string, number>();
  rels.forEach(r => counts.set(short(r), (counts.get(short(r)) ?? 0) + 1));
  return new Map(rels.map(r => [r, counts.get(short(r))! > 1 ? `${basename(dirname(r))}.${short(r)}` : short(r)]));
}

const isEntry = (rel: string) =>
  /^scripts\/[^/]+\.tsx?$/.test(rel) || /^supabase\/functions\/[^_/][^/]*\/index\.ts$/.test(rel) || rel.startsWith('src/screens/');

function summaryOf(node: ts.Node): string {
  const doc = ts.getJSDocCommentsAndTags(node).find(ts.isJSDoc);
  const text = doc ? ts.getTextOfJSDocComment(doc.comment) ?? '' : '';
  return text.split(/\r?\n/)[0].trim();
}

/** Parses the project with the TypeScript checker and returns functions, call edges and entry actions. */
export function buildGraph(root: string, { testSuffix = '.test.ts' } = {}): Graph {
  const files = listFiles(root, SOURCE_ROOTS, n => EXTS.includes(extname(n)) && !n.endsWith('.d.ts'));
  const rels = files.map(f => posix(relative(root, f)));
  const modules = moduleNames(rels);
  const program = ts.createProgram(files, {
    noEmit: true, allowImportingTsExtensions: true, resolveJsonModule: true, skipLibCheck: true,
    module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX,
  });
  const checker = program.getTypeChecker();
  const fns: Fn[] = [];
  const byDecl = new Map<ts.Node, Fn>();
  const bodies = new Map<Fn, ts.Node>();
  const entryStatements = new Map<string, ts.Node[]>();

  files.forEach((file, i) => {
    const sf = program.getSourceFile(file);
    if (!sf) return;
    const rel = rels[i];
    const module = modules.get(rel)!;
    const exported = (n: ts.Node) =>
      ts.canHaveModifiers(n) && !!ts.getModifiers(n)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    const add = (decl: ts.Node, name: string, fnNode: ts.FunctionLikeDeclaration, isExported: boolean) => {
      const line = sf.getLineAndCharacterOfPosition(fnNode.getStart(sf)).line + 1;
      const end = sf.getLineAndCharacterOfPosition(fnNode.getEnd()).line + 1;
      const bodyText = fnNode.body?.getText(sf) ?? '';
      const fn: Fn = {
        id: `${module}.${name}`, module, name, file: rel, line, loc: end - line + 1,
        signature: `${name.split('.').pop()}(${fnNode.parameters.map(p => p.getText(sf)).join(', ')})`,
        summary: summaryOf(decl),
        bodyHash: createHash('sha1').update(bodyText.replace(/\s+/g, ' ')).digest('hex').slice(0, 16),
        exported: isExported, layer: layerOf(rel), calls: new Set(), calledBy: new Set(), unresolved: 0,
        tables: new Set([...bodyText.matchAll(/\.(?:from|rpc)\(\s*['"](\w+)['"]/g)].map(m => m[1])),
        testedBy: [], duplicates: 0,
      };
      fns.push(fn); byDecl.set(decl, fn); bodies.set(fn, fnNode);
    };
    const rest: ts.Node[] = [];
    for (const st of sf.statements) {
      if (ts.isFunctionDeclaration(st) && st.name && st.body) add(st, st.name.text, st, exported(st));
      else if (ts.isVariableStatement(st)) {
        let isFn = false;
        for (const d of st.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
            add(d, d.name.text, d.initializer, exported(st)); isFn = true;
          }
        }
        if (!isFn) rest.push(st);
      } else if (ts.isClassDeclaration(st) && st.name) {
        for (const m of st.members) {
          if (ts.isMethodDeclaration(m) && m.body && ts.isIdentifier(m.name)) add(m, `${st.name.text}.${m.name.text}`, m, exported(st));
        }
      } else rest.push(st);
    }
    if (isEntry(rel)) entryStatements.set(rel, rest);
  });

  // undefined = unresolved symbol, null = external (library/global), Fn = ours
  const resolveCall = (expr: ts.Expression): Fn | null | undefined => {
    let sym = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(expr) ? expr.name : expr);
    if (!sym) return undefined;
    if (sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
    for (const d of sym.declarations ?? []) { const fn = byDecl.get(d); if (fn) return fn; }
    return null;
  };
  const eachCall = (node: ts.Node, cb: (t: Fn | null | undefined) => void) => {
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) || ts.isNewExpression(n)) cb(resolveCall(n.expression));
      ts.forEachChild(n, visit);
    };
    visit(node);
  };
  for (const [fn, body] of bodies) {
    eachCall(body, t => {
      if (t === undefined) fn.unresolved++;
      else if (t && t !== fn) { fn.calls.add(t.id); t.calledBy.add(fn.id); }
    });
  }

  const byId = new Map(fns.map(f => [f.id, f]));
  const actions: Action[] = [];
  for (const [rel, statements] of entryStatements) {
    const module = modules.get(rel)!;
    const id = `action.${module}`;
    const handlers = new Set<string>();
    statements.forEach(s => eachCall(s, t => { if (t) handlers.add(t.id); }));
    if (!rel.startsWith('scripts/')) fns.filter(f => f.file === rel && f.exported).forEach(f => handlers.add(f.id));
    handlers.forEach(h => byId.get(h)!.calledBy.add(id));
    const reach = new Set<string>();
    const queue = [...handlers];
    while (queue.length) {
      const next = queue.shift()!;
      if (reach.has(next)) continue;
      reach.add(next);
      byId.get(next)!.calls.forEach(c => queue.push(c));
    }
    actions.push({ id, module, file: rel, handlers: [...handlers].sort(), reaches: [...reach].sort() });
  }

  const tests = listFiles(root, ['tests'], n => n.endsWith(testSuffix)).map(f => ({ name: basename(f), text: readFileSync(f, 'utf8') }));
  const hashCount = new Map<string, number>();
  fns.filter(f => f.loc >= 5).forEach(f => hashCount.set(f.bodyHash, (hashCount.get(f.bodyHash) ?? 0) + 1));
  for (const fn of fns) {
    const stem = basename(fn.file, extname(fn.file));
    const word = new RegExp(`\\b${fn.name.split('.').pop()}\\b`);
    fn.testedBy = tests.filter(t => t.text.includes(`/${stem}.ts`) && word.test(t.text)).map(t => t.name);
    fn.duplicates = fn.loc >= 5 ? hashCount.get(fn.bodyHash)! - 1 : 0;
  }
  return { fns, actions };
}

/** Commits that touched the function's current line range, newest first (git log -L follows it back through edits). */
export function historyOf(root: string, fn: Fn): Change[] {
  // ponytail: uses the committed line range; uncommitted edits can skew it until the next commit's hook run.
  try {
    const out = execFileSync('git', ['log', '-L', `${fn.line},${fn.line + fn.loc - 1}:${fn.file}`, '--date=short', '--format=%x01%ad|%h|%s'],
      { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).toString();
    return out.split('\n').filter(l => l.startsWith('\x01')).map(l => {
      const [date, sha, ...subject] = l.slice(1).split('|');
      return { date, sha, subject: subject.join('|') };
    });
  } catch { return []; } // new, uncommitted file
}

const link = (id: string) => `[[${id}]]`;
const hubDir = (file: string) => `${CODE_DIR}/${dirname(file)}`;
const FN_META = { generated: true, promoted: false, source: 'scripts/vault-sync-code.ts' };

/** Turns the graph into vault notes: functions, file hubs and action hubs. */
export function renderGraph(g: Graph, synced: string): Note[] {
  const notes: Note[] = [];
  const byFile = new Map<string, Fn[]>();
  for (const f of g.fns) {
    byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
    const noCallers = f.calledBy.size === 0;
    const history = f.history ?? [];
    notes.push({
      path: `${hubDir(f.file)}/${f.module}/${f.id}.md`,
      frontmatter: {
        ...FN_META, synced, kind: 'function', file: f.file, line: f.line, loc: f.loc, signature: f.signature,
        summary: f.summary, body_hash: f.bodyHash, parent: link(f.module),
        calls: [...f.calls].sort().map(link), called_by: [...f.calledBy].sort().map(link),
        unresolved_calls: f.unresolved, tables: [...f.tables].sort(), tested_by: f.testedBy,
        duplicate_count: f.duplicates, dead_candidate: noCallers && f.testedBy.length === 0,
        test_only: noCallers && f.testedBy.length > 0,
        created: history.at(-1)?.date ?? null, last_changed: history[0]?.date ?? null, change_count: history.length,
        tags: ['code/ts', `layer/${f.layer}`, 'kind/function', `visibility/${f.exported ? 'public' : 'private'}`],
      },
      body: [
        `# ${f.id}`, '', f.summary || '_No summary yet: add a one-line JSDoc._', '', `\`${f.signature}\``, '',
        '## Calls', ...([...f.calls].sort().map(c => `- ${link(c)}`).concat(f.calls.size ? [] : ['- none'])), '',
        '## Called by', ...([...f.calledBy].sort().map(c => `- ${link(c)}`).concat(f.calledBy.size ? [] : ['- none'])), '',
        '## History', ...(history.length ? history.map(h => `- ${h.date} \`${h.sha}\` ${h.subject}`) : ['- uncommitted']),
      ].join('\n'),
    });
  }
  for (const [file, list] of byFile) {
    const module = list[0].module;
    notes.push({
      path: `${hubDir(file)}/${module}.md`,
      frontmatter: { ...FN_META, synced, kind: 'file', file, layer: list[0].layer, function_count: list.length,
        tags: ['code/ts', `layer/${list[0].layer}`, 'kind/file'] },
      body: [`# ${file}`, '', ...list.map(f => `- ${link(f.id)}${f.summary ? ` — ${f.summary}` : ''}`)].join('\n'),
    });
  }
  for (const a of g.actions) {
    const kind = a.file.startsWith('scripts/') ? 'script' : a.file.startsWith('src/') ? 'screen' : 'edge';
    notes.push({
      path: `${CODE_DIR}/_actions/${a.id}.md`,
      frontmatter: { ...FN_META, synced, kind: 'action', action_kind: kind, file: a.file,
        handlers: a.handlers.map(link), tags: ['kind/action', `action/${kind}`] },
      body: [`# ${a.id}`, '', `Entry: \`${a.file}\``, '', '## Reaches', ...a.reaches.map(r => `- ${link(r)}`)].join('\n'),
    });
  }
  return notes;
}

const CODE_MAP_BASE = `filters:
  and:
    - file.hasTag("kind/function")
views:
  - type: table
    name: By layer
    groupBy:
      property: file
      direction: ASC
    order:
      - file.name
      - summary
      - loc
      - tested_by
  - type: table
    name: Recently changed
    order:
      - file.name
      - last_changed
      - change_count
      - created
      - summary
    sort:
      - property: last_changed
        direction: DESC
  - type: table
    name: Dead candidates
    filters:
      and:
        - dead_candidate == true
    order:
      - file.name
      - summary
      - file
  - type: table
    name: Test-only
    filters:
      and:
        - test_only == true
    order:
      - file.name
      - tested_by
  - type: table
    name: Duplicates
    filters:
      and:
        - duplicate_count > 0
    order:
      - file.name
      - body_hash
      - file
  - type: table
    name: Missing summaries
    filters:
      and:
        - summary == ""
    order:
      - file.name
      - file
`;

function main(): void {
  const args = new Set(process.argv.slice(2));
  const meta = join(VAULT, CODE_DIR, '_meta');
  mkdirSync(meta, { recursive: true });
  const lock = join(meta, '.lock');
  // ponytail: check-then-create lock; fine for one developer's git hooks.
  if (existsSync(lock) && Date.now() - statSync(lock).mtimeMs < 10 * 60_000) return;
  mkdirSync(lock, { recursive: true });
  try {
    const graph = buildGraph(REPO_ROOT);
    graph.fns.forEach(f => { f.history = historyOf(REPO_ROOT, f); });
    const dryRun = args.has('--dry-run');
    const stats = syncNotes(VAULT, CODE_DIR, renderGraph(graph, today()), { dryRun });
    if (!dryRun) writeFileSync(join(meta, 'Code Map.base'), CODE_MAP_BASE);
    let sha = '-';
    try { sha = execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim(); } catch { /* not a repo */ }
    const line = `${new Date().toISOString()} ${sha} fns=${graph.fns.length} written=${stats.written} ` +
      `unchanged=${stats.unchanged} pruned=${stats.pruned} unsummarised=${graph.fns.filter(f => !f.summary).length}`;
    appendFileSync(join(meta, 'sync.log'), `${line}\n`);
    if (!args.has('--quiet')) console.log(line);
  } finally {
    rmdirSync(lock);
  }
}

if (isMain(import.meta.url)) main();
