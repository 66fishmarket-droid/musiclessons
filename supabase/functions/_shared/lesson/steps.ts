import { CREATE_TASKS } from '../engine/create.ts';
import { APPLY_DEFAULT_GRID } from '../engine/patterns.ts';
import { PLAYS_THROUGH, playStep, recipeFor } from '../engine/recipes.ts';
import { renderSteps, slotContext } from '../engine/render.ts';
import { swingOf } from '../engine/music.ts';
import { romanToChords } from '../engine/roman.ts';
import { STYLE_CATALOG } from '../engine/styles.ts';
import { THEORY_DAY_SCALE, THEORY_REVIEWS } from '../engine/theory.ts';
import type { BlockKind, LessonPlan, PlanBlock, Skill } from '../engine/types.ts';
import type { ReviewRhythm } from './contract.ts';
import type { Target } from '../engine/types.ts';
import { lessonThread } from './thread.ts';

/** A plan target as plain words (moved here from fallback.ts, which re-exports it). */
export function targetText(t: Target | null): string {
  if (!t) return '';
  if (t.metric === 'bpm' && t.target !== null) return `Start at ${t.start} bpm, reach ${t.target} bpm cleanly.`;
  if (t.metric === 'clean_reps' && t.target !== null) return `${t.target} clean reps in a row.`;
  return 'Rate yourself honestly, 1–5.';
}

export interface EngineBlock {
  kind: BlockKind; instructions: string[]; target_text: string; listen_for: string;
  /** What the block is and why (always visible), and how it links to what came before; '' when none (lesson/thread.ts). */
  intro: string; bridge: string;
  /** Review only, one per step: a style rhythm item's grid so the app can draw its card (the catalogue stays server-side); null otherwise. */
  rhythms?: (ReviewRhythm | null)[];
}

/** buildSteps' output: the blocks, the Create prompt card and the lesson path for the Today screen. */
export interface EngineSteps { blocks: EngineBlock[]; create_prompt: string; path: string[] }

/** Every word the learner reads from the engine's steps (instructions plus each block's listen_for) — the
 * allowance text for the no-unmet-skill-names check (contract.ts avoidNames) and the brief. */
export function stepsText(steps: { blocks: EngineBlock[] }): string {
  return steps.blocks.flatMap(b => [...b.instructions, b.listen_for]).join(' ');
}
export { APPLY_DEFAULT_GRID }; // moved to engine/patterns.ts so src/screens/Player.tsx doesn't pull steps.ts (and STYLE_CATALOG) into the client bundle
/** Resets after a playing block may call back to what was played; after a writing block they only move the body. */
const RESETS = {
  played: [
    'Put the guitar down for 30 seconds and shake out both hands.',
    'Put the guitar down. Close your eyes and picture the shape you just played.',
    'Put the guitar down for 30 seconds and breathe out slowly twice.',
    'Put the guitar down and hum the last thing you played.',
  ],
  wrote: [
    'Put the pen down, stand up and shake out both hands for 30 seconds.',
    'Stand up, stretch both arms overhead and breathe out slowly twice.',
    'Look away from the page at something far off for 30 seconds, then pick the guitar up.',
  ],
};

/** Every instruction the learner reads, from the plan: recipes, block templates and the Create library (spec §5). */
export function buildSteps(plan: LessonPlan, skills: Map<string, Skill>): EngineSteps {
  const day = Math.floor(Date.parse(plan.date) / 86_400_000);
  const skillOf = (id: string) => skills.get(id);
  const task = CREATE_TASKS.find(t => t.id === plan.create_task_id) ?? CREATE_TASKS[0];
  const base = slotContext(plan, {});
  const thread = lessonThread(plan, skills);

  // `limit` slices the templates before rendering, so a slot in a later step (e.g. the bpm ladder) is never
  // evaluated when the caller only wants an early step — needed on review, where the item's target is always null.
  const recipeSteps = (skillId: string, b: PlanBlock, today: boolean, limit = Infinity) => {
    const skill = skillOf(skillId);
    if (!skill) return { steps: [`Practise ${skillId}.`], listen: '' };
    const r = recipeFor(skill);
    const patternId = r.card === 'pattern' ? (today ? plan.pattern_id ?? r.patterns?.[0] : r.patterns?.[0]) ?? null : null;
    const ctx = slotContext(plan, { target: b.items[0]?.target ?? null, patternId, grid: r.grid ?? null, gridName: r.gridName ?? null, push: r.gridPush ?? null });
    return { steps: renderSteps(r.steps.slice(0, limit), ctx), listen: r.listenFor };
  };

  /** Skill review item: what it is plus the step that plays it (the recipe's first card step), then the chords once through. */
  const reviewSkillLine = (ref: string, b: PlanBlock, item: PlanBlock['items'][number]): string => {
    const r = recipeFor(skillOf(ref)!);
    const play = playStep(r);
    const steps = recipeSteps(ref, { ...b, items: [item] }, false, play + 1).steps;
    const through = PLAYS_THROUGH.includes(r.card) ? renderSteps([' Then once through {chords}, one chord per bar.'], base)[0] : '';
    return `${skillOf(ref)!.name}: ${play > 0 ? `${steps[0]} ${steps[play]}` : steps[0]}${through}`;
  };

  /** Style review item: the rhythm's counts, or the progression's chords; a safe line if either lookup fails. */
  const reviewStyleLine = (ref: string): string => {
    const element = STYLE_CATALOG.elements.find(e => e.id === ref);
    const safe = renderSteps([`${element?.name ?? ref}: play it once through {chords}.`], base)[0];
    if (!element) return safe;
    const profile = STYLE_CATALOG.profiles.find(p => p.id === element.style);
    if (element.kind === 'rhythm') {
      const pattern = profile?.rhythm_patterns.find(p => p.id === element.id);
      if (!pattern) return safe;
      const ctx = slotContext(plan, { grid: pattern.grid.join(''), gridName: pattern.name, swing: swingOf(profile), push: pattern.push ?? null });
      return renderSteps(['{rhythm_name}: {rhythm_counts}. Play it through {chords}, one chord per bar.'], ctx)[0];
    }
    const prog = profile?.progressions.find(p => p.id === element.id);
    if (!prog) return safe;
    const chords = romanToChords(plan.key, prog.roman);
    return `${element.name}: ${chords.map(c => `{${c}}`).join(' ')}, one bar each.`;
  };

  /** A style rhythm review item's pattern, for the app's card; null for anything else. */
  const reviewRhythm = (ref: string): ReviewRhythm | null => {
    if (!ref.startsWith('style:')) return null;
    const id = ref.slice('style:'.length);
    const profile = STYLE_CATALOG.profiles.find(x => x.rhythm_patterns.some(r => r.id === id));
    const p = profile?.rhythm_patterns.find(x => x.id === id);
    return p ? { name: p.name, grid: p.grid, swing: swingOf(profile), push: p.push ?? null } : null;
  };

  const build = (b: PlanBlock): EngineBlock => {
    const target_text = targetText(b.items[0]?.target ?? null);
    const make = (instructions: string[], listen_for = ''): EngineBlock => ({
      kind: b.kind, instructions, target_text, listen_for,
      intro: thread.blocks[b.kind]?.intro ?? '', bridge: thread.blocks[b.kind]?.bridge ?? '',
    });
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
      case 'review': return { ...make(b.items.map(i => {
        const [type, ref] = [i.ref.slice(0, i.ref.indexOf(':')), i.ref.slice(i.ref.indexOf(':') + 1)];
        if (type === 'style') return reviewStyleLine(ref);
        if (type === 'skill' && skillOf(ref)) return reviewSkillLine(ref, b, i);
        if (type === 'theory' && THEORY_REVIEWS[ref]) {
          return renderSteps([`${skillOf(ref)?.name ?? ref}: ${THEORY_REVIEWS[ref]}`], { ...base, scale: THEORY_DAY_SCALE.has(ref) ? base.scale : 'major' })[0];
        }
        return `Review: ${skillOf(ref)?.name ?? ref}.`;
      })), rhythms: b.items.map(i => reviewRhythm(i.ref)) };
      case 'apply': {
        const ctx = plan.music.rhythm ? base : slotContext(plan, { grid: APPLY_DEFAULT_GRID, gridName: 'Steady down-strums' });
        // A one-chord progression (funk's Dorian vamp) has no "through" to play, so say why it's one chord instead.
        const vamp = new Set(plan.music.progression.chords).size === 1;
        return make(renderSteps([
          '{rhythm_name}: {rhythm_counts}',
          vamp
            ? 'This is a one-chord vamp: stay on {chord1} for 8 bars or more. Nothing changes in the harmony, so all the interest is in the rhythm; keep it tight and even.'
            : 'Play it on {chord1} until it is steady, then through {chords}, one chord per bar.',
          // The scale came from today's style: play it, don't just mention it (spec 2026-10-07 §5). Shown with the scale card (src/lib/lesson.ts).
          ...(thread.scaleInApply ? ['Every fourth bar, swap the groove for a short {key} {scale} phrase from the warm-up shape: four notes, ending on the note {degrees:1}. Then straight back into the groove.'] : []),
          'Keep the picking hand going and hum or sing any tune over it.',
        ], ctx));
      }
      case 'create': return make(renderSteps(task.steps, base));
      case 'record': return make([
        'Record one take of the Apply groove with your singing, using the recorder below.',
        'Listen back once, all the way through.',
        'Rate it 1–5 and note one thing to fix tomorrow.',
      ]);
      case 'reset': {
        const r = skillOf(plan.skill_id) && recipeFor(skillOf(plan.skill_id)!);
        const pool = r && (r.card !== 'none' || r.show?.some(els => els.length)) ? RESETS.played : RESETS.wrote;
        return make([pool[day % pool.length]]);
      }
    }
  };
  return { blocks: plan.blocks.map(build), create_prompt: renderSteps([task.prompt], base)[0], path: thread.path };
}
