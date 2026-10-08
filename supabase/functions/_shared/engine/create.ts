import type { StepElement } from './recipes.ts';

/** `show`: per step, what Player shows besides the text (the prompt card is always on); the recorder only on RECORD.
 * `label` names the task in the lesson path; `why` is the Create block's always-visible intro (lesson/thread.ts). */
export interface CreateTask { id: string; label: string; why: string; prompt: string; steps: string[]; show: StepElement[][]; songwriting?: string[] }

const RECORD = 'Record it with the app\'s recorder and listen back once.';

/** Songwriting micro-tasks for the Create block (spec §6); same slots as recipes. */
export const CREATE_TASKS: CreateTask[] = [
  {
    id: 'melody_135', songwriting: ['songwriting.l1.core_loops'], label: 'a four-bar tune on 1, 3 and 5',
    why: 'Notes 1, 3 and 5 make the home chord, so a tune built from them always sounds like it belongs to the key: the safest way into writing a melody.',
    prompt: 'Make up a four-bar tune using only the notes {degrees:1,3,5} while you play {chords}, one bar each.',
    steps: [
      'A four-bar tune is a short melody that lasts four bars: one bar per chord, four beats per bar.',
      'Find it first: pick the notes {degrees:1,3,5} one at a time on the top strings until you like the order. The fretboard shows them as 1, 3 and 5.',
      'Now play {chords} with the day\'s rhythm and sing (or hum) the tune over it, one bar per chord.', RECORD,
    ],
    show: [[], ['scale'], ['chords'], ['chords', 'recorder']],
  },
  {
    id: 'question_answer', songwriting: ['songwriting.l2.melody_skeleton', 'songwriting.l2.section_contrast'], label: 'a question-and-answer phrase',
    why: 'Most melodies are phrases that ask and answer: ending on 5 sounds open, ending on 1 sounds finished. Two bars each is the shortest version of that.',
    prompt: 'Sing a two-bar question that ends on the note {degrees:5}, then a two-bar answer that ends on the note {degrees:1}, over {chords}.',
    steps: [
      'Play {chords}, one bar per chord.',
      'Over the first two bars, sing a short phrase that ends on the note {degrees:5}. It sounds unfinished, like a question.',
      'Over the last two bars, sing a phrase that ends on the note {degrees:1}. It sounds like home, the answer.', RECORD,
    ],
    show: [['chords'], ['chords', 'scale'], ['chords', 'scale'], ['chords', 'recorder']],
  },
  {
    id: 'rhyming_couplet', songwriting: ['songwriting.l1.object_writing'], label: 'a sung rhyming couplet',
    why: 'Words on a held pitch are a song in miniature, and holding the pitch lets you hear the chords colour it.',
    prompt: 'Write two rhyming lines about something in the room, then sing the first on the note {degrees:1} and the second on the note {degrees:5} over {chords}.',
    steps: [
      'Look around and pick one object. Write two short lines about it that rhyme.',
      'Play {chords}, one bar per chord, and speak the lines in time with the strum: line one over the first two bars, line two over the last two.',
      'Now sing them, each line on one held pitch: line one on the note {degrees:1} over the first two bars, line two on the note {degrees:5} over the last two. Keep the pitch steady and let the chords move under you.', RECORD,
    ],
    show: [[], ['chords'], ['chords', 'scale'], ['chords', 'recorder']],
  },
  {
    id: 'new_feel', songwriting: ['songwriting.l5.style_transplant'], label: 'a new feel for the same chords',
    why: 'Changing one thing in the rhythm shows how much of a song\'s mood lives in the groove rather than the chords.',
    prompt: 'Keep {chords} and change one thing about the rhythm.',
    steps: [
      'Play {chords} with the rhythm from the Apply block, one bar per chord.',
      'Change exactly one thing: move the bass note to a different beat, or leave one strum out.',
      'Hum or sing any line over the new feel and notice what changed in the mood.', RECORD,
    ],
    show: [['chords'], ['chords'], ['chords'], ['chords', 'recorder']],
  },
  {
    id: 'one_note_verse', songwriting: ['songwriting.l3.prechorus_tension'], label: 'a one-note verse line',
    why: 'Holding one pitch while the chords move is how many verses work: the harmony changes the note\'s colour under you.',
    prompt: 'Sing a line on one held pitch, the note {degrees:1}, over {chords} and let the chords do the moving.',
    steps: [
      'Play {chords}, one bar per chord.',
      'Sing or speak any line of words, keeping every syllable on the note {degrees:1}.',
      'Listen to how the same note feels different over each chord.', RECORD,
    ],
    show: [['chords'], ['chords', 'scale'], ['chords'], ['chords', 'recorder']],
  },
];

/** Today's Create task: one using today's songwriting skill if any, else rotate by date, never one of the last three. */
export function pickCreateTask(date: string, skillId: string, recent: (string | null)[]): string {
  const last3 = new Set(recent.slice(0, 3));
  const forSkill = CREATE_TASKS.find(t => t.songwriting?.includes(skillId) && !last3.has(t.id));
  if (forSkill) return forSkill.id;
  const pool = CREATE_TASKS.filter(t => !last3.has(t.id));
  const day = Math.floor(Date.parse(date) / 86_400_000);
  return (pool.length ? pool : CREATE_TASKS)[day % (pool.length || CREATE_TASKS.length)].id;
}
