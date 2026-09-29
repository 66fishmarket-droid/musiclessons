import type { BlockKind, LessonPlan } from '../../supabase/functions/_shared/engine/types.ts';

export type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
/** One verdict; exactly the element shape complete_lesson(p_logs) reads. */
export interface Log {
  block_index: number; block_kind: BlockKind; item_ref: string | null;
  passed: boolean | null; value_reached: number | null; note: string | null;
}
export interface Session { lessonId: string; index: number; logs: Log[]; startedAt: number; blockStartedAt: number }

const key = (lessonId: string) => `gc.session.${lessonId}`;

/** A fresh session at block 0. */
export function newSession(lessonId: string, now: number): Session {
  return { lessonId, index: 0, logs: [], startedAt: now, blockStartedAt: now };
}

/** The saved session for this lesson, so a reload resumes the same block; a fresh one if none or corrupt. */
export function loadSession(kv: KV, lessonId: string, now: number): Session {
  try {
    const s = JSON.parse(kv.getItem(key(lessonId)) ?? 'null') as Session | null;
    if (s && s.lessonId === lessonId && Array.isArray(s.logs) && Number.isInteger(s.index)) return s;
  } catch { /* corrupt: start fresh */ }
  return newSession(lessonId, now);
}

/** Persists the session. */
export function saveSession(kv: KV, s: Session): void {
  kv.setItem(key(s.lessonId), JSON.stringify(s));
}

/** Forgets the session once the lesson is finished. */
export function clearSession(kv: KV, lessonId: string): void {
  kv.removeItem(key(lessonId));
}

/** Refs to rate in a block: one per plan item, or a single null slot for blocks without items. */
export function slotsFor(plan: LessonPlan, i: number): (string | null)[] {
  const items = plan.blocks[i]?.items ?? [];
  return items.length ? items.map(it => it.ref) : [null];
}

/** Records a verdict, replacing an earlier one for the same block and item. */
export function logVerdict(s: Session, log: Log): Session {
  const others = s.logs.filter(l => !(l.block_index === log.block_index && l.item_ref === log.item_ref));
  return { ...s, logs: [...others, log] };
}

/** Moves to block `to`, clamped to 0..count (count = finished), restarting the block clock on a real move. */
export function goTo(s: Session, to: number, count: number, now: number): Session {
  const index = Math.max(0, Math.min(count, to));
  return index === s.index ? s : { ...s, index, blockStartedAt: now };
}

/**
 * A verdict against the block's target: true = clean at or above a bpm target (scored as a pass), false = not yet,
 * null = clean but below target (kept with its tempo as progress; complete_lesson leaves it unscored).
 */
export function verdictFor(clean: boolean, bpm: number, target: number | null): boolean | null {
  if (!clean) return false;
  return target === null || bpm >= target ? true : null;
}

/** A log that records a result: a verdict, or a clean tempo below target. */
const rated = (l: Log) => l.passed !== null || l.value_reached !== null;

/** Headline numbers for the Done screen: best clean bpm, clean vs rated verdicts, minutes practised. */
export function summary(s: Session, now: number): { bestBpm: number | null; clean: number; rated: number; minutes: number } {
  const done = s.logs.filter(rated);
  const clean = done.filter(l => l.passed !== false);
  const bpms = clean.flatMap(l => (l.value_reached !== null ? [l.value_reached] : []));
  return {
    bestBpm: bpms.length ? Math.max(...bpms) : null,
    clean: clean.length,
    rated: done.length,
    minutes: Math.max(1, Math.round((now - s.startedAt) / 60_000)),
  };
}

/** One line per block for the Done list: "clean at 52", "clean", "1 of 2 clean", "not yet" or "skipped". */
export function blockResult(s: Session, i: number): string {
  const logs = s.logs.filter(l => l.block_index === i && rated(l));
  if (!logs.length) return 'skipped';
  const clean = logs.filter(l => l.passed !== false).length;
  if (clean === logs.length) {
    const bpm = Math.max(0, ...logs.map(l => l.value_reached ?? 0));
    return bpm > 0 ? `clean at ${bpm}` : 'clean';
  }
  return clean ? `${clean} of ${logs.length} clean` : 'not yet';
}
