import { describe, expect, it } from 'vitest';
import { baseFret, dotLabels, rootStrings, shapesFor } from '../../src/lib/chordLabels.ts';

const G = { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], barres: [] };
const D = { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], barres: [] };

describe('dotLabels', () => {
  it('shows finger numbers, blank for open strings, null for muted', () => {
    expect(dotLabels(G, 'G', 'fingers')).toEqual(['2', '1', '', '', '', '3']);
    expect(dotLabels(D, 'D', 'fingers')).toEqual([null, null, '', '1', '3', '2']);
  });
  it('shows intervals from the chord root', () => {
    expect(dotLabels(G, 'G', 'intervals')).toEqual(['R', '3', '5', 'R', '3', 'R']);
    expect(dotLabels(D, 'D', 'intervals')).toEqual([null, null, 'R', '5', 'R', '3']);
    expect(dotLabels({ frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], barres: [] }, 'C', 'intervals'))
      .toEqual([null, 'R', '3', '5', 'R', '3']);
  });
  it('marks root strings', () => {
    expect(rootStrings(G, 'G')).toEqual([true, false, false, true, false, true]);
  });
});

describe('baseFret', () => {
  it('keeps open-position shapes at the nut', () => {
    expect(baseFret(G)).toBe(1);
    expect(baseFret({ frets: [-1, 3, 5, 5, 5, 3], fingers: [], barres: [3] })).toBe(1);
  });
  it('moves the window up for high shapes', () => {
    expect(baseFret({ frets: [6, 8, 8, 7, 6, 6], fingers: [], barres: [6] })).toBe(6);
    expect(baseFret({ frets: [-1, -1, 10, 9, 8, 10], fingers: [], barres: [] })).toBe(8);
  });
});

describe('shapesFor', () => {
  it('puts the lesson voicings first without duplicates', () => {
    const shapes = shapesFor('G', [G]);
    expect(shapes[0]).toEqual(G);
    expect(new Set(shapes.map(s => s.frets.join())).size).toBe(shapes.length);
    expect(shapes.length).toBeGreaterThan(1);
    expect(shapes.length).toBeLessThanOrEqual(6);
  });
  it('returns [] for names chords-db does not know instead of throwing', () => {
    expect(shapesFor('H7')).toEqual([]);
    expect(shapesFor('the E string')).toEqual([]);
  });
});
