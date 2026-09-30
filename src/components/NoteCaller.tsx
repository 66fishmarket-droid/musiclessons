import { useEffect, useState } from 'react';
import { ALL_NOTES, NATURALS, nextCall, spoken } from '../lib/noteCaller.ts';

/** Fretboard drill: shows and says a random note once per bar (4 beats) at the metronome tempo; find it before the next call. */
export function NoteCaller({ bpm }: { bpm: number }) {
  const [running, setRunning] = useState(false);
  const [all, setAll] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const set = all ? ALL_NOTES : NATURALS;
    let prev: string | null = null;
    const call = () => {
      prev = nextCall(prev, set);
      setNote(prev);
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        speechSynthesis.speak(new SpeechSynthesisUtterance(spoken(prev)));
      }
    };
    call();
    const timer = window.setInterval(call, (4 * 60_000) / bpm);
    return () => { window.clearInterval(timer); if ('speechSynthesis' in window) speechSynthesis.cancel(); };
  }, [running, all, bpm]);

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
      <p className="muted" style={{ fontSize: 13 }}>A new note every bar ({bpm} bpm). Find it on the low E or A string before the next one. Speed up with the metronome.</p>
      <button type="button" className="btn-play" aria-pressed={running} onClick={() => setRunning(!running)}>
        {running ? 'Stop' : 'Start calling notes'}
      </button>
    </section>
  );
}
