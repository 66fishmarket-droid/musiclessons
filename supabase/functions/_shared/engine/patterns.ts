import { Chord, Interval, Note } from 'tonal';
import { TUNING, noteAt, type Voicing } from './music.ts';

export type Finger = 'p' | 'i' | 'm' | 'a';
/** bass = lowest root string; alt = alternate bass; t1/t2/t3 = highest, second- and third-highest sounding strings. */
export type Role = 'bass' | 'alt' | 't1' | 't2' | 't3';
/** Strum strokes from style rhythm grids: D/U down/up, d/u muted ghost strokes, x mute, choke or slap. */
export type Stroke = 'D' | 'U' | 'd' | 'u' | 'x';
export interface PickPattern {
  id: string; name: string; beatsPerBar: 3 | 4; stepsPerBeat: 1 | 2 | 3 | 4;
  /** Bars the steps span (default 1); the chord changes at each bar line. */
  bars?: number;
  /** One entry per step; several notes in a step sound together (a pinch); [] is a rest or a stroke. */
  steps: { finger: Finger; role: Role }[][];
  /** Style rhythms only: the strum stroke on each step, null where the step is picked or silent. */
  strokes?: (Stroke | null)[];
}
export interface PickNote { finger: Finger; role: Role; string: number; note: string; interval: string }

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

/** String index (0 = lowest) for each role on this voicing, worked out from semitones in the given tuning. */
export function voiceRoles(v: Voicing, chord: string, tuning: readonly string[] = TUNING): Record<Role, number> {
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
  return p.steps.map(step => step.map(({ finger, role }) => {
    const string = roles[role];
    const note = Note.transpose(tuning[string], Interval.fromSemitones(Math.max(0, v.frets[string])));
    const interval = tonic ? DEGREE[(Note.chroma(note)! - Note.chroma(tonic)! + 12) % 12] : '';
    return { finger, role, string, note, interval };
  }));
}

/** Progression index for the next bar: the shown chord if the learner just tapped it (or on the first bar), else the one after the last bar's. */
export function nextBarChord(lastPlayed: number, shown: number, count: number): number {
  return shown !== lastPlayed ? shown : (shown + 1) % count;
}

const FINGERS = [I, M, A]; // P in a rhythm grid: the fingers pluck the top three strings together
const PICKED: Record<string, PickPattern['steps'][number]> = { '-': [], B: [P], P: FINGERS, BP: [P, ...FINGERS], N: [n('i', 't1')] };

/**
 * A style rhythm grid as a playable pattern. Grids are 16 slots (4/4 in 16ths), 12 (3/4 in 16ths when the name says
 * 3/4, else a 12/8 feel: 4 beats of triplets) or 32 (two bars of 16ths). B thumb bass, P fingers, BP pinch, N single note.
 */
export function rhythmPattern(name: string, grid: string[]): PickPattern {
  const [beatsPerBar, stepsPerBeat, bars] =
    grid.length === 12 ? (name.includes('3/4') ? [3, 4, 1] : [4, 3, 1])
    : grid.length === 32 ? [4, 4, 2]
    : [4, 4, grid.length / 16]; // ponytail: other lengths assume 16ths; the catalogue test catches a new one
  return {
    id: `rhythm:${name}`, name, beatsPerBar: beatsPerBar as 3 | 4, stepsPerBeat: stepsPerBeat as 3 | 4, bars,
    steps: grid.map(t => PICKED[t] ?? []),
    strokes: grid.map(t => (t in PICKED ? null : t as Stroke)),
  };
}

const DOING: Record<string, string> = {
  B: 'thumb plays the bass note', P: 'fingers pluck the top strings', BP: 'thumb and fingers pluck together', N: 'play a single note',
  D: 'strum down', U: 'strum up', d: 'muted strum down', u: 'muted strum up', x: 'mute (slap or choke)',
};
const COUNT_SUB: Record<number, string[]> = { 1: [''], 2: ['', '&'], 3: ['', '-trip', '-let'], 4: ['', 'e', '&', 'a'] };

/** The rhythm in words, count by count ("1 thumb plays the bass note · 2 strum down"), so the lesson text can't misread the grid. */
export function rhythmCounts(p: PickPattern): string {
  const barLen = p.beatsPerBar * p.stepsPerBeat;
  const token = (k: number) => p.strokes?.[k] ?? (p.steps[k].length === 4 ? 'BP' : p.steps[k].length === 3 ? 'P' : p.steps[k][0]?.role === 'bass' ? 'B' : p.steps[k].length ? 'N' : null);
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
  return out.join(' · ');
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
