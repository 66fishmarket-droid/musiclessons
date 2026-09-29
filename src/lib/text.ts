export type Segment = { text: string } | { chord: string };

/** Splits lesson text on {Chord} braces into plain-text and chord segments, in order. */
export function splitChords(s: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of s.matchAll(/\{([^{}]+)\}/g)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ chord: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

/** Distinct braced chords across the texts, in first-seen order. */
export function chordsIn(texts: string[]): string[] {
  return [...new Set(texts.flatMap(t => splitChords(t).flatMap(s => ('chord' in s ? [s.chord] : []))))];
}
