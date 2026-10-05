import { Chord, Interval, Note } from 'tonal';
import { TUNING, noteAt, type Voicing } from './music.ts';

export type Finger = 'p' | 'i' | 'm' | 'a';
/** bass = lowest root string; alt = alternate bass; t1/t2/t3 = highest, second- and third-highest sounding strings.
 * riff_* = the boogie riff's root, 5th and 6th on the two lowest strings, placed from the chord name, not the shape. */
export type Role = 'bass' | 'alt' | 't1' | 't2' | 't3' | 'riff_root' | 'riff_5' | 'riff_6';
/** Strum strokes from style rhythm grids: D/U down/up, d/u muted ghost strokes, M/m palm-muted down/up, x mute, choke or slap. */
export type Stroke = 'D' | 'U' | 'd' | 'u' | 'M' | 'm' | 'x';
export interface PickPattern {
  id: string; name: string; beatsPerBar: 3 | 4; stepsPerBeat: 1 | 2 | 3 | 4;
  /** Bars the steps span (default 1); the chord changes at each bar line. */
  bars?: number;
  /** One entry per step; several notes in a step sound together (a pinch); [] is a rest or a stroke. */
  steps: { finger: Finger; role: Role }[][];
  /** Style rhythms only: the strum stroke on each step, null where the step is picked or silent. */
  strokes?: (Stroke | null)[];
  /** Swung style rhythms on a 16th grid: how late the offbeats fall (see swingOffset). */
  swing?: Swing;
}
/** A style's swing: long-to-short ratio of each offbeat pair, on 8ths (blues, jazz) or 16ths (funk, neo-soul). */
export interface Swing { ratio: number; sixteenths: boolean }
/** fret is set only for riff notes, which don't sit on the chord shape. */
export interface PickNote { finger: Finger; role: Role; string: number; note: string; interval: string; fret?: number }

/** The apply block's rhythm grid when the day has no style (steady down-strums, one per beat). */
export const APPLY_DEFAULT_GRID = 'D---D---D---D---';

const DEGREE = ['R', 'b9', '9', 'b3', '3', '4', 'b5', '5', '#5', '6', 'b7', '7'];
const n = (finger: Finger, role: Role) => ({ finger, role });
const P = n('p', 'bass'), PA = n('p', 'alt'), I = n('i', 't3'), M = n('m', 't2'), A = n('a', 't1');
const I2 = n('i', 't2'), M1 = n('m', 't1');
const bar = (cell: PickPattern['steps'], times: number): PickPattern['steps'] => Array.from({ length: times }, () => cell).flat();

/** Picking-hand patterns in teaching order (Giuliani Op.1, thumb independence, Travis, accompaniment families). */
export const PATTERNS: Record<string, PickPattern> = {
  giuliani_pim: { id: 'giuliani_pim', name: 'p-i-m', beatsPerBar: 4, stepsPerBeat: 3, steps: bar([[P], [I], [M]], 4) },
  giuliani_pmi: { id: 'giuliani_pmi', name: 'p-m-i', beatsPerBar: 4, stepsPerBeat: 3, steps: bar([[P], [M], [I]], 4) },
  giuliani_pimi: { id: 'giuliani_pimi', name: 'p-i-m-i', beatsPerBar: 4, stepsPerBeat: 2, steps: bar([[P], [I], [M], [I]], 2) },
  giuliani_pima: { id: 'giuliani_pima', name: 'p-i-m-a', beatsPerBar: 4, stepsPerBeat: 2, steps: bar([[P], [I], [M], [A]], 2) },
  pinch: { id: 'pinch', name: 'Pinch and pluck', beatsPerBar: 4, stepsPerBeat: 1, steps: [[P, A], [I], [PA, M], [I]] },
  thumb_steady: { id: 'thumb_steady', name: 'Steady thumb', beatsPerBar: 4, stepsPerBeat: 1, steps: bar([[P]], 4) },
  thumb_alt: { id: 'thumb_alt', name: 'Alternating thumb', beatsPerBar: 4, stepsPerBeat: 1, steps: bar([[P], [PA]], 2) },
  travis: { id: 'travis', name: 'Travis', beatsPerBar: 4, stepsPerBeat: 2, steps: [[P, M1], [], [PA], [I2], [P], [M1], [PA], [I2]] },
  ballad: { id: 'ballad', name: 'Ballad p-i-m-a-m-i', beatsPerBar: 3, stepsPerBeat: 2, steps: [[P], [I], [M], [A], [M], [I]] },
  waltz: { id: 'waltz', name: 'Waltz boom-chuck-chuck', beatsPerBar: 3, stepsPerBeat: 1, steps: [[P], [I, M, A], [I, M, A]] },
};

/** Boogie riff root: the chord's root on string 6 or 5, whichever is the lower fret, so I and IV sit at the same fret a string apart. */
export function riffRoot(chord: string, tuning: readonly string[] = TUNING): { string: number; fret: number } {
  const root = Note.chroma(Chord.get(chord).tonic ?? 'C')!;
  const fretOn = (s: number) => (root - Note.chroma(tuning[s])! + 12) % 12;
  return fretOn(0) <= fretOn(1) ? { string: 0, fret: fretOn(0) } : { string: 1, fret: fretOn(1) };
}

/** String index (0 = lowest) for each role on this voicing, worked out from semitones in the given tuning. */
export function voiceRoles(v: Voicing, chord: string, tuning: readonly string[] = TUNING): Record<Exclude<Role, `riff_${string}`>, number> {
  const tonic = Chord.get(chord).tonic;
  const root = tonic ? Note.chroma(tonic) : undefined;
  const sounding = v.frets.flatMap((f, s) => (f >= 0 ? [s] : []));
  const iv = (s: number) => (root === undefined ? -1 : (Note.chroma(noteAt(s, v.frets[s], tuning))! - root + 12) % 12);
  const [t1, t2, t3] = [...sounding].reverse();
  const bass = sounding.find(s => iv(s) === 0) ?? sounding[0];
  const below = sounding.filter(s => s > bass && s < t3);
  const alt = below.find(s => iv(s) === 7) ?? below[0] ?? t3;
  return { bass, alt, t1, t2, t3 };
}

/** Each step of a pattern on this chord shape: finger, role, string, pitch with octave, and interval from the root. */
export function resolvePattern(p: PickPattern, v: Voicing, chord: string, tuning: readonly string[] = TUNING): PickNote[][] {
  const roles = voiceRoles(v, chord, tuning);
  const tonic = Chord.get(chord).tonic;
  const riff = riffRoot(chord, tuning);
  const RIFF = { riff_root: [0, 0], riff_5: [1, 2], riff_6: [1, 4] } as const; // [strings up, frets up] from the riff root
  return p.steps.map(step => step.map(({ finger, role }) => {
    const r = role.startsWith('riff_') ? RIFF[role as keyof typeof RIFF] : null;
    const string = r ? riff.string + r[0] : roles[role as keyof typeof roles];
    const fret = r ? riff.fret + r[1] : Math.max(0, v.frets[string]);
    const note = Note.transpose(tuning[string], Interval.fromSemitones(fret));
    const interval = tonic ? DEGREE[(Note.chroma(note)! - Note.chroma(tonic)! + 12) % 12] : '';
    return r ? { finger, role, string, note, interval, fret } : { finger, role, string, note, interval };
  }));
}

/** Progression index for the next bar: the shown chord if the learner just tapped it (or on the first bar), else the one after the last bar's. */
export function nextBarChord(lastPlayed: number, shown: number, count: number): number {
  return shown !== lastPlayed ? shown : (shown + 1) % count;
}

const FINGERS = [I, M, A]; // P in a rhythm grid: the fingers pluck the top three strings together
const PICKED: Record<string, PickPattern['steps'][number]> = {
  '-': [], B: [P], P: FINGERS, BP: [P, ...FINGERS], N: [n('i', 't1')],
  5: [n('p', 'riff_root'), n('p', 'riff_5')], 6: [n('p', 'riff_root'), n('p', 'riff_6')],
};

/**
 * A style rhythm grid as a playable pattern. Grids are 16 slots (4/4 in 16ths), 12 (3/4 in 16ths when the name says
 * 3/4, else a 12/8 feel: 4 beats of triplets) or 32 (two bars of 16ths). B thumb bass, P fingers, BP pinch, N single note,
 * 5/6 the boogie riff's root + 5th / root + 6th.
 */
export function rhythmPattern(name: string, grid: string[], swing?: Swing | null): PickPattern {
  const [beatsPerBar, stepsPerBeat, bars] =
    grid.length === 12 ? (name.includes('3/4') ? [3, 4, 1] : [4, 3, 1])
    : grid.length === 32 ? [4, 4, 2]
    : [4, 4, grid.length / 16]; // ponytail: other lengths assume 16ths; the catalogue test catches a new one
  return {
    id: `rhythm:${name}`, name, beatsPerBar: beatsPerBar as 3 | 4, stepsPerBeat: stepsPerBeat as 3 | 4, bars,
    steps: grid.map(t => PICKED[t] ?? []),
    strokes: grid.map(t => (t in PICKED ? null : t as Stroke)),
    // 12-slot grids are already written in triplets; below 1.2 the lilt is too small to hear.
    ...(swing && swing.ratio >= 1.2 && stepsPerBeat === 4 ? { swing } : {}),
  };
}

/** How late step k sounds, as a fraction of a beat: the swung offbeat of each pair moves from halfway to ratio/(1+ratio). */
export function swingOffset(p: PickPattern, k: number): number {
  if (!p.swing) return 0;
  const shift = p.swing.ratio / (1 + p.swing.ratio) - 0.5;
  const inBeat = k % p.stepsPerBeat;
  return p.swing.sixteenths ? (inBeat % 2 === 1 ? shift / 2 : 0) : inBeat === 2 ? shift : 0;
}

const DOING: Record<string, string> = {
  B: 'thumb plays the bass note', P: 'fingers pluck the top strings', BP: 'thumb and fingers pluck together', N: 'play a single note',
  D: 'strum down', U: 'strum up', d: 'muted strum down', u: 'muted strum up', x: 'mute (slap or choke)',
  M: 'palm-muted strum down', m: 'palm-muted strum up',
  5: 'root + 5th', 6: 'root + 6th',
};
/** Said before a riff's counts, so "root-5/root-6" is never left undefined. */
const RIFF_HOW = 'Root-5/root-6 means two notes on neighbouring low strings, picked down together. For each chord, put your first finger '
  + "on its root (string 6 or 5, the fret the card shows) and your third finger two frets higher on the next string: that's the root + 5th, "
  + 'a power chord. For the root + 6th, reach your little finger two frets past that. Swing it: the 5th is long, the 6th comes late '
  + 'and short on the "-let" of each beat. Counts:';
const COUNT_SUB: Record<number, string[]> = { 1: [''], 2: ['', '&'], 3: ['', '-trip', '-let'], 4: ['', 'e', '&', 'a'] };

/** The rhythm in words, count by count ("1 thumb plays the bass note · 2 strum down"), so the lesson text can't misread the grid. */
export function rhythmCounts(p: PickPattern): string {
  const barLen = p.beatsPerBar * p.stepsPerBeat;
  const riff = (k: number) => p.steps[k].find(s => s.role === 'riff_5' || s.role === 'riff_6')?.role.slice(-1);
  const token = (k: number) => p.strokes?.[k] ?? riff(k) ?? (p.steps[k].length === 4 ? 'BP' : p.steps[k].length === 3 ? 'P' : p.steps[k][0]?.role === 'bass' ? 'B' : p.steps[k].length ? 'N' : null);
  const out: string[] = [];
  let lastBar = 0;
  p.steps.forEach((_, k) => {
    const t = token(k);
    if (!t) return;
    const bar = Math.floor(k / barLen), inBar = k % barLen;
    const count = `${Math.floor(inBar / p.stepsPerBeat) + 1}${COUNT_SUB[p.stepsPerBeat][inBar % p.stepsPerBeat]}`;
    out.push(`${bar > lastBar ? `bar ${bar + 1}: ` : ''}${count} ${DOING[t]}`);
    lastBar = bar;
  });
  const counts = out.join(' · ');
  const swung = p.swing ? (p.swing.sixteenths
    ? 'Swung: in each pair of 16ths the first is longer, so every "e" and "a" lands a little late. '
    : 'Swung: in each pair of 8ths the first is longer, so every "&" lands late. ') : '';
  return `${p.steps.some((_, k) => riff(k)) ? `${RIFF_HOW} ` : ''}${swung}${counts}`;
}

const FINGER_WORD = { p: 'thumb', i: 'index', m: 'middle', a: 'ring' } as const;

/** A picking pattern in words, count by count ("1 thumb + ring together · 2 index"), so steps match the animated card. */
export function patternCounts(p: PickPattern): string {
  const barLen = p.beatsPerBar * p.stepsPerBeat;
  return p.steps.flatMap((step, k) => {
    if (step.length === 0) return [];
    const inBar = k % barLen;
    const count = `${Math.floor(inBar / p.stepsPerBeat) + 1}${COUNT_SUB[p.stepsPerBeat][inBar % p.stepsPerBeat]}`;
    const words = step.map(n => `${FINGER_WORD[n.finger]}${n.finger === 'p' && n.role === 'alt' ? ' (alternate bass)' : ''}`);
    return [`${count} ${words.join(' + ')}${step.length > 1 ? ' together' : ''}`];
  }).join(' · ');
}
