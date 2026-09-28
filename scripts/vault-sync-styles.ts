/**
 * Writes Styles/<id>.md and Styles/_Families.md from the engine's style data.
 *   node scripts/vault-sync-styles.ts [--dry-run]
 */
import { romanToChords } from '../supabase/functions/_shared/engine/roman.ts';
import { STYLES, type StyleProfile } from '../supabase/functions/_shared/engine/styles.ts';
import { VAULT, isMain, syncNotes, today, type Note } from './vault/lib.ts';

const META = { generated: true, promoted: false, source: 'supabase/functions/_shared/engine/styles.data.json' };

function body(s: StyleProfile): string {
  const lines = [
    `# ${s.name}`, '', `Family: [[_Families#${s.family}|${s.family}]] · ${s.feel.meter} · ${s.feel.subdivision} · ${s.feel.tempo_range[0]}–${s.feel.tempo_range[1]} bpm`,
    '', `**Accents:** ${s.feel.accents}`, '', '## Rhythm patterns', '',
  ];
  for (const p of s.rhythm_patterns) {
    lines.push(`### ${p.name}${p.verified ? '' : ' (unverified: check by ear)'}`, '', '```', p.grid.join(' '), '```');
    if (p.note) lines.push('', p.note);
    lines.push('');
  }
  lines.push('## Progressions (shown in C)', '');
  for (const p of s.progressions) lines.push(`- **${p.name}**: ${p.roman.join(' ')} → ${romanToChords('C', p.roman).join(' ')}${p.verified ? '' : ' (unverified)'}`);
  const list = (title: string, xs: string[]) => (xs.length ? ['', `## ${title}`, '', ...xs.map(x => `- ${x}`)] : []);
  lines.push(
    ...list('Chord colours', s.chord_colours), ...list('Forms', s.forms), ...list('Fill vocabulary', s.fill_vocabulary),
    ...list('Scales', s.scales), ...list('Common keys', s.keys_common), ...list('Tunings', s.tunings),
    ...list('Lyric traits', s.lyric_traits), ...list('Transplant levers', s.transplant_levers), ...list('Learning ladder', s.ladder),
    ...list('Reference tracks', s.reference_tracks.map(t => `${t.title} — ${t.artist}: ${t.why}`)),
  );
  return lines.join('\n');
}

/** One note per style plus a families hub. */
export function styleNotes(synced: string): Note[] {
  const notes: Note[] = STYLES.map(s => ({
    path: `Styles/${s.id}.md`,
    frontmatter: {
      ...META, synced, style_id: s.id, family: s.family, tempo_lo: s.feel.tempo_range[0], tempo_hi: s.feel.tempo_range[1],
      patterns: s.rhythm_patterns.length, verified_patterns: s.rhythm_patterns.filter(p => p.verified).length,
      tags: ['style', `style/${s.id}`, `family/${s.family}`],
    },
    body: body(s),
  }));
  const families = [...new Set(STYLES.map(s => s.family))].sort();
  notes.push({
    path: 'Styles/_Families.md',
    frontmatter: { ...META, synced, tags: ['style'] },
    body: ['# Style families', '', ...families.flatMap(f => [`## ${f}`, '', ...STYLES.filter(s => s.family === f).map(s => `- [[${s.id}]] — ${s.name}`), ''])].join('\n'),
  });
  return notes;
}

if (isMain(import.meta.url)) {
  const stats = syncNotes(VAULT, 'Styles', styleNotes(today()), { dryRun: process.argv.includes('--dry-run') });
  console.log(`Styles: ${JSON.stringify(stats)}`);
}
