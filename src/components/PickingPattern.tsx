import { Note } from 'tonal';
import { useEffect, useMemo, useState } from 'react';
import type { Voicing } from '../../supabase/functions/_shared/engine/music.ts';
import { resolvePattern, type PickPattern } from '../../supabase/functions/_shared/engine/patterns.ts';
import { audio, pluck } from '../audio/clock.ts';

const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const FINGER_CLASS = { p: 'pk-p', i: 'pk-i', m: 'pk-m', a: 'pk-a' } as const;
const SUB: Record<number, string[]> = { 1: [''], 2: ['', '&'], 3: ['', 'tri', 'let'] };

/** Animated picking pattern: finger dots light up in order on a tab-style string view, each note plucked at its pitch. */
export function PickingPattern({ pattern, chord, voicing, bpm }: { pattern: PickPattern; chord: string; voicing: Voicing; bpm: number }) {
  const steps = useMemo(() => resolvePattern(pattern, voicing, chord), [pattern, voicing, chord]);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(-1);
  const stepMs = 60_000 / bpm / pattern.stepsPerBeat;

  useEffect(() => {
    if (!playing) { setPos(-1); return; }
    let k = 0;
    const play = () => {
      const i = k % steps.length;
      setPos(i);
      const t = audio().currentTime;
      for (const n of steps[i]) pluck(t, Note.freq(n.note) ?? 220);
      k++;
    };
    play();
    const timer = window.setInterval(play, stepMs);
    return () => window.clearInterval(timer);
  }, [playing, steps, stepMs]);

  const W = 44 + steps.length * 30;
  const X = (col: number) => 44 + col * 30 + 15;
  const Y = (string: number) => 16 + (5 - string) * 24; // tab view: high e on top
  const label = steps.map(s => s.map(n => `${n.finger} on ${STRING_NAMES[n.string]} (${n.interval})`).join(' + ') || 'rest').join(', ');
  return (
    <section className="card" aria-label={`${pattern.name} picking pattern on ${chord}`}>
      <div className="row"><b>{pattern.name}</b><small className="muted">{chord} · {bpm} bpm</small></div>
      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={170} viewBox={`0 0 ${W} 170`} role="img" aria-label={label}>
          {pos >= 0 && <rect x={X(pos) - 13} y={4} width={26} height={140} rx={8} className="pk-head" />}
          {[0, 1, 2, 3, 4, 5].map(s => (
            <g key={s}>
              <text x={8} y={Y(s)} className="pk-name">{STRING_NAMES[s]}</text>
              <text x={26} y={Y(s)} className="pk-fret">{voicing.frets[s] < 0 ? '×' : voicing.frets[s]}</text>
              <line x1={40} x2={W - 4} y1={Y(s)} y2={Y(s)} className="pk-string" />
            </g>
          ))}
          {steps.map((step, col) => step.map(n => (
            <g key={`${col}-${n.string}`} className={pos === col ? 'pk-on' : ''}>
              <circle cx={X(col)} cy={Y(n.string)} r={11} className={`pk-dot ${FINGER_CLASS[n.finger]}`} />
              <text x={X(col)} y={Y(n.string) + 1} className="pk-finger">{n.finger}</text>
            </g>
          )))}
          {steps.map((_, col) => (
            <text key={col} x={X(col)} y={162} className="pk-count">
              {col % pattern.stepsPerBeat === 0 ? col / pattern.stepsPerBeat + 1 : SUB[pattern.stepsPerBeat][col % pattern.stepsPerBeat]}
            </text>
          ))}
        </svg>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>p thumb · i index · m middle · a ring. The thumb takes the root and the alternate bass; the fingers take the top chord tones.</p>
      <button type="button" className="btn-play" aria-pressed={playing} onClick={() => setPlaying(!playing)}>
        {playing ? 'Stop' : 'Play the pattern'}
      </button>
    </section>
  );
}
