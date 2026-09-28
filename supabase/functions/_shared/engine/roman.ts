import { Chord, Progression } from 'tonal';

const ROMAN = /^([b#]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/;

/**
 * Canonical numeral: upper-case degree with an explicit quality. tonal ignores case, so a lower-case
 * degree without a quality ("ii7") is rewritten as minor ("IIm7"). Also maps 6/9 → 69 and 9sus4 → 11.
 */
export function normalizeRoman(raw: string): string {
  const m = ROMAN.exec(raw.trim());
  if (!m) throw new Error(`Not a roman numeral: ${raw}`);
  const [, accidental, degree, suffix] = m;
  const rest = suffix.replace('6/9', '69').replace('9sus4', '11');
  const upper = degree.toUpperCase();
  if (degree !== degree.toLowerCase()) return accidental + upper + rest;
  if (/^(m(?!aj)|o|ø|dim|5)/.test(rest)) return accidental + upper + rest;
  return `${accidental}${upper}m${rest}`;
}

/** Chord names for numerals in a key; throws on any numeral tonal cannot build. */
export function romanToChords(key: string, romans: string[]): string[] {
  const chords = Progression.fromRomanNumerals(key, romans.map(normalizeRoman));
  chords.forEach((c, i) => {
    if (!c || Chord.get(c).empty) throw new Error(`Unresolvable numeral "${romans[i]}" in ${key}`);
  });
  return chords;
}
