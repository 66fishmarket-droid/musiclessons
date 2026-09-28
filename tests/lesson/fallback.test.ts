import { describe, expect, it } from 'vitest';
import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import { STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';
import { validateLesson } from '../../supabase/functions/_shared/lesson/contract.ts';
import { fallbackLesson, targetText } from '../../supabase/functions/_shared/lesson/fallback.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';
import { PLAN, SKILL_MAP, newUserState } from './fixtures.ts';

describe('targetText', () => {
  it.each([
    [{ metric: 'bpm', target: 70, start: 46 }, 'Start at 46 bpm, reach 70 bpm cleanly.'],
    [{ metric: 'clean_reps', target: 3, start: null }, '3 clean reps in a row.'],
    [{ metric: 'self', target: null, start: null }, 'Rate yourself honestly, 1–5.'],
    [null, ''],
  ] as const)('%j → %s', (t, want) => expect(targetText(t)).toBe(want));
});

describe('fallbackLesson', () => {
  it('builds a valid plan-only lesson from engine data', () => {
    const c = fallbackLesson(PLAN, SKILL_MAP);
    expect(c.fallback).toBe(true);
    expect(c.title).toBe(`${SKILL_MAP.get(PLAN.skill_id)!.name} in G`);
    expect(c.blocks.map(b => b.kind)).toEqual(PLAN.blocks.map(b => b.kind));
    expect(c.blocks.find(b => b.kind === 'apply')!.instructions[0]).toContain('{G} {C} {D} {G}');
    expect(c.blocks.find(b => b.kind === 'new_skill')!.target_text).toBe('Start at 46 bpm, reach 70 bpm cleanly.');
    const { fallback: _flag, ...rest } = c;
    expect(validateLesson(rest, PLAN, SKILL_MAP, { minSongs: 0 })).toMatchObject({ ok: true });
  });
  it('is valid for every non-theory skill, including ones whose text names chords', () => {
    const base = planLesson(newUserState(), STYLE_CATALOG);
    for (const s of SKILLS.filter(x => x.track !== 'theory')) {
      const plan = { ...base, skill_id: s.id, track: s.track as typeof base.track };
      const { fallback: _f, ...c } = fallbackLesson(plan, SKILL_MAP);
      expect(validateLesson(c, plan, SKILL_MAP, { minSongs: 0 }), s.id).toMatchObject({ ok: true });
    }
  });
  it('uses the style\'s reference tracks as songs', () => {
    const plan = planLesson(newUserState(), STYLE_CATALOG);
    expect(plan.style_element).not.toBeNull();
    const c = fallbackLesson(plan, SKILL_MAP);
    expect(c.songs.length).toBeGreaterThan(0);
    expect(c.songs.every(s => s.capo === 0)).toBe(true);
  });
});
