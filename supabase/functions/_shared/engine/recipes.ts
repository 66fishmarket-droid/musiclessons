import type { Skill } from './types.ts';

export type Card = 'pattern' | 'rhythm' | 'note_caller' | 'scale' | 'triads' | 'chords' | 'none';
export interface SkillRecipe {
  card: Card; patterns?: string[]; grid?: string; gridName?: string; degrees?: number[];
  steps: string[]; listenFor: string;
}

const LADDER = 'Start at {start_bpm} bpm. Add 5 bpm after each clean pass, up to {target_bpm}; drop back 5 after two misses in a row.';
const THROUGH = 'Once it is even, keep it going through {chords}, one chord per bar. The card shows each change.';

/** What the learner is told to do for each practice skill (spec §4). Slots: engine/render.ts. */
export const RECIPES: Record<string, SkillRecipe> = {
  'fingerstyle.l1.pima_pinches': {
    card: 'pattern', patterns: ['pinch', 'giuliani_pima'],
    steps: [
      'Fret {chord1}. Rest your thumb on string {root_string} (the root) and your index, middle and ring fingers on the top three strings.',
      'A pinch is the thumb and a finger plucking at the same instant. Play {pattern_name}: {pattern_counts}.',
      THROUGH, LADDER,
    ],
    listenFor: 'Both notes of each pinch landing as one sound, and every string at the same volume.',
  },
  'fingerstyle.l1.giuliani_arpeggios': {
    card: 'pattern', patterns: ['giuliani_pim', 'giuliani_pmi', 'giuliani_pimi', 'giuliani_pima'],
    steps: [
      'Fret {chord1}. Thumb on string {root_string} (the root); index, middle and ring on the top three strings.',
      'Play {pattern_name}: {pattern_counts}.', THROUGH, LADDER,
    ],
    listenFor: 'Even volume across the fingers, and the bass note ringing under the treble.',
  },
  'fingerstyle.l2.thumb_single_bass': {
    card: 'pattern', patterns: ['thumb_steady'],
    steps: [
      'Fret {chord1}. Your thumb plays string {root_string} (the root) once on every beat; the fingers stay still on the top strings.',
      'Rest the edge of your picking hand lightly on the strings by the bridge so the bass thuds a little.',
      'Count out loud while it runs: {pattern_counts}. The thumb must not drift.', THROUGH, LADDER,
    ],
    listenFor: 'Identical spacing and volume on every beat.',
  },
  'fingerstyle.l2.alternating_thumb': {
    card: 'pattern', patterns: ['thumb_alt'],
    steps: [
      'Fret {chord1}. The thumb alternates: the root on string {root_string}, then the alternate bass string the card shows.',
      'Play {pattern_name}: {pattern_counts}. Fingers stay off for now.', THROUGH, LADDER,
    ],
    listenFor: 'A steady boom-boom bass with no gap when the thumb changes string.',
  },
  'fingerstyle.l3.travis_basic': {
    card: 'pattern', patterns: ['thumb_alt', 'travis'],
    steps: [
      'Get {pattern_name} automatic on {chord1} first: {pattern_counts}.',
      'Then switch the card to Travis and add the fingers between the thumb notes, keeping the thumb exactly as it was.',
      THROUGH, LADDER,
    ],
    listenFor: 'The thumb never waiting for the fingers; the treble notes falling between the bass notes.',
  },
  'fingerstyle.l3.travis_changes': {
    card: 'pattern', patterns: ['travis'],
    steps: [
      'Play {pattern_name} on {chord1}: {pattern_counts}.',
      'Before you start the loop, look at where the root and alternate bass sit on each chord of {chords}.',
      'Play through {chords}, one chord per bar. Change the fretting hand a beat early if you need to; the thumb keeps time.', LADDER,
    ],
    listenFor: 'An unbroken bass line across every chord change.',
  },
  'fingerstyle.l4.accompaniment_patterns': {
    card: 'pattern', patterns: ['ballad', 'waltz', 'travis'],
    steps: [
      'Play {pattern_name} over {chords}, one chord per bar: {pattern_counts}.',
      'Switch the card to each of the other patterns and play the same chords with it.',
      'Keep the thumb on the root of each chord whatever the fingers do.', LADDER,
    ],
    listenFor: 'Each pattern keeping its own feel at the same tempo.',
  },
  'fingerstyle.l4.sing_over_pattern': {
    card: 'pattern', patterns: ['thumb_alt', 'ballad', 'travis'],
    steps: [
      'Run {pattern_name} through {chords}, one chord per bar, until you stop thinking about it.',
      'Hum one steady note over it for a full pass.', 'Now speak any line of words in rhythm over it.',
      'Now sing the line. If the hands stumble, go back to humming.',
    ],
    listenFor: 'The picking staying identical when the voice comes in.',
  },
  'fingerstyle.l5.melody_over_thumb': {
    card: 'pattern', patterns: ['thumb_steady', 'thumb_alt'],
    steps: [
      'Run {pattern_name} on {chord1}: {pattern_counts}.',
      'With a free finger, pick {degrees:1,3,5} one at a time on the top strings, on the beat, while the thumb carries on.',
      'Then move those notes between the beats. Stay on {chord1} until the bass never stops.', LADDER,
    ],
    listenFor: 'The bass carrying on untouched under every melody note.',
  },
  'fingerstyle.l5.arrange_own_song': {
    card: 'pattern', patterns: ['travis', 'ballad'],
    steps: [
      'Pick one of your songs and the pattern on the card that suits its feel.',
      'For each chord, find the root the thumb will play. Practise the changes with {chords} first.',
      'Play the whole song with the pattern, then record a full take with the app\'s recorder.',
    ],
    listenFor: 'The guitar supporting the voice, never competing with it.',
  },
};

/** The skill's recipe, or a generic one from its description until the recipe is written. */
export function recipeFor(skill: Skill): SkillRecipe {
  return RECIPES[skill.id] ?? {
    card: 'none',
    steps: [skill.description, skill.pass_metric === 'bpm' ? LADDER : 'Work through it slowly, then rate yourself honestly.'],
    listenFor: 'Clean, even time.',
  };
}
