import { Chord, Interval, Note, Scale } from 'tonal';
import guitar from '@tombatossals/chords-db/lib/guitar.json' with { type: 'json' };
import { normalizeRoman, romanToChords } from './roman.ts';
import type { Swing } from './patterns.ts';
import type { StyleElement, StyleProfile } from './styles.ts';

/** Open strings low → high; index 0 is the low E string. */
export const TUNING = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

export interface FretNote { string: number; fret: number; note: string; degree: number }
export interface Voicing { frets: number[]; fingers: number[]; barres: number[] }
export interface TriadShape { strings: number[]; frets: number[]; bass: string; inversion: 'root' | 'first' | 'second' }
export interface MusicContent {
  key: string;
  scale: { tonic: string; name: string; notes: string[]; positions: FretNote[] };
  progression: { roman: string[]; chords: string[] };
  voicings: Record<string, Voicing[]>;
  rhythm: { name: string; grid: string[]; swing?: Swing | null; push?: number | null } | null;
  triads: TriadShape[];
}
export interface MusicInput { key: string; track: string; style: StyleProfile | null; element: StyleElement | null }

/** Named tunings, low → high string, with octaves. Everything downstream is semitone maths from these. */
export const TUNINGS = {
  standard: TUNING,
  dropD: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  dadgad: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'],
  openD: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'],
  openG: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'],
} satisfies Record<string, readonly string[]>;

/** Pitch class sounding at a string (0 = lowest) and fret, in the given tuning (default standard). */
export function noteAt(string: number, fret: number, tuning: readonly string[] = TUNING): string {
  return Note.pitchClass(Note.transpose(tuning[string], Interval.fromSemitones(fret)));
}

/** A note's distance from the home note as a learner reads it: '1', 'b3', '5', '#4', 'b7'. */
export function degreeLabel(tonic: string, note: string): string {
  const iv = Interval.get(Interval.distance(Note.pitchClass(tonic), Note.pitchClass(note)));
  const n = ((iv.num ?? 1) - 1) % 7 + 1;
  const perfect = [1, 4, 5].includes(n);
  const acc = iv.q === 'm' ? 'b' : iv.q === 'd' ? (perfect ? 'b' : 'bb') : iv.q === 'A' ? '#' : iv.q === 'AA' ? '##' : '';
  return `${acc}${n}`;
}

/** Every fret 0..maxFret on every string whose note is in the scale, with its interval degree
 * (from tonal, e.g. '2M' → 2, '5d' and '5P' both → 5) — not its array index, which is wrong for
 * any scale that isn't a plain 7-note major/minor (pentatonics, blues, modes all skip or repeat degrees). */
export function scalePositions(tonic: string, scaleName: string, maxFret = 12): FretNote[] {
  const scale = Scale.get(`${tonic} ${scaleName}`);
  if (scale.notes.length === 0) throw new Error(`Unknown scale: ${tonic} ${scaleName}`);
  const { notes, intervals } = scale;
  const degrees = intervals.map(iv => Interval.num(iv));
  const chromas = notes.map(n => Note.chroma(n));
  const out: FretNote[] = [];
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= maxFret; f++) {
      const i = chromas.indexOf(Note.chroma(noteAt(s, f)));
      if (i >= 0) out.push({ string: s, fret: f, note: notes[i], degree: degrees[i] });
    }
  }
  return out;
}

/** One playable position: four frets starting one below the lowest root on the E or A string, or on it, whichever
 * holds more scale notes (major shapes reach back a fret; minor pentatonic starts on the root and needs the b3 above it). */
export function scaleBox(positions: FretNote[]): { from: number; to: number; notes: FretNote[] } {
  const root = Math.min(...positions.filter(p => p.degree === 1 && p.string <= 1).map(p => p.fret));
  const box = (from: number) => ({ from, to: from + 3, notes: positions.filter(p => p.fret >= from && p.fret <= from + 3) });
  const below = box(Math.max(0, root - 1)), on = box(root);
  return on.notes.length > below.notes.length ? on : below;
}

type DbPosition ={ frets: number[]; fingers: number[]; baseFret: number; barres: number[] };
const DB = guitar as unknown as {
  keys: string[]; suffixes: string[];
  chords: Record<string, { key: string; suffix: string; positions: DbPosition[] }[]>;
};
const SUFFIX_BY_INTERVALS = new Map<string, string>();
for (const suffix of DB.suffixes) {
  if (suffix.includes('/')) continue;
  const probe = Chord.get(suffix === 'major' ? 'C' : suffix === 'minor' ? 'Cm' : `C${suffix}`);
  const k = probe.intervals.join(',');
  if (!probe.empty && !SUFFIX_BY_INTERVALS.has(k)) SUFFIX_BY_INTERVALS.set(k, suffix);
}
function dbKey(tonic: string): string | null {
  for (const n of [tonic, Note.enharmonic(tonic)]) if (DB.keys.includes(n)) return n.replace('#', 'sharp');
  return null;
}

function powerChordVoicings(tonic: string): Voicing[] {
  return [0, 1].map(root => {
    const fret = [...Array(12).keys()].find(f => Note.chroma(noteAt(root, f)) === Note.chroma(tonic))!;
    const frets = [-1, -1, -1, -1, -1, -1];
    frets[root] = fret; frets[root + 1] = fret + 2; frets[root + 2] = fret + 2;
    return { frets, fingers: frets.map(f => (f <= 0 ? 0 : f === fret ? 1 : 3)), barres: [] };
  });
}

/** Up to `limit` playable shapes: chords-db lookup by interval structure, generated shapes for power chords. */
export function chordVoicings(name: string, limit = 2): Voicing[] {
  const chord = Chord.get(name);
  if (chord.empty || !chord.tonic) throw new Error(`Unknown chord: ${name}`);
  if (chord.aliases.includes('5')) return powerChordVoicings(chord.tonic).slice(0, limit);
  const key = dbKey(chord.tonic);
  const suffix = SUFFIX_BY_INTERVALS.get(chord.intervals.join(','));
  const entry = key && suffix ? DB.chords[key]?.find(c => c.suffix === suffix) : undefined;
  if (!entry) return [];
  return entry.positions.slice(0, limit).map(p => ({
    frets: p.frets.map(f => (f <= 0 ? f : f + p.baseFret - 1)),
    fingers: p.fingers,
    barres: p.barres.map(b => b + p.baseFret - 1),
  }));
}

/** Closed triad shapes on three strings (frets 0–15, span ≤ 4), lowest position first. */
export function triadInversions(name: string, strings: [number, number, number]): TriadShape[] {
  const tones = Chord.get(name).notes.slice(0, 3);
  if (tones.length < 3) return [];
  const chromas = tones.map(n => Note.chroma(n));
  const options = strings.map(s => [...Array(16).keys()].filter(f => chromas.includes(Note.chroma(noteAt(s, f)))));
  const shapes: TriadShape[] = [];
  for (const a of options[0]) for (const b of options[1]) for (const c of options[2]) {
    const frets = [a, b, c];
    if (Math.max(...frets) - Math.min(...frets) > 4) continue;
    const played = frets.map((f, i) => Note.chroma(noteAt(strings[i], f)));
    if (new Set(played).size !== 3) continue;
    const bass = chromas.indexOf(played[0]);
    shapes.push({ strings: [...strings], frets, bass: tones[bass], inversion: (['root', 'first', 'second'] as const)[bass] });
  }
  return shapes.sort((x, y) => Math.min(...x.frets) - Math.min(...y.frets));
}

/** The style's swing for its rhythms, or null when it plays straight (16ths when its feel names them, else 8ths). */
export function swingOf(p: StyleProfile | null | undefined): Swing | null {
  const r = p?.feel.swing_ratio;
  return r && r >= 1.2 ? { ratio: r, sixteenths: /16th/.test(p!.feel.subdivision) } : null;
}

/** Deterministic music for a lesson; these chords and scales are the only ones the LLM may reference. */
export function buildMusic({ key, track, style, element }: MusicInput): MusicContent {
  const chosen = element?.kind === 'progression' ? style?.progressions.find(p => p.id === element.id) : undefined;
  const roman = chosen?.roman ?? style?.progressions[0]?.roman ?? ['I', 'IV', 'V', 'I'];
  const chords = romanToChords(key, roman);
  const pattern = element?.kind === 'rhythm'
    ? style?.rhythm_patterns.find(p => p.id === element.id)
    : style?.rhythm_patterns.find(p => p.verified);
  const scaleName = style?.scales[0] ?? (Chord.get(chords[0]).quality === 'Minor' ? 'minor' : 'major');
  const voicings: Record<string, Voicing[]> = {};
  for (const c of new Set(chords)) voicings[c] = chordVoicings(c);
  return {
    key,
    scale: { tonic: key, name: scaleName, notes: Scale.get(`${key} ${scaleName}`).notes, positions: scalePositions(key, scaleName) },
    progression: { roman: roman.map(normalizeRoman), chords },
    voicings,
    rhythm: pattern ? { name: pattern.name, grid: pattern.grid, swing: swingOf(style), push: pattern.push ?? null } : null,
    // Always built (a triad skill's retest can land on a non-fretboard day), not gated by track.
    triads: [...triadInversions(chords[0], [3, 4, 5]), ...triadInversions(chords[0], [2, 3, 4])],
  };
}
