import { Interval, Note } from 'tonal';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TUNING, type Voicing } from '../../supabase/functions/_shared/engine/music.ts';
import { nextBarChord, resolvePattern, type PickPattern, type Stroke } from '../../supabase/functions/_shared/engine/patterns.ts';
import { audio, blip, pluck } from '../audio/clock.ts';

const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const FINGER_CLASS = { p: 'pk-p', i: 'pk-i', m: 'pk-m', a: 'pk-a' } as const;
const SUB: Record<number, string[]> = { 1: [''], 2: ['', '&'], 3: ['', 'tri', 'let'], 4: ['', 'e', '&', 'a'] };
const ARROW: Record<Stroke, string> = { D: '↓', U: '↑', d: '↓', u: '↑', x: '×' };
const STROKE_WORD: Record<Stroke, string> = { D: 'strum down', U: 'strum up', d: 'muted down', u: 'muted up', x: 'mute' };

/** A strum on this shape: down sweeps every sounding string low to high, up the top three high to low; ghosts and mutes click. */
function strum(t: number, stroke: Stroke, v: Voicing | undefined): void {
  if (stroke === 'x' || stroke === 'd' || stroke === 'u' || !v) { blip(t, stroke === 'x' ? 120 : 180, 0.035, stroke === 'x' ? 0.25 : 0.12); return; }
  const notes = v.frets.flatMap((f, s) => (f < 0 ? [] : [Note.freq(Note.transpose(TUNING[s], Interval.fromSemitones(f)))]));
  const order = stroke === 'D' ? notes : notes.slice(-3).reverse();
  order.forEach((f, k) => pluck(t + k * 0.012, f ?? 220));
}

/**
 * Animated picking pattern: finger dots light up in order on a tab-style string view, each note plucked at its pitch.
 * One bar per chord: while playing it walks the progression from the shown chord and reports each bar's chord via onIdx.
 */
export function PickingPattern({ pattern, chords, voicings, idx, onIdx, bpm }: {
  pattern: PickPattern; chords: string[]; voicings: Record<string, Voicing[] | undefined>;
  idx: number; onIdx: (i: number) => void; bpm: number;
}) {
  const stepsFor = (i: number) => {
    const v = voicings[chords[i]]?.[0];
    return v ? resolvePattern(pattern, v, chords[i]) : pattern.steps.map(() => []);
  };
  const chord = chords[idx];
  const voicing = voicings[chord]?.[0];
  const steps = useMemo(() => stepsFor(idx), [pattern, chords, voicings, idx]);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(-1);
  const stepMs = 60_000 / bpm / pattern.stepsPerBeat;
  const barLen = pattern.beatsPerBar * pattern.stepsPerBeat;
  const strokes = pattern.strokes;
  const COL = pattern.stepsPerBeat >= 4 ? 21 : 30; // 16ths need narrower columns to fit a phone
  const R = COL / 2 - 2;
  const live = useRef({ idx, onIdx, stepsFor, voicings });
  live.current = { idx, onIdx, stepsFor, voicings };

  useEffect(() => {
    if (!playing) { setPos(-1); return; }
    let k = 0;
    let bar = -1;
    let barSteps = steps;
    const play = () => {
      const i = k % pattern.steps.length;
      if (i % barLen === 0) {
        bar = nextBarChord(bar, live.current.idx, chords.length);
        barSteps = live.current.stepsFor(bar);
        if (bar !== live.current.idx) live.current.onIdx(bar);
      }
      setPos(i);
      const t = audio().currentTime;
      for (const n of barSteps[i]) pluck(t, Note.freq(n.note) ?? 220);
      const st = strokes?.[i];
      if (st) strum(t, st, live.current.voicings[chords[bar]]?.[0]);
      k++;
    };
    play();
    const timer = window.setInterval(play, stepMs);
    return () => window.clearInterval(timer);
  }, [playing, stepMs, pattern, chords]); // steps come from live.current, so a chord change mid-play does not restart the bar

  const W = 44 + steps.length * COL;
  const X = (col: number) => 44 + col * COL + COL / 2;
  const Y = (string: number) => 16 + (5 - string) * 24; // tab view: high e on top
  const label = steps.map((s, k) => (strokes?.[k] ? STROKE_WORD[strokes[k]!] : s.map(n => `${n.finger} on ${STRING_NAMES[n.string]} (${n.interval})`).join(' + ') || 'rest')).join(', ');
  return (
    <section className="card" aria-label={`${pattern.name} ${strokes ? 'rhythm' : 'picking pattern'} on ${chord}`}>
      <div className="row"><b>{pattern.name}</b><small className="muted"><span className="c-text">{chord}</span>{chords.length > 1 ? ` (${idx + 1} of ${chords.length})` : ''} · {bpm} bpm</small></div>
      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={170} viewBox={`0 0 ${W} 170`} role="img" aria-label={label}>
          {pos >= 0 && <rect x={X(pos) - COL / 2 + 1} y={4} width={COL - 2} height={140} rx={8} className="pk-head" />}
          {[0, 1, 2, 3, 4, 5].map(s => (
            <g key={s}>
              <text x={8} y={Y(s)} className="pk-name">{STRING_NAMES[s]}</text>
              <text x={26} y={Y(s)} className="pk-fret">{!voicing || voicing.frets[s] < 0 ? '×' : voicing.frets[s]}</text>
              <line x1={40} x2={W - 4} y1={Y(s)} y2={Y(s)} className="pk-string" />
            </g>
          ))}
          {steps.map((step, col) => step.map(n => (
            <g key={`${col}-${n.string}`} className={pos === col ? 'pk-on' : ''}>
              <circle cx={X(col)} cy={Y(n.string)} r={R} className={`pk-dot ${FINGER_CLASS[n.finger]}`} />
              <text x={X(col)} y={Y(n.string) + 1} className="pk-finger">{n.finger}</text>
            </g>
          )))}
          {strokes?.map((st, col) => st && (
            <text key={`s${col}`} x={X(col)} y={Y(2.5) + 2} className={`pk-stroke${st === 'd' || st === 'u' ? ' pk-ghost' : ''}${pos === col ? ' pk-on' : ''}`}>{ARROW[st]}</text>
          ))}
          {steps.map((_, col) => (
            <text key={col} x={X(col)} y={162} className="pk-count">
              {col % pattern.stepsPerBeat === 0 ? (col / pattern.stepsPerBeat) % pattern.beatsPerBar + 1 : SUB[pattern.stepsPerBeat][col % pattern.stepsPerBeat]}
            </text>
          ))}
        </svg>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        {strokes
          ? '↓ strum down · ↑ strum up · faded arrows are muted "ghost" strums · × mutes or slaps the strings · p is your thumb on the bass note (the root of the chord).'
          : 'p thumb · i index · m middle · a ring. The thumb takes the root and the alternate bass; the fingers take the top chord tones.'}
        {chords.length > 1 ? ' One bar per chord, through the progression.' : ''}
      </p>
      <button type="button" className="btn-play" aria-pressed={playing} onClick={() => setPlaying(!playing)}>
        {playing ? 'Stop' : strokes ? 'Play the rhythm' : 'Play the pattern'}
      </button>
    </section>
  );
}
