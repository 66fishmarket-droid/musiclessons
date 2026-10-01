import { OPEN_KEYS } from '../functions/_shared/engine/keys.ts';
import type { Skill, SkillTrack } from '../functions/_shared/engine/types.ts';

export const TRACK_NAMES: Record<SkillTrack, string> = {
  rhythm: 'Rhythm & Groove', fretboard: 'Fretboard & Voicings', fingerstyle: 'Fingerstyle', fills: 'Fills & Licks',
  ear_voice: 'Ear & Voice', songwriting: 'Songwriting & Harmony', theory: 'Theory',
};

type Extra = Partial<Pick<Skill, 'allowed_keys' | 'theory_topic_id' | 'styles'>>;
function skill(id: string, name: string, description: string, metric: Skill['pass_metric'], target: number | null, extra: Extra = {}): Skill {
  const [track, level] = id.split('.');
  return {
    id, track: track as SkillTrack, level: Number(level.slice(1)) as Skill['level'], name, description,
    pass_metric: metric, default_target: target, allowed_keys: extra.allowed_keys ?? null,
    theory_topic_id: extra.theory_topic_id ?? null, styles: extra.styles ?? null,
  };
}
const open = { allowed_keys: OPEN_KEYS };

/** The full skill ladder: 6 tracks + theory, 5 levels each (from Research/ ladders; see spec §3). */
export const SKILLS: Skill[] = [
  // Theory ladder: delivered as cards and review quizzes, never the new-skill slot
  skill('theory.l1.intervals', 'Intervals', 'Name and find every interval from a root, by ear and on the neck.', 'self', null),
  skill('theory.l1.scale_construction', 'How scales are built', 'Whole and half steps that make the major and natural minor scales.', 'self', null),
  skill('theory.l1.circle_of_fifths', 'Circle of fifths', 'How keys relate by fifths; key signatures; neighbouring keys.', 'self', null),
  skill('theory.l1.degrees', 'Scale degrees', 'Numbering notes 1–7 in any key so patterns transpose.', 'self', null),
  skill('theory.l2.triads', 'Triads', 'Major, minor, diminished and augmented triads as stacked thirds.', 'self', null),
  skill('theory.l2.diatonic_qualities', 'Chords in a key', 'Why I, IV, V are major, ii, iii, vi minor and vii° diminished; tonic, subdominant, dominant.', 'self', null),
  skill('theory.l3.sevenths', 'Seventh chords', 'maj7, m7, 7 and m7b5: what the seventh adds and where each lives in a key.', 'self', null),
  skill('theory.l3.sus_add', 'Sus and add chords', 'sus2/sus4 replace the third; add9 keeps it. How to find them from any chord.', 'self', null),
  skill('theory.l4.extensions', 'Extensions', '9, 11 and 13; why the natural 11 clashes with a major third; which notes to drop.', 'self', null),
  skill('theory.l4.slash_inversions', 'Slash chords and inversions', 'Chord over a bass note; first and second inversion; walking bass lines.', 'self', null),
  skill('theory.l5.modes', 'Modes', 'Dorian, Mixolydian, Aeolian and friends as parent-scale rotations and as moods.', 'self', null),
  skill('theory.l5.chord_scale_fit', 'Chord–scale fit', 'Which scale fits which chord, and why the blues breaks the rule.', 'self', null),
  skill('theory.l5.harmonise_melody', 'Harmonising a melody', 'Choosing chords under a melody note by note; reharmonising a line.', 'self', null),

  // Rhythm & Groove
  skill('rhythm.l1.locked_8ths', 'Locked 8ths and 16ths', 'Constant down-up motion locked to a click; 8ths then 16ths.', 'bpm', 70, open),
  skill('rhythm.l1.accents_palm_mute', 'Accents and palm muting', 'Accent chosen beats and palm-mute the rest without losing time.', 'bpm', 70, open),
  skill('rhythm.l2.backbeat_chuck', 'Backbeat chuck', 'Percussive fretting-hand chuck on 2 and 4 inside a strum.', 'bpm', 75),
  skill('rhythm.l2.ghost_strums', 'Ghost strums', 'Keep the hand moving in 16ths, hitting only the notated strokes.', 'bpm', 65),
  skill('rhythm.l3.anticipations', 'Anticipations and syncopation', 'Change chords on the "and" before the beat; syncopated accents.', 'bpm', 80, { styles: ['pop', 'rock_classic', 'americana'] }),
  skill('rhythm.l3.shuffle_68', 'Shuffle and 6/8 feels', 'Triplet-based shuffle and compound 6/8 strumming.', 'bpm', 75, { styles: ['blues', 'rock_hard', 'americana', 'celtic'] }),
  skill('rhythm.l4.dynamics_arrangement', 'Dynamics as arrangement', 'Sparse verse, full chorus: change strum density and attack by section.', 'self', null),
  skill('rhythm.l4.stops_breaks', 'Stops, hits and breaks', 'Land band hits and stop-time on a lyric, then re-enter in time.', 'clean_reps', 4, { styles: ['blues', 'funk', 'punk'] }),
  skill('rhythm.l5.be_the_band', 'Be the band', 'Bass notes, backbeat and chord stabs from one guitar.', 'bpm', 80, { styles: ['country', 'bluegrass', 'folk'] }),
  skill('rhythm.l5.offbeat_stabs', 'Offbeat stabs', 'Short muted stabs on the offbeats: reggae skank, funk chank.', 'bpm', 85, { styles: ['reggae', 'funk', 'neo_soul'] }),

  // Fretboard & Voicings
  skill('fretboard.l1.notes_e_a', 'Notes on strings 6 and 5', 'Landmark frets 3-5-7-9-12, then name any note on the low E and A strings instantly.', 'clean_reps', 3, { theory_topic_id: 'theory.l1.degrees' }),
  skill('fretboard.l1.b_string_rule', 'The B-string rule', 'Strings are 5 frets apart except G to B (4): why, and how it shifts every shape.', 'clean_reps', 3, { theory_topic_id: 'theory.l1.intervals' }),
  skill('fretboard.l1.octave_shapes', 'Octave shapes', 'Find every octave of a note: skip one string up 2, skip two back 3, plus the B-string shift.', 'clean_reps', 3, { theory_topic_id: 'theory.l1.intervals' }),
  skill('fretboard.l2.interval_shapes', 'Interval shapes', 'Where the 3rd, 5th, b7 and octave sit from any root on strings 6 and 5.', 'clean_reps', 3, { theory_topic_id: 'theory.l1.intervals' }),
  skill('fretboard.l2.caged_linked', 'CAGED shapes linked', 'Play one chord in all five CAGED shapes up the neck, naming the root in each.', 'clean_reps', 3),
  skill('fretboard.l2.pentatonic_per_shape', 'Pentatonic per CAGED shape', 'Box 1 first, then the pentatonic box that sits around each CAGED shape.', 'bpm', 70, { theory_topic_id: 'theory.l1.scale_construction' }),
  skill('fretboard.l2.progression_grid', 'The progression grid', 'I-IV-V-vi as one movable grid of roots on strings 6 and 5, by number.', 'bpm', 60, { theory_topic_id: 'theory.l2.diatonic_qualities' }),
  skill('fretboard.l3.triads_321', 'Triads on strings 3-2-1', 'Major triads in all inversions on the top three strings.', 'bpm', 60, { theory_topic_id: 'theory.l2.triads' }),
  skill('fretboard.l3.triads_432', 'Triads on strings 4-3-2', 'Major triads in all inversions on the middle strings.', 'bpm', 60, { theory_topic_id: 'theory.l2.triads' }),
  skill('fretboard.l3.minor_triads', 'Minor triads', 'Minor triad inversions on both top string sets.', 'bpm', 60, { theory_topic_id: 'theory.l2.triads' }),
  skill('fretboard.l4.voice_leading_inversions', 'Voice-leading inversions', 'Move I–IV–V–vi using the nearest inversion each time.', 'bpm', 60, { theory_topic_id: 'theory.l4.slash_inversions' }),
  skill('fretboard.l4.triads_lower_sets', 'Lower string-set triads', 'Triads on 5-4-3 and 6-5-4; sus and diminished shapes.', 'bpm', 60, { theory_topic_id: 'theory.l3.sus_add' }),
  skill('fretboard.l4.one_string_scale', 'Scales on one string', 'The key\'s scale along a single string, counting whole and half steps.', 'bpm', 70, { theory_topic_id: 'theory.l1.scale_construction' }),
  skill('fretboard.l5.thirds_sixths_shapes', '3rds and 6ths shapes', 'Two-string 3rd and 6th shapes through a key.', 'bpm', 70, { theory_topic_id: 'theory.l1.intervals' }),
  skill('fretboard.l5.seventh_shells', 'Seventh-chord shells', 'Root–3rd–7th shells on 6th and 5th string roots.', 'clean_reps', 4, { theory_topic_id: 'theory.l3.sevenths', styles: ['jazz_swing', 'neo_soul', 'bossa_samba'] }),

  // Fingerstyle
  skill('fingerstyle.l1.pima_pinches', 'p-i-m-a and pinches', 'Thumb on the bass strings, fingers on 3-2-1; pinch bass and treble together.', 'bpm', 60, open),
  skill('fingerstyle.l1.giuliani_arpeggios', 'Arpeggio patterns', 'Giuliani-style right-hand arpeggios over a frozen two-chord loop.', 'bpm', 60, open),
  skill('fingerstyle.l2.thumb_single_bass', 'Steady thumb', 'Thumb on one bass string, dead steady, fingers resting.', 'bpm', 70, open),
  skill('fingerstyle.l2.alternating_thumb', 'Alternating thumb', 'Alternate the thumb between two bass strings for two minutes without drifting.', 'bpm', 70, open),
  skill('fingerstyle.l3.travis_basic', 'Travis picking', 'Travis pattern on C, G, Am, D and E.', 'bpm', 70, { ...open, styles: ['folk', 'country', 'americana'] }),
  skill('fingerstyle.l3.travis_changes', 'Travis through changes', 'Change chords without breaking the bass line.', 'bpm', 65, { styles: ['folk', 'americana'] }),
  skill('fingerstyle.l4.accompaniment_patterns', 'Accompaniment patterns', 'Ballad arpeggio, 3/4 waltz, finger-strum with thumb bass.', 'bpm', 70),
  skill('fingerstyle.l4.sing_over_pattern', 'Singing over a pattern', 'Hum, then speak the lyric, then sing over a fingerstyle pattern.', 'self', null),
  skill('fingerstyle.l5.melody_over_thumb', 'Melody over a steady thumb', 'A melody or fill on top while the thumb keeps the bass.', 'bpm', 60),
  skill('fingerstyle.l5.arrange_own_song', 'Arrange your own song', 'A fingerstyle arrangement of one of your songs, capo or drop D allowed.', 'self', null),

  // Fills & Licks
  skill('fills.l1.sus_add_hammers', 'Sus and add hammer-ons', 'Hammer and pull sus2/sus4/add9 inside open chords (Dsus4–D–Dsus2).', 'bpm', 70, { ...open, theory_topic_id: 'theory.l3.sus_add' }),
  skill('fills.l1.open_chord_pulloffs', 'Open-string pull-offs', 'Pull-offs to open strings between chord changes.', 'bpm', 70, open),
  skill('fills.l2.bass_walks', 'Bass walks', 'Walk the bass into the next chord (G–G/F#–Em).', 'bpm', 70, { theory_topic_id: 'theory.l4.slash_inversions', styles: ['country', 'bluegrass', 'folk', 'americana'] }),
  skill('fills.l2.g_run', 'The G-run', 'The bluegrass G-run and its variations as a phrase ending.', 'bpm', 80, { styles: ['bluegrass', 'country'] }),
  skill('fills.l3.double_stops_static_top', 'Double-stops with a static top', 'Mayfield/Hendrix double-stops: hold the top note, hammer the lower one.', 'bpm', 65, { theory_topic_id: 'theory.l1.intervals', styles: ['soul', 'neo_soul', 'rock_classic'] }),
  skill('fills.l3.double_stops_barre', 'Double-stops from barre shapes', 'Double-stop fills from E- and A-shape barres, major pentatonic.', 'bpm', 65),
  skill('fills.l4.sliding_thirds', 'Sliding 3rds', 'Slide into and between diatonic 3rds on adjacent strings.', 'bpm', 65, { theory_topic_id: 'theory.l1.intervals' }),
  skill('fills.l4.sliding_sixths', 'Sliding 6ths', 'Sliding 6ths on string pairs 3-1 and 4-2.', 'bpm', 65, { styles: ['soul', 'country'] }),
  skill('fills.l5.pentatonic_fills_caged', 'Pentatonic fills from the shape', 'A 1–2 beat pentatonic fill from the CAGED shape around the current chord.', 'bpm', 70, { theory_topic_id: 'theory.l5.chord_scale_fit' }),
  skill('fills.l5.fill_in_context', 'Fills in context', 'At most one fill per four bars, then straight back into the groove.', 'clean_reps', 4),

  // Ear & Voice
  skill('ear_voice.l1.pitch_match', 'Pitch matching', 'Find your vocal range and match single pitches from the guitar.', 'self', null),
  skill('ear_voice.l1.sing_135', 'Sing 1-3-5', 'Sing 1-3-5 and 5-4-3-2-1 over a drone in the day\'s key.', 'self', null, { theory_topic_id: 'theory.l1.intervals' }),
  skill('ear_voice.l2.sing_all_degrees', 'All seven degrees', 'Sing every degree with its resolution, major then minor.', 'self', null, { theory_topic_id: 'theory.l1.degrees' }),
  skill('ear_voice.l2.sing_roots', 'Sing the roots', 'Sing chord roots over I–IV–V–vi loops and name the numerals.', 'self', null, { theory_topic_id: 'theory.l2.diatonic_qualities' }),
  skill('ear_voice.l3.sing_chord_tones', 'Sing chord tones', 'Sing root–3rd–5th of each chord while strumming whole notes.', 'self', null, { theory_topic_id: 'theory.l2.triads' }),
  skill('ear_voice.l3.harmony_thirds_sixths', 'Harmony in 3rds and 6ths', 'Sing a 3rd or 6th above a melody the app plays.', 'self', null),
  skill('ear_voice.l4.colour_notes', 'Colour notes', 'Hear and sing b7, b3, b6 and #4 over a drone.', 'self', null, { theory_topic_id: 'theory.l4.extensions' }),
  skill('ear_voice.l4.borrowed_chords_by_ear', 'Borrowed chords by ear', 'Recognise iv, bVII and bVI in a progression.', 'self', null, { theory_topic_id: 'theory.l5.modes' }),
  skill('ear_voice.l5.harmony_while_strumming', 'Harmony while strumming', 'Sing a harmony line while strumming the song.', 'self', null),
  skill('ear_voice.l5.transcribe_progression', 'Transcribe by ear', 'Work out a song\'s progression by ear and write it in numerals.', 'self', null),

  // Songwriting & Harmony
  skill('songwriting.l1.core_loops', 'Core loops', 'I–IV–V–vi loops and their rotations in any key.', 'self', null, { theory_topic_id: 'theory.l2.diatonic_qualities' }),
  skill('songwriting.l1.object_writing', 'Object writing and prosody', 'Five-minute sense-bound writing; stable vs unstable lines.', 'self', null),
  skill('songwriting.l2.section_contrast', 'Verse/chorus contrast', 'Change at least two levers between sections: harmonic rhythm, start chord, register, note length, phrase start.', 'self', null),
  skill('songwriting.l2.melody_skeleton', 'Melody skeleton', 'Write a four-note skeleton, then decorate it.', 'self', null),
  skill('songwriting.l3.prechorus_tension', 'Pre-chorus tension', 'A pre-chorus that builds and ends on V or IV.', 'self', null, { theory_topic_id: 'theory.l2.diatonic_qualities' }),
  skill('songwriting.l3.borrowed_colour', 'Borrowed colour', 'Borrow iv, bVII and bVI from the parallel minor.', 'self', null, { theory_topic_id: 'theory.l5.modes' }),
  skill('songwriting.l4.bridge_backwards', 'Bridges designed backwards', 'Choose the final chorus\'s first chord, end the bridge on its V, start where no other section starts.', 'self', null),
  skill('songwriting.l4.secondary_dominants', 'Secondary dominants', 'V/V, V/vi and relative major/minor shifts.', 'self', null, { theory_topic_id: 'theory.l3.sevenths' }),
  skill('songwriting.l5.modulation', 'Key changes', 'Pivot-chord and truck-driver modulations, used only when the lyric earns them.', 'self', null, { theory_topic_id: 'theory.l5.harmonise_melody' }),
  skill('songwriting.l5.style_transplant', 'Style transplant', 'Re-set a song in another style, one lever at a time: groove, colour, harmonic rhythm, mode, phrasing.', 'self', null),
];
