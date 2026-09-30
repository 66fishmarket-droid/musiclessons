import { describe, expect, it } from 'vitest';
import { blockText } from '../../src/lib/lesson.ts';

const base = { title: 't', why_it_matters: 'w', theory_card: 'c', songs: [], create_prompt: 'p' };
describe('blockText', () => {
  it('reads new engine + colour content', () => {
    const c = { ...base, blocks: [{ kind: 'warmup' as const, instructions: ['a'], target_text: '', listen_for: 'l', more: 'm' }] };
    expect(blockText(c, 0)).toEqual({ instructions: ['a'], target_text: '', listen_for: 'l', more: ['m'] });
  });
  it('reads lessons stored before engine-written steps (tips/explanation, no listen_for) (Review Focus 3)', () => {
    const old = { ...base, blocks: [{ kind: 'warmup', instructions: ['a'], target_text: 'x', tips: 'tip', explanation: '' }] };
    expect(blockText(old as never, 0)).toEqual({ instructions: ['a'], target_text: 'x', listen_for: '', more: ['tip'] });
  });
  it('is safe on a missing block', () => {
    expect(blockText({ ...base, blocks: [] }, 3)).toEqual({ instructions: [''], target_text: '', listen_for: '', more: [] });
  });
});
