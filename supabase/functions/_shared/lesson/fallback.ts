import { STYLE_CATALOG } from '../engine/styles.ts';
import type { BlockKind, LessonPlan, PlanBlock, Skill } from '../engine/types.ts';
import type { BlockContent, LessonContent } from './contract.ts';
import { targetText } from './steps.ts';

export { targetText } from './steps.ts';

const braced = (chords: string[]) => chords.map(c => `{${c}}`).join(' ');

function refName(ref: string, skills: Map<string, Skill>): string {
  const i = ref.indexOf(':');
  const [type, id] = [ref.slice(0, i), ref.slice(i + 1)];
  if (type === 'style') return STYLE_CATALOG.elements.find(e => e.id === id)?.name ?? id;
  return skills.get(id)?.name ?? id;
}

/** Plan-only lesson from engine data and templated text, served when every model fails (spec §11). */
export function fallbackLesson(plan: LessonPlan, skills: Map<string, Skill>): LessonContent {
  const skill = skills.get(plan.skill_id);
  const topic = plan.theory_topic_id ? skills.get(plan.theory_topic_id) : undefined;
  const { music } = plan;
  const chords = braced(music.progression.chords);
  const style = plan.style_element ? STYLE_CATALOG.profiles.find(p => p.id === plan.style_element!.style) : undefined;
  const text: Record<BlockKind, (b: PlanBlock) => string[]> = {
    warmup: () => ['Hum or lip-trill for 30 seconds to wake your voice up.',
      `Play the ${music.key} ${music.scale.name} scale in one position, singing each note and naming its degree.`],
    retest: () => [`Cold retest: ${skills.get(plan.retest?.skill_id ?? '')?.name ?? 'yesterday\'s skill'}, one attempt, no practice run.`],
    new_skill: () => [skill?.description ?? plan.skill_id, 'Loop it slowly. If you miss twice in a row, drop 5 bpm or simplify, then build back up.'],
    reset: () => ['Put the guitar down for 30 seconds. Listen back or picture the shape.'],
    review: b => b.items.map(i => `Review: ${refName(i.ref, skills)}.`),
    apply: () => [`Play ${chords} (${music.progression.roman.join(' ')})${music.rhythm ? ` with the ${music.rhythm.name} pattern` : ''} and sing over it.`],
    create: () => [`Write two lines of lyric or melody over ${chords} in ${music.key}.`],
    record: () => ['Record one take of today\'s skill, listen back, rate it 1–5 and note one thing to fix tomorrow.'],
  };
  const blocks: BlockContent[] = plan.blocks.map(b => ({
    kind: b.kind, instructions: text[b.kind](b), target_text: targetText(b.items[0]?.target ?? null), tips: '', explanation: '',
  }));
  return {
    title: `${skill?.name ?? plan.skill_id} in ${plan.key}`,
    why_it_matters: skill?.description ?? plan.skill_id,
    theory_card: topic ? `${topic.name}: ${topic.description}` : (skill?.description ?? plan.skill_id),
    songs: (style?.reference_tracks ?? []).slice(0, 3).map(t => ({ title: t.title, artist: t.artist, why: t.why, capo: 0 })),
    create_prompt: `Write two lines over ${chords} in ${plan.key}.`,
    blocks,
    fallback: true,
  };
}
