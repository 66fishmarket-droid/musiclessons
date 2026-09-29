import { useEffect, useRef, useState } from 'react';
import type { Voicing } from '../../supabase/functions/_shared/engine/music.ts';
import { skillInfo } from '../lib/skillInfo.ts';
import { PickingPattern } from './PickingPattern.tsx';

/** "About this skill": what it is, how to practise it, what to listen for, and its animated picking patterns. */
export function SkillSheet({ skillId, chord, voicing, bpm, onClose }: {
  skillId: string; chord: string; voicing: Voicing | undefined; bpm: number; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pi, setPi] = useState(0);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  const info = skillInfo(skillId);
  if (!info) return null;
  const { skill, guide, patterns } = info;
  return (
    <dialog ref={ref} className="sheet sheet-tall" onClose={onClose} aria-label={`About ${skill.name}`}>
      <div className="sheet-head">
        <small className="muted">{skill.track.replaceAll('_', ' ')} · level {skill.level}</small>
        <button type="button" className="btn-ghost" onClick={() => ref.current?.close()}>Close</button>
      </div>
      <h2 className="title title-sm">{skill.name}</h2>
      <p className="text-2">{guide?.what ?? skill.description}</p>
      {guide ? (
        <>
          <h3 className="label">How to practise</h3>
          <ol className="stack-sm" style={{ margin: 0, paddingLeft: 20 }}>{guide.how.map(h => <li key={h}>{h}</li>)}</ol>
          <p><b>Listen for:</b> <span className="text-2">{guide.listenFor}</span></p>
        </>
      ) : (
        <p className="muted">A fuller guide for this skill is on the way. The block's "Tips &amp; why" has today's notes.</p>
      )}
      {patterns.length > 0 && voicing && (
        <>
          {patterns.length > 1 && (
            <div className="toggle" role="group" aria-label="Pattern">
              {patterns.map((p, k) => <button key={p.id} type="button" aria-pressed={k === pi} onClick={() => setPi(k)}>{p.name}</button>)}
            </div>
          )}
          <PickingPattern key={patterns[pi].id} pattern={patterns[pi]} chord={chord} voicing={voicing} bpm={bpm} />
        </>
      )}
    </dialog>
  );
}
