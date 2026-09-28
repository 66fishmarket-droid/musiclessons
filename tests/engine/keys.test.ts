import { describe, expect, it } from 'vitest';
import { KEY_CYCLE, OPEN_KEYS, nextKey } from '../../supabase/functions/_shared/engine/keys.ts';

describe('nextKey', () => {
  it('starts at G with no history', () => expect(nextKey(null, null)).toBe('G'));
  it('steps round the circle of fifths and wraps', () => {
    expect(nextKey('G', null)).toBe('D');
    expect(nextKey('Gb', null)).toBe('G');
  });
  it('skips keys the skill does not allow', () => {
    expect(nextKey('E', OPEN_KEYS)).toBe('C');
    expect(nextKey('C', OPEN_KEYS)).toBe('G');
  });
  it('restarts at G for legacy keys outside the cycle', () => {
    expect(nextKey('F#', null)).toBe('G');
    expect(nextKey('', null)).toBe('G');
  });
  it('throws when no key is allowed', () => expect(() => nextKey('G', ['H'])).toThrow(/allowed/));
  it('has eleven flat-side keys', () => expect(KEY_CYCLE).toEqual(['G', 'D', 'A', 'E', 'C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb']));
});
