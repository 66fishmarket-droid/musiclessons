import { describe, expect, it } from 'vitest';
import { normalizeRoman, romanToChords } from '../../supabase/functions/_shared/engine/roman.ts';

describe('normalizeRoman', () => {
  it.each([
    ['ii7', 'IIm7'], ['iim7', 'IIm7'], ['vi', 'VIm'], ['iiim', 'IIIm'], ['v7', 'Vm7'], ['iv', 'IVm'],
    ['i5', 'I5'], ['vi5', 'VI5'], ['#ivo7', '#IVo7'], ['iim7b5', 'IIm7b5'],
    ['bVII', 'bVII'], ['Imaj7', 'Imaj7'], ['I6/9', 'I69'], ['V9sus4', 'V11'], ['Isus4', 'Isus4'],
  ])('%s → %s', (raw, want) => expect(normalizeRoman(raw)).toBe(want));
  it('rejects non-numerals', () => expect(() => normalizeRoman('X7')).toThrow(/roman/i));
});

describe('romanToChords', () => {
  it('turns numerals into chords in the key, lower case meaning minor', () => {
    expect(romanToChords('C', ['ii7', 'V7', 'Imaj7'])).toEqual(['Dm7', 'G7', 'Cmaj7']);
    expect(romanToChords('A', ['im', 'bVII', 'bVI', 'V'])).toEqual(['Am', 'G', 'F', 'E']);
    expect(romanToChords('G', ['I', 'V', 'vim', 'IV'])).toEqual(['G', 'D', 'Em', 'C']);
  });
  it('throws on numerals tonal cannot build', () => expect(() => romanToChords('C', ['IV/I'])).toThrow(/Unresolvable/));
});
