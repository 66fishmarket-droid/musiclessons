/**
 * Writes Development/Timeline.md (git log by day) and copies docs/SESSION_HANDOFF_*.md into Development/Handoffs/.
 *   node scripts/vault-sync-dev.ts [--dry-run]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, VAULT, isMain, syncNotes, today, type Note } from './vault/lib.ts';

const META = { generated: true, promoted: false, source: 'git log + docs/SESSION_HANDOFF_*.md' };

/** Timeline grouped by date (newest first) with handoffs linked on their date, plus a copy of each handoff. */
export function devNotes(gitLog: string, handoffs: { name: string; text: string }[], synced: string): Note[] {
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
  ];
}

if (isMain(import.meta.url)) {
  const log = execFileSync('git', ['log', '--date=short', '--pretty=format:%ad|%h|%s'], { cwd: REPO_ROOT }).toString();
  const docs = join(REPO_ROOT, 'docs');
  const handoffs = existsSync(docs)
    ? readdirSync(docs).filter(f => /^SESSION_HANDOFF_.*\.md$/.test(f)).map(name => ({ name, text: readFileSync(join(docs, name), 'utf8') }))
    : [];
  const stats = syncNotes(VAULT, 'Development', devNotes(log, handoffs, today()), { dryRun: process.argv.includes('--dry-run') });
  console.log(`Development: ${JSON.stringify(stats)}`);
}
