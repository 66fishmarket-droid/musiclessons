import { audio, blip } from './clock.ts';

/** Beats from `nextTime` up to (not including) `until` at `bpm`, cycling beat numbers through the bar. */
export function scheduleBeats(nextTime: number, beat: number, bpm: number, until: number, beatsPerBar = 4) {
  const spb = 60 / bpm;
  const beats: { time: number; beat: number }[] = [];
  while (nextTime < until) {
    beats.push({ time: nextTime, beat });
    nextTime += spb;
    beat = (beat + 1) % beatsPerBar;
  }
  return { beats, nextTime, nextBeat: beat };
}

export interface Metronome { readonly running: boolean; start(bpm: number): void; stop(): void; setBpm(bpm: number): void }

/** Web Audio metronome: a 25 ms timer schedules clicks 100 ms ahead (sample-accurate); beat 1 is accented. */
export function createMetronome(onBeat: (beat: number) => void): Metronome {
  let timer = 0;
  let bpm = 60;
  let next = 0;
  let beat = 0;
  const tick = () => {
    const ac = audio();
    const r = scheduleBeats(next, beat, bpm, ac.currentTime + 0.1);
    for (const b of r.beats) {
      blip(b.time, b.beat === 0 ? 1600 : 1000);
      window.setTimeout(() => onBeat(b.beat), Math.max(0, (b.time - ac.currentTime) * 1000));
    }
    next = r.nextTime;
    beat = r.nextBeat;
  };
  return {
    get running() { return timer !== 0; },
    start(b) {
      if (timer) return;
      bpm = b;
      next = audio().currentTime + 0.05;
      beat = 0;
      tick();
      timer = window.setInterval(tick, 25);
    },
    stop() { window.clearInterval(timer); timer = 0; },
    setBpm(b) { bpm = b; },
  };
}
