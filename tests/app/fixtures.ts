import type { LessonPlan } from '../../supabase/functions/_shared/engine/types.ts';

/** Four blocks: itemless warm-up, bpm new skill, two-item review, itemless apply. */
export const PLAN = {
  key: 'G',
  blocks: [
    { kind: 'warmup', minutes: 3, items: [] },
    { kind: 'new_skill', minutes: 10.5, items: [{ ref: 'skill:fingerstyle.l1.giuliani_arpeggios', target: { metric: 'bpm', start: 39, target: 60 } }] },
    { kind: 'review', minutes: 5, items: [{ ref: 'skill:rhythm.l1.down_up', target: null }, { ref: 'theory:intervals_basic', target: null }] },
    { kind: 'apply', minutes: 11, items: [] },
  ],
  music: { progression: { roman: ['I', 'IV', 'I', 'V'], chords: ['G', 'C', 'G', 'D'] }, voicings: {} },
} as unknown as LessonPlan;

/** In-memory stand-in for localStorage. */
export function memoryKV() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    map: m,
  };
}
