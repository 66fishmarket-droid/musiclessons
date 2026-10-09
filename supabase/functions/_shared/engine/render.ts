import { Interval, Scale } from 'tonal';
import { TUNING, type Voicing } from './music.ts';
import { PATTERNS, patternCounts, pullOff, rhythmCounts, rhythmPattern, voiceRoles, type PickPattern, type Swing } from './patterns.ts';
import type { LessonPlan, Target } from './types.ts';

/** Scale names whose {degrees:N} fallback (see resolveDegree) should use the key's natural minor, not major —
 * a rough but workable split: anything modal/coloured toward minor (including the blues family) counts as minor-family.
 * Also reused by planner.ts to keep majorKeyOnly recipes (recipes.ts) off minor-family style days. */
export const MINOR_FAMILY_SCALE = /minor|dorian|phrygian|aeolian|locrian|blues/i;
const PLAIN_QUALITY = new Set(['P', 'M', 'm']); // prefer these over d/A when a degree has more than one note (blues' b5/5)

/** The note the fretboard card actually labels degree N with, today. The card numbers dots by their tonal
 * interval degree (music.ts scalePositions), so {degrees:N} must agree: look first in the day's actual scale
 * (which may be a mode, a pentatonic, or blues) for a note whose interval is degree N, preferring a plain
 * (perfect/major/minor) quality over a diminished/augmented one when both exist. Only when the day's scale has
 * no note at that degree at all (a pentatonic's 4th/7th, blues' 2nd/6th) fall back to the key's 7-note parent
 * scale, which is the best a learner can do when the card itself has nothing there. */
function resolveDegree(key: string, dayScaleName: string, n: number): string {
  const day = Scale.get(`${key} ${dayScaleName}`);
  const matches = day.notes.length
    ? day.intervals.map((iv, i) => ({ iv, note: day.notes[i] })).filter(m => Interval.num(m.iv) === n)
    : [];
  if (matches.length) return (matches.find(m => PLAIN_QUALITY.has(Interval.get(m.iv).q)) ?? matches[0]).note;
  const parent = MINOR_FAMILY_SCALE.test(dayScaleName) ? 'minor' : 'major';
  return Scale.get(`${key} ${parent}`).notes[n - 1];
}

const FINGER_NAME = ['', 'index', 'middle', 'ring', 'little'];
/** The pull-off on this shape in words (patterns.ts pullOff, so text and card agree). */
function pullOffText(v: Voicing): string {
  const p = pullOff(v);
  if (!p) return 'this shape is one flat barre with nothing to pull off, so tap Other shapes for one with a finger above the barre, pick that note and flick the finger off it sideways';
  const f = v.fingers[p.string];
  return `pick string ${6 - p.string} (fret ${p.from}), then flick your ${FINGER_NAME[f] ? `${FINGER_NAME[f]} finger (${f})` : 'finger'} off it sideways so `
    + (p.to === 0 ? `the open ${TUNING[p.string].replace(/\d/, '')} string rings` : `the note under your barre (fret ${p.to}) rings`);
}

export interface SlotCtx {
  key: string; scale: string; chords: string[]; scaleNotes: string[]; target: Target | null;
  pattern: PickPattern | null; rhythm: PickPattern | null; rootString: number | null;
  /** "pick string 2 (fret 2), then flick your ring finger (3) off it sideways so the open B string rings": the first chord's pull-off, as the card plays it. */
  pullOff: string | null;
}

/** "G" · "G and B" · "G, B and D". */
export function listNotes(notes: string[]): string {
  return notes.length <= 1 ? notes.join('') : `${notes.slice(0, -1).join(', ')} and ${notes.at(-1)}`;
}

/** Everything a step template may mention, from the same plan data the cards draw. */
export function slotContext(plan: LessonPlan, opts: { target?: Target | null; patternId?: string | null; grid?: string | null; gridName?: string | null; swing?: Swing | null; push?: number | null }): SlotCtx {
  const { music } = plan;
  const chord1 = music.progression.chords[0];
  const v = chord1 ? music.voicings[chord1]?.[0] : undefined;
  const rhythm = opts.grid
    ? rhythmPattern(opts.gridName ?? 'Today\'s rhythm', opts.grid.split(''), opts.swing, opts.push)
    : music.rhythm ? rhythmPattern(music.rhythm.name, music.rhythm.grid, music.rhythm.swing, music.rhythm.push) : null;
  return {
    key: plan.key, scale: music.scale.name, chords: music.progression.chords, scaleNotes: music.scale.notes,
    target: opts.target ?? null, pattern: opts.patternId ? PATTERNS[opts.patternId] ?? null : null, rhythm,
    rootString: v && chord1 ? 6 - voiceRoles(v, chord1).bass : null, // guitarists count strings 6 (low E) to 1
    pullOff: v ? pullOffText(v) : null,
  };
}

const braced = (cs: string[]) => cs.map(c => `{${c}}`).join(' ');

/** Fills {slots}; throws on an unknown slot or one with no data, so a bad recipe fails its test, not the learner. */
export function renderSteps(templates: string[], ctx: SlotCtx): string[] {
  const t = ctx.target;
  const value = (slot: string): string | null => {
    const deg = /^degrees:([\d,]+)$/.exec(slot);
    if (deg) {
      const nums = deg[1].split(',').map(Number);
      if (nums.some(n => n < 1 || n > 7)) return null;
      return listNotes(nums.map(n => resolveDegree(ctx.key, ctx.scale, n)));
    }
    switch (slot) {
      case 'key': return ctx.key;
      case 'scale': return ctx.scale;
      case 'chords': return ctx.chords.length ? braced(ctx.chords) : null;
      case 'chord1': return ctx.chords[0] ? `{${ctx.chords[0]}}` : null;
      case 'root_string': return ctx.rootString !== null ? String(ctx.rootString) : null;
      case 'pull_off': return ctx.pullOff;
      case 'start_bpm': return t?.metric === 'bpm' && t.start !== null ? String(t.start) : null;
      case 'target_bpm': return t?.metric === 'bpm' && t.target !== null ? String(t.target) : null;
      case 'target_reps': return t?.metric === 'clean_reps' && t.target !== null ? String(t.target) : null;
      case 'pattern_name': return ctx.pattern?.name ?? null;
      case 'pattern_counts': return ctx.pattern ? patternCounts(ctx.pattern) : null;
      case 'rhythm_name': return ctx.rhythm?.name ?? null;
      case 'rhythm_counts': return ctx.rhythm ? rhythmCounts(ctx.rhythm) : null;
      default: return null;
    }
  };
  return templates.map(tpl => tpl.replace(/\{([a-z0-9_]+(?::[\d,]+)?)\}/g, (_, slot: string) => {
    const v = value(slot);
    if (v === null) throw new Error(`unfilled slot {${slot}}`);
    return v;
  }));
}
