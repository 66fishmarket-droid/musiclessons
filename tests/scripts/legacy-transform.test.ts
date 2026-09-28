import { describe, expect, it } from 'vitest';
import { SUBFOCUS_MAP, newReport, normalize, transformLessons, transformProgress } from '../../scripts/legacy/transform.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';

const lessonRow = (over: Record<string, string>) => ({
  Date: '2025-08-22T10:49:49.360Z', DayNumber: '1', FocusArea: 'Theory', SubFocus: 'Circle of Fifths', Key: 'D',
  Title: 'Mastering D', Concept: 'c', Exercise: 'e', WhyItMatters: 'w', JamPrompt: 'Loop G–C–D', Status: 'Completed',
  Feedback_NeedReinforce: 'No', Feedback_Confidence: '4', Feedback_Notes: '', Model: 'gpt4.o', PromptVersion: 'v1.0',
  GeneratedAt: '2025-08-22T10:50:06.119Z', LessonUID: '2025-08-22-1-Theory-D', ...over,
});

describe('SUBFOCUS_MAP', () => {
  it('maps only to real skills', () => {
    const ids = new Set(SKILLS.map(s => s.id));
    for (const [k, v] of Object.entries(SUBFOCUS_MAP)) expect(ids.has(v), `${k} → ${v}`).toBe(true);
  });
  it('normalises case, dashes and punctuation', () => {
    expect(normalize('  I–V–vi–IV ')).toBe('i-v-vi-iv');
    expect(SUBFOCUS_MAP[`${normalize('CAGED')}|${normalize('Shapes Overview')}`]).toBe('fretboard.l2.caged_linked');
  });
});

describe('transformLessons', () => {
  it('maps a clean row', () => {
    const report = newReport();
    const [row] = transformLessons([lessonRow({})], [], report);
    expect(row).toMatchObject({
      lesson_date: '2025-08-22', template: 'legacy', track: 'theory', skill_id: 'theory.l1.circle_of_fifths', key: 'D',
      status: 'completed', confidence: 4, want_more_time: false, llm_model: 'gpt-4.1', prompt_version: 'v1.0', source: 'legacy',
    });
    expect(row.content.legacy.Title).toBe('Mastering D');
  });
  it('repairs the shifted columns', () => {
    const report = newReport();
    const [row] = transformLessons([lessonRow({ JamPrompt: 'Completed', Feedback_NeedReinforce: '4', Feedback_Confidence: '' })], [], report);
    expect(row.confidence).toBe(4);
    expect(row.want_more_time).toBeNull();
    expect(row.content.legacy.JamPrompt).toBeNull();
    expect(report.repaired).toEqual(['2025-08-22: JamPrompt held a status', '2025-08-22: confidence was in NeedReinforce']);
  });
  it('keeps the later of two lessons on one date and reports the other', () => {
    const report = newReport();
    const rows = transformLessons([
      lessonRow({ Date: '2025-08-26', Title: 'first', GeneratedAt: '2025-08-26T07:00:00Z' }),
      lessonRow({ Date: '2025-08-26', Title: 'second', GeneratedAt: '2025-08-26T09:00:00Z' }),
    ], [], report);
    expect(rows.map(r => r.content.legacy.Title)).toEqual(['second']);
    expect(report.duplicatesDropped).toEqual(['2025-08-26: first']);
  });
  it('skips unparseable dates and reports unmapped subfocuses without guessing', () => {
    const report = newReport();
    const rows = transformLessons([lessonRow({ Date: 'yesterday' }), lessonRow({ SubFocus: 'Kazoo technique' })], [], report);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ skill_id: null, track: null });
    expect(report.unparseable).toEqual(['row 2: date "yesterday"']);
    expect(report.unmappedSubfocus).toEqual(['Theory|Kazoo technique']);
  });
  it('fills missing feedback from the Feedback tab by UID, then by unique date', () => {
    const report = newReport();
    const fb = [
      { Timestamp: '2025-08-22', 'Did you complete today’s lesson? ': 'Yes', '  Do you want more time on today’s concept tomorrow?  ': 'Yes',
        '  How confident do you feel now? (1=Low, 5=High)  ': '2', '  Any notes or specifics to work on?  ': 'shaky', LessonUID: '' },
    ];
    const [row] = transformLessons([lessonRow({ Feedback_Confidence: '', Feedback_NeedReinforce: '', LessonUID: '' })], fb, report);
    expect(row).toMatchObject({ confidence: 2, want_more_time: true, notes: 'shaky' });
    expect(report.feedbackFilled).toBe(1);
  });
  it('treats Delivered as skipped', () => {
    const [row] = transformLessons([lessonRow({ Status: 'Delivered' })], [], newReport());
    expect(row.status).toBe('skipped');
  });
});

describe('transformProgress', () => {
  it('takes the highest tier per mapped skill; tier ≥ 3 is mastered and enters review', () => {
    const report = newReport();
    const { progress, reviews } = transformProgress([
      { Focus: 'CAGED', Subfocus: 'Shapes overview', Tier: '2', Score: '1', LastSeen: '2026-01-10' },
      { Focus: 'CAGED', Subfocus: 'Linking shapes', Tier: '3', Score: '0', LastSeen: '2026-02-01' },
      { Focus: 'Theory', Subfocus: 'Intervals', Tier: '1', Score: '2', LastSeen: '' },
      { Focus: 'Mystery', Subfocus: 'Thing', Tier: '5', Score: '0', LastSeen: '' },
    ], report, '2026-09-28');
    expect(progress).toEqual([
      { skill_id: 'fretboard.l2.caged_linked', status: 'mastered', score: 0, current_target: null, last_seen: '2026-02-01', last_key: null },
      { skill_id: 'theory.l1.intervals', status: 'active', score: 0, current_target: null, last_seen: null, last_key: null },
    ]);
    expect(reviews).toEqual([{ item_type: 'skill', ref: 'fretboard.l2.caged_linked', interval_days: 7, next_due: '2026-09-29' }]);
    expect(report.unmappedSubfocus).toEqual(['Mystery|Thing']);
    expect(report.mastered).toBe(1);
  });
});
