import type { NeckMap as Map } from '../../supabase/functions/_shared/engine/neck.ts';
import { FretGrid } from './FretGrid.tsx';

const STRING_NUMBER = (s: number) => 6 - s;

/** A calculated neck map (engine/neck.ts): labelled dots, links between related spots, and a one-line caption. */
export function NeckMap({ map, title }: { map: Map; title: string }) {
  const label = `${title}: ` + map.dots.map(d => `string ${STRING_NUMBER(d.string)} fret ${d.fret} ${d.label}${d.note ? ` ${d.note}` : ''}`).join(', ');
  return (
    <section className="card" aria-label={title}>
      <div className="row"><b>{title}</b></div>
      <FretGrid from={map.from} to={map.to} dots={map.dots} links={map.links} label={label} />
      <p className="muted" style={{ fontSize: 13 }}>{map.caption}</p>
    </section>
  );
}
