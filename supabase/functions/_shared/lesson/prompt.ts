import { rhythmCounts, rhythmPattern } from '../engine/patterns.ts';
import type { StyleProfile } from '../engine/styles.ts';
import type { LessonPlan, Settings, Skill } from '../engine/types.ts';
import { allowedChords, avoidNames } from './contract.ts';
import { buildSteps, stepsText, type EngineBlock } from './steps.ts';

export interface ChatMessage { role: 'system' | 'user'; content: string }
export interface PromptInput {
  plan: LessonPlan; skills: Map<string, Skill>; style: StyleProfile | null; settings: Settings;
  /** One-line summaries, newest first (capped at 7). */
  recent: string[];
  /** Recent question texts, newest first (capped at 10). */
  questions: string[];
  /** Skill ids the learner has a skill_progress row for. */
  metSkills: string[];
  /** Precomputed engine steps for `plan`; computed once here when omitted (callers that already have it, e.g.
   * service.ts, pass it through so buildSteps runs once per request instead of once per caller). */
  steps?: { blocks: EngineBlock[]; create_prompt: string };
}

/** Bump when SYSTEM_PROMPT or the brief's shape changes; stored on every lesson row. */
export const PROMPT_VERSION = 'gc-2026-10-01';

export const SYSTEM_PROMPT = `You add colour to a daily guitar lesson. The learner is a beginner singer-songwriter who accompanies their own singing. The app's engine has already written every instruction the learner follows; they are in the brief as \`steps\` and are fixed: do not restate or contradict them, add steps, or give tempos or rep counts.

Return one JSON object that matches the response schema. No markdown fences, no text outside the JSON.

Rules:
1. blocks: exactly one entry per plan block, in the same order, with the same kind. \`more\` is 2 to 4 sentences, at most 400 characters: a common mistake and its fix, why this works, or a link to something the learner met before. "" for the reset block.
2. Chords: name only chords listed in allowed_chords, written in braces, e.g. {Am7}. Do not name chords in songs.
3. Skills: name only skills in met_skills or words already used in steps. Never mention fills, licks or techniques the learner has not met, and never use any phrase in avoid_names.
4. Plain words: explain any music term in the same sentence, in everyday words. Write progressions as chord names, never Roman numerals.
5. theory_card: 3 to 5 sentences on why today's material works, tied to theory_topic.
6. songs: exactly 3 real, well-known songs where today's skill or style element can be heard. capo is the fret from 0 to 12 that brings the song closest to today's key with open shapes. If unsure a song fits, choose another.
7. Address the learner as "you". Never refer to the learner as he or she.
8. Use recent_lessons and recent_questions only to avoid repeating yourself and to connect to what the learner has been asking about.`;

/** The fixed system prompt plus a JSON brief of today's plan for the model. */
export function buildMessages({ plan, skills, style, settings, recent, questions, metSkills, steps }: PromptInput): ChatMessage[] {
  const engineSteps = steps ?? buildSteps(plan, skills);
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
      rhythm_counts: plan.music.rhythm ? rhythmCounts(rhythmPattern(plan.music.rhythm.name, plan.music.rhythm.grid)) : null,
    },
    allowed_chords: allowedChords(plan, skills),
    blocks: plan.blocks.map(b => ({ kind: b.kind, minutes: b.minutes, items: b.items })),
    steps: engineSteps.blocks.map(b => ({ kind: b.kind, instructions: b.instructions, listen_for: b.listen_for })),
    met_skills: [...new Set([plan.skill_id, plan.retest?.skill_id, ...metSkills].filter(Boolean))].map(id => skills.get(id!)?.name ?? id!),
    avoid_names: avoidNames(plan, skills, metSkills, stepsText(engineSteps)),
    vocal_range: settings.vocal_low && settings.vocal_high ? `${settings.vocal_low}–${settings.vocal_high}` : null,
    recent_lessons: recent.slice(0, 7),
    recent_questions: questions.slice(0, 10),
  };
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Add colour to today's lesson. Plan and fixed steps:\n${JSON.stringify(brief, null, 2)}` },
  ];
}
