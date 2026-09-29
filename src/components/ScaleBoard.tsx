import type { MusicContent } from '../../supabase/functions/_shared/engine/music.ts';
import { scaleBox } from '../../supabase/functions/_shared/engine/music.ts';

const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const COL = 44;
const Y = (string: number) => 16 + (5 - string) * 24; // tab view: high e on top, as in the picking pattern

/** Today's scale in one position on a horizontal fretboard: dots show the scale degree, roots in marigold. */
export function ScaleBoard({ scale }: { scale: MusicContent['scale'] }) {
  const { from, to, notes } = scaleBox(scale.positions);
  const X = (fret: number) => 40 + (fret - from + 0.5) * COL;
  const W = 40 + (to - from + 1) * COL + 4;
  const label = `${scale.tonic} ${scale.name}, frets ${from} to ${to}: ` +
    notes.map(n => `${STRING_NAMES[n.string]} string fret ${n.fret} ${n.note} (${n.degree})`).join(', ');
  return (
    <section className="card" aria-label={`${scale.tonic} ${scale.name} scale`}>
      <div className="row"><b>{scale.tonic} {scale.name}</b><small className="muted">{scale.notes.join(' ')}</small></div>
      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={160} viewBox={`0 0 ${W} 160`} role="img" aria-label={label}>
          {[0, 1, 2, 3, 4, 5].map(s => (
            <g key={s}>
              <text x={8} y={Y(s)} className="pk-name">{STRING_NAMES[s]}</text>
              <line x1={40} x2={W - 4} y1={Y(s)} y2={Y(s)} className="pk-string" />
            </g>
          ))}
          {Array.from({ length: to - from + 2 }, (_, k) => from + k).filter(f => f > 0).map(f => ( // wire left of fret f; f = 1 is the nut
            <line key={f} x1={40 + (f - from) * COL} x2={40 + (f - from) * COL} y1={Y(5)} y2={Y(0)}
              className={f === 1 ? 'cd-nut-line' : 'cd-fret'} />
          ))}
          {Array.from({ length: to - from + 1 }, (_, k) => from + k).filter(f => f > 0).map(f => (
            <text key={f} x={X(f)} y={152} className="pk-count">{f}</text>
          ))}
          {notes.map(n => {
            const root = n.degree === 1 ? ' cd-root' : '';
            return (
              <g key={`${n.string}-${n.fret}`}>
                <circle cx={X(n.fret)} cy={Y(n.string)} r={10} className={`cd-dot${root}`} />
                <text x={X(n.fret)} y={Y(n.string) + 1} className={`cd-label${root}`}>{n.degree}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Numbers are scale degrees: 1 is {scale.tonic}, the home note (marigold).{from === 0 ? ' The first column is open strings.' : ''}</p>
    </section>
  );
}
