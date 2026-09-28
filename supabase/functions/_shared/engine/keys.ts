/** Circle-of-fifths key rotation shared by every track (flats on the flat side). */
export const KEY_CYCLE = ['G', 'D', 'A', 'E', 'C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'] as const;
/** Keys where open-position shapes work, for early fingerstyle and fills skills. */
export const OPEN_KEYS = ['C', 'G', 'D', 'A', 'E'];

/** Next allowed key after `last` in the cycle; restarts at G when `last` is empty or not in the cycle. */
export function nextKey(last: string | null, allowed: string[] | null): string {
  const start = last ? KEY_CYCLE.indexOf(last as (typeof KEY_CYCLE)[number]) : -1;
  for (let i = 1; i <= KEY_CYCLE.length; i++) {
    const key = KEY_CYCLE[(start + i) % KEY_CYCLE.length];
    if (!allowed || allowed.includes(key)) return key;
  }
  throw new Error(`No key in the cycle is allowed: ${allowed?.join(',')}`);
}
