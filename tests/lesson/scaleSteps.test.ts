import { describe, expect, it } from 'vitest';
import { buildMusic } from '../../supabase/functions/_shared/engine/music.ts';
import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import { elementsOf, STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';
import type { LessonPlan, ReviewItem } from '../../supabase/functions/_shared/engine/types.ts';
import { buildSteps } from '../../supabase/functions/_shared/lesson/steps.ts';
import { lessonThread } from '../../supabase/functions/_shared/lesson/thread.ts';
import { PLAN, SKILL_MAP, newUserState } from './fixtures.ts';

const scale = (ref: string, interval_days: number, next_due: string, last_result: boolean | null = true): ReviewItem =>
  ({ item_type: 'scale', ref, interval_days, next_due, last_result });
const warm = (plan: LessonPlan) => buildSteps(plan, SKILL_MAP).blocks.find(b => b.kind === 'warmup')!;
const known = { ...newUserState(), reviewItems: [scale('minor_pent:E', 7, '2026-10-01'), scale('minor_pent:D', 3, '2026-10-01')] };

describe('scale block steps', () => {
  it('writes one warm-up instruction per scale step, in order', () => {
    const plan = planLesson(known, STYLE_CATALOG);
    expect(warm(plan).instructions).toHaveLength(plan.scale_block!.steps.length);
    expect(warm(plan).instructions[0]).toMatch(/^The drone plays the note [A-G][#b]? underneath; switch it off any time\./);
    expect(warm(PLAN).instructions.join(' ')).not.toContain('Hum or lip-trill');
  });

  it('names each position by chord shape and fret, and the retrieve target by its note', () => {
    const plan = planLesson(known, STYLE_CATALOG);
    const [first] = warm(plan).instructions;
    expect(first).toMatch(/-shape [A-G][#b]?m? chord (at fret \d+|in open position)/);
    expect(first).toMatch(/play every (b?\d) \(the note [A-G][#b]?\)/);
    expect(first).toContain('Tap Show');
  });

  it('lands each Use phrase on the named 3rd of every chord', () => {
    const plan = planLesson(known, STYLE_CATALOG);
    const use = warm(plan).instructions.at(-1)!;
    for (const c of new Set(plan.music.progression.chords)) expect(use).toContain(`over {${c}}`);
  });

  it('uses the parent major/minor on modal and blues days, never the mode name', () => {
    for (const p of STYLE_CATALOG.profiles) {
      const el = elementsOf(p)[0];
      const music = buildMusic({ key: 'A', track: 'rhythm', style: p, element: el });
      const plan = { ...planLesson(known, STYLE_CATALOG), key: 'A', music };
      const text = warm(plan).instructions.join(' ') + lessonThread(plan, SKILL_MAP).blocks.warmup!.intro;
      expect(text, p.id).not.toMatch(/dorian|mixolydian|phrygian|lydian|aeolian|blues|harmonic/i);
    }
  });

  it('keeps the old warm-up text for plans made before the scale block', () => {
    const old = warm({ ...PLAN, scale_block: null }).instructions;
    expect(old).toHaveLength(3);
    expect(old[0]).toContain('Hum or lip-trill');
  });

  it('every ladder stage writes without throwing in every key', () => {
    for (const key of ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb']) {
      const plan = { ...planLesson(known, STYLE_CATALOG), key, music: buildMusic({ key, track: 'rhythm', style: null, element: null }) };
      expect(() => warm(plan)).not.toThrow();
    }
  });
});
