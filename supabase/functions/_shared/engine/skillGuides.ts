export interface SkillGuide { what: string; how: string[]; listenFor: string }

/** Hand-written explainers per skill ("About this skill"), promoted from Music_Lessons Vault/Research. */
export const SKILL_GUIDES: Record<string, SkillGuide> = {
  'fingerstyle.l1.pima_pinches': {
    what: 'PIMA names the picking-hand fingers from the Spanish: p (pulgar, thumb), i (índice), m (medio), a (anular). Each finger owns a string: the thumb covers the bass strings, i-m-a sit on the top three. A pinch plays the thumb and a finger at the same instant, which is how a bass note and a melody note line up.',
    how: ['Rest i, m and a on the top three strings, thumb on the bass note of the chord.', 'Pluck from the knuckle, not the wrist; the hand stays still.', 'Pinch: thumb and a together, then i, then m. Keep the pinch notes exactly together.'],
    listenFor: 'Both notes of each pinch landing as one sound, and every string at the same volume.',
  },
  'fingerstyle.l1.giuliani_arpeggios': {
    what: "Mauro Giuliani's 120 Right-Hand Studies (Op. 1, 1812) hold one simple chord still and cycle the picking hand through arpeggio patterns: three-finger ones first (p-i-m, p-m-i), then a repeated finger (p-i-m-i), then all four (p-i-m-a). Freezing the fretting hand puts all your attention on the picking hand, so each finger learns its own string and its own volume. It is the classical foundation under almost every fingerpicked accompaniment.",
    how: ['Thumb (p) plays the bass note of the chord; i, m and a play the top three strings.', 'Hold a two-chord loop you already own (G–D or C–G7) so the fretting hand needs no thought.', 'Start the first pattern at the start tempo; move to the next only when every note is even.', 'Climb the tempo ladder one rung at a time; drop a rung after two misses in a row.'],
    listenFor: 'Even volume across all four fingers, and the bass note ringing under the treble.',
  },
  'fingerstyle.l2.thumb_single_bass': {
    what: "The thumb plays one bass string on every beat, dead steady, while the fingers stay out of it. Tommy Emmanuel teaches this before anything else, and has even taped students' fingers down, because a thumb that runs by itself is what later frees the fingers and the voice.",
    how: ['Thumb on the root string of the chord, one note per beat.', 'Rest the side of the picking hand lightly on the bridge to palm-mute the bass a little.', 'Talk or count out loud while it runs; the thumb must not drift.'],
    listenFor: 'Identical spacing and volume on every beat for two full minutes.',
  },
  'fingerstyle.l2.alternating_thumb': {
    what: 'The thumb alternates between the root and a second bass note, usually the fifth, on every beat. It is the engine of Travis picking and most folk accompaniment: a walking bass line from one hand.',
    how: ['Root on beats 1 and 3, the alternate bass note on beats 2 and 4.', 'The app picks the alternate string from the chord: the fifth if it sits below the treble strings, otherwise the nearest chord tone.', 'Fingers stay off until two minutes run without a stumble.'],
    listenFor: 'A steady boom-boom bass with no gaps when the thumb changes string.',
  },
  'fingerstyle.l3.travis_basic': {
    what: 'Travis picking (after Merle Travis, refined by Chet Atkins and Tommy Emmanuel) keeps the alternating thumb on every beat and adds treble notes between the thumb beats, often starting with a pinch on beat 1. The result sounds like bass and a second guitar at once.',
    how: ['Get the alternating thumb automatic first.', 'Pinch the root with the middle finger on the top string on beat 1.', 'Fill the "and" of beats 2, 3 and 4 with index and middle on the top two strings.', 'Keep the bass lightly palm-muted so the treble sits on top.'],
    listenFor: 'The thumb never waits for the fingers; the treble notes fall exactly between the bass notes.',
  },
  'fingerstyle.l3.travis_changes': {
    what: 'The same Travis pattern carried through chord changes without the bass stopping. The thumb re-targets to the new root and alternate note on the change; the pattern itself does not change.',
    how: ['Know where the root and alternate bass move for each chord before playing.', 'Change the fretting hand a beat early if needed; the thumb keeps time.', 'Loop two chords, then the whole progression.'],
    listenFor: 'An unbroken bass line across every chord change.',
  },
  'fingerstyle.l4.accompaniment_patterns': {
    what: 'The pattern families that carry most fingerpicked songs: the ballad arpeggio (p-i-m-a-m-i), the 3/4 waltz (bass then two chord plucks), Travis, and finger-strumming with a thumb bass. Knowing several lets the song choose the pattern, not the other way round.',
    how: ['Play each family over the same progression.', 'Match the pattern to the feel: waltz for 3/4, ballad for slow 4/4, Travis for driving folk.', 'Keep the thumb on the chord roots whatever the fingers do.'],
    listenFor: 'Each pattern keeping its own feel at the same tempo.',
  },
  'fingerstyle.l4.sing_over_pattern': {
    what: 'Singing over a fingerstyle pattern only works once the pattern is automatic. The ladder is hum, then speak the lyric in rhythm, then sing, and you only climb a rung when the hands do not falter.',
    how: ['Run the pattern for two minutes while humming one note.', 'Speak the lyric in rhythm over it.', 'Sing it. If the hands stumble, drop back a rung.'],
    listenFor: 'The picking staying identical when the voice comes in.',
  },
  'fingerstyle.l5.melody_over_thumb': {
    what: 'A melody or fill played on the top strings while the thumb keeps the bass going underneath: a whole arrangement from one guitar.',
    how: ['Thumb on steady or alternating bass first.', 'Add the melody notes on the top strings, on the beat at first, then between beats.', 'Keep fills to one per four bars inside a song.'],
    listenFor: 'The bass carrying on untouched under every melody note.',
  },
  'fingerstyle.l5.arrange_own_song': {
    what: 'A fingerstyle arrangement of one of your own songs: choose a pattern family, place the bass on the roots, and put melody or fills on top. A capo or drop D tuning is allowed if it makes the shapes sit better.',
    how: ["Pick the pattern family that fits the song's feel.", 'Map the bass roots for every chord.', 'Record a full take and listen back for balance between voice and guitar.'],
    listenFor: 'The guitar supporting the voice, never competing with it.',
  },
};
