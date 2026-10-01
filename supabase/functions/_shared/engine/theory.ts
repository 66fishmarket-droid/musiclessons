/**
 * One concrete review task per theory topic: a sentence of "what it is" plus something to play, in the day's key.
 * lesson/steps.ts renders these against the key's MAJOR scale (so a minor-flavoured style day can't give wrong notes);
 * the text says "{key} major" wherever the scale matters. Same slots as recipes (engine/render.ts).
 */
export const THEORY_REVIEWS: Record<string, string> = {
  'theory.l1.intervals':
    'an interval is the distance between two notes. Find the note {degrees:1} on string 6, then play the note {degrees:3} (a 3rd: one string up, one fret back), the note {degrees:5} (a 5th: one string up, two frets up) and the octave, naming each as you play it.',
  'theory.l1.scale_construction':
    'a scale is a recipe of whole steps (two frets) and half steps (one fret). Play {key} major up a single string from the note {degrees:1}, saying W or H for each move: W-W-H-W-W-W-H.',
  'theory.l1.circle_of_fifths':
    'keys a 5th apart are neighbours on the circle of fifths. Play the chords on {degrees:1}, {degrees:4}, {degrees:5}, then back to {degrees:1} (I-IV-V-I in {key} major): the 4 and 5 chords are the two keys next to {key} on the circle, one step each way, which is why they sound at home together.',
  'theory.l1.degrees':
    'every note in a key has a number. Play {key} major, the notes {degrees:1,2,3,4,5,6,7}, saying 1 to 7 as you go, then jump straight to 1, 3 and 5 by number.',
  'theory.l2.triads':
    'a triad is three notes stacked in 3rds. Play the notes {degrees:1,3,5} one at a time, then together as the {key} chord; now move the note {degrees:3} down one fret and hear the same chord turn minor.',
  'theory.l2.diatonic_qualities':
    'every key has its own family of chords. In {key} major, play the chords on {degrees:1}, {degrees:4} and {degrees:5} (major), then on {degrees:2}, {degrees:3} and {degrees:6} (minor), saying major or minor for each.',
  'theory.l3.sevenths':
    'a seventh chord adds one more 3rd on top of a triad. Play the notes {degrees:1,3,5,7} one at a time, then lower the note {degrees:7} by one fret and hear the bluesier dominant 7th.',
  'theory.l3.sus_add':
    'sus chords swap the 3rd out; add chords keep it. Play the {key} chord, then swap the note {degrees:3} for the note {degrees:4} (sus4), then for the note {degrees:2} (sus2), and hear each one wait to resolve.',
  'theory.l4.extensions':
    'extensions are notes stacked past the 7th. Hold the {key} chord and add the note {degrees:2} an octave up (the 9th), then the note {degrees:6} up high (the 13th), hearing the colour each one adds.',
  'theory.l4.slash_inversions':
    'a slash chord keeps the chord but changes its lowest note. Play the {key} chord with the note {degrees:3} lowest (first inversion), then with the note {degrees:5} lowest (second inversion).',
  'theory.l5.modes':
    'a mode is the same notes started from a different home. Play {key} major\'s notes from the note {degrees:2} up to the next {degrees:2} (Dorian, minor-sounding), then from the note {degrees:5} up to the next {degrees:5} (Mixolydian, a relaxed major).',
  'theory.l5.chord_scale_fit':
    'some notes rest on a chord and some want to move. Hold the {key} chord and play the notes {degrees:1,3,5} (they rest), then the note {degrees:4} (it wants to fall to the note {degrees:3}).',
  'theory.l5.harmonise_melody':
    'one melody note can sit under several chords. Sing or play the note {degrees:3}, then strum the chords on {degrees:1}, {degrees:3} and {degrees:6} under it: that note belongs to all three.',
};
