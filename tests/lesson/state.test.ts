import { describe, expect, it } from 'vitest';
import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import { TRACKS } from '../../supabase/functions/_shared/engine/types.ts';
import {
  DEFAULT_SETTINGS, lessonSummaries, toPlannerState, type LessonRowLite, type StateRows,
} from '../../supabase/functions/_shared/lesson/state.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';

const rows = (over: Partial<StateRows> = {}): StateRows =>
  ({ settings: null, skills: SKILLS, progress: [], reviews: [], lessons: [], logs: [], questions: [], ...over });
const lesson = (lesson_date: string, track: string | null, over: Partial<LessonRowLite> = {}): LessonRowLite => ({
  lesson_date, track, skill_id: track ? `${track}.x` : null, key: 'G', want_more_time: false, status: 'completed',
  plan: {}, confidence: 4, notes: null, ...over,
});

describe('toPlannerState', () => {
  it('uses the DB default settings when no row is saved', () => {
    expect(toPlannerState(rows(), '2026-10-10').settings).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ session_minutes: 30, style_core: ['folk', 'blues', 'funk', 'soul'], vocal_low: null, vocal_high: null });
  });
  it('drops lessons from today on, nulls tracks outside the six, and reads the style element from the plan', () => {
    const s = toPlannerState(rows({ lessons: [
      lesson('2026-10-10', 'rhythm'),
      lesson('2026-10-09', 'theory', { skill_id: 'theory.l1.intervals' }),
      lesson('2026-10-08', 'fills', { plan: { style_element: { style: 'folk', element_id: 'folk.boom_chick', kind: 'rhythm', is_new: true } } }),
    ] }), '2026-10-10');
    expect(s.recentLessons.map(l => [l.date, l.track, l.skill_id])).toEqual([['2026-10-09', null, null], ['2026-10-08', 'fills', 'fills.x']]);
    expect(s.recentLessons[1].style_element?.element_id).toBe('folk.boom_chick');
    expect(s.recentLessons[0].style_element).toBeNull();
  });
  it('keeps new-skill logs only for the six tracks and before today', () => {
    const s = toPlannerState(rows({ logs: [
      { passed: true, lessons: { lesson_date: '2026-10-10', track: 'rhythm' } },
      { passed: false, lessons: { lesson_date: '2026-10-09', track: 'ear_voice' } },
      { passed: true, lessons: { lesson_date: '2026-10-08', track: 'theory' } },
      { passed: true, lessons: null },
    ] }), '2026-10-10');
    expect(s.recentLogs).toEqual([{ date: '2026-10-09', track: 'ear_voice', passed: false }]);
  });
  it('plans a valid lesson for a legacy-only account with no settings row', () => {
    const s = toPlannerState(rows({ lessons: [
      lesson('2026-10-09', 'theory', { skill_id: 'theory.l1.intervals', want_more_time: true }),
      lesson('2026-02-23', null, { status: 'skipped' }),
    ] }), '2026-10-10');
    const plan = planLesson(s);
    expect(plan.is_repeat).toBe(false);
    expect(TRACKS).toContain(plan.track);
  });
});

describe('lessonSummaries', () => {
  it('writes one line per lesson, newest first, capped', () => {
    const ls = [lesson('2026-10-09', 'rhythm', { notes: 'shaky', confidence: 3, want_more_time: true }), lesson('2026-10-08', null, { confidence: null })];
    expect(lessonSummaries(ls)).toEqual([
      '2026-10-09: rhythm.x in G (completed, confidence 3/5, wanted more time, notes: shaky)',
      '2026-10-08: legacy lesson in G (completed)',
    ]);
    expect(lessonSummaries(ls, 1)).toHaveLength(1);
  });
});
