import type { MusicContent } from '../../supabase/functions/_shared/engine/music.ts';
import { scaleBox } from '../../supabase/functions/_shared/engine/music.ts';
import { FretGrid } from './FretGrid.tsx';

const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];

/** Today's scale in one position on a horizontal fretboard: dots show the scale degree, roots in marigold. */
export function ScaleBoard({ scale, highlight }: { scale: MusicContent['scale']; highlight?: number[] }) {
  const { from, to, notes } = scaleBox(scale.positions);
  const label = `${scale.tonic} ${scale.name}, frets ${from} to ${to}: ` +
    notes.map(n => `${STRING_NAMES[n.string]} string fret ${n.fret} ${n.note} (${n.degree})`).join(', ');
  return (
    <section className="card" aria-label={`${scale.tonic} ${scale.name} scale`}>
      <div className="row"><b>{scale.tonic} {scale.name}</b><small className="muted">{scale.notes.join(' ')}</small></div>
      <FretGrid from={from} to={to} label={label}
        dots={notes.map(n => ({ string: n.string, fret: n.fret, label: String(n.degree), root: n.degree === 1, dim: !!highlight && !highlight.includes(n.degree) }))} />
      <p className="muted" style={{ fontSize: 13 }}>Numbers are scale degrees: 1 is {scale.tonic}, the home note (marigold).{from === 0 ? ' The first column is open strings.' : ''}{highlight ? ' Bright dots: the notes to sing.' : ''}</p>
    </section>
  );
}
