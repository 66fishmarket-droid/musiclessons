import type { KV, Log } from './session.ts';

export interface Completion { lessonId: string; logs: Log[]; confidence: number | null; wantMoreTime: boolean; notes: string | null }
const KEY = 'gc.pending';

function read(kv: KV): Completion[] {
  try {
    const q = JSON.parse(kv.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(q) ? (q as Completion[]) : [];
  } catch {
    return [];
  }
}

/** Keeps a completion on this device until the server accepts it (spec §11); a newer one for the same lesson replaces it. */
export function queueCompletion(kv: KV, c: Completion): void {
  kv.setItem(KEY, JSON.stringify([...read(kv).filter(x => x.lessonId !== c.lessonId), c]));
}

/** Sends every queued completion in order, keeps the ones that fail, and returns how many are still waiting. */
export async function flushPending(kv: KV, send: (c: Completion) => Promise<void>): Promise<number> {
  const left: Completion[] = [];
  for (const c of read(kv)) {
    try { await send(c); } catch { left.push(c); }
  }
  if (left.length) kv.setItem(KEY, JSON.stringify(left));
  else kv.removeItem(KEY);
  return left.length;
}
