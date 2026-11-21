import { describe, expect, it } from 'vitest';
import { planScaleBlock } from '../../supabase/functions/_shared/engine/scaleBlock.ts';
import type { LessonSummary, PlannerState, ReviewItem } from '../../supabase/functions/_shared/engine/types.ts';

const state = (over: Partial<PlannerState> = {}): PlannerState => ({
  today: '2026-10-10', settings: { session_minutes: 30, style_core: [], vocal_low: null, vocal_high: null },
  skills: [], progress: [], reviewItems: [], recentLessons: [], recentLogs: [], ...over,
});
const scale = (ref: string, interval_days: number, next_due: string, last_result: boolean | null = true): ReviewItem =>
  ({ item_type: 'scale', ref, interval_days, next_due, last_result });
const lesson = (date: string): LessonSummary => ({ date, track: 'rhythm', skill_id: 'x', key: 'G', style_element: null, want_more_time: false, status: 'completed', create_task_id: null });

describe('planScaleBlock', () => {
  it('a new learner maps box 1 with no retrieve or connect', () => {
    const b = planScaleBlock(state(), 30);
    expect(b).toMatchObject({ map: 'minor_pent:E', map_is_new: true, retrieve: [] });
    expect(b.steps.map(s => s.kind)).toEqual(['map', 'vary', 'use']);
    expect(planScaleBlock(state(), 25).steps.map(s => s.kind)).toEqual(['map', 'use']);
  });

  it('introduces the next position once the newest has interval 7, connecting to its known neighbour', () => {
    const b = planScaleBlock(state({ reviewItems: [scale('minor_pent:E', 7, '2026-10-17')] }), 30);
    expect(b).toMatchObject({ map: 'minor_pent:D', map_is_new: true, retrieve: ['minor_pent:E'] });
    expect(b.steps.map(s => s.kind)).toEqual(['retrieve', 'map', 'vary', 'connect', 'use']);
    expect(b.steps.find(s => s.kind === 'connect')).toMatchObject({ ref: 'minor_pent:D', to: 'minor_pent:E' });
  });

  it('skips Connect when the neighbour cannot share notes in the lesson key', () => {
    const b = planScaleBlock(state({ reviewItems: [scale('minor_pent:E', 7, '2026-10-17')] }), 30, () => false);
    expect(b.steps.map(s => s.kind)).toEqual(['retrieve', 'map', 'vary', 'use']);
  });

  it('holds back a new position under interval 7 and retrieves the map position cold when it is the only one', () => {
    const b = planScaleBlock(state({ reviewItems: [scale('minor_pent:E', 3, '2026-10-10')] }), 30);
    expect(b).toMatchObject({ map: 'minor_pent:E', map_is_new: false, retrieve: ['minor_pent:E'] });
  });

  it('maps the position missed last time', () => {
    const b = planScaleBlock(state({ reviewItems: [
      scale('minor_pent:E', 7, '2026-10-12'), scale('minor_pent:D', 1, '2026-10-11', false), scale('major_pent:G', 3, '2026-10-12'),
    ] }), 30);
    expect(b.map).toBe('minor_pent:D');
  });

  it('retrieves due items first, at most two, not the map position, same plan for the same day', () => {
    const items = [
      scale('minor_pent:E', 14, '2026-10-20'), scale('minor_pent:D', 7, '2026-10-09'),
      scale('major_pent:G', 7, '2026-10-15'), scale('major_pent:E', 3, '2026-10-11'),
    ];
    const b = planScaleBlock(state({ reviewItems: items }), 30);
    expect(b.map).toBe('minor_pent:D'); // most overdue
    expect(b.retrieve).toHaveLength(2);
    expect(b.retrieve).not.toContain('minor_pent:D');
    expect(planScaleBlock(state({ reviewItems: items }), 30)).toEqual(b);
    expect(b.steps.filter(s => s.kind === 'retrieve').every(s => !!s.degree)).toBe(true);
  });

  it('puts due positions ahead of not-yet-due ones in retrieve', () => {
    const b = planScaleBlock(state({ reviewItems: [
      scale('minor_pent:E', 14, '2026-10-20'), scale('minor_pent:D', 3, '2026-10-12', false),
      scale('major_pent:G', 7, '2026-10-10'), scale('major_pent:E', 3, '2026-10-20'),
    ] }), 30);
    expect(b.map).toBe('minor_pent:D');
    expect(b.retrieve[0]).toBe('major_pent:G');
  });

  it('after a 7-day gap retrieves the longest-unseen positions first', () => {
    const b = planScaleBlock(state({ recentLessons: [lesson('2026-10-01')], reviewItems: [
      scale('minor_pent:E', 14, '2026-10-20'), // last seen 10-06
      scale('minor_pent:D', 7, '2026-10-05'),  // last seen 09-28 (map: most overdue)
      scale('major_pent:G', 14, '2026-10-14'), // last seen 09-30
      scale('major_pent:E', 3, '2026-10-08'),  // last seen 10-05 (newest, interval 3: no new position yet)
    ] }), 30);
    expect(b.map).toBe('minor_pent:D');
    expect(b.retrieve).toEqual(['major_pent:G', 'major_pent:E']);
  });

  it('retrieve targets full-scale degrees only on full positions', () => {
    const pent = planScaleBlock(state({ reviewItems: [scale('minor_pent:E', 3, '2026-10-10')] }), 30);
    expect(['b3', '5', '1']).toContain(pent.steps[0].degree);
  });
});
