import { describe, expect, it } from 'vitest';
import { ALL_NOTES, NATURALS, NOTE_CALLER_SKILLS, nextCall, spoken } from '../../src/lib/noteCaller.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';

describe('nextCall', () => {
  it('never repeats the last note', () => {
    let prev: string | null = null;
    for (let k = 0; k < 200; k++) {
      const n = nextCall(prev, ALL_NOTES);
      expect(n).not.toBe(prev);
      prev = n;
    }
  });
  it('picks from the given set only', () => {
    for (const r of [0, 0.5, 0.999]) expect(NATURALS).toContain(nextCall('A', NATURALS, () => r));
    expect(nextCall('A', NATURALS, () => 0)).toBe('B'); // A is skipped, so the lowest pick is B
  });
});

describe('spoken', () => {
  it('says sharps as words', () => {
    expect(spoken('F#')).toBe('F sharp');
    expect(spoken('A')).toBe('A');
  });
});

it('note-caller skills exist in the curriculum', () => {
  for (const id of NOTE_CALLER_SKILLS) expect(SKILLS.some(s => s.id === id)).toBe(true);
});
