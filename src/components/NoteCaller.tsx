import { useEffect, useState } from 'react';
import type { MetronomeControls } from '../audio/useMetronome.ts';
import { ALL_NOTES, NATURALS, nextCall, spoken } from '../lib/noteCaller.ts';

/** Fretboard drill: on every bar's first metronome click, shows and says a random note; find it before the next bar. */
export function NoteCaller({ metro }: { metro: MetronomeControls }) {
  const [running, setRunning] = useState(false);
  const [all, setAll] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!running || metro.beat !== 0) return;
    const n = nextCall(note, all ? ALL_NOTES : NATURALS);
    setNote(n);
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      speechSynthesis.speak(new SpeechSynthesisUtterance(spoken(n)));
    }
  }, [metro.beat, running]); // only a new downbeat calls; `all` and `note` are read then
  useEffect(() => () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); }, []);

  const toggle = () => {
    if (running === metro.playing) metro.toggle(); // start and stop the metronome together with the caller
    setRunning(!running);
    if (running) setNote(null);
  };

  return (
    <section className="card" aria-label="Note caller">
      <div className="row">
        <b>Note caller</b>
        <div className="toggle" role="group" aria-label="Notes to call">
          <button type="button" aria-pressed={!all} onClick={() => setAll(false)}>Naturals</button>
          <button type="button" aria-pressed={all} onClick={() => setAll(true)}>All 12</button>
        </div>
      </div>
      <p className="center" aria-live="assertive" style={{ fontSize: 72, fontWeight: 800, margin: '8px 0', color: 'var(--c, var(--gold))' }}>
        {running && note ? note : '–'}
      </p>
      <p className="muted" style={{ fontSize: 13 }}>A new note on the first beat of every bar ({metro.bpm} bpm). Find it on the low E or A string before the next one. Speed up with the metronome.</p>
      <button type="button" className="btn-play" aria-pressed={running} onClick={toggle}>
        {running ? 'Stop' : 'Start calling notes'}
      </button>
    </section>
  );
}
