import { describe, expect, it } from 'vitest';
import { readDroneOff, writeDroneOff } from '../../src/lib/dronePref.ts';
import { itemList, refLabel, stepElements, warmupShow } from '../../src/lib/lesson.ts';
import type { ScaleBlock } from '../../supabase/functions/_shared/engine/types.ts';

const block: ScaleBlock = { map: 'minor_pent:D', map_is_new: true, retrieve: ['minor_pent:E'], steps: [
  { kind: 'retrieve', ref: 'minor_pent:E', degree: 'b3' }, { kind: 'map', ref: 'minor_pent:D' },
  { kind: 'vary', ref: 'minor_pent:D', variation: 'descend' }, { kind: 'connect', ref: 'minor_pent:D', to: 'minor_pent:E' },
  { kind: 'use', ref: 'minor_pent:D' },
] };

describe('scale block in the player', () => {
  it('shows the board and metronome on every warm-up step, and the chords only on Use', () => {
    expect(warmupShow(block)).toEqual([
      ['scale', 'metronome'], ['scale', 'metronome'], ['scale', 'metronome'], ['scale', 'metronome'], ['scale', 'chords', 'metronome'],
    ]);
    expect(stepElements(undefined, 'warmup', 4, 5, null, block)).toEqual(['scale', 'chords', 'metronome']);
  });

  it('keeps the old warm-up elements for plans without a scale block', () => {
    expect(stepElements(undefined, 'warmup', 1, 3, null, null)).toEqual(['scale', 'metronome']);
  });

  it('lists warm-up retrieves as rows (so a verdict never skips the rest of the warm-up); other blocks keep the pair for one item', () => {
    expect(itemList('warmup', ['scale:minor_pent:E'], true)).toBe(true);
    expect(itemList('warmup', [null], true)).toBe(false);
    expect(itemList('review', ['skill:a', 'theory:b'], false)).toBe(true);
    expect(itemList('new_skill', ['skill:a'], false)).toBe(false);
  });

  it('labels scale review items for people', () => {
    expect(refLabel('scale:minor_pent:E')).toBe('Minor pentatonic, E shape');
    expect(refLabel('scale:major:A')).toBe('Major, A shape');
  });

  it('remembers the drone off switch, and survives storage that throws', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    expect(readDroneOff(store)).toBe(false);
    writeDroneOff(true, store);
    expect(readDroneOff(store)).toBe(true);
    writeDroneOff(false, store);
    expect(readDroneOff(store)).toBe(false);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(readDroneOff(broken)).toBe(false);
    expect(() => writeDroneOff(true, broken)).not.toThrow();
    expect(readDroneOff(undefined)).toBe(false);
  });
});
