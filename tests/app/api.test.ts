import { describe, expect, it, vi } from 'vitest';
import { ApiError, GENERATE_TIMEOUT_MS, completeLesson, fetchToday } from '../../src/lib/api.ts';
import { memoryKV } from './fixtures.ts';

const ROW = { id: 'L1', lesson_date: '2026-09-29', status: 'planned', plan: {}, content: {} };
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const base = { url: 'http://api', anonKey: 'anon', token: 'tok', date: '2026-09-29' };

describe('fetchToday', () => {
  it('POSTs the local date with auth, waits up to 120 s, and caches the row', async () => {
    const kv = memoryKV();
    const fetchFn = vi.fn(async () => ok(ROW));
    expect(await fetchToday({ ...base, storage: kv, fetchFn })).toEqual(ROW);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api/functions/v1/generate-lesson');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ date: '2026-09-29' });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(GENERATE_TIMEOUT_MS).toBe(120_000);
    expect(JSON.parse(kv.getItem('gc.lesson')!)).toEqual({ date: '2026-09-29', lesson: ROW });
  });

  it('serves the cached copy for the same date when the network fails', async () => {
    const kv = memoryKV();
    kv.setItem('gc.lesson', JSON.stringify({ date: '2026-09-29', lesson: ROW }));
    const fetchFn = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect(await fetchToday({ ...base, storage: kv, fetchFn })).toEqual(ROW);
  });

  it("never serves yesterday's copy", async () => {
    const kv = memoryKV();
    kv.setItem('gc.lesson', JSON.stringify({ date: '2026-09-28', lesson: ROW }));
    await expect(fetchToday({ ...base, storage: kv, fetchFn: async () => { throw new TypeError('offline'); } }))
      .rejects.toThrow('offline');
  });

  it('throws ApiError with the server message, and a 401 ignores the cache', async () => {
    const kv = memoryKV();
    kv.setItem('gc.lesson', JSON.stringify({ date: '2026-09-29', lesson: ROW }));
    const err = await fetchToday({ ...base, storage: kv, fetchFn: async () => ok({ error: 'not signed in' }, 401) }).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, message: 'not signed in' });
    // a 500 falls back to today's cached copy
    expect(await fetchToday({ ...base, storage: kv, fetchFn: async () => ok({ error: 'boom' }, 500) })).toEqual(ROW);
  });
});

describe('completeLesson', () => {
  const c = { lessonId: 'L1', logs: [], confidence: 4, wantMoreTime: true, notes: 'thumb' };
  it('calls complete_lesson with the mapped params', async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    await completeLesson({ rpc } as never, c);
    expect(rpc).toHaveBeenCalledWith('complete_lesson', {
      p_lesson_id: 'L1', p_logs: [], p_confidence: 4, p_want_more_time: true, p_notes: 'thumb' });
  });
  it('throws on failure so the caller can queue it, but drops a lesson that no longer exists', async () => {
    await expect(completeLesson({ rpc: async () => ({ error: { code: '08006', message: 'offline' } }) } as never, c)).rejects.toBeTruthy();
    await expect(completeLesson({ rpc: async () => ({ error: { code: 'P0002', message: 'lesson not found' } }) } as never, c)).resolves.toBeUndefined();
  });
});
