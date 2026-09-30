import type { Skill } from './types.ts';

export type Card = 'pattern' | 'rhythm' | 'note_caller' | 'scale' | 'triads' | 'chords' | 'none';
export interface SkillRecipe {
  card: Card; patterns?: string[]; grid?: string; gridName?: string; degrees?: number[];
  steps: string[]; listenFor: string;
  majorKeyOnly?: boolean; // planner.ts keeps this skill's day off a minor-family style scale; its steps assume a major key.
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
      'Play and sing the roots of your key\'s four main chords, one at a time: {degrees:1}, {degrees:4}, {degrees:5} and {degrees:6} — the home chord and its three most common partners.',
      'Turn on the drone for {key}. Sing all four roots again in that order, checking each against the drone before you move on.',
      'Now sing them in a random order, naming which one it is ("one", "four", "five" or "six") as you sing it.',
      'Rate yourself 1–5 on how fast you named each root.',
    ],
    listenFor: 'Each sung root landing exactly on the drone\'s pitch before you name it.',
  },
  'ear_voice.l3.sing_chord_tones': {
    card: 'scale', degrees: [1, 3, 5],
    steps: [
      'Turn on the drone. Strum the {key} chord — your home chord, made of {degrees:1,3,5} — and let it ring a full bar.',
      'Sing that chord\'s root, then its 3rd, then its 5th: {degrees:1,3,5}, low to high.',
      'Strum the {key} chord again and sing root-3rd-5th straight through without stopping to check each note first.',
      'Rate yourself 1–5 on how clean each of the three notes was.',
    ],
    listenFor: 'Three clearly separate pitches inside the chord, landing low to high without sliding.',
  },
  'ear_voice.l3.harmony_thirds_sixths': {
    card: 'scale', degrees: [1, 3, 6],
    steps: [
      'Play {degrees:1} on the guitar: that is your melody note. A 3rd above it is {degrees:3}; play and sing that.',
      'A 6th above {degrees:1} is {degrees:6}. Play it, then sing it, keeping {degrees:1} ringing under it if you can.',
      'Play {degrees:1} again as the melody note. Sing a 3rd above it, then a 6th above it, back to back, without checking each on the guitar first.',
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
  // Fretboard: note_caller for the two note-finding skills; triads for the shapes the triads card actually draws
  // (chords[0]'s inversions on strings 3-2-1 and 4-3-2); scale (degrees highlighted, shapes described in words)
  // for everything the card can't show on its own — a different quality, a different string set, or no triad at all.
  'fretboard.l1.notes_e_a': {
    card: 'note_caller',
    steps: [
      'Strings 6 and 5 are E and A when played open; each fret up is the next note (E, F, F#, G…).',
      'Press "Start calling notes". Find each called note on string 6 or 5 before the next bar.',
      'Say the note out loud as you play it.', 'Aim for {target_reps} clean passes in a row.',
    ],
    listenFor: 'Finding each note before the next click of beat 1.',
  },
  'fretboard.l1.octave_shapes': {
    card: 'note_caller',
    steps: [
      'An octave is the same note, higher or lower. From a note on string 6 or 5, its octave sits two strings up and two frets over.',
      'Press "Start calling notes". Find the called note on string 6 or 5, then find its octave with that shape.',
      'Say the note name out loud at both spots.', 'Aim for {target_reps} clean passes in a row.',
    ],
    listenFor: 'Landing on the note and its octave before the next click of beat 1.',
  },
  'fretboard.l2.caged_linked': {
    card: 'scale', degrees: [1],
    steps: [
      'CAGED links five chord shapes — C, A, G, E and D — that each play {chord1} at a different spot up the neck.',
      'Play {chord1} in a shape you know, then find the next CAGED shape up the neck sharing the same root note, {degrees:1}.',
      'Move shape to shape up the neck in CAGED order, landing on {degrees:1} in each new shape before you strum.',
      'Aim for {target_reps} clean passes in a row.',
    ],
    listenFor: 'Every string ringing clean in each new shape, with the root always findable first.',
  },
  'fretboard.l2.pentatonic_per_shape': {
    card: 'scale', degrees: [1, 3, 5],
    steps: [
      'A pentatonic box has five notes instead of seven: two notes fewer than the full scale box shown for today\'s position.',
      'Find {chord1}\'s CAGED shape, then play the pentatonic box wrapped around it, using {degrees:1,3,5} as your anchor notes.',
      'Climb the box root to root, saying "root" each time you land on {degrees:1}.',
      LADDER,
    ],
    listenFor: 'Landing on the root note cleanly in tune every time you climb through the box.',
  },
  'fretboard.l3.triads_321': {
    card: 'triads',
    steps: [
      'The card shows three inversions of {chord1} on strings 3-2-1 (the top three): root position, then first and second inversion, three notes each.',
      'Play each shape in order, root to second inversion, saying which inversion you\'re on as you strum it.',
      'Move to the next inversion only once the last one rings clean and in tune.',
      LADDER,
    ],
    listenFor: 'All three notes of each shape ringing together, with no muted or buzzing string.',
  },
  'fretboard.l3.triads_432': {
    card: 'triads',
    steps: [
      'The card also shows {chord1}\'s three inversions on strings 4-3-2: drop the top string, add string 4, same shapes moved one string set down.',
      'Play root, first and second inversion in order on strings 4-3-2 only, letting each one ring before you move on.',
      'Compare the sound to the 3-2-1 set: the same three notes, sitting one string lower overall.',
      LADDER,
    ],
    listenFor: 'Every note in each shape ringing evenly, including the middle string most players mute by accident.',
  },
  'fretboard.l3.minor_triads': {
    card: 'scale', degrees: [1, 5],
    steps: [
      'A minor triad is root, minor 3rd and 5th. {degrees:1} and {degrees:5} anchor the shape; the 3rd sits one fret below the major 3rd you know.',
      'Build minor triads on strings 3-2-1 first, then the same shapes on strings 4-3-2, moving fret by fret up the neck.',
      'Say "minor" out loud each time you land on a new shape, to keep the darker sound in your ear.',
      LADDER,
    ],
    listenFor: 'The minor 3rd sounding noticeably darker than a major triad, with the shape still ringing clean.',
  },
  'fretboard.l4.voice_leading_inversions': {
    card: 'triads',
    steps: [
      'The card shows {chord1}\'s three inversions on strings 3-2-1. Start on the one closest to the middle of the neck, not always the lowest.',
      'Move through {chords}, one chord per bar: for each new chord, choose the triad shape on strings 3-2-1 nearest the fret you just played.',
      'Never jump back to an open or low shape mid-progression — the smallest hand move wins.',
      LADDER,
    ],
    listenFor: 'Each chord change covering the smallest possible distance up or down the neck.',
  },
  'fretboard.l4.triads_lower_sets': {
    card: 'scale', degrees: [1, 5],
    steps: [
      'The same triad idea moves to strings 5-4-3, then 6-5-4: root, 3rd and 5th, one note per string, {degrees:1} and {degrees:5} as anchors.',
      'A sus chord swaps the 3rd for {degrees:4} (sus4) or {degrees:2} (sus2); a diminished triad flattens both the 3rd and the 5th a fret each.',
      'Build {chord1}\'s triad on strings 5-4-3 first, then move the same shape down to strings 6-5-4.',
      LADDER,
    ],
    listenFor: 'All three notes on the lower strings ringing as clearly as the higher sets you already know.',
  },
  'fretboard.l5.thirds_sixths_shapes': {
    card: 'scale', degrees: [1, 3, 6],
    steps: [
      'A 3rd shape pairs two notes a 3rd apart, like {degrees:1,3}, on two neighbouring strings; a 6th shape pairs notes a 6th apart, like {degrees:1,6}.',
      'Play {degrees:1,3} together on two strings, then slide the same shape up to the next pair of notes in {scale}.',
      'Do the same with a 6th shape, {degrees:1,6}, moving it degree by degree through {scale}.',
      LADDER,
    ],
    listenFor: 'Both notes of each pair landing together, evenly balanced in volume.',
  },
  'fretboard.l5.seventh_shells': {
    card: 'scale', degrees: [1, 3, 7],
    steps: [
      'A shell voicing drops the 5th and plays just root, 3rd and 7th — {degrees:1,3,7} — three notes instead of a full chord.',
      'Build the shell with the root on string 6, then again with the root on string 5, one string higher.',
      'Say "root, third, seventh" as you play each note of the shell.',
      'Aim for {target_reps} clean passes in a row.',
    ],
    listenFor: 'Three clear, separate notes with no muffled or buzzing string between them.',
  },
  // Fills: chord panel only, no tab card yet (spec §8) — strings, frets and shapes stay in words, relative
  // to {chord1} itself and its root ({degrees:1}), never claimed as something the card's diagram shows
  // (the card draws chords-db's first voicing, usually open, not a barre or a CAGED-labelled shape).
  'fills.l1.sus_add_hammers': {
    card: 'chords',
    steps: [
      'A hammer-on: tap a fretting-hand finger onto a higher fret on the same string without picking again, so the new note rings straight out of the old one.',
      'On {chord1}, hammer a free finger onto the next fret up on the same string, then lift straight back off to the plain chord.',
      'Go through {chords}, one hammer-on and lift-off per bar.',
      LADDER,
    ],
    listenFor: 'The hammered note ringing as loud as a picked one, then the plain chord landing clean when the finger lifts.',
  },
  'fills.l1.open_chord_pulloffs': {
    card: 'chords',
    steps: [
      'A pull-off: fret a note, then flick that finger off the string sideways so the open string below it sounds, without picking again.',
      'On {chord1}, pull off one fretted note to its open string on beat 4, then land back on the chord on beat 1.',
      'Go through {chords}, one pull-off at the end of each bar.', LADDER,
    ],
    listenFor: 'The pulled-off note as loud as a picked one, and beat 1 landing on time.',
  },
  'fills.l2.bass_walks': {
    card: 'chords',
    steps: [
      'A bass walk: instead of jumping straight to the next chord, step your lowest note up or down one note per beat until it lands on the next chord\'s root.',
      'On {chord1}, start from the bass note the card shows (string {root_string}) and walk the bass into the next chord during the last beat of each bar.',
      'Land exactly on the new root the instant the chord changes, then let it ring.',
      LADDER,
    ],
    listenFor: 'The walk arriving right on the new root with no gap when the chord changes.',
  },
  'fills.l2.g_run': {
    card: 'chords',
    steps: [
      'A phrase-ending run: walk up the bass strings note by note under the current chord, timed to land on the root exactly as the next phrase starts.',
      'Play the run under {chord1}, finishing with a hammer-on or pull-off — tap or flick a finger without picking again — right onto the root.',
      'Use it to close a phrase through {chords}, about once every four bars.',
      LADDER,
    ],
    listenFor: 'The run landing squarely on the root as the new phrase begins, the closing hammer or pull-off as loud as the rest.',
  },
  'fills.l3.double_stops_static_top': {
    card: 'chords',
    steps: [
      'A double-stop: two notes plucked or strummed together on two neighbouring strings, both part of the current chord.',
      'On {chord1}, hold the higher of the two notes still and hammer the lower one up a fret into the next chord tone, then let both ring together.',
      'Repeat through {chords}: the top note stays put, only the lower note moves.',
      LADDER,
    ],
    listenFor: 'The top note staying rock steady while the lower note snaps cleanly into its new pitch.',
  },
  'fills.l3.double_stops_barre': {
    card: 'chords',
    steps: [
      'A barre: press one finger flat across every string, then shape {chord1} behind it with its root on string 6 where {degrees:1} sits (E-shape) or string 5 (A-shape).',
      'Play just the top two strings of that barre together — that\'s the double-stop — then slide it (keep pressing while you move) up two frets and back down.',
      'Go through {chords}, sliding the double-stop up and back once on each chord.',
      LADDER,
    ],
    listenFor: 'Both notes staying locked together through the slide, with no buzz or muted string.',
  },
  'fills.l4.sliding_thirds': {
    card: 'chords',
    steps: [
      'A 3rd: two notes two scale steps apart, like {degrees:1,3}, played together on two neighbouring strings.',
      'Find a 3rd shape inside {chord1} on two neighbouring strings, then slide it (keep pressing while you move) up to the next 3rd shape in {scale}.',
      'Walk that sliding 3rd through {chords}, following each chord\'s own notes.',
      LADDER,
    ],
    listenFor: 'Both notes of each 3rd arriving together after the slide, neither one lagging behind.',
  },
  'fills.l4.sliding_sixths': {
    card: 'chords',
    steps: [
      'A 6th: two notes further apart than a 3rd, like {degrees:1,6}, played together with one string skipped between them.',
      'Play a 6th shape on strings 3 and 1 inside {chord1}, then slide it up one shape and back.',
      'Move the same sliding 6th to strings 4 and 2, then walk it through {chords}.',
      LADDER,
    ],
    listenFor: 'Both notes of the 6th ringing evenly through the slide, even with a string skipped between them.',
  },
  'fills.l5.pentatonic_fills_caged': {
    card: 'chords',
    steps: [
      'A pentatonic fill: five notes built around the chord — {degrees:1,2,3,5,6} — played from wherever your fretting hand is already sitting on {chord1}.',
      'In the last two beats of a bar, play three or four of those notes, ending on a chord tone.',
      'Drop straight back into the rhythm on beat 1. Try it once per phrase through {chords}.',
      LADDER,
    ],
    listenFor: 'The fill staying inside two beats and landing back on the groove exactly on beat 1.',
  },
  'fills.l5.fill_in_context': {
    card: 'chords',
    steps: [
      'Play the groove on {chords} for four full bars, no fills, keeping the rhythm locked.',
      'On the last two beats of bar four, play one fill you know (a hammer, a pull-off, a slide or a short run), then land back on the beat.',
      'Repeat for another four bars, choosing a different fill each time.',
      'Aim for {target_reps} clean passes in a row.',
    ],
    listenFor: 'Exactly one fill every four bars, with the groove never missing a beat around it.',
  },
  // Songwriting: chords or none; always end with the recorder or a written line.
  'songwriting.l1.core_loops': {
    card: 'chords',
    steps: [
      'Play {chords}, one bar each, until it loops without a gap.',
      'Now start the same loop from the second chord, then from the third. Each start gives the same chords a different mood.',
      'Hum over your favourite start and note which one felt most like a chorus, the song\'s most repeated section.', 'Rate yourself 1–5 on how smooth the loop felt.',
    ],
    listenFor: 'The loop landing back on its first chord without a hiccup.',
  },
  'songwriting.l1.object_writing': {
    card: 'none',
    steps: [
      'Set a 5-minute timer. Pick one thing nearby and write only what your senses notice about it — sight, sound, smell, touch, taste — no crossing out.',
      'A stable line reads like a finished sentence; an unstable line trails off, like a question. Mark each line you wrote S or U.',
      'Write one more line that flips your best line: stable if it was unstable, or the reverse.',
      'Rate yourself 1–5 on how much of it was senses, not opinions.',
    ],
    listenFor: 'Concrete, sensory words rather than vague feelings or judgments.',
  },
  'songwriting.l2.section_contrast': {
    card: 'chords',
    steps: [
      'Play {chords}, one chord per bar, starting on {chord1}: that\'s your verse, the section that tells the story between choruses.',
      'For a chorus, the song\'s most repeated section, change two levers: start on a chord other than {chord1}, and double the harmonic rhythm, how often the chord changes.',
      'Hum a line over each version, singing the chorus higher in your range than the verse: that\'s a third lever, register.',
      'Rate yourself 1–5 on how different the two sections felt.',
    ],
    listenFor: 'A clearly different starting point, speed of change and register between the two.',
  },
  'songwriting.l2.melody_skeleton': {
    card: 'chords',
    steps: [
      'Play {chords}, one chord per bar. A melody skeleton is the handful of long notes a tune is built from before it gets decorated.',
      'Pick one note per bar to be your skeleton, favouring the stable notes {degrees:1,3,5}: four notes total, one per chord.',
      'Sing just those four skeleton notes, holding each one for its whole bar.',
      'Now decorate: add one short extra note before or after each skeleton note, then sing the decorated version.',
      'Rate yourself 1–5 on how clearly the skeleton still shows through the decoration.',
    ],
    listenFor: 'The held skeleton note still landing on the beat once the decoration is added around it.',
  },
  'songwriting.l3.prechorus_tension': {
    card: 'chords',
    steps: [
      'A pre-chorus is a short section between verse and chorus whose job is to raise tension before the chorus lands.',
      'Play {chords} for two bars, then land the last bar on the chord built on {degrees:5} (or, for a softer pull, {degrees:4}) instead of back on {chord1}.',
      'Speed up on the way there: change chords twice as often in that last bar as you did before.',
      'Hum a rising line over it, ending unresolved on {degrees:5} itself.',
      'Rate yourself 1–5 on how strongly it pulled you toward the next section.',
    ],
    listenFor: 'The last chord staying unresolved instead of settling home, so you want the next section to arrive.',
  },
  'songwriting.l3.borrowed_colour': {
    card: 'chords', majorKeyOnly: true,
    steps: [
      'Borrowing means dropping one chord from the minor version of your key into an otherwise major progression, for a darker colour just for a moment.',
      'Play {chords}. Then, in place of one bar, play a major chord built a whole step below {degrees:1} — that borrowed chord is called bVII.',
      'Try it again, this time playing a minor chord built on {degrees:4} in place of one bar of {chords} — that borrowed chord is called iv.',
      'Rate yourself 1–5 on how clearly each borrowed chord changed the mood before it resolved back to {chord1}.',
    ],
    listenFor: 'A sudden, deliberate darkening of colour that still resolves cleanly back to the home chord.',
  },
  'songwriting.l4.bridge_backwards': {
    card: 'chords',
    steps: [
      'A bridge is a section, used once, that breaks the verse/chorus pattern to set up the final chorus.',
      'Decide your chorus starts on {chord1}. Work backwards: your bridge must end on the chord built on {degrees:5}, so {chord1} lands like the answer.',
      'Start the bridge on a chord you have not used to open the verse or chorus, then find your own path from there to {degrees:5}.',
      'Play the bridge straight into {chords} and listen for the chorus landing like a relief.',
      'Rate yourself 1–5 on how clearly the bridge set up that landing.',
    ],
    listenFor: 'The bridge ending on tension, then the chorus arriving like a resolved answer.',
  },
  'songwriting.l4.secondary_dominants': {
    card: 'chords', majorKeyOnly: true,
    steps: [
      'A secondary dominant is a chord borrowed for one bar that pulls hard toward a chord other than home, the way a V chord normally pulls toward I.',
      'Play {chords}. Right before the chord built on {degrees:5}, insert a major chord built on {degrees:2} — that extra pull toward {degrees:5} is called V of V.',
      'Now pull toward {degrees:6} instead: insert a major chord built on {degrees:3} right before it — that is V of vi.',
      'Play {chords} once more, treating {degrees:6} as home — that\'s the relative minor — then shift back to {degrees:1} as home, the relative major.',
      'Rate yourself 1–5 on how clearly each move pulled toward its target.',
    ],
    listenFor: 'Extra pull into the target chord, sharper than the plain diatonic move would give.',
  },
  'songwriting.l5.modulation': {
    card: 'chords',
    steps: [
      'A modulation is a permanent change of home note partway through a song, used only when the lyric\'s energy earns it, not as decoration.',
      'Try a truck-driver modulation: play {chords}, then play the same shapes one fret higher — the whole song stepping up is the classic final-chorus lift.',
      'Now try a pivot-chord modulation: end on the chord built on {degrees:4}, a chord that exists in both keys, then treat it as the new home and resolve into it.',
      'Say in one sentence why this moment in your song would earn a key change — if you can\'t, skip it.',
      'Rate yourself 1–5 on how smooth (pivot) or how earned (truck-driver) the shift felt.',
    ],
    listenFor: 'A shift that feels inevitable, not bolted on — earned by the lyric, not just louder.',
  },
  'songwriting.l5.style_transplant': {
    card: 'chords',
    steps: [
      'A style transplant takes a song you already have and moves it into another style by changing one lever at a time, not everything at once.',
      'Play {chords} in today\'s groove, then play the same {chords} with a different groove — swap straight time for a shuffle, or the reverse.',
      'Now change one more lever: the harmonic rhythm (how often chords change), or borrow one chord from the opposite mode — major borrows from minor, minor from major.',
      'Hum your melody over the new version and notice which lever changed the mood the most.',
      'Rate yourself 1–5 on how recognisable the song still was after the change.',
    ],
    listenFor: 'The same song, one clearly different lever at a time, still recognisable underneath.',
  },
};

/** The skill's recipe, or a generic one from its description. The generic branch protects skills added to the curriculum later. */
export function recipeFor(skill: Skill): SkillRecipe {
  return RECIPES[skill.id] ?? {
    card: 'none',
    steps: [skill.description, skill.pass_metric === 'bpm' ? LADDER : 'Work through it slowly, then rate yourself honestly.'],
    listenFor: 'Clean, even time.',
  };
}
