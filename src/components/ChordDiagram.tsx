import type { Voicing } from '../../supabase/functions/_shared/engine/music.ts';
import { baseFret, dotLabels, rootStrings, type DotMode } from '../lib/chordLabels.ts';

const X = (s: number) => 15 + 20 * s;   // string 0 = low E, on the left
const Y = (row: number) => 30 + 24 * row; // row 0 = the nut line

/** Vertical chord box: finger numbers or intervals in the dots, root in marigold, x/o above the nut, base fret when high. */
export function ChordDiagram({ chord, voicing, mode, width = 116 }: { chord: string; voicing: Voicing; mode: DotMode; width?: number }) {
  const base = baseFret(voicing);
  const labels = dotLabels(voicing, chord, mode);
  const roots = rootStrings(voicing, chord);
  const barres = voicing.barres
    .map(fret => {
      const on = voicing.frets.flatMap((f, s) => (f === fret ? [s] : []));
      return { fret, from: Math.min(...on), to: Math.max(...on) };
    })
    .filter(b => b.to > b.from);
  const described = voicing.frets.map(f => (f < 0 ? 'x' : String(f))).join(' ');
  return (
    <svg className="chord-diagram" width={width} height={(width * 160) / 130} viewBox="0 0 130 160" role="img"
      aria-label={`${chord}, frets low to high: ${described}`}>
      {base === 1
        ? <rect x="14" y="27" width="102" height="5" rx="1" className="cd-nut" />
        : <text x="124" y={Y(0.5)} className="cd-base">{base}</text>}
      {[1, 2, 3, 4, 5].map(r => <line key={r} x1="15" x2="115" y1={Y(r)} y2={Y(r)} className="cd-fret" />)}
      {[0, 1, 2, 3, 4, 5].map(s => <line key={s} x1={X(s)} x2={X(s)} y1="30" y2="150" className="cd-string" />)}
      {barres.map(b => (
        <rect key={b.fret} x={X(b.from) - 10} width={X(b.to) - X(b.from) + 20} y={Y(b.fret - base + 0.5) - 10} height="20" rx="10" className="cd-barre" />
      ))}
      {voicing.frets.map((f, s) => {
        const root = roots[s] ? ' cd-root' : '';
        if (f < 0) return <text key={s} x={X(s)} y="15" className="cd-mute">×</text>;
        if (f === 0) return <circle key={s} cx={X(s)} cy="14" r="6" className={`cd-open${root}`} />;
        const y = Y(f - base + 0.5);
        return (
          <g key={s}>
            <circle cx={X(s)} cy={y} r="10" className={`cd-dot${root}`} />
            <text x={X(s)} y={y + 1} className={`cd-label${root}`}>{labels[s]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Fingers / Intervals switch for chord diagrams. */
export function ModeToggle({ mode, onChange }: { mode: DotMode; onChange: (m: DotMode) => void }) {
  return (
    <div className="toggle" role="group" aria-label="Show dots as">
      {(['fingers', 'intervals'] as const).map(m => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => onChange(m)}>
          {m === 'fingers' ? 'Fingers' : 'Intervals'}
        </button>
      ))}
    </div>
  );
}
