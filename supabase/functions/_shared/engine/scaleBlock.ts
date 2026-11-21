import { LADDER, neighbours, parseRef } from './scaleShapes.ts';
import type { PlannerState, ReviewItem, ScaleBlock, ScaleStep, SessionMinutes, VariationId } from './types.ts';

const DAY = 86_400_000;
const VARIATIONS: VariationId[] = ['from_3', 'descend', 'threes', 'triplets'];

/** Deterministic 32-bit hash (FNV-1a), so "random" picks stay the same for the same day and the planner stays pure. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const lastSeen = (r: ReviewItem) => new Date(Date.parse(r.next_due) - r.interval_days * DAY).toISOString().slice(0, 10);

/** Retrieve target as the learner reads it on this position: minor types flatten the 3rd, 6th and 7th. */
function retrieveDegree(id: string, seed: string): string {
  const { type } = parseRef(id);
  const pool = type.endsWith('pent') ? ['3', '5', '1'] : ['3', '5', '1', '2', '6', '4', '7'];
  const n = pool[hash(seed) % pool.length];
  return type.startsWith('minor') && ['3', '6', '7'].includes(n) ? `b${n}` : n;
}

/** Today's warm-up scale block: which positions to retrieve cold, which to map (new or weakest), and the step list. */
export function planScaleBlock(state: PlannerState, minutes: SessionMinutes, canConnect: (map: string, to: string) => boolean = () => true): ScaleBlock {
  const { today } = state;
  const known = state.reviewItems.filter(r => r.item_type === 'scale' && LADDER.includes(r.ref));
  const rank = (id: string) => LADDER.indexOf(id);
  const newest = [...known].sort((a, b) => rank(b.ref) - rank(a.ref))[0];
  const next = newest ? LADDER[rank(newest.ref) + 1] : LADDER[0];

  let map: string;
  let map_is_new = false;
  if (!newest || (newest.interval_days >= 7 && next)) { map = next; map_is_new = true; }
  else {
    map = [...known].sort((a, b) => Number(a.last_result !== false) - Number(b.last_result !== false)
      || a.next_due.localeCompare(b.next_due) || rank(a.ref) - rank(b.ref))[0].ref;
  }

  const last = state.recentLessons[0]?.date;
  const gap = known.length > 0 && (!last || (Date.parse(today) - Date.parse(last)) / DAY >= 7);
  const others = known.filter(r => r.ref !== map);
  const ordered = gap
    ? others.sort((a, b) => lastSeen(a).localeCompare(lastSeen(b)) || rank(a.ref) - rank(b.ref))
    : [
      ...others.filter(r => r.next_due <= today).sort((a, b) => a.next_due.localeCompare(b.next_due) || rank(a.ref) - rank(b.ref)),
      ...others.filter(r => r.next_due > today).sort((a, b) => hash(today + a.ref) - hash(today + b.ref)),
    ];
  let retrieve = ordered.slice(0, 2).map(r => r.ref);
  if (retrieve.length === 0 && !map_is_new) retrieve = [map];

  const full = minutes !== 25;
  const connectTo = neighbours(map).find(n => known.some(r => r.ref === n) && canConnect(map, n));
  const dayIndex = Math.floor(Date.parse(today) / DAY);
  const steps: ScaleStep[] = [
    ...retrieve.map(ref => ({ kind: 'retrieve' as const, ref, degree: retrieveDegree(ref, today + ref) })),
    { kind: 'map', ref: map },
    ...(full ? [{ kind: 'vary' as const, ref: map, variation: VARIATIONS[dayIndex % VARIATIONS.length] }] : []),
    ...(full && connectTo ? [{ kind: 'connect' as const, ref: map, to: connectTo }] : []),
    { kind: 'use', ref: map },
  ];
  return { map, map_is_new, retrieve, steps };
}
