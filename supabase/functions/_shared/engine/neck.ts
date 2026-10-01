import { Interval, Note, Scale } from 'tonal';

export type MapKind = 'unisons' | 'octaves' | 'intervals' | 'grid' | 'one_string';
export const MAP_KINDS: MapKind[] = ['unisons', 'octaves', 'intervals', 'grid', 'one_string'];
/** One labelled spot on the neck; `note` is an extra name shown above the dot, `flag` marks the G→B shift. */
export interface NeckDot { string: number; fret: number; label: string; note?: string; root?: boolean; flag?: boolean }
export interface NeckMap { from: number; to: number; dots: NeckDot[]; links: [NeckDot, NeckDot][]; caption: string }

/** Open strings as MIDI numbers, index 0 = low E (string 6) … 5 = high E (string 1). */
export const OPEN = [40, 45, 50, 55, 59, 64];
const at = (s: number, f: number) => OPEN[s] + f;
/** Lowest fret ≥ min on string s that sounds pitch class pc. */
const fretOf = (s: number, pc: number, min = 0) => { let f = ((pc - OPEN[s]) % 12 + 12) % 12; while (f < min) f += 12; return f; };
const span = (dots: NeckDot[]) => ({ from: Math.min(...dots.map(d => d.fret)), to: Math.max(...dots.map(d => d.fret)) });

/** A calculated neck map for `key` (a tonic such as 'G' or 'Bb'); `minor` picks natural minor for one_string. */
export function neckMap(kind: MapKind, key: string, minor = false): NeckMap {
  const tonic = /^[A-G][#b]?/.exec(key)?.[0] ?? 'C';
  const pc = Note.chroma(tonic)!;
  const flats = /^[A-G]b$/.test(tonic) || tonic === 'F';
  const name = (m: number) => Note.pitchClass(flats ? Note.fromMidi(m) : Note.fromMidiSharps(m));
  switch (kind) {
    case 'unisons': {
      const dots: NeckDot[] = [];
      const links: [NeckDot, NeckDot][] = [];
      for (let s = 0; s < 5; s++) {
        const gap = OPEN[s + 1] - OPEN[s];
        const flag = gap === 4 || undefined;
        const a: NeckDot = { string: s, fret: gap, label: name(at(s, gap)), flag };
        const b: NeckDot = { string: s + 1, fret: 0, label: name(OPEN[s + 1]), flag };
        dots.push(a, b); links.push([a, b]);
      }
      return { from: 0, to: 5, dots, links,
        caption: 'Each joined pair is the same note: fret 5 matches the next string up played open, except fret 4 on string 3 (flagged).' };
    }
    case 'octaves': {
      const dots: NeckDot[] = [];
      for (let s = 0; s < 6; s++) for (let f = fretOf(s, pc); f <= 12; f += 12) dots.push({ string: s, fret: f, label: name(at(s, f)), root: true });
      const links: [NeckDot, NeckDot][] = [];
      for (const a of dots) for (const b of dots) {
        const skip = b.string - a.string;
        if ((skip === 2 || skip === 3) && at(b.string, b.fret) - at(a.string, a.fret) === 12) {
          if (a.string <= 3 && b.string >= 4) b.flag = true;
          links.push([a, b]);
        }
      }
      return { from: 0, to: 12, dots, links,
        caption: `Every ${tonic} on the neck. Skip one string: up 2 frets. Skip two strings: back 3 frets. Crossing from string 3 to string 2 adds one fret (flagged).` };
    }
    case 'intervals': {
      const dots: NeckDot[] = [];
      const links: [NeckDot, NeckDot][] = [];
      const steps: [string, number][] = [['3', 4], ['5', 7], ['b7', 10], ['8', 12]];
      for (const s0 of [0, 1]) {
        const r = fretOf(s0, pc, 1);
        const root: NeckDot = { string: s0, fret: r, label: 'R', note: tonic, root: true };
        dots.push(root);
        for (const [label, semi] of steps) {
          let best: NeckDot | null = null;
          for (const s of [s0 + 1, s0 + 2]) {
            const f = at(s0, r) + semi - OPEN[s];
            if (f >= 0 && (!best || Math.abs(f - r) < Math.abs(best.fret - r))) best = { string: s, fret: f, label };
          }
          dots.push(best!); links.push([root, best!]);
        }
      }
      return { ...span(dots), dots, links,
        caption: `R is ${tonic}. From a root on string 6 or 5: the 3rd is one string up, one fret back; the 5th is one string up, two frets up; the b7 is two strings up, same fret; 8 is the octave.` };
    }
    case 'grid': {
      const r = fretOf(0, pc);
      const dots: NeckDot[] = [[1, 0, ''], [4, 5, ''], [5, 7, ''], [6, 9, 'm']].map(([n, semi, suffix]) => {
        let best: NeckDot | null = null;
        for (const s of [0, 1]) for (const extra of [0, 12]) {
          const f = fretOf(s, (pc + (semi as number)) % 12) + extra;
          if (!best || Math.abs(f - r) < Math.abs(best.fret - r)) best = { string: s, fret: f, label: String(n), note: `${name(at(s, f))}${suffix}` };
        }
        if (n === 1) best!.root = true;
        return best!;
      });
      return { ...span(dots), dots, links: [],
        caption: 'The 1, 4, 5 and 6 chords of the key as one grid of roots. The shape is the same in every key; only the starting fret moves.' };
    }
    case 'one_string': {
      let s = 0;
      for (const c of [1, 2, 3]) if (fretOf(c, pc) < fretOf(s, pc)) s = c;
      const f0 = fretOf(s, pc);
      const semis = [...Scale.get(`${tonic} ${minor ? 'minor' : 'major'}`).intervals.map(i => Interval.semitones(i)!), 12];
      const dots: NeckDot[] = semis.map((x, k) => ({ string: s, fret: f0 + x, label: String((k % 7) + 1), note: name(at(s, f0 + x)), root: k % 7 === 0 }));
      const gaps = dots.slice(1).map((d, k) => (d.fret - dots[k].fret === 1 ? 'H' : 'W'));
      return { ...span(dots), dots, links: dots.slice(1).map((d, k) => [dots[k], d] as [NeckDot, NeckDot]),
        caption: `${tonic} ${minor ? 'natural minor' : 'major'} along string ${6 - s}: ${gaps.join('-')}.` };
    }
  }
}
