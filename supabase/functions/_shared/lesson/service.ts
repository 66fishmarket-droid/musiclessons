import type { SupabaseClient } from '@supabase/supabase-js';
import { planLesson } from '../engine/planner.ts';
import { STYLE_CATALOG } from '../engine/styles.ts';
import type { Skill } from '../engine/types.ts';
import { writeLesson } from './generate.ts';
import type { Complete } from './llm.ts';
import { PROMPT_VERSION, buildMessages } from './prompt.ts';
import { fetchStateRows, lessonSummaries, toPlannerState } from './state.ts';
import { buildSteps } from './steps.ts';

/** A bad request from the client (HTTP 400). */
export class InputError extends Error {}

/** Validates the client's local date: a real YYYY-MM-DD within one day of the server's UTC date. */
export function checkDate(date: unknown, now: Date): string {
  const real = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date))
    && new Date(date).toISOString().slice(0, 10) === date;
  if (!real) throw new InputError(`date must be YYYY-MM-DD, got ${JSON.stringify(date)}`);
  if (Math.abs(Date.parse(date as string) - Date.parse(now.toISOString().slice(0, 10))) > 86_400_000) {
    throw new InputError(`date ${date} is more than a day from today`);
  }
  return date as string;
}

export interface LessonRecord {
  id: string; lesson_date: string; status: string; template: string; track: string | null; skill_id: string | null;
  key: string | null; plan: unknown; content: unknown; llm_model: string | null; prompt_version: string | null;
}
const COLUMNS = 'id, lesson_date, status, template, track, skill_id, key, plan, content, llm_model, prompt_version';

/** Today's lesson for the signed-in user: the existing row, or plan → model text (with fallback) → insert. Races converge on one row. */
export async function getOrCreateLesson(
  db: SupabaseClient, date: string, complete: Complete, models: (string | undefined)[],
): Promise<LessonRecord> {
  const existing = async (): Promise<LessonRecord | null> => {
    const { data, error } = await db.from('lessons').select(COLUMNS).eq('lesson_date', date).maybeSingle();
    if (error) throw error;
    return data as LessonRecord | null;
  };
  const found = await existing();
  if (found) return found;

  const rows = await fetchStateRows(db, date);
  const state = toPlannerState(rows, date);
  const plan = planLesson(state);
  const skills = new Map<string, Skill>(rows.skills.map(s => [s.id, s]));
  const style = plan.style_element ? STYLE_CATALOG.profiles.find(p => p.id === plan.style_element!.style) ?? null : null;
  const metSkills = rows.progress.map(p => p.skill_id);
  const steps = buildSteps(plan, skills); // computed once per request; shared by the prompt brief and writeLesson/assembleLesson
  const messages = buildMessages({ plan, skills, style, settings: state.settings, recent: lessonSummaries(rows.lessons), questions: rows.questions, metSkills, steps });
  // ponytail: two simultaneous first-opens both pay for a model call; the unique key keeps one row. Add a claim row if cost matters.
  const written = await writeLesson(messages, plan, skills, complete, models, metSkills, steps);

  const { data, error } = await db.from('lessons').insert({
    lesson_date: date, template: plan.template, track: plan.track, skill_id: plan.skill_id, key: plan.key,
    style_element: plan.style_element?.element_id ?? null, plan,
    content: { ...written.content, generation: written.attempts },
    llm_model: written.llm_model, prompt_version: PROMPT_VERSION,
  }).select(COLUMNS).single();
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const winner = await existing();
      if (winner) return winner;
    }
    throw error;
  }
  return data as LessonRecord;
}
