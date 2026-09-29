import type { StyleProfile } from '../engine/styles.ts';
import type { LessonPlan, Settings, Skill } from '../engine/types.ts';
import { allowedChords } from './contract.ts';

export interface ChatMessage { role: 'system' | 'user'; content: string }
export interface PromptInput {
  plan: LessonPlan; skills: Map<string, Skill>; style: StyleProfile | null; settings: Settings;
  /** One-line summaries, newest first (capped at 7). */
  recent: string[];
  /** Recent question texts, newest first (capped at 10). */
  questions: string[];
}

/** Bump when SYSTEM_PROMPT or the brief's shape changes; stored on every lesson row. */
export const PROMPT_VERSION = 'gc-2026-09-29';

export const SYSTEM_PROMPT = `You write the text for a daily guitar practice app. The learner is a singer-songwriter who accompanies their own singing. The app's engine has already decided everything musical: the skill, key, chords, scale, rhythm, targets and block timings. You explain and coach; you never change the plan.

Return one JSON object that matches the response schema. No markdown fences, no text outside the JSON.

Rules:
1. blocks: exactly one entry per plan block, in the same order, with the same kind.
2. Chords: name only chords listed in allowed_chords, and write every chord name in braces, e.g. {Am7}. Never suggest substitutions, extensions or other chords. Do not name chords in songs.
3. Targets: never invent tempos or rep counts. target_text restates the block's plan target in plain words, or is "" when the block has none.
4. One new concept: only the new_skill block teaches something new. retest and review blocks test what was already learned.
5. instructions: 2 to 5 short imperative steps per block, about 25 words each at most. The new_skill block follows Hear, then Learn, then Play, and starts the tempo ladder at the plan's start tempo.
6. warmup: hum or lip-trill, then play and sing today's scale in one position, naming the degrees.
7. Ear and voice work stays in today's key and inside vocal_range when it is given.
8. Fills: at most one fill per 4 bars.
9. apply: today's skill over today's progression in today's style element, singing over it.
10. create: one songwriting micro-constraint in today's key using today's progression or style element. create_prompt states the whole task in one plain sentence with note and chord names, e.g. "Make up a short tune using only G, B and D while you play {G} {C} {G} {D}, one bar each." The create block's instructions are a recipe a beginner can follow without asking anything: first say what they are making in everyday words (e.g. a four-bar melody is a short tune that lasts four bars: one bar per chord, four beats per bar); then how to find it (hum it first, then find the notes on the guitar); then one tiny worked example using real note names (e.g. stay on G for the {G} bar, step up to B for {C}).
11. theory_card: 3 to 5 sentences on why today's material works, tied to theory_topic.
12. songs: exactly 3 real, well-known songs where this skill or style element can be heard. capo is the fret from 0 to 12 that brings the song closest to today's key with open shapes. If you are unsure a song fits, choose another.
13. tips: one common mistake and its fix. explanation: one or two sentences on why the block matters. Either may be "" for the reset block.
14. Address the learner as "you". Never refer to the learner as he or she.
15. Use recent_lessons and recent_questions only to avoid repeating yourself and to connect to what the learner has been asking about.
16. reset: exactly one instruction, e.g. put the guitar down for 30 seconds and listen back or picture the shape. Every block, reset included, has at least one instruction.
17. Plain words: the learner is a beginner. Explain every music term the first time it appears in a block, in the same sentence and in everyday words, e.g. "scale degrees 1, 3 and 5 (the 1st, 3rd and 5th notes of the scale: G, B and D)". Prefer note and chord names to numbers: write a progression as its chords, e.g. {G} {C} {G} {D}, never as Roman numerals like I-IV-I-V.`;

/** The fixed system prompt plus a JSON brief of today's plan for the model. */
export function buildMessages({ plan, skills, style, settings, recent, questions }: PromptInput): ChatMessage[] {
  const named = (id: string | null | undefined) => {
    const s = id ? skills.get(id) : undefined;
    return s ? { id: s.id, name: s.name, description: s.description } : null;
  };
  const chosen = plan.style_element;
  const element = style && chosen ? [...style.rhythm_patterns, ...style.progressions].find(e => e.id === chosen.element_id) : undefined;
  const brief = {
    date: plan.date, session: plan.template, track: plan.track, key: plan.key, is_repeat: plan.is_repeat,
    skill: named(plan.skill_id), theory_topic: named(plan.theory_topic_id),
    retest: plan.retest ? { skill: named(plan.retest.skill_id), target: plan.retest.target } : null,
    review: plan.review.map(r => ({ type: r.item_type, ref: r.ref, name: skills.get(r.ref)?.name ?? r.ref })),
    style: style ? {
      name: style.name, family: style.family, feel: style.feel,
      element: element && chosen ? { name: element.name, kind: chosen.kind, is_new: chosen.is_new } : null,
    } : null,
    music: {
      scale: `${plan.music.scale.tonic} ${plan.music.scale.name}`, scale_notes: plan.music.scale.notes,
      progression: plan.music.progression, rhythm: plan.music.rhythm,
    },
    allowed_chords: allowedChords(plan, skills),
    blocks: plan.blocks.map(b => ({ kind: b.kind, minutes: b.minutes, items: b.items })),
    vocal_range: settings.vocal_low && settings.vocal_high ? `${settings.vocal_low}–${settings.vocal_high}` : null,
    recent_lessons: recent.slice(0, 7),
    recent_questions: questions.slice(0, 10),
  };
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Write today's lesson for this plan:\n${JSON.stringify(brief, null, 2)}` },
  ];
}
