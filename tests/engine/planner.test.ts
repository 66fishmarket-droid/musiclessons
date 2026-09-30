import { describe, expect, it } from 'vitest';
import { CREATE_TASKS } from '../../supabase/functions/_shared/engine/create.ts';
import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import { elementsOf, type StyleCatalog, type StyleProfile } from '../../supabase/functions/_shared/engine/styles.ts';
import type { LessonSummary, PlannerState, Skill, StyleChoice } from '../../supabase/functions/_shared/engine/types.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';
import { newUserState, NO_STYLES } from '../lesson/fixtures.ts';

const sk = (id: string, metric: Skill['pass_metric'], target: number | null, extra: Partial<Skill> = {}): Skill => {
  const [track, lvl] = id.split('.');
  return { id, track: track as Skill['track'], level: Number(lvl.slice(1)) as Skill['level'], name: id, description: id,
    pass_metric: metric, default_target: target, allowed_keys: null, theory_topic_id: null, styles: null, ...extra };
};
const skills: Skill[] = [
  sk('rhythm.l1.a', 'bpm', 70), sk('rhythm.l1.b', 'bpm', 70, { styles: ['funk'] }), sk('rhythm.l2.a', 'bpm', 75),
  sk('fretboard.l1.a', 'clean_reps', 3, { theory_topic_id: 'theory.l2.a' }),
  sk('fingerstyle.l1.a', 'bpm', 60, { allowed_keys: ['C', 'G', 'D', 'A', 'E'] }),
  sk('fills.l1.a', 'bpm', 70), sk('ear_voice.l1.a', 'self', null), sk('songwriting.l1.a', 'self', null),
  sk('theory.l1.a', 'self', null), sk('theory.l2.a', 'self', null),
];
const profile = (id: string, verified = true): StyleProfile => ({
  id, name: id, family: id, feel: { subdivision: '8ths', meter: '4/4', tempo_range: [60, 120], accents: '', swing_ratio: null, clave: null },
  rhythm_patterns: [
    { id: `${id}.p1`, name: 'p1', grid: 'D-D-D-D-D-D-D-D-'.split(''), accents: [], verified, note: null },
    { id: `${id}.p2`, name: 'p2', grid: 'D-DU-UD-D-DU-UD-'.split(''), accents: [], verified, note: null },
  ],
  progressions: [{ id: `${id}.prog_a`, name: 'a', roman: ['I', 'IV', 'V', 'I'], bars: 4, verified }],
  chord_colours: [], forms: [], fill_vocabulary: [], scales: ['major'], keys_common: [], tunings: [],
  lyric_traits: [], reference_tracks: [], transplant_levers: [], ladder: [],
});
const catalogOf = (...ps: StyleProfile[]): StyleCatalog => ({ profiles: ps, elements: ps.flatMap(elementsOf) });
const catalog = catalogOf(profile('folk'), profile('funk'));
const state = (over: Partial<PlannerState> = {}): PlannerState => ({
  today: '2026-10-10', settings: { session_minutes: 30, style_core: ['folk'], vocal_low: null, vocal_high: null },
  skills, progress: [], reviewItems: [], recentLessons: [], recentLogs: [], ...over,
});
const lesson = (date: string, track: LessonSummary['track'], skill_id: string, key: string, over: Partial<LessonSummary> = {}): LessonSummary =>
  ({ date, track, skill_id, key, style_element: null, want_more_time: false, status: 'completed', create_task_id: null, ...over });
const style = (s: string, el: string, is_new = false): StyleChoice => ({ style: s, element_id: el, kind: 'rhythm', is_new });

describe('planLesson', () => {
  it('plans a complete lesson for a brand-new user', () => {
    const plan = planLesson(state(), catalog);
    expect(plan).toMatchObject({
      date: '2026-10-10', template: 'standard_30', track: 'rhythm', skill_id: 'rhythm.l1.a', key: 'G', is_repeat: false,
      style_element: { style: 'folk', element_id: 'folk.p1', kind: 'rhythm', is_new: true },
      theory_topic_id: 'theory.l1.a', retest: null, review: [],
    });
    expect(plan.blocks.map(b => b.kind)).toEqual(['warmup', 'new_skill', 'reset', 'apply', 'create', 'record']);
    expect(plan.blocks.reduce((t, b) => t + b.minutes, 0)).toBe(30);
    expect(plan.blocks[1].items).toEqual([{ ref: 'skill:rhythm.l1.a', target: { metric: 'bpm', target: 70, start: 46 } }]);
    expect(plan.music.progression.chords).toEqual(['G', 'C', 'D', 'G']);
    expect(plan.music.rhythm?.name).toBe('p1');
  });

  it('skips yesterday\'s track and picks the stalest one', () => {
    const plan = planLesson(state({ recentLessons: [
      lesson('2026-10-09', 'rhythm', 'rhythm.l1.a', 'G'), lesson('2026-10-05', 'fretboard', 'fretboard.l1.a', 'D'),
    ] }), catalog);
    expect(plan.track).toBe('fingerstyle');
    expect(plan.key).toBe('G');
  });

  it('weights staleness by recent failures', () => {
    const plan = planLesson(state({
      recentLessons: [lesson('2026-10-09', 'fills', 'fills.l1.a', 'G'),
        ...['rhythm', 'fretboard', 'fingerstyle', 'ear_voice', 'songwriting'].map(t => lesson('2026-10-06', t as never, `${t}.l1.a`, 'G'))],
      recentLogs: [{ date: '2026-10-06', track: 'ear_voice', passed: false }, { date: '2026-10-06', track: 'rhythm', passed: true }],
    }), catalog);
    expect(plan.track).toBe('ear_voice');
  });

  it('continues the key rotation from the track\'s last key and honours allowed keys', () => {
    const recentLessons = [lesson('2026-10-09', 'fills', 'fills.l1.a', 'G'), lesson('2026-10-01', 'rhythm', 'rhythm.l1.a', 'D')];
    const others = ['fretboard', 'fingerstyle', 'ear_voice', 'songwriting'].map(t => lesson('2026-10-08', t as never, `${t}.l1.a`, 'G'));
    expect(planLesson(state({ recentLessons: [...recentLessons, ...others] }), catalog).key).toBe('A');
    const finger = planLesson(state({ recentLessons: [lesson('2026-10-09', 'rhythm', 'rhythm.l1.a', 'G'),
      lesson('2026-10-01', 'fingerstyle', 'fingerstyle.l1.a', 'E'),
      ...['fretboard', 'fills', 'ear_voice', 'songwriting'].map(t => lesson('2026-10-08', t as never, `${t}.l1.a`, 'G'))] }), catalog);
    expect(finger).toMatchObject({ track: 'fingerstyle', key: 'C' });
  });

  it('repeats yesterday exactly when more time was requested', () => {
    const y = lesson('2026-10-09', 'fretboard', 'fretboard.l1.a', 'Eb', { want_more_time: true, style_element: style('funk', 'funk.p2', true) });
    const plan = planLesson(state({ recentLessons: [y] }), catalog);
    expect(plan).toMatchObject({ is_repeat: true, track: 'fretboard', skill_id: 'fretboard.l1.a', key: 'Eb', retest: null,
      style_element: { style: 'funk', element_id: 'funk.p2', is_new: false } });
  });

  it('retests yesterday\'s completed skill at its current target', () => {
    const plan = planLesson(state({
      recentLessons: [lesson('2026-10-09', 'fills', 'fills.l1.a', 'G')],
      progress: [{ skill_id: 'fills.l1.a', status: 'active', score: 1, current_target: 75, last_seen: '2026-10-09', last_key: 'G' }],
    }), catalog);
    expect(plan.retest).toEqual({ skill_id: 'fills.l1.a', target: { metric: 'bpm', target: 75, start: 49 } });
    expect(plan.blocks.find(b => b.kind === 'retest')!.items[0].ref).toBe('skill:fills.l1.a');
  });

  it('moves up a level once a level is mastered', () => {
    const m = (id: string) => ({ skill_id: id, status: 'mastered' as const, score: 0, current_target: 80, last_seen: '2026-09-01', last_key: 'G' });
    const plan = planLesson(state({ progress: [m('rhythm.l1.a'), m('rhythm.l1.b')] }), catalog);
    expect(plan.skill_id).toBe('rhythm.l2.a');
  });

  it('prefers skills tagged with today\'s style', () => {
    const plan = planLesson(state({ settings: { session_minutes: 30, style_core: ['funk'], vocal_low: null, vocal_high: null } }), catalog);
    expect(plan.style_element?.style).toBe('funk');
    expect(plan.skill_id).toBe('rhythm.l1.b');
  });

  it('introduces a new style element at most every other session', () => {
    const plan = planLesson(state({ recentLessons: [
      lesson('2026-10-09', 'fills', 'fills.l1.a', 'G', { style_element: style('folk', 'folk.p1', true) }),
      lesson('2026-10-05', 'fretboard', 'fretboard.l1.a', 'G', { style_element: style('funk', 'funk.p1', true) }),
    ] }), catalog);
    expect(plan.style_element).toEqual({ style: 'funk', element_id: 'funk.p1', kind: 'rhythm', is_new: false });
  });

  it('reviews due items oldest first, max three, never from today\'s track or today\'s theory card', () => {
    const due = (item_type: 'skill' | 'theory' | 'style', ref: string, next_due: string) => ({ item_type, ref, interval_days: 3, next_due, last_result: true });
    const plan = planLesson(state({ reviewItems: [
      due('skill', 'rhythm.l1.b', '2026-10-01'),      // today's track → excluded
      due('theory', 'theory.l1.a', '2026-10-01'),     // today's theory card → excluded
      due('style', 'folk.p1', '2026-10-02'), due('theory', 'theory.l2.a', '2026-10-03'), due('skill', 'fills.l1.a', '2026-10-08'),
      due('skill', 'fingerstyle.l1.a', '2026-10-09'), // due, but beyond the max of three
      due('skill', 'songwriting.l1.a', '2026-10-11'), // not due yet
    ] }), catalog);
    expect(plan).toMatchObject({ track: 'rhythm', theory_topic_id: 'theory.l1.a' });
    expect(plan.style_element).toMatchObject({ element_id: 'folk.p2', is_new: true }); // folk.p1 already seen via review
    expect(plan.review).toEqual([
      { item_type: 'style', ref: 'folk.p1' }, { item_type: 'theory', ref: 'theory.l2.a' }, { item_type: 'skill', ref: 'fills.l1.a' },
    ]);
  });

  it('uses the skill\'s theory topic when it has one', () => {
    const plan = planLesson(state({ recentLessons: [lesson('2026-10-09', 'rhythm', 'rhythm.l1.a', 'G')] }), catalog);
    expect(plan).toMatchObject({ track: 'fretboard', theory_topic_id: 'theory.l2.a' });
  });

  it('still plans when no style element is verified', () => {
    const plan = planLesson(state(), catalogOf(profile('folk', false)));
    expect(plan.style_element).toBeNull();
    expect(plan.music.progression.roman).toEqual(['I', 'IV', 'V', 'I']);
  });

  it('is deterministic', () => {
    expect(planLesson(state(), catalog)).toEqual(planLesson(state(), catalog));
  });
});

describe('pattern and create task', () => {
  const pinch = 'fingerstyle.l1.pima_pinches';
  const seen = (n: number) => Array.from({ length: n }, (_, i) => ({
    date: `2026-10-0${i + 1}`, track: 'fingerstyle' as const, skill_id: pinch, key: 'G', style_element: null,
    want_more_time: null, status: 'completed' as const, create_task_id: null,
  }));
  const planFor = (n: number) => {
    const skills = SKILLS.filter(s => s.id === pinch);
    return planLesson(newUserState({ today: '2026-10-09', skills, recentLessons: seen(n) }), NO_STYLES);
  };
  it('starts on the first pattern and rotates each time the skill comes back', () => {
    expect(planFor(0).pattern_id).toBe('pinch');
    expect(planFor(1).pattern_id).toBe('giuliani_pima');
    expect(planFor(2).pattern_id).toBe('pinch');
  });
  it('keeps yesterday\'s pattern on a repeat day instead of advancing', () => {
    const skills = SKILLS.filter(s => s.id === pinch);
    const yesterday = [{
      date: '2026-10-08', track: 'fingerstyle' as const, skill_id: pinch, key: 'G', style_element: null,
      want_more_time: true, status: 'completed' as const, create_task_id: null,
    }];
    const plan = planLesson(newUserState({ today: '2026-10-09', skills, recentLessons: yesterday }), NO_STYLES);
    expect(plan.is_repeat).toBe(true);
    expect(plan.pattern_id).toBe('pinch');
  });
  it('has no pattern for a skill without a pattern card', () => {
    expect(planLesson(newUserState(), NO_STYLES).pattern_id).toBeNull();
  });
  it('always picks a known Create task', () => {
    expect(CREATE_TASKS.map(t => t.id)).toContain(planLesson(newUserState(), NO_STYLES).create_task_id);
  });
});
