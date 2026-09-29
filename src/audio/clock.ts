let ctx: AudioContext | null = null;

/** The app's single AudioContext, created and resumed on first use (call from a tap: iOS needs a user gesture). */
export function audio(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** A short sine blip at `when` (AudioContext time): metronome clicks and the block-end chime. */
export function blip(when: number, freq: number, dur = 0.05, gain = 0.5): void {
  const ac = audio();
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.frequency.value = freq;
  env.gain.setValueAtTime(gain, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + dur);
  osc.connect(env).connect(ac.destination);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

/** A short plucked-string tone at `when`: triangle wave, fast attack, 0.6 s decay. */
export function pluck(when: number, freq: number): void {
  const ac = audio();
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(0.3, when + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, when + 0.6);
  osc.connect(env).connect(ac.destination);
  osc.start(when);
  osc.stop(when + 0.65);
}
