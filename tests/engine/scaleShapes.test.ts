import { describe, expect, it } from 'vitest';
import { LADDER, neighbours, parseRef, placeShape, renderRef, dayParent } from '../../supabase/functions/_shared/engine/scaleShapes.ts';

describe('scaleShapes', () => {
  it('places A minor pentatonic box 1 around the E-shape Am at fret 5', () => {
    const p = placeShape('A', 'minor_pent', 'E');
    expect(p).toMatchObject({ chord: 'Am', rootString: 0, rootFret: 5, from: 5, to: 8 });
    for (let s = 0; s < 6; s++) expect(p.notes.filter(n => n.string === s)).toHaveLength(2);
  });

  it('places G major around the E-shape G at fret 3, reaching back to F# at fret 2', () => {
    const p = placeShape('G', 'major', 'E');
    expect(p).toMatchObject({ chord: 'G', rootFret: 3, from: 2 });
    expect(p.notes).toContainEqual(expect.objectContaining({ string: 0, fret: 2, note: 'F#' }));
  });

  it('places C major around the A-shape C at fret 3 on the A string', () => {
    expect(placeShape('C', 'major', 'A')).toMatchObject({ chord: 'C', rootString: 1, rootFret: 3 });
  });

  it('renders a minor ref on a major day in the relative minor, and a major ref on a minor day in the relative major', () => {
    expect(renderRef('minor_pent:E', 'C', 'major')).toMatchObject({ tonic: 'A', scaleName: 'minor pentatonic', from: 5 });
    expect(renderRef('major:E', 'G', 'major')).toMatchObject({ tonic: 'G', chord: 'G', rootFret: 3 });
    expect(renderRef('major_pent:G', 'A', 'minor')).toMatchObject({ tonic: 'C', scaleName: 'major pentatonic' });
  });

  it('ladder steps 3 and 4 are the same dots as steps 1 and 2 with a major home note', () => {
    const dots = (id: string) => renderRef(id, 'G', 'major').notes.map(n => `${n.string}/${n.fret}`).sort();
    expect(dots(LADDER[2])).toEqual(dots(LADDER[0]));
    expect(dots(LADDER[3])).toEqual(dots(LADDER[1]));
  });

  it('neighbours follow C-A-G-E-D and stay on the ladder', () => {
    expect(neighbours('minor_pent:E')).toEqual(['minor_pent:D']);
    expect(neighbours('major:C').sort()).toEqual(['major:A', 'major:D']);
  });

  it('parses refs and splits day scales into a major or minor parent', () => {
    expect(parseRef('minor_pent:E')).toEqual({ type: 'minor_pent', shape: 'E' });
    expect(dayParent('dorian')).toBe('minor');
    expect(dayParent('mixolydian')).toBe('major');
    expect(dayParent('minor blues')).toBe('minor');
  });

  it('every ladder position in every key fits frets 0-15 and holds every degree of its scale', () => {
    for (const t of ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']) {
      for (const id of LADDER) {
        for (const parent of ['major', 'minor'] as const) {
          const p = renderRef(id, t, parent);
          const where = `${id} in ${t} ${parent}`;
          expect(p.from, where).toBeGreaterThanOrEqual(0);
          expect(p.to, where).toBeLessThanOrEqual(15);
          expect(new Set(p.notes.map(n => n.degree)).size, where).toBe(id.includes('pent') ? 5 : 7);
        }
      }
    }
  });
});
