import { describe, expect, it } from 'vitest';
import { Note } from 'tonal';
import { MAP_KINDS, OPEN, neckMap, type NeckDot } from '../../supabase/functions/_shared/engine/neck.ts';

const KEYS = ['G', 'C', 'E', 'Eb', 'D', 'F#', 'Bb', 'F', 'A'];
const midi = (d: NeckDot) => OPEN[d.string] + d.fret;

describe('neckMap', () => {
  it('keeps every dot on the neck, frets 0–16, for every kind and key (Review Focus 1)', () => {
    for (const kind of MAP_KINDS) for (const key of KEYS) {
      const m = neckMap(kind, key);
      for (const d of m.dots) {
        expect(d.fret, `${kind} ${key}`).toBeGreaterThanOrEqual(0);
        expect(d.fret, `${kind} ${key}`).toBeLessThanOrEqual(16);
        expect(d.fret).toBeGreaterThanOrEqual(m.from);
        expect(d.fret).toBeLessThanOrEqual(m.to);
      }
      expect(m.caption.length).toBeGreaterThan(0);
    }
  });
  it('unisons: each pair is the same pitch, 5 frets apart except G→B (4), and only that pair is flagged', () => {
    const m = neckMap('unisons', 'G');
    expect(m.links).toHaveLength(5);
    for (const [a, b] of m.links) {
      expect(midi(a)).toBe(midi(b));
      expect(a.fret).toBe(a.string === 3 ? 4 : 5);
      expect(!!a.flag).toBe(a.string === 3);
    }
  });
  it('octaves: every link is 12 half steps, with the +1 shift only when crossing G→B', () => {
    for (const key of KEYS) {
      const m = neckMap('octaves', key);
      expect(m.dots.every(d => Note.chroma(d.label) === Note.chroma(key)), key).toBe(true);
      expect(m.links.length, key).toBeGreaterThan(0);
      for (const [a, b] of m.links) {
        expect(midi(b) - midi(a)).toBe(12);
        const skip = b.string - a.string;
        const crosses = a.string <= 3 && b.string >= 4;
        expect(b.fret - a.fret, `${key} ${a.string}→${b.string}`).toBe((skip === 2 ? 2 : -3) + (crosses ? 1 : 0));
        expect(!!b.flag).toBe(crosses);
      }
    }
  });
  it('intervals: 3, 5, b7 and 8 sit 4, 7, 10 and 12 half steps above their root, from roots on strings 6 and 5', () => {
    const SEMI: Record<string, number> = { 3: 4, 5: 7, b7: 10, 8: 12 };
    for (const key of KEYS) {
      const m = neckMap('intervals', key);
      const roots = m.dots.filter(d => d.root);
      expect(roots.map(r => r.string).sort(), key).toEqual([0, 1]);
      expect(m.links).toHaveLength(8);
      for (const [r, d] of m.links) expect(midi(d) - midi(r), `${key} ${d.label}`).toBe(SEMI[d.label]);
    }
  });
  it('grid: roots spell I, IV, V and vi of the key, labelled 1/4/5/6 with chord names', () => {
    const m = neckMap('grid', 'G');
    expect(m.dots.map(d => `${d.label} ${d.note}`)).toEqual(['1 G', '4 C', '5 D', '6 Em']);
    for (const key of KEYS) {
      const semis = neckMap('grid', key).dots.map(d => ((midi(d) - Note.chroma(key)!) % 12 + 12) % 12);
      expect(semis, key).toEqual([0, 5, 7, 9]);
    }
  });
  it('one_string: gaps follow the major formula, or natural minor when minor (Review Focus 3)', () => {
    const gaps = (minor: boolean, key: string) => {
      const ds = neckMap('one_string', key, minor).dots;
      expect(new Set(ds.map(d => d.string)).size).toBe(1);
      return ds.slice(1).map((d, k) => (d.fret - ds[k].fret === 1 ? 'H' : 'W')).join('');
    };
    for (const key of KEYS) {
      expect(gaps(false, key), key).toBe('WWHWWWH');
      expect(gaps(true, key), key).toBe('WHWWHWW');
    }
  });
  it('spells notes from the key, including flat-side minor keys and Gb (final review I2)', () => {
    expect(neckMap('one_string', 'G', true).dots.map(d => d.note)).toEqual(['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F', 'G']);
    expect(neckMap('one_string', 'Gb').dots.map(d => d.note)).toContain('Cb');
    expect(neckMap('grid', 'Gb').dots.map(d => d.note)).toEqual(['Gb', 'Cb', 'Db', 'Ebm']);
    expect(neckMap('octaves', 'Db').dots.every(d => d.label === 'Db')).toBe(true);
  });
  it('grid keeps the same shape in every key: 1 on string 6, 4/5/6 on string 5 at +0/+2/+4 (final review I3)', () => {
    for (const key of ['G', 'D', 'A', 'E', 'C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']) {
      const [one, ...rest] = neckMap('grid', key).dots;
      expect(one.string, key).toBe(0);
      expect(rest.map(d => [d.string, d.fret - one.fret]), key).toEqual([[1, 0], [1, 2], [1, 4]]);
    }
  });
  it('names notes with flats in flat keys (Review Focus 2)', () => {
    expect(neckMap('grid', 'Bb').dots.map(d => d.note)).toEqual(['Bb', 'Eb', 'F', 'Gm']);
    expect(neckMap('octaves', 'Eb').dots[0].label).toBe('Eb');
  });
});
