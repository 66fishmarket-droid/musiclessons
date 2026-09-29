/** Decorative powder burst (static SVG from scripts/gen-bursts.ts); hidden from screen readers. */
export function Burst({ name, variant }: { name: string; variant: 'hero' | 'corner' | 'done' }) {
  return <img className={`burst burst-${variant}`} src={`/bursts/${name}.svg`} alt="" />;
}
