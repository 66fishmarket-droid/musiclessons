import { describe, expect, it } from 'vitest';
import { blockCard, blockTerms, blockText, elementVisible, isMinorScale, stepElements } from '../../src/lib/lesson.ts';
import { RECIPES } from '../../supabase/functions/_shared/engine/recipes.ts';
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

describe('blockTerms', () => {
  const block = (over: object) => ({ kind: 'warmup' as const, instructions: ['a'], target_text: '', listen_for: '', more: '', ...over });
  it('finds terms in steps even when there is no LLM more text (Review Focus 5)', () => {
    const c = { ...base, blocks: [block({ instructions: ['Move up one half step'] })] };
    expect(blockTerms(c, 0).map(t => t.id)).toEqual(['half_step']);
  });
  it('reads create_prompt only on the create block', () => {
    const c = { ...base, create_prompt: 'Climb by whole steps', blocks: [block({}), block({ kind: 'create' })] };
    expect(blockTerms(c as never, 0)).toEqual([]);
    expect(blockTerms(c as never, 1).map(t => t.id)).toEqual(['whole_step']);
  });
  it('works on lessons stored before engine-written steps (Review Focus 4)', () => {
    const old = { ...base, blocks: [{ kind: 'warmup', instructions: ['a'], target_text: '', tips: 'slide a half step' }] };
    expect(blockTerms(old as never, 0).map(t => t.id)).toEqual(['slide', 'half_step']);
    expect(blockTerms(old as never, 5)).toEqual([]);
  });
});

describe('isMinorScale and elementVisible (final review I1, I4)', () => {
  it('treats every minor-family style scale as minor', () => {
    for (const s of ['minor', 'aeolian', 'minor pentatonic', 'dorian', 'harmonic minor', 'phrygian']) expect(isMinorScale(s), s).toBe(true);
    for (const s of ['major', 'mixolydian', 'major pentatonic', 'lydian']) expect(isMinorScale(s), s).toBe(false);
  });
  it('keeps an element visible while it is active, even on a step that does not list it', () => {
    expect(elementVisible(['card'], 'metronome', true)).toBe(true);
    expect(elementVisible(['card'], 'metronome', false)).toBe(false);
    expect(elementVisible(null, 'metronome')).toBe(true);
    expect(elementVisible(['metronome'], 'metronome')).toBe(true);
  });
});

describe('stepElements', () => {
  const r = RECIPES['fretboard.l1.octave_shapes'];
  it('returns the current step\'s elements on a new_skill block', () => {
    expect(stepElements(r, 'new_skill', 0, r.steps.length)).toEqual(['card']);
    expect(stepElements(r, 'new_skill', 3, r.steps.length)).toEqual(['note_caller', 'metronome']);
  });
  it('falls back to per-block (null) for retest blocks, whose steps shift (Review Focus 5)', () => {
    expect(stepElements(r, 'retest', 0, 3)).toBeNull();
  });
  it('falls back when the stored lesson has a different number of steps (Review Focus 4)', () => {
    expect(stepElements(r, 'new_skill', 0, r.steps.length - 1)).toBeNull();
  });
  it('falls back for recipes without show, and with no recipe', () => {
    expect(stepElements(RECIPES['fretboard.l3.triads_321'], 'new_skill', 0, 4)).toBeNull();
    expect(stepElements(undefined, 'warmup', 0, 3)).toBeNull();
  });
});
