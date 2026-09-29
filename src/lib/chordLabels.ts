import { Chord, Note } from 'tonal';
import { chordVoicings, noteAt, type Voicing } from '../../supabase/functions/_shared/engine/music.ts';

export type DotMode = 'fingers' | 'intervals';
const DEGREE = ['R', 'b9', '9', 'b3', '3', '4', 'b5', '5', '#5', '6', 'b7', '7'];

function semitones(v: Voicing, chord: string): (number | null)[] {
  const tonic = Chord.get(chord).tonic;
  const root = tonic ? Note.chroma(tonic) : undefined;
  return v.frets.map((f, s) => (f < 0 || root === undefined ? null : (Note.chroma(noteAt(s, f))! - root + 12) % 12));
}

/** Label per string: the finger number ("" when open) or the interval from the chord root; null for muted strings. */
export function dotLabels(v: Voicing, chord: string, mode: DotMode): (string | null)[] {
  const iv = semitones(v, chord);
  return v.frets.map((f, s) => {
    if (f < 0) return null;
    if (mode === 'fingers') return f === 0 ? '' : String(v.fingers[s] || '');
    return iv[s] === null ? '' : DEGREE[iv[s]!];
  });
}

/** True where a string sounds the chord root (drawn in marigold). */
export function rootStrings(v: Voicing, chord: string): boolean[] {
  return semitones(v, chord).map(x => x === 0);
}

/** First fret of the 5-fret window: 1 when the shape fits at the nut, else its lowest fretted note. */
export function baseFret(v: Voicing): number {
  const fretted = v.frets.filter(f => f > 0);
  return fretted.length === 0 || Math.max(...fretted) <= 5 ? 1 : Math.min(...fretted);
}

/** Up to 6 shapes for a chord: the lesson's own voicings first, then chords-db; [] for names it doesn't know. */
export function shapesFor(chord: string, known: Voicing[] = []): Voicing[] {
  let more: Voicing[] = [];
  try { more = chordVoicings(chord, 6); } catch { /* not a chord name */ }
  const seen = new Set(known.map(v => v.frets.join()));
  return [...known, ...more.filter(v => !seen.has(v.frets.join()))].slice(0, 6);
}
