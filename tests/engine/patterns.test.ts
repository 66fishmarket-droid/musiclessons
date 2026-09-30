import { describe, expect, it } from 'vitest';
import { TUNINGS, noteAt } from '../../supabase/functions/_shared/engine/music.ts';
import { PATTERNS, SKILL_PATTERNS, nextBarChord, resolvePattern, rhythmCounts, rhythmPattern, voiceRoles } from '../../supabase/functions/_shared/engine/patterns.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';
import { STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';

const G = { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], barres: [] };
const C = { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], barres: [] };
const D = { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], barres: [] };

describe('noteAt with tunings', () => {
  it('defaults to standard and counts semitones from any tuning', () => {
    expect(noteAt(0, 3)).toBe('G');
    expect(noteAt(0, 0, TUNINGS.dropD)).toBe('D');
    expect(noteAt(4, 0, TUNINGS.dadgad)).toBe('A');
    expect(noteAt(3, 4, TUNINGS.openD)).toBe('A#');
  });
});

describe('voiceRoles', () => {
  it('puts the thumb on the root and the fifth, fingers on the top three strings (G)', () => {
    expect(voiceRoles(G, 'G')).toEqual({ bass: 0, alt: 2, t1: 5, t2: 4, t3: 3 });
  });
  it('uses another chord tone for the alternate bass when the fifth sits in the treble (C: 4th string E)', () => {
    expect(voiceRoles(C, 'C')).toEqual({ bass: 1, alt: 2, t1: 5, t2: 4, t3: 3 });
  });
  it('shares the lowest treble string when there is no room below it (D: 4th and 3rd)', () => {
    expect(voiceRoles(D, 'D')).toEqual({ bass: 2, alt: 3, t1: 5, t2: 4, t3: 3 });
  });
  it('resolves the same roles in DADGAD from semitones alone (open Dsus4)', () => {
    expect(voiceRoles({ frets: [0, 0, 0, 0, 0, 0], fingers: [0, 0, 0, 0, 0, 0], barres: [] }, 'Dsus4', TUNINGS.dadgad))
      .toEqual({ bass: 0, alt: 1, t1: 5, t2: 4, t3: 3 });
  });
});

describe('resolvePattern', () => {
  it('turns roles into strings, pitches and intervals', () => {
    const steps = resolvePattern(PATTERNS.giuliani_pima, G, 'G');
    expect(steps[0]).toEqual([{ finger: 'p', role: 'bass', string: 0, note: 'G2', interval: 'R' }]);
    expect(steps[1]).toEqual([{ finger: 'i', role: 't3', string: 3, note: 'G3', interval: 'R' }]);
    expect(steps[2]).toEqual([{ finger: 'm', role: 't2', string: 4, note: 'B3', interval: '3' }]);
    expect(steps[3]).toEqual([{ finger: 'a', role: 't1', string: 5, note: 'G4', interval: 'R' }]);
  });
  it('plays the Travis alternate bass on the fifth', () => {
    expect(resolvePattern(PATTERNS.travis, G, 'G')[2]).toEqual([{ finger: 'p', role: 'alt', string: 2, note: 'D3', interval: '5' }]);
  });
});

describe('pattern library', () => {
  it('fills exactly one bar per pattern', () => {
    for (const p of Object.values(PATTERNS)) expect(p.steps.length, p.id).toBe(p.beatsPerBar * p.stepsPerBeat);
  });
  it('maps every fingerstyle skill to known patterns', () => {
    for (const s of SKILLS.filter(x => x.track === 'fingerstyle')) {
      expect(SKILL_PATTERNS[s.id]?.length, s.id).toBeGreaterThan(0);
      for (const id of SKILL_PATTERNS[s.id]) expect(PATTERNS[id], id).toBeDefined();
    }
  });
});

describe('nextBarChord', () => {
  it('starts on the shown chord, then moves one chord per bar and wraps', () => {
    expect(nextBarChord(-1, 0, 4)).toBe(0);
    expect(nextBarChord(0, 0, 4)).toBe(1);
    expect(nextBarChord(3, 3, 4)).toBe(0);
  });
  it('plays a tapped chord next bar instead of skipping past it', () => {
    expect(nextBarChord(1, 3, 4)).toBe(3);
  });
  it('stays put on a single chord', () => {
    expect(nextBarChord(0, 0, 1)).toBe(0);
  });
});

describe('rhythmPattern', () => {
  it('turns boom-chick into a thumb bass on 1 and 3 and down-strums on 2 and 4, in 16ths', () => {
    const p = rhythmPattern('Boom-chick', 'B---D---B---D---'.split(''));
    expect(p).toMatchObject({ beatsPerBar: 4, stepsPerBeat: 4, bars: 1 });
    expect(p.steps[0]).toEqual([{ finger: 'p', role: 'bass' }]);
    expect(p.strokes![4]).toBe('D');
    expect(p.steps[4]).toEqual([]);
    expect(p.strokes![0]).toBeNull();
  });
  it('reads 12 slots as 3/4 when the name says so, else a 12/8 feel; 32 slots as two bars', () => {
    expect(rhythmPattern('Waltz boom-chuck-chuck (3/4, 12 slots)', 'B---D---D---'.split(''))).toMatchObject({ beatsPerBar: 3, stepsPerBeat: 4 });
    expect(rhythmPattern('Country-blues shuffle (12/8, 12 slots)', 'B-DB-DB-DB-D'.split(''))).toMatchObject({ beatsPerBar: 4, stepsPerBeat: 3 });
    expect(rhythmPattern('Guajeo 2-3', '--P---P-P---P---P---P-----P---P-'.split(''))).toMatchObject({ beatsPerBar: 4, stepsPerBeat: 4, bars: 2 });
  });
  it('plays fingers, pinches and single notes as picked notes', () => {
    const p = rhythmPattern('x', ['BP', 'P', 'N', '-'].concat(Array(12).fill('-')));
    expect(p.steps[0].map(s => s.role)).toEqual(['bass', 't3', 't2', 't1']);
    expect(p.steps[1].map(s => s.finger)).toEqual(['i', 'm', 'a']);
    expect(p.steps[2]).toEqual([{ finger: 'i', role: 't1' }]);
  });
  it('handles every rhythm in the style catalogue: one entry per slot, whole bars, known tokens', () => {
    for (const prof of STYLE_CATALOG.profiles) for (const r of prof.rhythm_patterns) {
      const p = rhythmPattern(r.name, r.grid);
      expect(p.steps).toHaveLength(r.grid.length);
      expect(p.beatsPerBar * p.stepsPerBeat * (p.bars ?? 1)).toBe(r.grid.length);
      r.grid.forEach((t, k) => {
        expect(['D', 'U', 'd', 'u', 'x', null], `${r.name} slot ${k} "${t}"`).toContain(p.strokes![k]);
        expect(p.steps[k].length > 0 || p.strokes![k] !== null || t === '-', `${r.name} slot ${k} "${t}"`).toBe(true);
      });
    }
  });
});

describe('rhythmCounts', () => {
  it('spells out what the picking hand does on each count', () => {
    expect(rhythmCounts(rhythmPattern('Boom-chick', 'B---D---B---D---'.split(''))))
      .toBe('1 thumb plays the bass note · 2 strum down · 3 thumb plays the bass note · 4 strum down');
  });
  it('names off-beats and muted strokes', () => {
    expect(rhythmCounts(rhythmPattern('x', 'D-DUx-DU--------'.split(''))))
      .toBe('1 strum down · 1& strum down · 1a strum up · 2 mute (slap or choke) · 2& strum down · 2a strum up');
    expect(rhythmCounts(rhythmPattern('Shuffle (12/8, 12 slots)', 'B-DB-D------'.split(''))))
      .toBe('1 thumb plays the bass note · 1-let strum down · 2 thumb plays the bass note · 2-let strum down');
  });
  it('marks the second bar of a two-bar rhythm', () => {
    expect(rhythmCounts(rhythmPattern('Guajeo', 'P'.concat('-'.repeat(15), 'P', '-'.repeat(15)).split('')))).toBe('1 fingers pluck the top strings · bar 2: 1 fingers pluck the top strings');
  });
});
