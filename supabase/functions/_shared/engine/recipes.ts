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
  // Ear & voice: scale card, degrees highlighted on the fretboard; drone from the metronome card; no mic, so every step ends in self-rating.
  'ear_voice.l1.pitch_match': {
    card: 'scale', degrees: [1],
    steps: [
      'Turn on the drone for {degrees:1}, the home note. Hum along until your note locks on with no wobble.',
      'Now play {degrees:1} on the guitar, stop the drone, and sing that exact pitch from memory.',
      'Play {degrees:1} again to check: did you land on it, above it, or below it?',
      'Rate yourself 1–5 on how close your pitch matching was today.',
    ],
    listenFor: 'Your sung note settling into the drone until you cannot hear two separate pitches.',
  },
  'ear_voice.l1.sing_135': {
    card: 'scale', degrees: [1, 3, 5],
    steps: [
      'Turn on the drone. Play {degrees:1} on the guitar and sing it: that is 1, the home note.',
      'Sing up 1-3-5, that is {degrees:1,3,5}, then back down. Play each note first if you lose it.',
      'Now sing 5-4-3-2-1: {degrees:5,4,3,2,1}.', 'Rate yourself 1–5 on how close each note felt.',
    ],
    listenFor: 'Each sung note blending with the drone instead of wobbling against it.',
  },
  'ear_voice.l2.sing_all_degrees': {
    card: 'scale', degrees: [1, 2, 3, 4, 5, 6, 7],
    steps: [
      'Turn on the drone. Sing {degrees:1,2,3,4,5,6,7} one at a time, low to high, checking each against the drone.',
      'Now sing each degree again, but resolve it back to {degrees:1} before you move to the next one.',
      'Go in a random order instead of straight up the scale, resolving home every time.',
      'Rate yourself 1–5 on how quickly each degree found its way home.',
    ],
    listenFor: 'Every degree settling cleanly onto the drone\'s note when it resolves.',
  },
  'ear_voice.l2.sing_roots': {
    card: 'scale', degrees: [1, 4, 5, 6],
    steps: [
      'These roots live at {degrees:1,4,5,6}. Play each one on the guitar first so your ear knows where home, four, five and six sit.',
      'Now strum {chords}, one chord per bar, and sing the root of each one as it changes.',
      'Go again. This time call out each chord\'s number in the loop ("one", "four", "five"…) right after you sing its root.',
      'Rate yourself 1–5 on how fast you found each new root.',
    ],
    listenFor: 'Your sung root landing exactly as each new chord arrives, not a beat late.',
  },
  'ear_voice.l3.sing_chord_tones': {
    card: 'scale', degrees: [1, 3, 5],
    steps: [
      'Warm up the shape first: sing {degrees:1,3,5} in order, low to high, over the drone.',
      'Strum {chord1} and let it ring a full bar. Sing that chord\'s own root, then its 3rd, then its 5th.',
      'Go through {chords}, one whole-note strum per chord, singing root-3rd-5th before you strum the next one.',
      'Rate yourself 1–5 on how many chords you got by ear before strumming.',
    ],
    listenFor: 'Three clearly separate pitches inside each chord, landing low to high without sliding.',
  },
  'ear_voice.l3.harmony_thirds_sixths': {
    card: 'scale', degrees: [1, 3, 6],
    steps: [
      'Play {degrees:1} on the guitar: that is your melody note. A 3rd above it is {degrees:3}; play and sing that.',
      'A 6th above {degrees:1} is {degrees:6}. Play it, then sing it, keeping {degrees:1} ringing under it if you can.',
      'Pick any other scale degree as your melody note, play it, then sing a 3rd or a 6th above it from memory.',
      'Rate yourself 1–5 on how in-tune each harmony note felt against the melody note.',
    ],
    listenFor: 'The harmony note sitting clearly above the melody note, never unison or below it.',
  },
  'ear_voice.l4.colour_notes': {
    card: 'scale', degrees: [3, 4, 5, 6, 7],
    steps: [
      'Turn on the drone. b7 sits one fret below {degrees:7}; b3 sits one fret below {degrees:3}. Play and sing each against the drone.',
      'b6 sits one fret below {degrees:6}; #4 sits one fret above {degrees:4}. Play and sing those two the same way.',
      'Pick any two colour notes and sing them back to back, without replaying them on the guitar first.',
      'Rate yourself 1–5 on how confidently you found each colour note by ear.',
    ],
    listenFor: 'Each colour note sitting clearly darker or brighter than its nearby scale degree, not identical to it.',
  },
  'ear_voice.l4.borrowed_chords_by_ear': {
    card: 'scale', degrees: [4, 6, 7],
    steps: [
      'Play {chords} straight through once so the plain, diatonic version is fresh in your ear.',
      'iv and bVI borrow a note from outside the key: one fret below {degrees:6} (b6); bVII borrows one fret below {degrees:7} (b7). Sing each borrowed note over the drone.',
      'Play {chords} again. On one bar, swap the chord for iv, bVI or bVII in your head and sing the changed note before you hear it played.',
      'Rate yourself 1–5 on how clearly the borrowed chord stood out.',
    ],
    listenFor: 'The borrowed chord sounding darker or further from home than the diatonic chords around it.',
  },
  'ear_voice.l5.harmony_while_strumming': {
    card: 'scale', degrees: [1, 3, 6],
    steps: [
      'Strum {chords} at a steady pace until the chord changes need no attention at all.',
      'Pick a harmony line a 3rd or 6th above the melody, using {degrees:1,3,6} as your reference points in today\'s key.',
      'Strum {chords} again, singing that harmony line the whole way through. If the hands falter, hum it instead of singing words.',
      'Rate yourself 1–5 on how steady the strumming stayed while you sang.',
    ],
    listenFor: 'The strum pattern completely unaffected by the voice coming in.',
  },
  'ear_voice.l5.transcribe_progression': {
    card: 'scale', degrees: [1, 2, 3, 4, 5, 6, 7],
    steps: [
      'Play {degrees:1,2,3,4,5,6,7} on the guitar or hum them, so every degree is fresh before you start.',
      'Play the first chord of your chosen song. Sing its root, then match that pitch to a degree on the card.',
      'Write down the numeral for that degree, then repeat for every new chord until the progression loops.',
      'Rate yourself 1–5 on how many chords you placed correctly.',
    ],
    listenFor: 'Each root landing cleanly on one scale degree, not hovering between two.',
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
