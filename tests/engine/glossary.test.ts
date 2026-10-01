import { describe, expect, it } from 'vitest';
import { GLOSSARY, termsIn, type GlossaryEntry } from '../../supabase/functions/_shared/engine/glossary.ts';

const e = (id: string, match: string[]): GlossaryEntry => ({ id, term: id, match, plain: '', why: '', sources: [] });
const MINI = [e('root', ['root']), e('triad', ['triad', 'triads']), e('minor', ['minor']),
  e('minor_pentatonic', ['minor pentatonic']), e('sus', ['sus']), e('hammer_on', ['hammer-on', 'hammer-ons'])];
const ids = (texts: string[]) => termsIn(texts, MINI).map(t => t.id);

describe('termsIn', () => {
  it('matches whole words in any case, including plurals listed in match (Review Focus 1)', () => {
    expect(ids(['Play the Triads up the neck'])).toEqual(['triad']);
  });
  it('matches next to punctuation and inside hyphenated terms (Review Focus 2)', () => {
    expect(ids(['Find the (root), then a triad. Add hammer-ons.'])).toEqual(['root', 'triad', 'hammer_on']);
  });
  it('ignores chord chips and partial words (Review Focus 3)', () => {
    expect(ids(['Strum {Gsus4} then {Am}; stay rooted'])).toEqual([]);
  });
  it('prefers the longest phrase and consumes it', () => {
    expect(ids(['Use the minor pentatonic box'])).toEqual(['minor_pentatonic']);
    expect(ids(['A minor chord, then the minor pentatonic'])).toEqual(['minor', 'minor_pentatonic']);
  });
  it('de-duplicates and keeps first-appearance order across texts', () => {
    expect(ids(['triad on the root', 'another triad', 'sus chord'])).toEqual(['triad', 'root', 'sus']);
  });
  it('returns [] for empty input', () => {
    expect(ids([])).toEqual([]);
    expect(ids(['', ''])).toEqual([]);
  });
});

describe('GLOSSARY integrity', () => {
  it('has unique ids and non-empty text', () => {
    expect(new Set(GLOSSARY.map(g => g.id)).size).toBe(GLOSSARY.length);
    for (const g of GLOSSARY) {
      expect(g.term && g.plain && g.why, g.id).toBeTruthy();
      expect(g.sources.length, g.id).toBeGreaterThan(0);
    }
  });
  it('match words are lower-case, non-empty and owned by one entry', () => {
    const all = GLOSSARY.flatMap(g => g.match);
    for (const m of all) expect(m).toBe(m.toLowerCase().trim());
    expect(all.every(Boolean)).toBe(true);
    expect(new Set(all).size).toBe(all.length);
  });
  it('builds up: each definition only uses terms defined at or above it', () => {
    GLOSSARY.forEach((g, i) => {
      const later = termsIn([g.plain, g.why]).filter(t => GLOSSARY.indexOf(t) > i).map(t => t.id);
      expect(later, `${g.id} uses later terms`).toEqual([]);
    });
  });
});
