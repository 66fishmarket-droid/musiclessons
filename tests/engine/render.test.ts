import { describe, expect, it } from 'vitest';
import { buildMusic } from '../../supabase/functions/_shared/engine/music.ts';
import { listNotes, renderSteps, slotContext } from '../../supabase/functions/_shared/engine/render.ts';
import { PLAN } from '../lesson/fixtures.ts';

const withKey = (key: string) => ({ ...PLAN, key, music: buildMusic({ key, track: PLAN.track, style: null, element: null }) });

describe('listNotes', () => {
  it('joins with commas and "and"', () => {
    expect(listNotes(['G'])).toBe('G');
    expect(listNotes(['G', 'B'])).toBe('G and B');
    expect(listNotes(['G', 'B', 'D'])).toBe('G, B and D');
  });
});

describe('renderSteps', () => {
  const ctx = slotContext(PLAN, { target: { metric: 'bpm', start: 46, target: 70 }, patternId: 'pinch', grid: 'B---D---B---D---' });
  it('fills every slot from the plan', () => {
    expect(renderSteps([
      '{key} {scale}: {chords}, start on {chord1}.',
      'Sing {degrees:1,3,5}.',
      'Thumb on string {root_string}.',
      '{start_bpm} to {target_bpm} bpm.',
      '{pattern_name}: {pattern_counts}',
      '{rhythm_name}: {rhythm_counts}',
    ], ctx)).toEqual([
      'G major: {G} {C} {D} {G}, start on {G}.',
      'Sing G, B and D.',
      'Thumb on string 6.',
      '46 to 70 bpm.',
      'Pinch and pluck: 1 thumb + ring together · 2 index · 3 thumb (alternate bass) + middle together · 4 index',
      "Today's rhythm: 1 thumb plays the bass note · 2 strum down · 3 thumb plays the bass note · 4 strum down",  // a recipe grid without a name (Task 3 adds gridName)
    ]);
  });
  it('throws on unknown slots and on slots with no data', () => {
    expect(() => renderSteps(['{nope}'], ctx)).toThrow('unfilled slot {nope}');
    expect(() => renderSteps(['{target_reps}'], ctx)).toThrow('unfilled slot {target_reps}');
    expect(() => renderSteps(['{pattern_name}'], slotContext(PLAN, {}))).toThrow('unfilled slot {pattern_name}');
  });
  it('spells degrees in the scale\'s own names in every key, major and minor', () => {
    for (const tonic of ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db']) {
      const c = slotContext(withKey(tonic), {});
      const [line] = renderSteps(['{degrees:1,3,5}'], c);
      expect(line.startsWith(c.scaleNotes[0])).toBe(true);
    }
    expect(renderSteps(['{degrees:1,3,5}'], slotContext(withKey('F#'), {}))).toEqual(['F#, A# and C#']);
  });
  it('spells degrees for an explicit minor scale', () => {
    const minorPlan = { ...PLAN, music: { ...PLAN.music, scale: { ...PLAN.music.scale, name: 'minor', notes: ['E', 'F#', 'G', 'A', 'B', 'C', 'D'] } } };
    expect(renderSteps(['{degrees:1,3,5}'], slotContext(minorPlan, {}))).toEqual(['E, G and B']);
  });
});
