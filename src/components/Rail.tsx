import type { BlockKind } from '../../supabase/functions/_shared/engine/types.ts';
import { BLOCK_META } from '../lib/lesson.ts';

/** Session progress: one segment per block, sized by minutes, in the block's colour; the current one fills with time. */
export function Rail({ blocks, index, progress }: { blocks: { kind: BlockKind; minutes: number }[]; index: number; progress: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className="rail" role="progressbar" aria-label="Session progress" aria-valuemin={1} aria-valuemax={blocks.length} aria-valuenow={index + 1}>
      {blocks.map((b, k) => {
        const c = BLOCK_META[b.kind].colour;
        const full = `var(--${c})`;
        const dim = `var(--${c}-dim)`;
        const background = k < index ? full : k > index ? dim : `linear-gradient(90deg, ${full} 0 ${pct}%, ${dim} ${pct}% 100%)`;
        return <span key={k} style={{ flexGrow: b.minutes, background }} />;
      })}
    </div>
  );
}
