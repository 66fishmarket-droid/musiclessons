import { describe, expect, it } from 'vitest';
import { scheduleBeats } from '../../src/audio/metronome.ts';

describe('scheduleBeats', () => {
  it('schedules every beat before the horizon at the given tempo', () => {
    const r = scheduleBeats(0, 0, 60, 2.5);
    expect(r.beats).toEqual([{ time: 0, beat: 0 }, { time: 1, beat: 1 }, { time: 2, beat: 2 }]);
    expect(r).toMatchObject({ nextTime: 3, nextBeat: 3 });
  });
  it('wraps the bar and picks up where the last call stopped', () => {
    const r = scheduleBeats(3, 3, 120, 4.1);
    expect(r.beats.map(b => b.beat)).toEqual([3, 0, 1]);
    expect(r.nextTime).toBeCloseTo(4.5);
    expect(r.nextBeat).toBe(2);
  });
  it('schedules nothing when the next beat is past the horizon', () => {
    expect(scheduleBeats(5, 1, 60, 4.9).beats).toEqual([]);
  });
});
