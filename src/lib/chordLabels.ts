import { Chord, Note } from 'tonal';
import { chordVoicings, noteAt, type Voicing } from '../../supabase/functions/_shared/engine/music.ts';
import type { LessonPlan, Skill } from '../../supabase/functions/_shared/engine/types.ts';
import type { LessonContent } from '../../supabase/functions/_shared/lesson/contract.ts';
import { buildSteps } from '../../supabase/functions/_shared/lesson/steps.ts';

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

type KV = Pick<Storage, 'getItem' | 'setItem'>;
const SHAPE_KEY = (chord: string) => `shape:${chord}`;

/** The shape to draw for a chord: the one the learner picked under Other shapes (this device), else the lesson's first. */
export function shapeFor(chord: string, known: Voicing[] = [], kv: KV = localStorage): Voicing | undefined {
  let picked: string | null = null;
  try { picked = kv.getItem(SHAPE_KEY(chord)); } catch { /* storage blocked: use the lesson's */ }
  return (picked ? shapesFor(chord, known).find(v => v.frets.join() === picked) : undefined) ?? known[0];
}

/** Makes `v` this chord's default shape on this device (VoicingSheet "Use this shape"). */
export function pickShape(chord: string, v: Voicing, kv: KV = localStorage): void {
  try { kv.setItem(SHAPE_KEY(chord), v.frets.join()); } catch { /* storage blocked: the pick is not kept */ }
}

/** The lesson's text re-rendered with the learner's picked shapes, so steps naming a finger, string or fret ({pull_off},
 * {hammer_on}, {root_string}) describe the shape the card draws. Owner 2026-10-19. Unchanged when nothing was picked. */
export function withPickedShapes(content: LessonContent, plan: LessonPlan, skills: Map<string, Skill>, kv: KV = localStorage): LessonContent {
  const voicings = { ...plan.music.voicings };
  let changed = false;
  for (const c of plan.music.progression.chords) {
    const v = shapeFor(c, voicings[c], kv);
    if (v && v !== voicings[c]?.[0]) { voicings[c] = [v, ...(voicings[c] ?? []).filter(k => k !== v)]; changed = true; }
  }
  if (!changed) return content;
  try {
    const steps = buildSteps({ ...plan, music: { ...plan.music, voicings } }, skills);
    return { ...content, blocks: content.blocks.map((b, i) => (steps.blocks[i] ? { ...b, instructions: steps.blocks[i].instructions } : b)) };
  } catch { return content; } // a shape the engine can't describe: keep the stored text
}
