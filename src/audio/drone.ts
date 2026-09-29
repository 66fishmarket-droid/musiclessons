import { Note } from 'tonal';
import { audio } from './clock.ts';

/** Starts a soft root + fifth + octave drone on `tonic` (pitch class); returns a stop function that fades it out. */
export function startDrone(tonic: string): () => void {
  const ac = audio();
  const out = ac.createGain();
  out.gain.setValueAtTime(0, ac.currentTime);
  out.gain.linearRampToValueAtTime(0.12, ac.currentTime + 0.5);
  out.connect(ac.destination);
  const oscs = [`${tonic}2`, `${Note.transpose(tonic, '5P')}2`, `${tonic}3`].map(n => {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = Note.freq(n) ?? 110;
    o.connect(out);
    o.start();
    return o;
  });
  return () => {
    const t = ac.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(0, t + 0.4);
    oscs.forEach(o => o.stop(t + 0.45));
  };
}
