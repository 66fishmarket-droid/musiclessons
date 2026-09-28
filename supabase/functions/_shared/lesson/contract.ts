import { Chord, Note } from 'tonal';
import type { BlockKind, LessonPlan, Skill } from '../engine/types.ts';

export interface Song { title: string; artist: string; why: string; capo: number }
export interface BlockContent { kind: BlockKind; instructions: string[]; target_text: string; tips: string; explanation: string }
export interface LessonContent {
  title: string; why_it_matters: string; theory_card: string; songs: Song[]; create_prompt: string;
  blocks: BlockContent[];
  /** Set only on the plan-only lesson built by fallbackLesson. */
  fallback?: true;
}
export type Validation = { ok: true; content: LessonContent } | { ok: false; errors: string[] };

const BLOCK_KINDS: BlockKind[] = ['warmup', 'retest', 'new_skill', 'reset', 'review', 'apply', 'create', 'record'];
const str = { type: 'string' } as const;

/** Structured-output schema sent to the model (strict mode: every property required, no extras). */
export const LESSON_JSON_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'why_it_matters', 'theory_card', 'songs', 'create_prompt', 'blocks'],
  properties: {
    title: str, why_it_matters: str, theory_card: str, create_prompt: str,
    songs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'artist', 'why', 'capo'],
      properties: { title: str, artist: str, why: str, capo: { type: 'integer' } } } },
    blocks: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['kind', 'instructions', 'target_text', 'tips', 'explanation'],
      properties: { kind: { type: 'string', enum: BLOCK_KINDS }, instructions: { type: 'array', items: str },
        target_text: str, tips: str, explanation: str } } },
  },
};

const BRACED = /\{([^{}]+)\}/g;
// Unbraced chord symbols must carry a quality or number, so the article "A" and note names ("the E string") never match.
const BARE = /(?<![\w#])[A-G][#b]?(?:(?:maj|min|m|dim|aug|sus|add|°|ø)\d{0,2}|\d{1,2})(?:b5|#5|b9|#9|#11)?(?:\/[A-G][#b]?)?(?![\w#])/g;

/** Spelling-independent chord identity: tonic pitch class + intervals ("A#m7" = "Bbm7" = "Bbmin7"); null if not a chord. */
export function chordKey(name: string): string | null {
  const c = Chord.get(name);
  return c.empty || !c.tonic ? null : `${Note.chroma(c.tonic)}:${c.intervals.join(',')}`;
}

// A progression written as dash-joined chords, e.g. "Dsus4–D–Dsus2" or "G–G/F#–Em" (bare letters count here).
const RUN = /(?<![\w#/])[A-G][#b]?[\w#°ø]*(?:\/[A-G][#b]?)?(?:[–—-][A-G][#b]?[\w#°ø]*(?:\/[A-G][#b]?)?)+/g;

/** Chords the lesson may name: the plan's progression and voicings plus every chord the day's curriculum text names. */
export function allowedChords(plan: LessonPlan, skills: Map<string, Skill>): string[] {
  const text = [plan.skill_id, plan.retest?.skill_id, plan.theory_topic_id]
    .map(id => (id ? skills.get(id)?.description ?? '' : '')).join(' ');
  const inRuns = [...text.matchAll(RUN)].flatMap(m => m[0].split(/[–—-]/));
  const named = [...inRuns, ...[...text.matchAll(BARE)].map(m => m[0])].filter(c => chordKey(c) !== null);
  return [...new Set([...plan.music.progression.chords, ...Object.keys(plan.music.voicings), ...named])];
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const nonEmpty = (v: unknown): v is string => isStr(v) && v.trim().length > 0;
const strings = (v: unknown): string[] =>
  isStr(v) ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];

/** Checks model output against the plan: shape, one block per plan block in order, songs, and only allowed chords. */
export function validateLesson(raw: unknown, plan: LessonPlan, skills: Map<string, Skill>, { minSongs = 3 } = {}): Validation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, errors: ['not a JSON object'] };
  const o = raw as Record<string, unknown>;
  const errors: string[] = [];
  if ('fallback' in o) errors.push('fallback: not allowed');
  for (const k of ['title', 'why_it_matters', 'theory_card', 'create_prompt']) if (!nonEmpty(o[k])) errors.push(`${k}: missing`);

  const songs = Array.isArray(o.songs) ? o.songs : [];
  if (songs.length < minSongs || songs.length > 3) errors.push(`songs: expected ${minSongs === 3 ? '3' : `${minSongs}-3`}, got ${songs.length}`);
  songs.forEach((s, i) => {
    const x = (s ?? {}) as Record<string, unknown>;
    if (!nonEmpty(x.title) || !nonEmpty(x.artist) || !isStr(x.why)) errors.push(`songs[${i}]: title and artist required`);
    if (!Number.isInteger(x.capo) || (x.capo as number) < 0 || (x.capo as number) > 12) errors.push(`songs[${i}].capo: expected 0-12`);
  });

  const blocks = Array.isArray(o.blocks) ? o.blocks : [];
  if (blocks.length !== plan.blocks.length) errors.push(`blocks: expected ${plan.blocks.length}, got ${blocks.length}`);
  blocks.forEach((b, i) => {
    const x = (b ?? {}) as Record<string, unknown>;
    const want = plan.blocks[i]?.kind;
    if (want && x.kind !== want) errors.push(`blocks[${i}].kind: expected ${want}, got ${String(x.kind)}`);
    if (!Array.isArray(x.instructions) || x.instructions.length === 0 || !x.instructions.every(nonEmpty)) {
      errors.push(`blocks[${i}].instructions: need at least one`);
    }
    for (const k of ['target_text', 'tips', 'explanation']) if (!isStr(x[k])) errors.push(`blocks[${i}].${k}: expected text`);
  });

  const allowed = new Set(allowedChords(plan, skills).map(chordKey));
  const bad = new Set<string>();
  for (const text of strings({ ...o, songs: undefined })) {
    for (const [, name] of text.matchAll(BRACED)) if (!allowed.has(chordKey(name.trim()))) bad.add(name.trim());
    for (const [name] of text.replace(BRACED, ' ').matchAll(BARE)) if (!allowed.has(chordKey(name))) bad.add(name);
  }
  bad.forEach(c => errors.push(`chord not in plan: ${c}`));
  return errors.length ? { ok: false, errors } : { ok: true, content: o as unknown as LessonContent };
}
