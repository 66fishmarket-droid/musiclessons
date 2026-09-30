import { Note } from 'tonal';
import { noteAt, type TriadShape } from '../../supabase/functions/_shared/engine/music.ts';

const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const COL = 44;
const INVERSION_LABEL = { root: 'root position', first: '1st inversion', second: '2nd inversion' } as const;

/** Each `TriadShape` as a mini horizontal fretboard: one row of dots per shape, root note in marigold. */
export function TriadBoard({ triads }: { triads: TriadShape[] }) {
  if (triads.length === 0) return null;
  const rootChroma = Note.chroma(triads.find(t => t.inversion === 'root')?.bass ?? triads[0].bass);
  return (
    <section className="card" aria-label="Triad shapes">
      {triads.map((t, k) => {
        const from = Math.min(...t.frets) - 1;
        const to = Math.max(...t.frets) + 1;
        const X = (fret: number) => 40 + (fret - from + 0.5) * COL;
        const Y = (row: number) => 16 + (t.strings.length - 1 - row) * 24; // high string on top, matching ScaleBoard's tab view
        const W = 40 + (to - from + 1) * COL + 4;
        const H = 16 + t.strings.length * 24;
        const label = `${INVERSION_LABEL[t.inversion]}: ` + t.strings.map((s, i) => `${STRING_NAMES[s]} string fret ${t.frets[i]}`).join(', ');
        return (
          <div key={k} style={{ overflowX: 'auto' }}>
            <div className="row"><b>{INVERSION_LABEL[t.inversion]}</b></div>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
              {t.strings.map((s, row) => (
                <g key={s}>
                  <text x={8} y={Y(row)} className="pk-name">{STRING_NAMES[s]}</text>
                  <line x1={40} x2={W - 4} y1={Y(row)} y2={Y(row)} className="pk-string" />
                </g>
              ))}
              {Array.from({ length: to - from + 2 }, (_, i) => from + i).filter(f => f > 0).map(f => (
                <line key={f} x1={40 + (f - from) * COL} x2={40 + (f - from) * COL} y1={Y(t.strings.length - 1)} y2={Y(0)}
                  className={f === 1 ? 'cd-nut-line' : 'cd-fret'} />
              ))}
              {t.frets.map((f, row) => {
                const root = Note.chroma(noteAt(t.strings[row], f)) === rootChroma ? ' cd-root' : '';
                return (
                  <g key={row}>
                    <circle cx={X(f)} cy={Y(row)} r={10} className={`cd-dot${root}`} />
                    <text x={X(f)} y={Y(row) + 1} className={`cd-label${root}`}>{f}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })}
    </section>
  );
}
