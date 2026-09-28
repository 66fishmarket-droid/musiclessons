import { describe, expect, it } from 'vitest';
import { InputError, checkDate } from '../../supabase/functions/_shared/lesson/service.ts';

const now = new Date('2026-10-10T23:30:00Z');

describe('checkDate', () => {
  it.each(['2026-10-09', '2026-10-10', '2026-10-11'])('accepts %s (a local date within a day of UTC)', d => expect(checkDate(d, now)).toBe(d));
  it.each([['2026-10-12'], ['2026-10-08'], ['2026-02-30'], ['10/10/2026'], [undefined], [20261010]])('rejects %j', d => {
    expect(() => checkDate(d, now)).toThrow(InputError);
  });
});
