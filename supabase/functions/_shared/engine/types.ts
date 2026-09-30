import type { MusicContent } from './music.ts';

export const TRACKS = ['rhythm', 'fretboard', 'fingerstyle', 'fills', 'ear_voice', 'songwriting'] as const;
export type Track = (typeof TRACKS)[number];
export type SkillTrack = Track | 'theory';
export type PassMetric = 'bpm' | 'clean_reps' | 'self';
export type SessionMinutes = 25 | 30 | 40;
export type BlockKind = 'warmup' | 'retest' | 'new_skill' | 'reset' | 'review' | 'apply' | 'create' | 'record';

export interface Skill {
  id: string; track: SkillTrack; level: 1 | 2 | 3 | 4 | 5; name: string; description: string;
  pass_metric: PassMetric; default_target: number | null; allowed_keys: string[] | null;
  theory_topic_id: string | null; styles: string[] | null;
}
export interface SkillProgress {
  skill_id: string; status: 'active' | 'mastered'; score: number; current_target: number | null;
  last_seen: string | null; last_key: string | null;
}
export interface ReviewItem {
  item_type: 'skill' | 'theory' | 'style'; ref: string; interval_days: number; next_due: string; last_result: boolean | null;
}
export interface StyleChoice { style: string; element_id: string; kind: 'rhythm' | 'progression'; is_new: boolean }
export interface LessonSummary {
  date: string; track: Track | null; skill_id: string | null; key: string | null;
  style_element: StyleChoice | null; want_more_time: boolean | null; status: 'planned' | 'completed' | 'skipped';
  create_task_id: string | null;
}
/** One logged new-skill block, newest first. */
export interface LogSummary { date: string; track: Track; passed: boolean | null }
export interface Settings { session_minutes: SessionMinutes; style_core: string[]; vocal_low: string | null; vocal_high: string | null }
export interface PlannerState {
  today: string; settings: Settings; skills: Skill[]; progress: SkillProgress[]; reviewItems: ReviewItem[];
  /** Newest first; excludes today. */
  recentLessons: LessonSummary[];
  recentLogs: LogSummary[];
}
export interface Target { metric: PassMetric; target: number | null; start: number | null }
export interface PlanItem { ref: string; target: Target | null }
export interface PlanBlock { kind: BlockKind; minutes: number; items: PlanItem[] }
export interface LessonPlan {
  date: string; template: `standard_${SessionMinutes}`; track: Track; skill_id: string; key: string; is_repeat: boolean;
  style_element: StyleChoice | null; theory_topic_id: string | null;
  retest: { skill_id: string; target: Target } | null;
  review: { item_type: ReviewItem['item_type']; ref: string }[];
  blocks: PlanBlock[]; music: MusicContent;
  pattern_id: string | null; create_task_id: string;
}
