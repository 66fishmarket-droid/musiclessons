import { describe, expect, it } from 'vitest';
import { blockCard, blockText } from '../../src/lib/lesson.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';

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

describe('blockCard', () => {
  const fingerstyle = SKILLS.find(s => s.id === 'fingerstyle.l1.giuliani_arpeggios')!;
  it('apply always plays the rhythm card, whatever the skill', () => {
    expect(blockCard('apply', fingerstyle).card).toBe('rhythm');
    expect(blockCard('apply', undefined).card).toBe('rhythm');
  });
  it('a skill with a written recipe gives its card', () => {
    expect(blockCard('new_skill', fingerstyle).card).toBe('pattern');
  });
  it('falls back to none, and never throws, for an unknown or missing skill (old stored lessons)', () => {
    expect(() => blockCard('retest', undefined)).not.toThrow();
    expect(blockCard('retest', undefined).card).toBe('none');
    expect(blockCard('new_skill', undefined).card).toBe('none');
  });
  it('blocks with no skill (warmup etc.) get none', () => {
    expect(blockCard('warmup', undefined).card).toBe('none');
  });
});
