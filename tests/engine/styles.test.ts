import { describe, expect, it } from 'vitest';
import { Scale } from 'tonal';
import { romanToChords } from '../../supabase/functions/_shared/engine/roman.ts';
import { STYLES, STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';

describe('merged style catalog', () => {
  it('covers every family in the spec', () => {
    expect(new Set(STYLES.map(s => s.family))).toEqual(new Set(
      ['folk_roots', 'blues', 'soul_rnb', 'funk', 'rock', 'pop', 'country', 'jazz', 'caribbean', 'latin_iberian', 'african']));
  });
  it('stores only canonical numerals that resolve in every key', () => {
    for (const s of STYLES) for (const p of s.progressions) {
      expect(p.roman.every(r => !/^[b#]?[iv]/.test(r)), p.id).toBe(true);
      for (const key of ['C', 'Eb', 'F#']) expect(romanToChords(key, p.roman).length, `${p.id} in ${key}`).toBe(p.roman.length);
    }
  });
  it('has valid scales and at least one verified element per style', () => {
    for (const s of STYLES) {
      s.scales.forEach(sc => expect(Scale.get(`C ${sc}`).empty, `${s.id} ${sc}`).toBe(false));
      expect(STYLE_CATALOG.elements.some(e => e.style === s.id && e.verified), s.id).toBe(true);
    }
  });
});
