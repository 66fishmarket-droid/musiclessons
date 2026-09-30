import { CREATE_TASKS } from '../engine/create.ts';
import { recipeFor } from '../engine/recipes.ts';
import { renderSteps, slotContext } from '../engine/render.ts';
import { STYLE_CATALOG } from '../engine/styles.ts';
import type { BlockKind, LessonPlan, PlanBlock, Skill } from '../engine/types.ts';
import type { Target } from '../engine/types.ts';

/** A plan target as plain words (moved here from fallback.ts, which re-exports it). */
export function targetText(t: Target | null): string {
  if (!t) return '';
  if (t.metric === 'bpm' && t.target !== null) return `Start at ${t.start} bpm, reach ${t.target} bpm cleanly.`;
  if (t.metric === 'clean_reps' && t.target !== null) return `${t.target} clean reps in a row.`;
  return 'Rate yourself honestly, 1–5.';
}

export interface EngineBlock { kind: BlockKind; instructions: string[]; target_text: string; listen_for: string }
export const APPLY_DEFAULT_GRID = 'D---D---D---D---';
const RESETS = [
  'Put the guitar down for 30 seconds and shake out both hands.',
  'Put the guitar down. Close your eyes and picture the shape you just played.',
  'Put the guitar down for 30 seconds and breathe out slowly twice.',
  'Put the guitar down and hum the last thing you played.',
];

/** Every instruction the learner reads, from the plan: recipes, block templates and the Create library (spec §5). */
export function buildSteps(plan: LessonPlan, skills: Map<string, Skill>): { blocks: EngineBlock[]; create_prompt: string } {
  const day = Math.floor(Date.parse(plan.date) / 86_400_000);
  const skillOf = (id: string) => skills.get(id);
  const task = CREATE_TASKS.find(t => t.id === plan.create_task_id) ?? CREATE_TASKS[0];
  const base = slotContext(plan, {});

  const recipeSteps = (skillId: string, b: PlanBlock, today: boolean) => {
    const skill = skillOf(skillId);
    if (!skill) return { steps: [`Practise ${skillId}.`], listen: '' };
    const r = recipeFor(skill);
    const patternId = r.card === 'pattern' ? (today ? plan.pattern_id : r.patterns?.[0]) ?? null : null;
    const ctx = slotContext(plan, { target: b.items[0]?.target ?? null, patternId, grid: r.grid ?? null, gridName: r.gridName ?? null });
    return { steps: renderSteps(r.steps, ctx), listen: r.listenFor };
  };

  const build = (b: PlanBlock): EngineBlock => {
    const target_text = targetText(b.items[0]?.target ?? null);
    const make = (instructions: string[], listen_for = ''): EngineBlock => ({ kind: b.kind, instructions, target_text, listen_for });
    switch (b.kind) {
      case 'warmup': return make(renderSteps([
        'Hum or lip-trill for 30 seconds to wake your voice up.',
        'Play {key} {scale} in the position shown, saying each note\'s number (1 is {degrees:1}) as you play it.',
        'Play it again, singing each note.',
      ], base));
      case 'new_skill': {
        const r = recipeSteps(plan.skill_id, b, true);
        return make(r.steps, r.listen);
      }
      case 'retest': {
        const id = plan.retest?.skill_id ?? plan.skill_id;
        const r = recipeSteps(id, b, false);
        return make([`Cold retest: ${skillOf(id)?.name ?? id}. One attempt at the target, no practice run first.`, ...r.steps.slice(0, 2)], r.listen); // first two steps: set-up plus the pattern/rhythm line
      }
      case 'review': return make(b.items.map(i => {
        const [type, ref] = [i.ref.slice(0, i.ref.indexOf(':')), i.ref.slice(i.ref.indexOf(':') + 1)];
        if (type === 'style') return renderSteps([`${STYLE_CATALOG.elements.find(e => e.id === ref)?.name ?? ref}: play it once through {chords}.`], base)[0];
        if (type === 'skill' && skillOf(ref)) return `${skillOf(ref)!.name}: ${recipeSteps(ref, { ...b, items: [i] }, false).steps[0]}`;
        return `Review: ${skillOf(ref)?.name ?? ref}.`;
      }));
      case 'apply': {
        const ctx = plan.music.rhythm ? base : slotContext(plan, { grid: APPLY_DEFAULT_GRID, gridName: 'Steady down-strums' });
        return make(renderSteps([
          '{rhythm_name}: {rhythm_counts}',
          'Play it on {chord1} until it is steady, then through {chords}, one chord per bar.',
          'Keep the picking hand going and hum or sing any tune over it.',
        ], ctx));
      }
      case 'create': return make(renderSteps(task.steps, base));
      case 'record': return make([
        'Record one take of the Apply groove with your singing, using the recorder below.',
        'Listen back once, all the way through.',
        'Rate it 1–5 and note one thing to fix tomorrow.',
      ]);
      case 'reset': return make([RESETS[day % RESETS.length]]);
    }
  };
  return { blocks: plan.blocks.map(build), create_prompt: renderSteps([task.prompt], base)[0] };
}
