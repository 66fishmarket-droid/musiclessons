import { Chord, Note } from 'tonal';
import { dayNote, dayParent, nearestTo, parseRef, renderRef, type PlacedShape } from '../engine/scaleShapes.ts';
import type { LessonPlan, ScaleStep, VariationId } from '../engine/types.ts';

/** The warm-up's scale name in today's key: the plain parent (major/minor), pentatonic when the position is. */
export function warmScaleName(plan: LessonPlan, id: string): string {
  const parent = dayParent(plan.music.scale.name);
  return `${plan.key} ${parent}${parseRef(id).type.endsWith('pent') ? ' pentatonic' : ''}`;
}

/** "the A minor pentatonic position around the E-shape Am chord at fret 5 (same dots as C major pentatonic, so 1 is the note C)";
 * `short` drops the relative-key clause when the sentence already gave it. */
export function positionPhrase(plan: LessonPlan, id: string, short = false, placed?: PlacedShape): string {
  const p = placed ?? place(plan, id);
  const where = p.rootFret === 0 ? 'in open position' : `at fret ${p.rootFret}`;
  const own = `the ${p.tonic} ${p.scaleName} position around the ${parseRef(id).shape}-shape ${p.chord} chord ${where}`;
  return p.tonic === plan.key || short ? own : `${own} (same dots as ${warmScaleName(plan, id)}, so 1 is the note ${plan.key})`;
}

const place = (plan: LessonPlan, id: string): PlacedShape => renderRef(id, plan.key, dayParent(plan.music.scale.name));

/** A degree of the position's own scale ('b3' of A minor) as today's board labels it, with its note: "1 (the note C)". */
function targetPhrase(plan: LessonPlan, s: ScaleStep): string {
  const p = place(plan, s.ref!);
  const n = Number(s.degree!.replace('b', ''));
  const d = dayNote(plan.key, dayParent(plan.music.scale.name), p.notes.find(x => x.degree === n)?.note ?? p.tonic);
  return `${d.label} (the note ${d.name})`;
}

const VARY: Record<VariationId, (third: string) => string> = {
  from_3: third => `Vary it: play the same position starting from its lowest ${third}, up to the top and back down to that ${third}.`,
  descend: () => 'Vary it: play the same position top to bottom only, starting on the highest note and walking down.',
  threes: () => 'Vary it: groups of three up the position: the first, second and third notes, then the second, third and fourth, each group starting one note higher.',
  triplets: () => 'Vary it: play the position as triplets, three notes to each metronome click, accenting the first of each three.',
};

/** Where each chord's phrase lands: its 3rd when the position has it (the note that says major or minor), else its root,
 * else its 5th, else its 7th; a chord with none of them in the position (a borrowed chord) gets a rest, never an off-board note. */
function landings(p: PlacedShape, chords: string[]): string {
  const have = new Set(p.notes.map(n => Note.chroma(n.note)));
  const ROLES: [RegExp, string][] = [[/^3[Mm]$/, '3rd'], [/^1P$/, 'root'], [/^5[PdA]$/, '5th'], [/^7[Mmd]$/, '7th']];
  return chords.map(c => {
    const { notes, intervals } = Chord.get(c);
    for (const [re, role] of ROLES) {
      const i = intervals.findIndex(iv => re.test(iv));
      if (i >= 0 && have.has(Note.chroma(notes[i]))) return `the note ${Note.simplify(notes[i])} (its ${role}) over {${c}}`;
    }
    return `a rest over {${c}} (none of its notes are in this position)`;
  }).join(', ');
}

/** Warm-up instructions, one per scale_block step (the Player pairs them 1:1 with each step's board). */
export function scaleBlockSteps(plan: LessonPlan): string[] {
  const block = plan.scale_block!;
  const third = dayParent(plan.music.scale.name) === 'minor' ? 'b3' : '3';
  const chords = [...new Set(plan.music.progression.chords)];
  const lines = block.steps.map(s => {
    const pos = positionPhrase(plan, s.ref!);
    switch (s.kind) {
      case 'retrieve':
      {
        const target = targetPhrase(plan, s);
        return `Without looking: in ${pos}, play every ${target} in this position${target.startsWith('1 ') ? ', low to high' : ', then every 1'}. Tap Show to check.`;
      }
      case 'map': {
        const pent = parseRef(s.ref!).type.endsWith('pent');
        const fresh = s.ref === block.map && block.map_is_new;
        if (fresh && pent) return `New position: ${pos}. Fret the chord shape first, then climb the position from its lowest 1 to the top and back, slowly, singing each note's number.`;
        if (fresh) return `New position: ${pos}. Fret the chord, then play just its 1, 3 and 5, then add the 2 and 6, then the 4 and 7, singing each note's number.`;
        return `Map ${pos}: fret the chord shape first, then play the whole position slowly, low to high and back, singing each note's number.`;
      }
      case 'vary':
        return VARY[s.variation!](third);
      case 'connect':
        return `Connect: play ${positionPhrase(plan, s.ref!, true)}, then slide along one string into ${positionPhrase(plan, s.to!, true, nearestTo(place(plan, s.to!), place(plan, s.ref!)))} (the faded dots). Cross over on the notes the two share, and go across and back twice.`;
      case 'use':
        return `Use it: loop ${chords.map(c => `{${c}}`).join(' ')}, one chord per bar, and play 3-5 note phrases from this position, ending each phrase on a note of the chord: ${landings(place(plan, s.ref!), chords)}.`;
    }
  });
  lines[0] = `The drone plays the note ${plan.key} underneath; switch it off any time. ${lines[0]}`;
  return lines;
}
