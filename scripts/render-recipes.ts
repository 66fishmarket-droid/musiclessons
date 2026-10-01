/**
 * Prints every practice recipe rendered for a sample day, for a human skim of the lesson wording.
 *   node scripts/render-recipes.ts [key]   (default G)
 */
import { buildMusic } from '../supabase/functions/_shared/engine/music.ts';
import { targetFor } from '../supabase/functions/_shared/engine/planner.ts';
import { RECIPES } from '../supabase/functions/_shared/engine/recipes.ts';
import { renderSteps, slotContext } from '../supabase/functions/_shared/engine/render.ts';
import type { LessonPlan } from '../supabase/functions/_shared/engine/types.ts';
import { SKILLS } from '../supabase/seed/curriculum.ts';

const key = process.argv[2] ?? 'G';
let track = '';
for (const s of SKILLS.filter(x => x.track !== 'theory')) {
  const r = RECIPES[s.id];
  if (!r) continue;
  if (s.track !== track) { track = s.track; console.log(`\n## ${track}\n`); }
  const plan = { key, music: buildMusic({ key, track: s.track, style: null, element: null }) } as unknown as LessonPlan;
  const ctx = slotContext(plan, { target: targetFor(s), patternId: r.patterns?.[0] ?? null, grid: r.grid ?? null, gridName: r.gridName ?? null });
  console.log(`### ${s.name} (L${s.level}) — card: ${r.card}${r.patterns ? ` [${r.patterns.join(', ')}]` : ''}${r.majorKeyOnly ? ' · major keys only' : ''}\n`);
  renderSteps(r.steps, ctx).forEach((line, i) => console.log(`${i + 1}. ${line}`));
  console.log(`\n*Listen for:* ${r.listenFor}\n`);
}
