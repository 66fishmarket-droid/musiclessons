/**
 * Writes Development/Timeline.md (git log by day), copies docs/SESSION_HANDOFF_*.md into Development/Handoffs/
 * and every other .md under docs/ (specs, plans, reviews) into Development/Docs/, keeping the folder layout.
 *   node scripts/vault-sync-dev.ts [--dry-run]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, VAULT, isMain, posix, syncNotes, today, type Note } from './vault/lib.ts';

const META = { generated: true, promoted: false, source: 'git log + docs/' };

/** Timeline grouped by date (newest first) with handoffs linked on their date, plus a copy of each handoff and doc. */
export function devNotes(gitLog: string, handoffs: { name: string; text: string }[], synced: string,
  docs: { path: string; text: string }[] = []): Note[] {
  const byDate = new Map<string, string[]>();
  for (const line of gitLog.split('\n').filter(Boolean)) {
    const [date, sha, ...subject] = line.split('|');
    byDate.set(date, [...(byDate.get(date) ?? []), `- \`${sha}\` ${subject.join('|')}`]);
  }
  for (const h of handoffs) {
    const date = /\d{4}-\d{2}-\d{2}/.exec(h.name)?.[0];
    if (date) byDate.set(date, [`- 📝 [[${h.name.replace(/\.md$/, '')}]]`, ...(byDate.get(date) ?? [])]);
  }
  const days = [...byDate.keys()].sort().reverse();
  return [
    {
      path: 'Development/Timeline.md',
      frontmatter: { ...META, synced, tags: ['development'] },
      body: ['# Development timeline', '', ...days.flatMap(d => [`## ${d}`, '', ...byDate.get(d)!, ''])].join('\n'),
    },
    ...handoffs.map(h => ({
      path: `Development/Handoffs/${h.name}`,
      frontmatter: { ...META, synced, tags: ['development', 'handoff'] },
      body: h.text,
    })),
    ...docs.map(d => ({
      path: `Development/Docs/${d.path}`,
      frontmatter: { ...META, synced, tags: ['development', 'doc'] },
      body: d.text,
    })),
  ];
}

if (isMain(import.meta.url)) {
  const log = execFileSync('git', ['log', '--date=short', '--pretty=format:%ad|%h|%s'], { cwd: REPO_ROOT }).toString();
  const docsDir = join(REPO_ROOT, 'docs');
  const all = existsSync(docsDir)
    ? readdirSync(docsDir, { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.md')).map(f => posix(f))
    : [];
  const read = (f: string) => readFileSync(join(docsDir, f), 'utf8');
  const isHandoff = (f: string) => /^SESSION_HANDOFF_.*\.md$/.test(f);
  const handoffs = all.filter(isHandoff).map(name => ({ name, text: read(name) }));
  const docs = all.filter(f => !isHandoff(f)).map(path => ({ path, text: read(path) }));
  const stats = syncNotes(VAULT, 'Development', devNotes(log, handoffs, today(), docs), { dryRun: process.argv.includes('--dry-run') });
  console.log(`Development: ${JSON.stringify(stats)}`);
}
