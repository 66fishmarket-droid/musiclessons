/**
 * Writes docs/steps-review.md: every recipe, create task and fixed block, step by step, with what each step shows
 * (card, chords, metronome, note caller, scale, recorder), for a human skim of the per-step layout.
 *   node scripts/render-steps.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CREATE_TASKS } from '../supabase/functions/_shared/engine/create.ts';
import { RECIPES, type StepElement } from '../supabase/functions/_shared/engine/recipes.ts';
import { SKILLS } from '../supabase/seed/curriculum.ts';
import { stepElements } from '../src/lib/lesson.ts';
import { REPO_ROOT } from './vault/lib.ts';

const NAMES: Record<StepElement, string> = {
  card: 'card', chords: 'chords', metronome: 'metronome', note_caller: 'note caller', scale: 'scale board', recorder: 'recorder',
};
const shows = (els: StepElement[] | null | undefined) => (els?.length ? els.map(e => NAMES[e]).join(' + ') : 'text only');
const out = ['# Per-step review', '', 'What each step shows besides its text. "More about this" is on every step.', ''];

out.push('## Fixed blocks', '');
for (const [kind, n] of [['warmup', 3], ['apply', 3], ['record', 3]] as const) {
  out.push(`- **${kind}**: ${Array.from({ length: n }, (_, k) => `${k + 1}. ${shows(stepElements(undefined, kind, k, n))}`).join(' · ')}`);
}
out.push('- **review / reset**: whole block (unchanged)', '');

out.push('## Create tasks', '');
for (const t of CREATE_TASKS) {
  out.push(`### ${t.id}`, '', ...t.steps.map((s, k) => `${k + 1}. ${s} → **${shows(t.show[k])}**`), '');
}

let track = '';
for (const s of SKILLS.filter(x => x.track !== 'theory')) {
  const r = RECIPES[s.id];
  if (!r) continue;
  if (s.track !== track) { track = s.track; out.push(`## ${track}`, ''); }
  out.push(`### ${s.name} (card: ${r.card}${r.map ? `, map: ${r.map}` : ''})`, '', ...r.steps.map((st, k) => `${k + 1}. ${st} → **${shows(r.show?.[k])}**`), '');
}
writeFileSync(join(REPO_ROOT, 'docs', 'steps-review.md'), `${out.join('\n')}\n`);
console.log(`docs/steps-review.md: ${Object.keys(RECIPES).length} recipes, ${CREATE_TASKS.length} create tasks`);
