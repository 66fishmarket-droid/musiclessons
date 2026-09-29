import type { MetronomeControls } from '../audio/useMetronome.ts';

/** Tempo card: ± stepper around a 76 px bpm, ladder chips, beat dots, drone chip, start/stop. */
export function Metronome({ metro, target, ladder, drone, onDrone, tonic }: {
  metro: MetronomeControls; target: number | null; ladder: number[] | null; drone: boolean; onDrone: () => void; tonic: string;
}) {
  return (
    <section className="card metro" aria-label="Metronome">
      <div className="row">
        <button type="button" className="round lg" aria-label="Slower" onClick={() => metro.setBpm(metro.bpm - 1)}>−</button>
        <div className="center">
          <span className="bpm">{metro.bpm}</span>
          <small className="muted">bpm{target !== null ? ` · target ${target}` : ''}</small>
        </div>
        <button type="button" className="round lg" aria-label="Faster" onClick={() => metro.setBpm(metro.bpm + 1)}>+</button>
      </div>
      {ladder && ladder.length > 1 && (
        <div className="ladder" role="group" aria-label="Tempo ladder">
          {ladder.map(v => <button key={v} type="button" aria-pressed={v === metro.bpm} onClick={() => metro.setBpm(v)}>{v}</button>)}
        </div>
      )}
      <div className="row">
        <div className="beats" aria-hidden="true">
          {[0, 1, 2, 3].map(b => <span key={b} className={b === metro.beat ? 'on' : ''} />)}
        </div>
        <button type="button" className="btn-ghost" aria-pressed={drone} onClick={onDrone}>Drone {tonic} · {drone ? 'on' : 'off'}</button>
      </div>
      <button type="button" className="btn-play" aria-pressed={metro.playing} onClick={metro.toggle}>
        {metro.playing ? 'Stop metronome' : 'Start metronome'}
      </button>
    </section>
  );
}
