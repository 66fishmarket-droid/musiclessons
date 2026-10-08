import { useEffect, useRef, useState } from 'react';
import type { Voicing } from '../../supabase/functions/_shared/engine/music.ts';
import { pickShape, shapeFor, shapesFor, type DotMode } from '../lib/chordLabels.ts';
import { ChordDiagram, ModeToggle } from './ChordDiagram.tsx';

/** Modal sheet paging through a chord's shapes ("Shape n of N"), opening on the current default; "Use this shape" makes
 * the shown one the default everywhere the chord is drawn (a learner who struggles with the easiest-in-theory shape). */
export function VoicingSheet({ chord, known, onClose }: { chord: string; known?: Voicing[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [shapes] = useState(() => shapesFor(chord, known));
  const [def, setDef] = useState(() => shapeFor(chord, known)?.frets.join());
  const [i, setI] = useState(() => Math.max(0, shapes.findIndex(v => v.frets.join() === def)));
  const [mode, setMode] = useState<DotMode>('fingers');
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal(); // StrictMode runs effects twice; showModal on an open dialog throws
  }, []);
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-label={`${chord} shapes`}>
      <div className="sheet-head">
        <h2 className="chord-name">{chord}</h2>
        <button type="button" className="btn-ghost" onClick={() => ref.current?.close()}>Close</button>
      </div>
      {shapes.length === 0 ? <p className="muted">No diagram for {chord}.</p> : (
        <>
          <ChordDiagram chord={chord} voicing={shapes[i]} mode={mode} width={180} />
          <div className="row">
            <button type="button" className="round" aria-label="Previous shape" disabled={i === 0} onClick={() => setI(i - 1)}>‹</button>
            <span>Shape {i + 1} of {shapes.length}</span>
            <button type="button" className="round" aria-label="Next shape" disabled={i === shapes.length - 1} onClick={() => setI(i + 1)}>›</button>
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
          {shapes[i].frets.join() === def
            ? <small className="muted">Your shape for {chord}.</small>
            : <button type="button" className="btn-ghost" onClick={() => { pickShape(chord, shapes[i]); setDef(shapes[i].frets.join()); }}>Use this shape</button>}
        </>
      )}
    </dialog>
  );
}
