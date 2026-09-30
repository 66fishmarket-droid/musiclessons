export interface CreateTask { id: string; prompt: string; steps: string[]; songwriting?: string[] }

const RECORD = 'Record it with the app\'s recorder and listen back once.';

/** Songwriting micro-tasks for the Create block (spec §6); same slots as recipes. */
export const CREATE_TASKS: CreateTask[] = [
  {
    id: 'melody_135', songwriting: ['songwriting.l1.core_loops'],
    prompt: 'Make up a four-bar tune using only {degrees:1,3,5} while you play {chords}, one bar each.',
    steps: [
      'A four-bar tune is a short melody that lasts four bars: one bar per chord, four beats per bar.',
      'Find it first: pick {degrees:1,3,5} one note at a time on the top strings until you like the order. The fretboard shows them as 1, 3 and 5.',
      'Now play {chords} with the day\'s rhythm and sing (or hum) the tune over it, one bar per chord.', RECORD,
    ],
  },
  {
    id: 'question_answer', songwriting: ['songwriting.l2.melody_skeleton', 'songwriting.l2.section_contrast'],
    prompt: 'Sing a two-bar question that ends on {degrees:5}, then a two-bar answer that ends on {degrees:1}, over {chords}.',
    steps: [
      'Play {chords}, one bar per chord.',
      'Over the first two bars, sing a short phrase that ends on {degrees:5}. It sounds unfinished, like a question.',
      'Over the last two bars, sing a phrase that ends on {degrees:1}. It sounds like home, the answer.', RECORD,
    ],
  },
  {
    id: 'rhyming_couplet', songwriting: ['songwriting.l1.object_writing'],
    prompt: 'Write two rhyming lines about something in the room and sing them on {degrees:1} and {degrees:5} over {chords}.',
    steps: [
      'Look around and pick one object. Write two short lines about it that rhyme.',
      'Play {chords}, one bar per chord, and say the lines in time with the strum.',
      'Now sing them: the first line on {degrees:1}, the second on {degrees:5}.', RECORD,
    ],
  },
  {
    id: 'new_feel', songwriting: ['songwriting.l5.style_transplant'],
    prompt: 'Keep {chords} and change one thing about the rhythm.',
    steps: [
      'Play {chords} with the day\'s rhythm, one bar per chord.',
      'Change exactly one thing: move the bass note to a different beat, or leave one strum out.',
      'Hum or sing any line over the new feel and notice what changed in the mood.', RECORD,
    ],
  },
  {
    id: 'one_note_verse', songwriting: ['songwriting.l3.prechorus_tension'],
    prompt: 'Sing a line on one note, {degrees:1}, over {chords} and let the chords do the moving.',
    steps: [
      'Play {chords}, one bar per chord.',
      'Sing or speak any line of words, keeping every syllable on {degrees:1}.',
      'Listen to how the same note feels different over each chord.', RECORD,
    ],
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
