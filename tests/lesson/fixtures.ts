import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import type { StyleCatalog } from '../../supabase/functions/_shared/engine/styles.ts';
import type { LessonPlan, PlannerState, Skill } from '../../supabase/functions/_shared/engine/types.ts';
import type { LessonContent } from '../../supabase/functions/_shared/lesson/contract.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';

export const SKILL_MAP = new Map<string, Skill>(SKILLS.map(s => [s.id, s]));
export const NO_STYLES: StyleCatalog = { profiles: [], elements: [] };
export const newUserState = (over: Partial<PlannerState> = {}): PlannerState => ({
  today: '2026-10-10', settings: { session_minutes: 30, style_core: ['folk'], vocal_low: null, vocal_high: null },
  skills: SKILLS, progress: [], reviewItems: [], recentLessons: [], recentLogs: [], ...over,
});
/** Brand-new user, no styles: rhythm in G over I–IV–V–I, blocks warmup/new_skill/reset/apply/create/record. */
export const PLAN: LessonPlan = planLesson(newUserState(), NO_STYLES);

/** Minimal content that passes validateLesson for `plan`. */
export function validContent(plan: LessonPlan = PLAN): LessonContent {
  return {
    title: `Accents in ${plan.key}`, why_it_matters: 'Accents make a strum sound like a song.', theory_card: 'Keys relate by fifths.',
    create_prompt: `Write two lines over {${plan.music.progression.chords[0]}}.`,
    songs: [1, 2, 3].map(i => ({ title: `Song ${i}`, artist: 'Artist', why: 'Steady strumming.', capo: 0 })),
    blocks: plan.blocks.map(b => ({ kind: b.kind, instructions: [`Do the ${b.kind} block.`], target_text: '', tips: '', explanation: '' })),
  };
}
