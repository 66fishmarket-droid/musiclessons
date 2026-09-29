import type { SupabaseClient } from '@supabase/supabase-js';
import type { TodayLesson } from './lesson.ts';
import type { Completion } from './pending.ts';
import type { KV } from './session.ts';

/** An HTTP error from an edge function, carrying its status. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

/** generate-lesson can take 22–100 s on first open; allow a little more (Phase 2 handoff). */
export const GENERATE_TIMEOUT_MS = 120_000;
const CACHE = 'gc.lesson';

/** Today's lesson from generate-lesson (created on first open), kept as the offline copy; falls back to today's copy on failure. */
export async function fetchToday(o: {
  url: string; anonKey: string; token: string; date: string; storage: KV; fetchFn?: typeof fetch;
}): Promise<TodayLesson> {
  const f = o.fetchFn ?? fetch;
  try {
    const res = await f(`${o.url}/functions/v1/generate-lesson`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${o.token}`, apikey: o.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: o.date }),
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    });
    const body = await res.json().catch(() => ({})) as TodayLesson & { error?: string };
    if (!res.ok) throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status);
    o.storage.setItem(CACHE, JSON.stringify({ date: o.date, lesson: body }));
    return body;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw e;
    try {
      const cached = JSON.parse(o.storage.getItem(CACHE) ?? 'null') as { date: string; lesson: TodayLesson } | null;
      if (cached?.date === o.date) return cached.lesson;
    } catch { /* corrupt cache: report the original error */ }
    throw e;
  }
}

/** Calls complete_lesson(); throws so the caller can queue it, except for a lesson that no longer exists (dropped). */
export async function completeLesson(db: Pick<SupabaseClient, 'rpc'>, c: Completion): Promise<void> {
  const { error } = await db.rpc('complete_lesson', {
    p_lesson_id: c.lessonId, p_logs: c.logs, p_confidence: c.confidence, p_want_more_time: c.wantMoreTime, p_notes: c.notes,
  });
  if (error && error.code !== 'P0002') throw error;
}

/** Which of `days` (YYYY-MM-DD, ascending) have a completed lesson. */
export async function completedDays(db: SupabaseClient, days: string[]): Promise<string[]> {
  const { data, error } = await db.from('lessons').select('lesson_date')
    .eq('status', 'completed').gte('lesson_date', days[0]).lte('lesson_date', days[days.length - 1]);
  if (error) throw error;
  return (data ?? []).map(r => r.lesson_date as string);
}
