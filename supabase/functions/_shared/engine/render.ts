import { PATTERNS, patternCounts, rhythmCounts, rhythmPattern, voiceRoles, type PickPattern } from './patterns.ts';
import type { LessonPlan, Target } from './types.ts';

export interface SlotCtx {
  key: string; scale: string; chords: string[]; scaleNotes: string[]; target: Target | null;
  pattern: PickPattern | null; rhythm: PickPattern | null; rootString: number | null;
}

/** "G" · "G and B" · "G, B and D". */
export function listNotes(notes: string[]): string {
  return notes.length <= 1 ? notes.join('') : `${notes.slice(0, -1).join(', ')} and ${notes.at(-1)}`;
}

/** Everything a step template may mention, from the same plan data the cards draw. */
export function slotContext(plan: LessonPlan, opts: { target?: Target | null; patternId?: string | null; grid?: string | null; gridName?: string | null }): SlotCtx {
  const { music } = plan;
  const chord1 = music.progression.chords[0];
  const v = chord1 ? music.voicings[chord1]?.[0] : undefined;
  const rhythm = opts.grid
    ? rhythmPattern(opts.gridName ?? 'Today\'s rhythm', opts.grid.split(''))
    : music.rhythm ? rhythmPattern(music.rhythm.name, music.rhythm.grid) : null;
  return {
    key: plan.key, scale: music.scale.name, chords: music.progression.chords, scaleNotes: music.scale.notes,
    target: opts.target ?? null, pattern: opts.patternId ? PATTERNS[opts.patternId] ?? null : null, rhythm,
    rootString: v && chord1 ? 6 - voiceRoles(v, chord1).bass : null, // guitarists count strings 6 (low E) to 1
  };
}

const braced = (cs: string[]) => cs.map(c => `{${c}}`).join(' ');

/** Fills {slots}; throws on an unknown slot or one with no data, so a bad recipe fails its test, not the learner. */
export function renderSteps(templates: string[], ctx: SlotCtx): string[] {
  const t = ctx.target;
  const value = (slot: string): string | null => {
    const deg = /^degrees:([\d,]+)$/.exec(slot);
    if (deg) return listNotes(deg[1].split(',').map(d => ctx.scaleNotes[Number(d) - 1]).filter(Boolean));
    switch (slot) {
      case 'key': return ctx.key;
      case 'scale': return ctx.scale;
      case 'chords': return ctx.chords.length ? braced(ctx.chords) : null;
      case 'chord1': return ctx.chords[0] ? `{${ctx.chords[0]}}` : null;
      case 'root_string': return ctx.rootString !== null ? String(ctx.rootString) : null;
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
