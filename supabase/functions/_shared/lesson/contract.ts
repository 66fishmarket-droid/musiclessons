import type { Swing } from '../engine/patterns.ts';
import { Chord, Note } from 'tonal';
import { romanToChords } from '../engine/roman.ts';
import { STYLE_CATALOG } from '../engine/styles.ts';
import type { BlockKind, LessonPlan, Skill } from '../engine/types.ts';

export interface Song { title: string; artist: string; why: string; capo: number }
/** `tips`/`explanation` exist only on lessons stored before the engine wrote the steps. */
export interface BlockContent { kind: BlockKind; instructions: string[]; target_text: string; listen_for: string; more: string; tips?: string; explanation?: string; rhythms?: (ReviewRhythm | null)[] }
/** A style rhythm review step's pattern, for the app's card. */
export interface ReviewRhythm { name: string; grid: string[]; swing?: Swing | null }
export interface LessonContent {
  title: string; why_it_matters: string; theory_card: string; songs: Song[]; create_prompt: string;
  blocks: BlockContent[];
  /** Set only on the plan-only lesson served when every model fails. */
  fallback?: true;
}
/** What the model writes: everything else in a lesson comes from the engine (buildSteps). */
export interface Colour { title: string; why_it_matters: string; theory_card: string; songs: Song[]; blocks: { kind: BlockKind; more: string }[] }

const BLOCK_KINDS: BlockKind[] = ['warmup', 'retest', 'new_skill', 'reset', 'review', 'apply', 'create', 'record'];
const str = { type: 'string' } as const;

/** Structured-output schema sent to the model (strict mode: every property required, no extras). */
export const COLOUR_JSON_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'why_it_matters', 'theory_card', 'songs', 'blocks'],
  properties: {
    title: str, why_it_matters: str, theory_card: str,
    songs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'artist', 'why', 'capo'],
      properties: { title: str, artist: str, why: str, capo: { type: 'integer' } } } },
    blocks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'more'],
      properties: { kind: { type: 'string', enum: BLOCK_KINDS }, more: str } } },
  },
};

const BRACED = /\{([^{}]+)\}/g;
// Unbraced chord symbols must carry a quality or a chord number (6, 7, 9, 11, 13, 69), so the article "A", note names
// ("the E string") and notes with octaves ("A2", "E5" in a vocal range) never match. A bare "E5" power chord is
// therefore unchecked; braced {E5} still is.
const BARE = /(?<![\w#])[A-G][#b]?(?:(?:maj|min|m|dim|aug|sus|add|°|ø)\d{0,2}|69|13|11|[679])(?:b5|#5|b9|#9|#11)?(?:sus[24]?|add\d{1,2})?(?:\/[A-G][#b]?)?(?![\w#])/g;

/** Spelling-independent chord identity: tonic pitch class + intervals ("A#m7" = "Bbm7" = "Bbmin7"); null if not a chord. */
export function chordKey(name: string): string | null {
  const c = Chord.get(name);
  return c.empty || !c.tonic ? null : `${Note.chroma(c.tonic)}:${c.intervals.join(',')}`;
}

// A progression written as dash-joined chords, e.g. "Dsus4–D–Dsus2" or "G–G/F#–Em" (bare letters count here).
const RUN = /(?<![\w#/])[A-G][#b]?[\w#°ø]*(?:\/[A-G][#b]?)?(?:[–—-][A-G][#b]?[\w#°ø]*(?:\/[A-G][#b]?)?)+/g;

/** A review item's style progression, transposed into today's key (steps.ts reviewStyleLine builds the same line). */
function reviewProgressionChords(plan: LessonPlan): string[] {
  return plan.review.flatMap(r => {
    if (r.item_type !== 'style') return [];
    const element = STYLE_CATALOG.elements.find(e => e.id === r.ref && e.kind === 'progression');
    const prog = element && STYLE_CATALOG.profiles.find(p => p.id === element.style)?.progressions.find(p => p.id === element.id);
    return prog ? romanToChords(plan.key, prog.roman) : [];
  });
}

/** Chords the lesson may name: the plan's progression and voicings, every chord the day's curriculum text names,
 * and any style-progression review item's chords in today's key (steps.ts already says these in the review block). */
export function allowedChords(plan: LessonPlan, skills: Map<string, Skill>): string[] {
  const text = [plan.skill_id, plan.retest?.skill_id, plan.theory_topic_id]
    .map(id => (id ? skills.get(id)?.description ?? '' : '')).join(' ');
  const inRuns = [...text.matchAll(RUN)].flatMap(m => m[0].split(/[–—-]/));
  const named = [...inRuns, ...[...text.matchAll(BARE)].map(m => m[0])].filter(c => chordKey(c) !== null);
  return [...new Set([...plan.music.progression.chords, ...Object.keys(plan.music.voicings), ...named, ...reviewProgressionChords(plan)])];
}

/** Non-theory curriculum skill names the model may not use: neither met nor already named in the engine's own
 * steps text. Shared by validateColour (rejects them) and the brief's `avoid_names` (tells the model up front). */
export function avoidNames(plan: LessonPlan, skills: Map<string, Skill>, metSkills: string[], stepsText: string): string[] {
  const allowedNames = new Set([plan.skill_id, plan.retest?.skill_id, ...metSkills]
    .map(id => (id ? skills.get(id)?.name.toLowerCase() : undefined)).filter((n): n is string => !!n));
  const steps = stepsText.toLowerCase();
  return [...skills.values()]
    .filter(s => s.track !== 'theory' && !allowedNames.has(s.name.toLowerCase()) && !steps.includes(s.name.toLowerCase()))
    .map(s => s.name);
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const nonEmpty = (v: unknown): v is string => isStr(v) && v.trim().length > 0;
const strings = (v: unknown): string[] =>
  isStr(v) ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];

const TEMPO = /\b\d+\s?bpm\b/i;
const REPS = /\b\d+\s+(?:clean\s+)?reps?\b/i;

/**
 * Checks model colour against the plan: shape, one block per plan block in order, songs, only allowed chords, no tempos or
 * rep counts, and no curriculum skill the learner has not met (unless the engine's steps already name it).
 */
export function validateColour(
  raw: unknown, plan: LessonPlan, skills: Map<string, Skill>, ctx: { metSkills: string[]; stepsText: string }, { minSongs = 3 } = {},
): { ok: true; colour: Colour } | { ok: false; errors: string[] } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, errors: ['not a JSON object'] };
  const o = raw as Record<string, unknown>;
  const errors: string[] = [];
  if ('fallback' in o) errors.push('fallback: not allowed');
  for (const k of ['title', 'why_it_matters', 'theory_card']) if (!nonEmpty(o[k])) errors.push(`${k}: missing`);

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
    if (!isStr(x.more)) errors.push(`blocks[${i}].more: expected text`);
    else if (x.more.length > 400) errors.push(`blocks[${i}].more: ${x.more.length} characters, max 400`);
  });

  const texts = strings({ ...o, songs: undefined });
  const allowed = new Set(allowedChords(plan, skills).map(chordKey));
  const bad = new Set<string>();
  for (const text of texts) {
    for (const [, name] of text.matchAll(BRACED)) if (!allowed.has(chordKey(name.trim()))) bad.add(name.trim());
    for (const [name] of text.replace(BRACED, ' ').matchAll(BARE)) if (!allowed.has(chordKey(name))) bad.add(name);
  }
  bad.forEach(c => errors.push(`chord not in plan: ${c}`));

  const allowedNames = new Set([plan.skill_id, plan.retest?.skill_id, ...ctx.metSkills]
    .map(id => (id ? skills.get(id)?.name.toLowerCase() : undefined)).filter((n): n is string => !!n));
  const avoid = avoidNames(plan, skills, ctx.metSkills, ctx.stepsText);
  for (const text of texts) {
    if (TEMPO.test(text)) errors.push(`tempo in text: ${text.match(TEMPO)![0]}`);
    if (REPS.test(text)) errors.push(`rep count in text: ${text.match(REPS)![0]}`);
    // Blank out allowed names first: "Melody over a steady thumb" must not count as naming "Steady thumb".
    const lower = [...allowedNames].reduce((t, n) => t.replaceAll(n, ' '), text.toLowerCase());
    for (const name of avoid) if (lower.includes(name.toLowerCase())) errors.push(`unmet skill named: ${name}`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, colour: o as unknown as Colour };
}
