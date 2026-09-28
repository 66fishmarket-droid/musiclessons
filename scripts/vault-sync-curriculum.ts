/**
 * Writes Curriculum/<Track>/<skill id>.md and Curriculum/<Track>.md from the seed plus live progress.
 *   node --env-file-if-exists=.env.local scripts/vault-sync-curriculum.ts [--dry-run]
 * Progress is read with the service role when SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are set (single-user app).
 */
import { createClient } from '@supabase/supabase-js';
import type { SkillProgress } from '../supabase/functions/_shared/engine/types.ts';
import { SKILLS, TRACK_NAMES } from '../supabase/seed/curriculum.ts';
import { VAULT, isMain, syncNotes, today, type Note } from './vault/lib.ts';

const META = { generated: true, promoted: false, source: 'supabase/seed/curriculum.ts + skill_progress' };

/** One note per skill (progress merged in) plus one hub per track grouped by level. */
export function curriculumNotes(progress: Map<string, SkillProgress>, synced: string): Note[] {
  const notes: Note[] = SKILLS.map(s => {
    const p = progress.get(s.id);
    return {
      path: `Curriculum/${TRACK_NAMES[s.track]}/${s.id}.md`,
      frontmatter: {
        ...META, synced, skill_id: s.id, track: s.track, level: s.level, pass_metric: s.pass_metric,
        default_target: s.default_target, theory_topic: s.theory_topic_id ? `[[${s.theory_topic_id}]]` : null,
        styles: (s.styles ?? []).map(x => `[[${x}]]`), status: p?.status ?? 'not started', score: p?.score ?? null,
        current_target: p?.current_target ?? null, last_seen: p?.last_seen ?? null,
        tags: ['skill', `track/${s.track}`, `level/${s.level}`],
      },
      body: [`# ${s.name}`, '', s.description, ...(s.theory_topic_id ? ['', `**Theory:** [[${s.theory_topic_id}]]`] : [])].join('\n'),
    };
  });
  for (const [track, name] of Object.entries(TRACK_NAMES)) {
    const lines = [`# ${name}`, ''];
    for (const lvl of [1, 2, 3, 4, 5]) {
      lines.push(`## Level ${lvl}`, '');
      for (const s of SKILLS.filter(x => x.track === track && x.level === lvl)) {
        lines.push(`- [[${s.id}]] — ${s.name}${progress.get(s.id)?.status === 'mastered' ? ' ✅' : ''}`);
      }
      lines.push('');
    }
    notes.push({ path: `Curriculum/${name}.md`, frontmatter: { ...META, synced, track, tags: ['track'] }, body: lines.join('\n') });
  }
  return notes;
}

async function loadProgress(): Promise<Map<string, SkillProgress>> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.log('Curriculum: no Supabase env, writing without progress'); return new Map(); }
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } })
    .from('skill_progress').select('skill_id, status, score, current_target, last_seen, last_key');
  if (error) throw error;
  return new Map((data as SkillProgress[]).map(p => [p.skill_id, p]));
}

if (isMain(import.meta.url)) {
  const stats = syncNotes(VAULT, 'Curriculum', curriculumNotes(await loadProgress(), today()), { dryRun: process.argv.includes('--dry-run') });
  console.log(`Curriculum: ${JSON.stringify(stats)}`);
}
