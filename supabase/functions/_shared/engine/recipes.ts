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
  // Rhythm: a grid in style-grid tokens (B bass, P fingers, D/U strum, d/u muted ghost, x mute, - rest), 16 slots = one 4/4 bar in 16ths, 12 = 12/8 feel.
  'rhythm.l1.locked_8ths': {
    card: 'rhythm', grid: 'DUDUDUDUDUDUDUDU', gridName: 'Locked down-up 16ths',
    steps: [
      'Keep your pick hand swinging down-up-down-up in one constant motion, even over a silent beat, so it never stops or restarts.',
      'Strum {chord1}: {rhythm_counts}. Start with only the downs landing hard; keep the ups light and even.',
      'Then through {chords}, one chord per bar.', LADDER,
    ],
    listenFor: 'Down and up strokes perfectly even in spacing, with the hand never pausing between them.',
  },
  'rhythm.l1.accents_palm_mute': {
    card: 'rhythm', grid: 'D-U-d-u-D-U-d-u-', gridName: 'Accents with palm mutes',
    steps: [
      'Palm muting: rest the edge of your picking hand on the strings right by the bridge, so they thud instead of ring.',
      'Strum on {chord1}: {rhythm_counts}. Lift the palm for the bright arrows; keep it down for the faded (muted) ones.',
      'Then through {chords}, one chord per bar.', LADDER,
    ],
    listenFor: 'Loud open strums and soft thuds, with the time never wavering.',
  },
  'rhythm.l2.backbeat_chuck': {
    card: 'rhythm', grid: 'D-U-x-U-D-U-x-U-', gridName: 'Backbeat chuck on 2 and 4',
    steps: [
      'A chuck: relax your fretting hand just enough to kill the ring right as the pick hits, so the chord thuds instead of rings.',
      'Strum {chord1}: {rhythm_counts}. The × marks are chucks, not strums — mute with the fretting hand exactly on beats 2 and 4.',
      'Then through {chords}, one chord per bar.', LADDER,
    ],
    listenFor: 'A sharp, short thud on 2 and 4, as crisp as a snare hit.',
  },
  'rhythm.l2.ghost_strums': {
    card: 'rhythm', grid: 'duduDudududuDudu', gridName: 'Ghost strums, hits on 2 and 4',
    steps: [
      'A ghost strum: the hand keeps moving down-up on every 16th, but most strokes barely touch the strings, so most of what you hear is silence.',
      'Strum {chord1}: {rhythm_counts}. The faded arrows are ghosts; press only slightly harder on the notated hits.',
      'Then through {chords}, one chord per bar.', LADDER,
    ],
    listenFor: 'The hand never stopping, with only the named hits ringing out above the quiet ghosts.',
  },
  'rhythm.l3.anticipations': {
    card: 'rhythm', grid: 'D---D-U-D-U-D-D-', gridName: 'Anticipated change before beat 1',
    steps: [
      'An anticipated chord arrives an eighth early, on the "&" of beat 4, instead of landing right on beat 1.',
      'Strum {chord1}: {rhythm_counts}. That last hit is the anticipation — move the fretting hand there, just before the downbeat.',
      'Then through {chords}, changing early on the anticipation every time, one chord per bar.', LADDER,
    ],
    listenFor: 'The new chord already ringing a fraction before beat 1 lands, not after it.',
  },
  'rhythm.l3.shuffle_68': {
    card: 'rhythm', grid: 'B-DB-DB-DB-D', gridName: 'Shuffle (12/8 feel)',
    steps: [
      'A shuffle swings each beat into a long-short triplet feel — "1-a-lah, 2-a-lah" — instead of straight, even time.',
      'Play {chord1}: {rhythm_counts}. The bass note opens each triplet; the strum fills its last third.',
      'Then through {chords}, one chord per bar.', LADDER,
    ],
    listenFor: 'An even long-short swing on every beat that never straightens out into flat time.',
  },
  'rhythm.l4.dynamics_arrangement': {
    card: 'rhythm',
    steps: [
      'Play today\'s rhythm on {chord1} quiet and sparse, fingers only or a soft strum, the way you would behind a verse.',
      'Now play the same rhythm on {chord1} full and loud, like a chorus: bigger strum, harder attack.',
      'Play through {chords} once quiet, once loud, so the two passes sit far apart.',
      'Rate yourself 1–5 on how big the jump between quiet and loud really was.',
    ],
    listenFor: 'A real jump in volume and attack between the two passes, not a small nudge.',
  },
  'rhythm.l4.stops_breaks': {
    card: 'rhythm', grid: 'D' + '-'.repeat(15), gridName: 'Stop-time',
    steps: [
      'A stop-time hit: strike {chord1} once, sharp and short, then go dead silent — no ring, no pick noise, nothing moving.',
      'On beat 1: {rhythm_counts}. Hold that silence while you say or hum your line over it.',
      'Strike {chord1} again on the next beat 1 to re-enter exactly in time, then cut it dead again.',
      'Aim for {target_reps} clean passes in a row.',
    ],
    listenFor: 'Total silence after the hit, and the re-entry landing exactly on beat 1.',
  },
  'rhythm.l5.be_the_band': {
    card: 'rhythm', grid: 'B---D-U-B---D-U-', gridName: 'Boom-chuck: bass then backbeat stab',
    steps: [
      'Be the band: your thumb is the bass drum, your strum is the snare — one guitar covering both jobs at once.',
      'Play {chord1}: {rhythm_counts}. Thumb alone on beats 1 and 3; the down-up strum answers on 2 and 4.',
      'Then through {chords}, one chord per bar, keeping the thumb on the root of each new chord.', LADDER,
    ],
    listenFor: 'A steady bass pulse on 1 and 3 under a crisp strum on 2 and 4, like two players.',
  },
  'rhythm.l5.offbeat_stabs': {
    card: 'rhythm', grid: '--x---x---x---x-', gridName: 'Offbeat stabs (skank / chank)',
    steps: [
      'An offbeat stab: mute {chord1} completely, then snap the fretting hand tight the instant you strike, so only a short "chk" comes out.',
      'Play {chord1}: {rhythm_counts}. Every × lands on an "and" — never on the beat itself.',
      'Then through {chords}, one chord per bar, stabbing on every "and" and staying silent on the beats.', LADDER,
    ],
    listenFor: 'A crisp, short "chk" landing only between the beats, with true silence on the beats themselves.',
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
