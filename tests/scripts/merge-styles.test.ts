import { describe, expect, it } from 'vitest';
import { mergeProfiles } from '../../scripts/merge-styles.ts';

const draft = (over: Record<string, unknown> = {}) => ({
  id: 'folk', name: 'Folk',
  feel: { subdivision: 'straight 8ths', swing: 0.5, tempo_range: [70, 130], accents: 'bass on 1 and 3' },
  rhythm_patterns: [
    { name: 'Boom-chick', grid16: 'B---D---B---D---' },
    { name: 'Travis alternating thumb', grid16: 'P---T-F-T-F-T-F-' },
    { name: 'Drone 3-3-2 arpeggio', grid16: 'B--F--F-B--F--F-' },
  ],
  progressions: [{ name: 'Dorian vamp', roman: ['im', 'IV'], bars: 2 }, { name: 'Split', roman: ['I7', 'v7 I7'], bars: 2 }],
  chord_colours: ['add9'], forms: ['strophic'], fill_vocabulary: ['hammer-on'], scales: ['major', 'dorian'],
  keys_common: ['G'], lyric_traits: ['narrative'], reference_tracks: [{ title: 't', artist: 'a', why: 'w' }], ladder: ['boom-chick'],
  ...over,
});

describe('mergeProfiles', () => {
  const { profiles, issues } = mergeProfiles([draft()]);
  const folk = profiles[0];
  it('fills the family and a uniform feel (swing fraction → ratio)', () => {
    expect(issues).toEqual([]);
    expect(folk.family).toBe('folk_roots');
    expect(folk.feel).toEqual({ subdivision: 'straight 8ths', meter: '4/4', tempo_range: [70, 130], accents: 'bass on 1 and 3', swing_ratio: 1, clave: null });
  });
  it('tokenises grids and maps thumb/finger to B/P', () => {
    expect(folk.rhythm_patterns[1].grid.slice(0, 7)).toEqual(['P', '-', '-', '-', 'B', '-', 'P']);
    expect(folk.rhythm_patterns[1].id).toBe('folk.travis_alternating_thumb');
  });
  it('marks known-inferred patterns unverified', () => {
    expect(folk.rhythm_patterns.map(p => p.verified)).toEqual([true, true, false]);
  });
  it('normalises numerals and splits space-joined entries', () => {
    expect(folk.progressions[0].roman).toEqual(['Im', 'IV']);
    expect(folk.progressions[1].roman).toEqual(['I7', 'Vm7', 'I7']);
    expect(folk.progressions[0].id).toBe('folk.prog_dorian_vamp');
  });
  it('respects per-pattern confidence and space-separated grids', () => {
    const { profiles: [reggae] } = mergeProfiles([draft({ id: 'reggae', rhythm_patterns: [
      { name: 'Skank', grid: '- - D - - - D - - - D - - - D -', confidence: 'sourced' },
      { name: 'Double chop', grid: '- - D D - - D D - - D D - - D D', confidence: 'inferred' },
    ] })]);
    expect(reggae.rhythm_patterns.map(p => [p.grid.length, p.verified])).toEqual([[16, true], [16, false]]);
  });
  it('applies numeral fixes', () => {
    const { profiles: [wa] } = mergeProfiles([draft({ id: 'west_african', progressions: [{ name: '4 temps', roman: ['I', 'VII', 'IV', 'V'], bars: 4 }] })]);
    expect(wa.progressions[0].roman).toEqual(['I', 'bVII', 'IV', 'V']);
  });
  it('reports bad grids, numerals, scales and unknown families', () => {
    const { issues: bad } = mergeProfiles([draft({
      id: 'mystery', scales: ['nonsense'],
      rhythm_patterns: [{ name: 'Odd', grid16: 'DQ-' }], progressions: [{ name: 'Bad', roman: ['IV/I'], bars: 1 }],
    })]);
    expect(bad).toEqual([
      'mystery: no family',
      'mystery.odd: grid length 3',
      'mystery.odd: bad tokens Q',
      'mystery.prog_bad: Unresolvable numeral "IV/I" in C',
      'mystery: unknown scale "nonsense"',
    ]);
  });
});
