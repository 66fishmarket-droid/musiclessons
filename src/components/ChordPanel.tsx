import { useState } from 'react';
import type { Voicing } from '../../supabase/functions/_shared/engine/music.ts';
import { liftedShape } from '../../supabase/functions/_shared/engine/patterns.ts';
import { shapeFor, type DotMode } from '../lib/chordLabels.ts';
import { ChordDiagram, ModeToggle } from './ChordDiagram.tsx';

/** Progression blocks: the current chord large, the next chord, tappable progression chips (Instrument layout).
 * `lift` adds a Chord / Lifted flip for hammer-on and pull-off skills (owner 2026-10-19: see both shapes, fingers included). */
export function ChordPanel({ chords, voicings, idx, onIdx, onShapes, lift = false }: {
  chords: string[]; voicings: Record<string, Voicing[]>; idx: number; onIdx: (i: number) => void; onShapes: (chord: string) => void; lift?: boolean;
}) {
  const [mode, setMode] = useState<DotMode>('fingers');
  const [lifted, setLifted] = useState(false);
  if (chords.length === 0) return null;
  const cur = chords[idx];
  const next = chords[(idx + 1) % chords.length];
  const full = shapeFor(cur, voicings[cur]);
  const up = lift && full ? liftedShape(full) : null;
  const v = lifted && up ? up : full;
  return (
    <>
      <section className="card panel" aria-label="Chords">
        <div className="panel-chord">
          <h2 className="chord-name">{cur}</h2>
          {v ? <ChordDiagram chord={cur} voicing={v} mode={mode} width={150} /> : <p className="muted">No diagram</p>}
        </div>
        <div className="panel-side">
          <div className="next"><small className="muted">NEXT</small><span className="chord-name c-text">{next}</span></div>
          {up && (
            <div className="toggle" role="group" aria-label="Shape">
              <button type="button" aria-pressed={!lifted} onClick={() => setLifted(false)}>Chord</button>
              <button type="button" aria-pressed={lifted} onClick={() => setLifted(true)}>Lifted</button>
            </div>
          )}
          {up && <small className="muted">Lifted = one finger off: hammer it back on to reach Chord.</small>}
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
