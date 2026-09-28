import { describe, expect, it } from 'vitest';
import { TEMPLATES, buildBlocks } from '../../supabase/functions/_shared/engine/templates.ts';

const total = (bs: { minutes: number }[]) => bs.reduce((t, b) => t + b.minutes, 0);

describe('templates', () => {
  it.each([25, 30, 40] as const)('%i-minute template sums exactly and keeps warm-up ≤ 15%%', m => {
    expect(total(TEMPLATES[m])).toBe(m);
    expect(TEMPLATES[m][0]).toMatchObject({ kind: 'warmup' });
    expect(TEMPLATES[m][0].minutes / m).toBeLessThanOrEqual(0.15);
    expect(TEMPLATES[m].map(b => b.kind)).toEqual(['warmup', 'retest', 'new_skill', 'reset', 'review', 'apply', 'create', 'record']);
  });
  it('gives a missing retest to new_skill and a missing review to apply', () => {
    const blocks = buildBlocks(30, { hasRetest: false, hasReview: false });
    expect(blocks.map(b => b.kind)).toEqual(['warmup', 'new_skill', 'reset', 'apply', 'create', 'record']);
    expect(blocks.find(b => b.kind === 'new_skill')!.minutes).toBe(10.5);
    expect(blocks.find(b => b.kind === 'apply')!.minutes).toBe(11);
    expect(total(blocks)).toBe(30);
  });
  it('does not mutate the template', () => {
    buildBlocks(25, { hasRetest: false, hasReview: false });
    expect(total(TEMPLATES[25])).toBe(25);
    expect(TEMPLATES[25]).toHaveLength(8);
  });
});
