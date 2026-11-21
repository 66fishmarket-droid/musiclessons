import { Note, Scale } from 'tonal';
import { boxAt, degreeLabel, isGapless, scalePositions, TUNING, type FretNote, type ScaleWindow } from './music.ts';
import { MINOR_FAMILY_SCALE } from './render.ts';

export type Shape = 'C' | 'A' | 'G' | 'E' | 'D';
export type ScaleType = 'minor_pent' | 'major_pent' | 'major' | 'minor';
export interface PlacedShape {
  tonic: string; scaleName: string; chord: string; rootString: number; rootFret: number; from: number; to: number; notes: FretNote[];
}

/** The order scale positions are introduced (spec 2026-11-21): box 1 and its neighbour, the same dots as major, then full scales. */
export const LADDER: string[] = [
  'minor_pent:E', 'minor_pent:D', 'major_pent:G', 'major_pent:E',
  'major:E', 'major:A', 'major:C', 'major:G', 'major:D',
  'minor:E', 'minor:D', 'minor:C', 'minor:A', 'minor:G',
];

const CYCLE: Shape[] = ['C', 'A', 'G', 'E', 'D'];
const TONAL_NAME: Record<ScaleType, string> = {
  minor_pent: 'minor pentatonic', major_pent: 'major pentatonic', major: 'major', minor: 'minor',
};
// Root string (0 = low E) and the chord's fret span from its root fret, taken from the open chord each shape is named after.
const SHAPES: Record<Shape, { string: number; lo: number; hi: number }> = {
  E: { string: 0, lo: 0, hi: 2 }, A: { string: 1, lo: 0, hi: 2 }, D: { string: 2, lo: 0, hi: 3 },
  G: { string: 0, lo: -3, hi: 0 }, C: { string: 1, lo: -3, hi: 0 },
};

/** Splits a ladder id ('minor_pent:E') into its scale type and CAGED shape. */
export function parseRef(id: string): { type: ScaleType; shape: Shape } {
  const [type, shape] = id.split(':') as [ScaleType, Shape];
  return { type, shape };
}

/** Ladder ids of the same scale type whose shapes sit next to this one up or down the neck (C-A-G-E-D cycle). */
export function neighbours(id: string): string[] {
  const { type, shape } = parseRef(id);
  const i = CYCLE.indexOf(shape);
  return [CYCLE[(i + 4) % 5], CYCLE[(i + 1) % 5]].map(s => `${type}:${s}`).filter(n => LADDER.includes(n));
}

/** Major or minor parent of a day's scale (dorian → minor, mixolydian → major), so the warm-up stays on plain scales. */
export const dayParent = (scaleName: string): 'major' | 'minor' => (MINOR_FAMILY_SCALE.test(scaleName) ? 'minor' : 'major');

const isMinorType = (t: ScaleType) => t === 'minor' || t === 'minor_pent';

const placed = new Map<string, PlacedShape>();
/** One scale position wrapped around a CAGED chord shape in `tonic`, computed from semitones so it works in every key.
 * Memoised: the lesson thread and steps ask for the same few positions many times (12 tonics × 20 shapes at most). */
export function placeShape(tonic: string, type: ScaleType, shape: Shape): PlacedShape {
  const key = `${tonic}|${type}|${shape}`;
  if (!placed.has(key)) placed.set(key, computeShape(tonic, type, shape));
  return placed.get(key)!;
}

function computeShape(tonic: string, type: ScaleType, shape: Shape): PlacedShape {
  const scaleName = TONAL_NAME[type];
  const positions = scalePositions(tonic, scaleName, 17);
  const s = SHAPES[shape];
  let rootFret = (Note.chroma(tonic)! - Note.chroma(TUNING[s.string])! + 12) % 12;
  if (rootFret + s.lo < 0) rootFret += 12;
  const [lo, hi] = [rootFret + s.lo, rootFret + s.hi];
  const candidates: ScaleWindow[] = [];
  for (const span of [3, 4]) {
    for (const from of [lo - 1, lo]) if (from >= 0 && from + span >= hi) candidates.push(boxAt(positions, from, span));
  }
  const gapless = candidates.filter(c => isGapless(c, positions));
  const pool = gapless.length ? gapless.filter(c => c.to - c.from === gapless[0].to - gapless[0].from) : candidates;
  const best = pool.reduce((a, b) => (b.notes.length > a.notes.length ? b : a));
  return { tonic, scaleName, chord: `${tonic}${isMinorType(type) ? 'm' : ''}`, rootString: s.string, rootFret, ...best };
}

/** A board note as the learner reads it today: label counted in the day's parent scale, name spelled in that key
 * (a relative-key render can respell, e.g. Fb as E on a Db minor day, which would break letter-based labels). */
export function dayNote(dayTonic: string, parent: 'major' | 'minor', note: string): { label: string; name: string } {
  const spelled = Scale.get(`${dayTonic} ${parent}`).notes.find(n => Note.chroma(n) === Note.chroma(note)) ?? note;
  return { label: degreeLabel(dayTonic, spelled), name: spelled };
}

/** `p` moved by an octave (if that helps) so it overlaps `map` on the board: Connect needs shared notes to slide across. */
export function nearestTo(p: PlacedShape, map: PlacedShape): PlacedShape {
  const at = new Set(map.notes.map(n => `${n.string}/${n.fret}`));
  const shifted = [0, -12, 12].map(o => ({ ...p, rootFret: p.rootFret + o, from: p.from + o, to: p.to + o, notes: p.notes.map(n => ({ ...n, fret: n.fret + o })) }))
    .filter(s => s.from >= 0 && s.to <= 17);
  const shared = (s: PlacedShape) => s.notes.filter(n => at.has(`${n.string}/${n.fret}`)).length;
  return shifted.reduce((a, b) => (shared(b) > shared(a) ? b : a));
}

/** True when `to` can sit next to `map` on the neck with notes in common (an open C-shape has no D-shape below the nut). */
export function overlaps(map: string, to: string, dayTonic: string, parent: 'major' | 'minor'): boolean {
  const m = renderRef(map, dayTonic, parent);
  const at = new Set(m.notes.map(n => `${n.string}/${n.fret}`));
  return nearestTo(renderRef(to, dayTonic, parent), m).notes.some(n => at.has(`${n.string}/${n.fret}`));
}

/** A ladder position in today's key: a minor-type id on a major day uses the relative minor (and vice versa), same dots. */
export function renderRef(id: string, dayTonic: string, parent: 'major' | 'minor'): PlacedShape {
  const { type, shape } = parseRef(id);
  const minorRef = isMinorType(type);
  const tonic = minorRef === (parent === 'minor') ? dayTonic
    : Note.pitchClass(Note.transpose(dayTonic, minorRef ? '6M' : '3m'));
  return placeShape(Note.simplify(tonic), type, shape);
}
