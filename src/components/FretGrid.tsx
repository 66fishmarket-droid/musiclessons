import type { NeckDot } from '../../supabase/functions/_shared/engine/neck.ts';

export type GridDot = NeckDot & { dim?: boolean };
const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const COL = 44;
const Y = (string: number) => 16 + (5 - string) * 24; // tab view: high e on top, as in the picking pattern

/** Horizontal fretboard from fret `from` to `to`: labelled dots (roots in marigold), optional links and G→B flags. */
export function FretGrid({ from, to, dots, links = [], label }: { from: number; to: number; dots: GridDot[]; links?: [GridDot, GridDot][]; label: string }) {
  const X = (fret: number) => 40 + (fret - from + 0.5) * COL;
  const W = 40 + (to - from + 1) * COL + 4;
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={160} viewBox={`0 0 ${W} 160`} role="img" aria-label={label}>
        {[0, 1, 2, 3, 4, 5].map(s => (
          <g key={s}>
            <text x={8} y={Y(s)} className="pk-name">{STRING_NAMES[s]}</text>
            <line x1={40} x2={W - 4} y1={Y(s)} y2={Y(s)} className="pk-string" />
          </g>
        ))}
        {Array.from({ length: to - from + 2 }, (_, k) => from + k).filter(f => f > 0).map(f => ( // wire left of fret f; f = 1 is the nut
          <line key={f} x1={40 + (f - from) * COL} x2={40 + (f - from) * COL} y1={Y(5)} y2={Y(0)} className={f === 1 ? 'cd-nut-line' : 'cd-fret'} />
        ))}
        {Array.from({ length: to - from + 1 }, (_, k) => from + k).filter(f => f > 0).map(f => (
          <text key={f} x={X(f)} y={152} className="fret-num">{f}</text>
        ))}
        {links.map(([a, b]) => (
          <line key={`${a.string}-${a.fret}-${b.string}-${b.fret}`} x1={X(a.fret)} y1={Y(a.string)} x2={X(b.fret)} y2={Y(b.string)} className="nm-link" />
        ))}
        {dots.map(d => {
          const root = d.root ? ' cd-root' : '';
          return (
            <g key={`${d.string}-${d.fret}`} opacity={d.dim ? 0.25 : undefined}>
              <circle cx={X(d.fret)} cy={Y(d.string)} r={10} className={`cd-dot${root}${d.flag ? ' nm-flag' : ''}`} />
              <text x={X(d.fret)} y={Y(d.string) + 1} className={`cd-label${root}`}>{d.label}</text>
              {d.note && <text x={X(d.fret)} y={Y(d.string) - 14} className="pk-count">{d.note}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
