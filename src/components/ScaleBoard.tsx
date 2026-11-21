import type { MusicContent } from '../../supabase/functions/_shared/engine/music.ts';
import { degreeLabel, scaleBox } from '../../supabase/functions/_shared/engine/music.ts';
import type { PlacedShape } from '../../supabase/functions/_shared/engine/scaleShapes.ts';
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
        dots={notes.map(n => ({ string: n.string, fret: n.fret, label: degreeLabel(scale.tonic, n.note), root: n.degree === 1, dim: !!highlight && !highlight.includes(n.degree) }))} />
      <p className="muted" style={{ fontSize: 13 }}>Labels count up from the home note: 1 is {scale.tonic} (marigold); b3 or b7 means one fret lower than in the major scale.{from === 0 ? ' The first column is open strings.' : ''}{highlight ? ' Bright dots: the notes to sing.' : ''}</p>
    </section>
  );
}

/** One warm-up position (and Connect's neighbour, faded) labelled from today's home note; shared notes ringed. */
export function PositionBoard({ placed, labelTonic, second }: { placed: PlacedShape; labelTonic: string; second?: PlacedShape }) {
  const from = Math.min(placed.from, second?.from ?? placed.from);
  const to = Math.max(placed.to, second?.to ?? placed.to);
  const at = (n: { string: number; fret: number }) => `${n.string}/${n.fret}`;
  const mine = new Set(placed.notes.map(at));
  const theirs = new Set(second?.notes.map(at) ?? []);
  const dot = (n: PlacedShape['notes'][number], dim: boolean) => {
    const label = degreeLabel(labelTonic, n.note);
    return { string: n.string, fret: n.fret, label, root: label === '1', dim, flag: mine.has(at(n)) && theirs.has(at(n)) };
  };
  const dots = [...placed.notes.map(n => dot(n, false)), ...(second?.notes.filter(n => !mine.has(at(n))).map(n => dot(n, true)) ?? [])];
  const name = `${placed.tonic} ${placed.scaleName} around the ${placed.chord} chord ${placed.rootFret === 0 ? 'in open position' : `at fret ${placed.rootFret}`}`;
  const label = `${name}, frets ${from} to ${to}: ` + dots.map(d => `${STRING_NAMES[d.string]} string fret ${d.fret} (${d.label})${d.dim ? ' faded' : ''}`).join(', ');
  return (
    <section className="card" aria-label={name}>
      <div className="row"><b>{name}</b></div>
      <FretGrid from={from} to={to} label={label} dots={dots} />
      <p className="muted" style={{ fontSize: 13 }}>Labels count up from the home note: 1 is {labelTonic} (marigold).{second ? ' Faded dots: the next position; ringed dots: notes both share.' : ''}{from === 0 ? ' The first column is open strings.' : ''}</p>
    </section>
  );
}
