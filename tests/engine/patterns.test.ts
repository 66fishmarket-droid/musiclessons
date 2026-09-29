import { describe, expect, it } from 'vitest';
import { TUNINGS, noteAt } from '../../supabase/functions/_shared/engine/music.ts';
import { PATTERNS, SKILL_PATTERNS, resolvePattern, voiceRoles } from '../../supabase/functions/_shared/engine/patterns.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';

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
