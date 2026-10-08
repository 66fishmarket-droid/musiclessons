import { useState } from 'react';
import type { Voicing } from '../../supabase/functions/_shared/engine/music.ts';
import { shapeFor, type DotMode } from '../lib/chordLabels.ts';
import { ChordDiagram, ModeToggle } from './ChordDiagram.tsx';

/** Progression blocks: the current chord large, the next chord, tappable progression chips (Instrument layout). */
export function ChordPanel({ chords, voicings, idx, onIdx, onShapes }: {
  chords: string[]; voicings: Record<string, Voicing[]>; idx: number; onIdx: (i: number) => void; onShapes: (chord: string) => void;
}) {
  const [mode, setMode] = useState<DotMode>('fingers');
  if (chords.length === 0) return null;
  const cur = chords[idx];
  const next = chords[(idx + 1) % chords.length];
  const v = shapeFor(cur, voicings[cur]);
  return (
    <>
      <section className="card panel" aria-label="Chords">
        <div className="panel-chord">
          <h2 className="chord-name">{cur}</h2>
          {v ? <ChordDiagram chord={cur} voicing={v} mode={mode} width={150} /> : <p className="muted">No diagram</p>}
        </div>
        <div className="panel-side">
          <div className="next"><small className="muted">NEXT</small><span className="chord-name c-text">{next}</span></div>
          <ModeToggle mode={mode} onChange={setMode} />
          <small className="muted">Marigold = the root.</small>
          <button type="button" className="btn-ghost" onClick={() => onShapes(cur)}>Other shapes ›</button>
        </div>
      </section>
      <div className="prog" role="group" aria-label="Progression">
        {chords.map((c, k) => <button key={k} type="button" aria-pressed={k === idx} onClick={() => onIdx(k)}>{c}</button>)}
      </div>
    </>
  );
}
