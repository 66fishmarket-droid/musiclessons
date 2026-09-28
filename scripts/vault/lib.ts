import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const VAULT = join(REPO_ROOT, 'Music_Lessons Vault');
export const PROTECTED = '_notes';

export interface Note { path: string; frontmatter: Record<string, unknown>; body: string }
export interface SyncStats { written: number; unchanged: number; pruned: number }

/** Today's date as YYYY-MM-DD (UTC). */
export const today = (): string => new Date().toISOString().slice(0, 10);
/** Converts an OS path to forward slashes. */
export const posix = (p: string): string => p.split(sep).join('/');
/** True when the module at `url` is the script Node was started with. */
export const isMain = (url: string): boolean =>
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(url);

function scalar(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(String(v));
}

/** Renders YAML frontmatter plus body; strings are JSON-quoted (valid YAML), arrays become block lists. */
export function renderNote(n: Note): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(n.frontmatter)) {
    if (Array.isArray(v)) {
      lines.push(v.length ? `${k}:` : `${k}: []`);
      for (const item of v) lines.push(`  - ${scalar(item)}`);
    } else lines.push(`${k}: ${scalar(v)}`);
  }
  lines.push('---', '', n.body.trimEnd(), '');
  return lines.join('\n');
}

const withoutSynced = (text: string) => text.replace(/^synced: .*$/m, '');

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (e.name !== PROTECTED) walk(join(dir, e.name), out); }
    else if (e.name.endsWith('.md')) out.push(join(dir, e.name));
  }
  return out;
}

/**
 * Writes notes under vault/managed (skipping ones that only differ by `synced`) and prunes generated notes
 * no longer produced. `_notes/` and notes without `generated: true` are never touched.
 */
export function syncNotes(vault: string, managed: string, notes: Note[], { dryRun = false } = {}): SyncStats {
  const stats: SyncStats = { written: 0, unchanged: 0, pruned: 0 };
  const keep = new Set<string>();
  for (const n of notes) {
    if (!n.path.startsWith(`${managed}/`) || n.path.split('/').includes(PROTECTED)) {
      throw new Error(`Refusing to write outside ${managed}: ${n.path}`);
    }
    const file = resolve(join(vault, n.path));
    keep.add(file);
    const text = renderNote(n);
    if (existsSync(file) && withoutSynced(readFileSync(file, 'utf8')) === withoutSynced(text)) { stats.unchanged++; continue; }
    if (!dryRun) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); }
    stats.written++;
  }
  for (const file of walk(join(vault, managed))) {
    if (keep.has(resolve(file))) continue;
    if (!/^generated: true$/m.test(readFileSync(file, 'utf8'))) continue;
    if (!dryRun) rmSync(file);
    stats.pruned++;
  }
  return stats;
}
