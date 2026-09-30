import { STYLE_CATALOG } from '../engine/styles.ts';
import type { LessonPlan, Skill } from '../engine/types.ts';
import type { Colour, LessonContent } from './contract.ts';
import { buildSteps } from './steps.ts';

export { targetText } from './steps.ts';

/** Templated colour from engine data, served when every model fails (spec §11). */
export function fallbackColour(plan: LessonPlan, skills: Map<string, Skill>): Colour {
  const skill = skills.get(plan.skill_id);
  const topic = plan.theory_topic_id ? skills.get(plan.theory_topic_id) : undefined;
  const style = plan.style_element ? STYLE_CATALOG.profiles.find(p => p.id === plan.style_element!.style) : undefined;
  return {
    title: `${skill?.name ?? plan.skill_id} in ${plan.key}`,
    why_it_matters: skill?.description ?? plan.skill_id,
    theory_card: topic ? `${topic.name}: ${topic.description}` : (skill?.description ?? plan.skill_id),
    songs: (style?.reference_tracks ?? []).slice(0, 3).map(t => ({ title: t.title, artist: t.artist, why: t.why, capo: 0 })),
    blocks: plan.blocks.map(b => ({ kind: b.kind, more: '' })),
  };
}

/** The stored lesson: the engine's steps for every block, plus the model's (or the fallback's) colour. */
export function assembleLesson(plan: LessonPlan, skills: Map<string, Skill>, colour: Colour, fallback = false): LessonContent {
  const { blocks, create_prompt } = buildSteps(plan, skills);
  return {
    title: colour.title, why_it_matters: colour.why_it_matters, theory_card: colour.theory_card, songs: colour.songs, create_prompt,
    blocks: blocks.map((b, i) => ({ ...b, more: colour.blocks[i]?.more ?? '' })),
    ...(fallback ? { fallback: true as const } : {}),
  };
}
