import { Chord, Interval, Note } from 'tonal';
import { TUNING, noteAt, type Voicing } from './music.ts';

export type Finger = 'p' | 'i' | 'm' | 'a';
/** bass = lowest root string; alt = alternate bass; t1/t2/t3 = highest, second- and third-highest sounding strings. */
export type Role = 'bass' | 'alt' | 't1' | 't2' | 't3';
export interface PickPattern {
  id: string; name: string; beatsPerBar: 3 | 4; stepsPerBeat: 1 | 2 | 3;
  /** One entry per step; several notes in a step sound together (a pinch); [] is a rest. */
  steps: { finger: Finger; role: Role }[][];
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

/** Which patterns each fingerstyle skill practises, easiest first. */
export const SKILL_PATTERNS: Record<string, string[]> = {
  'fingerstyle.l1.pima_pinches': ['giuliani_pima', 'pinch'],
  'fingerstyle.l1.giuliani_arpeggios': ['giuliani_pim', 'giuliani_pmi', 'giuliani_pimi', 'giuliani_pima'],
  'fingerstyle.l2.thumb_single_bass': ['thumb_steady'],
  'fingerstyle.l2.alternating_thumb': ['thumb_alt'],
  'fingerstyle.l3.travis_basic': ['thumb_alt', 'travis'],
  'fingerstyle.l3.travis_changes': ['travis'],
  'fingerstyle.l4.accompaniment_patterns': ['ballad', 'waltz', 'travis'],
  'fingerstyle.l4.sing_over_pattern': ['thumb_alt', 'ballad', 'travis'],
  'fingerstyle.l5.melody_over_thumb': ['thumb_steady', 'thumb_alt'],
  'fingerstyle.l5.arrange_own_song': ['travis', 'ballad'],
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
