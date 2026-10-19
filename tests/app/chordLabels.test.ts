import { describe, expect, it } from 'vitest';
import { baseFret, dotLabels, pickShape, rootStrings, shapeFor, shapesFor, withPickedShapes } from '../../src/lib/chordLabels.ts';
import { chordVoicings } from '../../supabase/functions/_shared/engine/music.ts';
import { buildSteps } from '../../supabase/functions/_shared/lesson/steps.ts';
import { PLAN, SKILL_MAP } from '../lesson/fixtures.ts';

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

describe('shapeFor / pickShape', () => {
  const kv = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };
  it("draws the lesson's first shape until the learner picks another under Other shapes", () => {
    const store = kv();
    expect(shapeFor('G', [G], store)).toEqual(G);
    const other = shapesFor('G', [G])[1];
    pickShape('G', other, store);
    expect(shapeFor('G', [G], store)).toEqual(other);
    expect(shapeFor('C', [], store)).toBeUndefined();
  });
  it('falls back to the lesson shape when storage throws or holds a shape the chord no longer has', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} };
    expect(shapeFor('G', [G], broken)).toEqual(G);
    expect(() => pickShape('G', G, broken)).not.toThrow();
    const store = kv();
    store.setItem('shape:G', '9,9,9,9,9,9');
    expect(shapeFor('G', [G], store)).toEqual(G);
  });
});

describe('withPickedShapes (owner 2026-10-19: step text described the lesson shape, the card drew the picked one)', () => {
  const store = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };
  const chords = ['A7', 'E7'];
  const plan = { ...PLAN, skill_id: 'fills.l1.sus_add_hammers', key: 'A',
    music: { ...PLAN.music, progression: { roman: ['I', 'V'], chords }, voicings: Object.fromEntries(chords.map(c => [c, chordVoicings(c)])) } };
  const stored = buildSteps(plan, SKILL_MAP);
  const content = { blocks: stored.blocks.map(b => ({ ...b, more: '' })), create_prompt: stored.create_prompt, path: stored.path, songs: [] } as never;
  it('keeps the stored text when nothing was picked', () => {
    expect(withPickedShapes(content, plan, SKILL_MAP, store())).toBe(content);
  });
  it('re-renders the steps with the picked shape', () => {
    const kv = store();
    const alt = shapesFor('A7', plan.music.voicings.A7).find(v => v.frets.join() !== plan.music.voicings.A7[0].frets.join())!;
    pickShape('A7', alt, kv);
    const want = buildSteps({ ...plan, music: { ...plan.music, voicings: { ...plan.music.voicings, A7: [alt, ...plan.music.voicings.A7] } } }, SKILL_MAP);
    const got = withPickedShapes(content, plan, SKILL_MAP, kv) as { blocks: { instructions: string[] }[] };
    expect(got.blocks.map(b => b.instructions)).toEqual(want.blocks.map(b => b.instructions));
    expect(got.blocks.map(b => b.instructions)).not.toEqual(stored.blocks.map(b => b.instructions));
  });
});
