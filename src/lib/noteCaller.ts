export const NATURALS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
export const ALL_NOTES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
/** Skills whose blocks show the note caller (the prompt tells the LLM the same). */
export const NOTE_CALLER_SKILLS = ['fretboard.l1.notes_e_a', 'fretboard.l1.octave_shapes'];

/** A random note from `set`, never the same as `prev`. */
export function nextCall(prev: string | null, set: string[], rand: () => number = Math.random): string {
  const pool = set.filter(n => n !== prev);
  return pool[Math.floor(rand() * pool.length)];
}

/** How the speech voice should say a note name. */
export const spoken = (note: string) => note.replace('#', ' sharp');
