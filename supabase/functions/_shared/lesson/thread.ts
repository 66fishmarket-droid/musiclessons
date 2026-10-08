import { CREATE_TASKS } from '../engine/create.ts';
import { termsIn } from '../engine/glossary.ts';
import { recipeFor } from '../engine/recipes.ts';
import { STYLE_CATALOG } from '../engine/styles.ts';
import type { BlockKind, LessonPlan, Skill } from '../engine/types.ts';

export interface BlockThread { intro: string; bridge: string }
export interface LessonThread {
  /** The scale came from today's style, so Apply plays it (spec 2026-10-07 §5). */
  scaleInApply: boolean;
  /** Today's path: 1–5 lines for the Today screen. */
  path: string[];
  /** reset gets no entry; record gets a bridge only; warmup an intro only. */
  blocks: Partial<Record<BlockKind, BlockThread>>;
}

/** "Country (classic/Nashville + modern)" → "Country": profile names carry a bracketed qualifier the learner doesn't need. */
export const shortStyleName = (name: string): string => name.replace(/\s*\(.*\)\s*$/, '');

const braced = (chords: string[]) => [...new Set(chords)].map(c => `{${c}}`).join(' ');
/** "the chord {Gm7}" / "the chords {G}, {C} and {D}": Today shows the path without chord chips, so say they're chords. */
const chordPhrase = (chords: string[]) => {
  const u = [...new Set(chords)].map(c => `{${c}}`);
  return u.length === 1 ? `the chord ${u[0]}` : `the chords ${u.slice(0, -1).join(', ')} and ${u.at(-1)}`;
};
/** Glossary examples are written in one fixed key ("In G that's G, A, B, D, E"); the warm-up names today's notes instead. */
const KEYED_EXAMPLE = /\s*In [A-G][#b]? that's [^.]*\./g;

/** How today's blocks connect: a what-and-why intro per block, a bridge naming the link or the change of focus,
 * and the lesson path. Links only where the plan already has them (owner, 2026-10-07: "link where natural only"). */
export function lessonThread(plan: LessonPlan, skills: Map<string, Skill>): LessonThread {
  const { key, music } = plan;
  const scale = `${key} ${music.scale.name}`;
  const chords = braced(music.progression.chords);
  const has = (k: BlockKind) => plan.blocks.some(b => b.kind === k);
  const profile = plan.style_element ? STYLE_CATALOG.profiles.find(p => p.id === plan.style_element!.style) : undefined;
  const element = plan.style_element ? STYLE_CATALOG.elements.find(e => e.id === plan.style_element!.element_id) : undefined;
  const style = profile ? shortStyleName(profile.name) : '';
  const scaleInApply = !!profile && profile.scales[0] === music.scale.name;
  const skill = skills.get(plan.skill_id);
  const sameScale = !!skill && recipeFor(skill).card === 'scale';
  const inStyle = !!skill && !!profile && !!skill.styles?.includes(profile.id);
  const retest = plan.retest ? skills.get(plan.retest.skill_id) : undefined;
  const task = CREATE_TASKS.find(t => t.id === plan.create_task_id) ?? CREATE_TASKS[0];
  const scaleTerm = termsIn([music.scale.name])[0];
  const [i, iv, v] = music.progression.chords;
  const iivvi = !profile && music.progression.roman.join(' ') === 'I IV V I';

  const blocks: LessonThread['blocks'] = {
    warmup: {
      intro: `Today's scale: ${scale} (${music.scale.notes.join(', ')}).${scaleTerm ? ` ${scaleTerm.plain.replace(KEYED_EXAMPLE, '')}` : ''}${scaleInApply ? ` It's today's scale because ${style} players build their phrases from it, and Apply uses it.` : ''}`,
      bridge: '',
    },
    retest: {
      intro: retest?.description ?? '',
      bridge: `Change of focus: a cold check on ${retest?.name ?? 'an earlier skill'} from an earlier lesson.`,
    },
    new_skill: {
      intro: skill?.description ?? '',
      bridge: sameScale ? `Same ${scale} as the warm-up.`
        : inStyle ? `Part of today's ${style} style.`
        : `Change of focus: ${skill?.name ?? plan.skill_id}. Nothing carries over from the ${scale} warm-up here.`,
    },
    review: {
      intro: 'Spaced review: a quick pass over things you learned earlier, so they stick.',
      bridge: 'Change of focus: a quick pass over earlier material.',
    },
    apply: {
      intro: profile && element ? `${style} groove: ${element.name}.`
        : iivvi ? `{${iv}} and {${v}} sit either side of {${i}} on the circle of fifths: home, its two nearest neighbours, then home again. That's why it sounds settled.`
        : `Strumming ${chords} with today's rhythm.`,
      bridge: scaleInApply
        ? `Same ${scale} notes, now over the ${chords} groove: ${style} players build their phrases from this scale.`
        : skill?.track === 'rhythm' && has('new_skill') ? `Same strumming hand as the new skill, now over ${chords}.`
        : 'Change of focus: rhythm. The warm-up scale isn\'t used here; this is about locking the strum to the beat.',
    },
    create: {
      intro: task.why,
      bridge: `Same ${chords} as Apply.${scaleInApply && task.show.some(s => s.includes('scale')) ? ` The notes come from the ${scale} warm-up.` : ''}`,
    },
    record: { intro: '', bridge: 'Same groove as Apply.' },
  };

  const path: string[] = [];
  const onChords = chordPhrase(music.progression.chords);
  if (has('warmup')) path.push(`Warm-up: ${scale}${scaleInApply ? ` → Apply plays it over the ${style} groove on ${onChords}.` : '.'}`);
  if (has('new_skill')) path.push(`New skill: ${skill?.name ?? plan.skill_id}${sameScale || inStyle ? '.' : ' (separate from the scale).'}`);
  if (has('apply') && !scaleInApply) path.push(`Apply: ${profile ? `${style} groove` : 'strumming'} on ${onChords}.`);
  if (has('review')) { const n = plan.review.length; path.push(`Review: ${n} earlier item${n === 1 ? '' : 's'}.`); }
  if (has('create')) path.push(`Create: ${task.label} on ${onChords}.`);

  for (const k of Object.keys(blocks) as BlockKind[]) if (!has(k)) delete blocks[k];
  return { scaleInApply, path: path.slice(0, 5), blocks };
}
