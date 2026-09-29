import { describe, expect, it } from 'vitest';
import { flushPending, queueCompletion, type Completion } from '../../src/lib/pending.ts';
import {
  blockResult, clearSession, goTo, loadSession, logVerdict, newSession, saveSession, slotsFor, summary, type Log,
} from '../../src/lib/session.ts';
import { PLAN, memoryKV } from './fixtures.ts';

const log = (block_index: number, item_ref: string | null, passed: boolean | null, value_reached: number | null = null): Log =>
  ({ block_index, block_kind: PLAN.blocks[block_index].kind, item_ref, passed, value_reached, note: null });

describe('session', () => {
  it('has one slot per plan item, or a single null slot for itemless blocks', () => {
    expect(slotsFor(PLAN, 0)).toEqual([null]);
    expect(slotsFor(PLAN, 1)).toEqual(['skill:fingerstyle.l1.giuliani_arpeggios']);
    expect(slotsFor(PLAN, 2)).toEqual(['skill:rhythm.l1.down_up', 'theory:intervals_basic']);
  });

  it('replaces an earlier verdict for the same block and item only', () => {
    let s = newSession('L1', 0);
    s = logVerdict(s, log(2, 'skill:rhythm.l1.down_up', false));
    s = logVerdict(s, log(2, 'theory:intervals_basic', true));
    s = logVerdict(s, log(2, 'skill:rhythm.l1.down_up', true));
    expect(s.logs).toHaveLength(2);
    expect(s.logs.every(l => l.passed)).toBe(true);
  });

  it('moves between blocks, clamps, and restarts the block clock only on a real move', () => {
    const s = newSession('L1', 0);
    const a = goTo(s, 1, 4, 500);
    expect(a).toMatchObject({ index: 1, blockStartedAt: 500 });
    expect(goTo(a, 1, 4, 900)).toBe(a);
    expect(goTo(a, -3, 4, 900).index).toBe(0);
    expect(goTo(a, 9, 4, 900).index).toBe(4); // count = finished
  });

  it('survives a reload: save then load resumes the same block with its verdicts', () => {
    const kv = memoryKV();
    let s = goTo(newSession('L1', 1000), 2, 4, 2000);
    s = logVerdict(s, log(1, 'skill:fingerstyle.l1.giuliani_arpeggios', true, 52));
    saveSession(kv, s);
    expect(loadSession(kv, 'L1', 99_999)).toEqual(s);
  });

  it('starts fresh for another lesson, corrupt storage, or after clearing', () => {
    const kv = memoryKV();
    saveSession(kv, goTo(newSession('L1', 0), 2, 4, 0));
    expect(loadSession(kv, 'L2', 5)).toEqual(newSession('L2', 5));
    kv.setItem('gc.session.L3', '{not json');
    expect(loadSession(kv, 'L3', 5)).toEqual(newSession('L3', 5));
    clearSession(kv, 'L1');
    expect(loadSession(kv, 'L1', 5).index).toBe(0);
  });

  it('summarises best clean bpm, clean count and minutes', () => {
    let s = newSession('L1', 0);
    s = logVerdict(s, log(0, null, true));
    s = logVerdict(s, log(1, 'skill:fingerstyle.l1.giuliani_arpeggios', true, 52));
    s = logVerdict(s, log(3, null, false, 60));
    s = logVerdict(s, log(2, 'skill:rhythm.l1.down_up', null));
    expect(summary(s, 31 * 60_000)).toEqual({ bestBpm: 52, clean: 2, rated: 3, minutes: 31 });
    expect(summary(newSession('L1', 0), 10_000)).toEqual({ bestBpm: null, clean: 0, rated: 0, minutes: 1 });
  });

  it('describes each block result for the Done list', () => {
    let s = newSession('L1', 0);
    s = logVerdict(s, log(0, null, true));
    s = logVerdict(s, log(1, 'skill:fingerstyle.l1.giuliani_arpeggios', true, 52));
    s = logVerdict(s, log(2, 'skill:rhythm.l1.down_up', true));
    s = logVerdict(s, log(2, 'theory:intervals_basic', false));
    expect(blockResult(s, 0)).toBe('clean');
    expect(blockResult(s, 1)).toBe('clean at 52');
    expect(blockResult(s, 2)).toBe('1 of 2 clean');
    expect(blockResult(s, 3)).toBe('skipped');
    expect(blockResult(logVerdict(s, log(3, null, false)), 3)).toBe('not yet');
  });
});

describe('pending completions', () => {
  const c = (lessonId: string, notes: string | null = null): Completion =>
    ({ lessonId, logs: [], confidence: 3, wantMoreTime: false, notes });

  it('keeps one completion per lesson, the newest', () => {
    const kv = memoryKV();
    queueCompletion(kv, c('L1', 'old'));
    queueCompletion(kv, c('L2'));
    queueCompletion(kv, c('L1', 'new'));
    const q = JSON.parse(kv.getItem('gc.pending')!) as Completion[];
    expect(q.map(x => [x.lessonId, x.notes])).toEqual([['L2', null], ['L1', 'new']]);
  });

  it('sends everything, keeps failures, and clears the key when all succeed', async () => {
    const kv = memoryKV();
    queueCompletion(kv, c('L1'));
    queueCompletion(kv, c('L2'));
    const sent: string[] = [];
    expect(await flushPending(kv, async x => { sent.push(x.lessonId); if (x.lessonId === 'L2') throw new Error('offline'); })).toBe(1);
    expect(sent).toEqual(['L1', 'L2']);
    expect((JSON.parse(kv.getItem('gc.pending')!) as Completion[]).map(x => x.lessonId)).toEqual(['L2']);
    expect(await flushPending(kv, async () => {})).toBe(0);
    expect(kv.getItem('gc.pending')).toBeNull();
  });

  it('treats a corrupt queue as empty', async () => {
    const kv = memoryKV();
    kv.setItem('gc.pending', 'garbage');
    expect(await flushPending(kv, async () => { throw new Error('should not be called'); })).toBe(0);
  });
});
