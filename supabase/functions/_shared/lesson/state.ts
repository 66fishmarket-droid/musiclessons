import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TRACKS, type PlannerState, type ReviewItem, type Settings, type Skill, type SkillProgress, type StyleChoice, type Track,
} from '../engine/types.ts';

/** Mirrors the settings table's column defaults (used until the user saves settings). */
export const DEFAULT_SETTINGS: Settings = { session_minutes: 30, style_core: ['folk', 'blues', 'funk', 'soul'], vocal_low: null, vocal_high: null };

export interface LessonRowLite {
  lesson_date: string; track: string | null; skill_id: string | null; key: string | null; want_more_time: boolean | null;
  status: 'planned' | 'completed' | 'skipped'; plan: { style_element?: StyleChoice | null; create_task_id?: string | null } | null;
  confidence: number | null; notes: string | null;
}
export interface StateRows {
  settings: Settings | null; skills: Skill[]; progress: SkillProgress[]; reviews: ReviewItem[];
  /** Before today, newest first. */
  lessons: LessonRowLite[];
  /** new_skill logs with their lesson, newest first. */
  logs: { passed: boolean | null; lessons: { lesson_date: string; track: string | null } | null }[];
  questions: string[];
}

const asTrack = (t: string | null | undefined): Track | null => ((TRACKS as readonly string[]).includes(t ?? '') ? (t as Track) : null);

/** DB rows → planner input: default settings when none saved; legacy tracks outside the six (e.g. 'theory') become null. */
export function toPlannerState(rows: StateRows, today: string): PlannerState {
  return {
    today,
    settings: rows.settings ?? DEFAULT_SETTINGS,
    skills: rows.skills, progress: rows.progress, reviewItems: rows.reviews,
    recentLessons: rows.lessons.filter(l => l.lesson_date < today).map(l => {
      const track = asTrack(l.track);
      return {
        date: l.lesson_date, track, skill_id: track ? l.skill_id : null, key: l.key,
        style_element: l.plan?.style_element ?? null, want_more_time: l.want_more_time, status: l.status,
        create_task_id: l.plan?.create_task_id ?? null,
      };
    }),
    recentLogs: rows.logs.flatMap(l => {
      const track = asTrack(l.lessons?.track);
      return track && l.lessons && l.lessons.lesson_date < today ? [{ date: l.lessons.lesson_date, track, passed: l.passed }] : [];
    }),
  };
}

/** One-line summaries of the most recent lessons for the model brief. */
export function lessonSummaries(lessons: LessonRowLite[], n = 7): string[] {
  return lessons.slice(0, n).map(l => `${l.lesson_date}: ${l.skill_id ?? 'legacy lesson'} in ${l.key ?? '?'} (${l.status}` +
    `${l.confidence ? `, confidence ${l.confidence}/5` : ''}${l.want_more_time ? ', wanted more time' : ''}${l.notes ? `, notes: ${l.notes}` : ''})`);
}

/** Reads everything the planner needs for the signed-in user; RLS scopes every query to them. */
export async function fetchStateRows(db: SupabaseClient, today: string): Promise<StateRows> {
  const must = (r: { data: unknown; error: unknown }): unknown => { if (r.error) throw r.error; return r.data; };
  const [settings, skills, progress, reviews, lessons, logs, questions] = await Promise.all([
    db.from('settings').select('session_minutes, style_core, vocal_low, vocal_high').maybeSingle(),
    db.from('skills').select('id, track, level, name, description, pass_metric, default_target, allowed_keys, theory_topic_id, styles'),
    db.from('skill_progress').select('skill_id, status, score, current_target, last_seen, last_key'),
    db.from('review_items').select('item_type, ref, interval_days, next_due, last_result'),
    db.from('lessons').select('lesson_date, track, skill_id, key, want_more_time, status, plan, confidence, notes')
      .lt('lesson_date', today).order('lesson_date', { ascending: false }).limit(60),
    db.from('exercise_logs').select('passed, lessons!inner(lesson_date, track)').eq('block_kind', 'new_skill')
      .order('created_at', { ascending: false }).limit(50),
    db.from('questions').select('question').order('created_at', { ascending: false }).limit(10),
  ]);
  return {
    settings: must(settings) as Settings | null,
    skills: must(skills) as Skill[],
    progress: must(progress) as SkillProgress[],
    reviews: must(reviews) as ReviewItem[],
    lessons: must(lessons) as LessonRowLite[],
    logs: must(logs) as StateRows['logs'],
    questions: (must(questions) as { question: string }[]).map(q => q.question),
  };
}
