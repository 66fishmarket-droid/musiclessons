import type { BlockKind, SessionMinutes } from './types.ts';

type Block = { kind: BlockKind; minutes: number };
const b = (kind: BlockKind, minutes: number): Block => ({ kind, minutes });

/** Block order and minutes per session length (spec §4; order is data so it can change without schema work). */
export const TEMPLATES: Record<SessionMinutes, Block[]> = {
  25: [b('warmup', 2), b('retest', 2), b('new_skill', 7), b('reset', 0.5), b('review', 5), b('apply', 4), b('create', 2.5), b('record', 2)],
  30: [b('warmup', 3), b('retest', 2), b('new_skill', 8.5), b('reset', 0.5), b('review', 5), b('apply', 6), b('create', 3), b('record', 2)],
  40: [b('warmup', 3), b('retest', 3), b('new_skill', 11), b('reset', 1), b('review', 8), b('apply', 7), b('create', 4), b('record', 3)],
};

/** A session's blocks; a missing retest gives its time to new_skill, a missing review gives its time to apply. */
export function buildBlocks(minutes: SessionMinutes, { hasRetest, hasReview }: { hasRetest: boolean; hasReview: boolean }): Block[] {
  const blocks = TEMPLATES[minutes].map(x => ({ ...x }));
  const fold = (from: BlockKind, into: BlockKind) => {
    const i = blocks.findIndex(x => x.kind === from);
    blocks.find(x => x.kind === into)!.minutes += blocks[i].minutes;
    blocks.splice(i, 1);
  };
  if (!hasRetest) fold('retest', 'new_skill');
  if (!hasReview) fold('review', 'apply');
  return blocks;
}
