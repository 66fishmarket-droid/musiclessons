import { describe, expect, it } from 'vitest';
import { Note } from 'tonal';
import { buildMusic, scalePositions } from '../../supabase/functions/_shared/engine/music.ts';
import { listNotes, renderSteps, slotContext } from '../../supabase/functions/_shared/engine/render.ts';
import { STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';
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
    const minorPlan = { ...PLAN, key: 'E', music: { ...PLAN.music, scale: { ...PLAN.music.scale, name: 'minor', notes: ['E', 'F#', 'G', 'A', 'B', 'C', 'D'] } } };
    expect(renderSteps(['{degrees:1,3,5}'], slotContext(minorPlan, {}))).toEqual(['E, G and B']);
  });
  it('falls back to the key\'s parent scale only for a degree the day\'s reduced scale doesn\'t have', () => {
    const pentPlan = { ...PLAN, key: 'G', music: { ...PLAN.music, scale: { ...PLAN.music.scale, name: 'major pentatonic', notes: ['G', 'A', 'B', 'D', 'E'] } } };
    // 1, 3, 5 come straight from the pentatonic itself; pentatonic has no 4th or 7th, so those fall back to G major.
    expect(renderSteps(['{degrees:1,3,5,7}'], slotContext(pentPlan, {}))).toEqual(['G, B, D and F#']);
    expect(renderSteps(['{degrees:4,7}'], slotContext(pentPlan, {}))).toEqual(['C and F#']);
  });
  it('agrees with the fretboard card for every live modal/blues scale, not just major/minor', () => {
    const dayPlan = (key: string, scaleName: string) => ({ ...PLAN, key, music: { ...PLAN.music, scale: { ...PLAN.music.scale, name: scaleName } } });
    // The card (music.ts scalePositions) labels dots by tonal interval degree; these must match exactly,
    // even where that disagrees with the major/natural-minor parent scale (dorian 6, mixolydian 7, etc.).
    expect(renderSteps(['{degrees:6}'], slotContext(dayPlan('G', 'dorian'), {}))).toEqual(['E']);
    expect(renderSteps(['{degrees:7}'], slotContext(dayPlan('G', 'mixolydian'), {}))).toEqual(['F']);
    expect(renderSteps(['{degrees:7}'], slotContext(dayPlan('G', 'harmonic minor'), {}))).toEqual(['F#']);
    expect(renderSteps(['{degrees:2}'], slotContext(dayPlan('G', 'phrygian'), {}))).toEqual(['Ab']);
    // Blues has both a b5 and a 5 (degree 5 twice); prefer the plain (perfect) one over the diminished one.
    expect(renderSteps(['{degrees:5}'], slotContext(dayPlan('A', 'blues'), {}))).toEqual(['E']);
  });
  it('throws on a degree outside 1-7', () => {
    expect(() => renderSteps(['{degrees:8}'], slotContext(PLAN, {}))).toThrow('unfilled slot {degrees:8}');
  });
  it('renders {degrees:N} as the same note the fretboard card draws for that degree, for every style\'s scale', () => {
    const seenScales = new Set<string>();
    for (const profile of STYLE_CATALOG.profiles) {
      const scaleName = profile.scales[0];
      if (!scaleName || seenScales.has(scaleName)) continue;
      seenScales.add(scaleName);
      const positions = scalePositions('G', scaleName);
      const ctx = slotContext({ ...PLAN, key: 'G', music: { ...PLAN.music, scale: { ...PLAN.music.scale, name: scaleName } } }, {});
      for (let n = 1; n <= 7; n++) {
        const dot = positions.find(p => p.degree === n);
        if (!dot) continue; // this scale has no note at degree n; {degrees:n} would fall back to the parent, which is fine — nothing on the card to agree with
        const [line] = renderSteps([`{degrees:${n}}`], ctx);
        expect(Note.chroma(line), `${scaleName} degree ${n}`).toBe(Note.chroma(dot.note));
      }
    }
  });
});
