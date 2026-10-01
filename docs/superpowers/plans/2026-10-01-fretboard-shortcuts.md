# Fretboard Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach the top fretboard shortcuts inside the fretboard track: 4 new skills and 4 upgraded ones. Each comes with a calculated, degree-labelled neck map, and each step shows only the elements it needs.

**Architecture:**
- A pure engine module `neck.ts` calculates neck maps from semitone arithmetic over the standard tuning.
- Recipes gain a `neck_map` card, a `map` kind and a per-step `show` list.
- Player draws the maps through a `FretGrid` component, which is pulled out of `ScaleBoard`, and gates the card, chords, metronome and note caller by step.
- A migration upserts the skills.

**Tech Stack:** TypeScript, React (Vite PWA), `tonal`, Vitest, Supabase Postgres, Node 22+ (`node file.ts`).

**Spec:** `docs/superpowers/specs/2026-10-01-fretboard-shortcuts-design.md`

## Global Constraints
- Positions come only from semitone arithmetic over the tuning E A D G B E (MIDI 40 45 50 55 59 64). Never hand-enter fret positions in map code.
- String index 0 = low E (string 6) … 5 = high E (string 1), matching `FretNote` in `music.ts`. Human-facing text uses string numbers 1–6.
- Per-step gating applies only to **new_skill** blocks whose recipe has `show` with the same length as the rendered steps. Every other case keeps today's per-block behaviour.
- No change to the lesson content contract (`lesson/contract.ts`).
- UK spelling. Step text should use glossary terms; run `node scripts/render-glossary.ts` after changing recipe text.
- Work on `dev`. Commit after each task. Never push to `main` or deploy without the owner's go-ahead.

## Review Focus
1. **Keys whose root sits at fret 0 or high up the neck** (E, Eb, D, F#): maps must not use negative frets and must stay within frets 0–16. Test in Task 1.
2. **Flat keys** (Bb, Eb, F): note names should use flats (Bb, not A#). Test in Task 1.
3. **Minor-key lessons** reaching `one_string` (e.g. a G minor style day): the map should show natural minor (W-H-W-W-H-W-W), not major. Test in Task 1. The Player wiring is checked in Task 3.
4. **Lessons stored before this change**, where the steps count differs from `show.length`: they must fall back to per-block behaviour and never hide everything. Test in Task 3.
5. **Retest blocks for the new skills** (a "Cold retest" line is prepended, so indexes shift): no per-step gating, and the old behaviour shows the card. Test in Task 3.

---

## File Structure
- Create `supabase/functions/_shared/engine/neck.ts`: map kinds, the `neckMap` calculator, and `OPEN` tuning. Pure functions.
- Modify `supabase/functions/_shared/engine/recipes.ts`: types (`Card`, `StepElement`, `SkillRecipe.map/show`), 4 new and 4 updated recipes.
- Modify `supabase/seed/curriculum.ts`: 4 new skills and updated wording. Regenerate `supabase/seed.sql`.
- Create `supabase/migrations/20261001000001_fretboard_shortcuts.sql`.
- Create `src/components/FretGrid.tsx` (shared SVG fretboard) and `src/components/NeckMap.tsx`. Modify `src/components/ScaleBoard.tsx` and `src/theme.css`.
- Modify `src/lib/lesson.ts` (`stepElements`) and `src/screens/Player.tsx` (gating plus NeckMap).
- Tests: `tests/engine/neck.test.ts` (new), `tests/engine/recipes.test.ts`, `tests/seed/curriculum.test.ts`, `tests/app/blockText.test.ts`, `tests/db/fretboard_shortcuts.test.ts` (new).

---

### Task 1: `neck.ts`, the calculated neck maps

**Files:**
- Create: `supabase/functions/_shared/engine/neck.ts`
- Test: `tests/engine/neck.test.ts`

**Interfaces:**
- Produces:
  - `type MapKind = 'unisons' | 'octaves' | 'intervals' | 'grid' | 'one_string'`
  - `const MAP_KINDS: MapKind[]`
  - `const OPEN: number[]` (MIDI of the open strings, index 0 = low E)
  - `interface NeckDot { string: number; fret: number; label: string; note?: string; root?: boolean; flag?: boolean }`
  - `interface NeckMap { from: number; to: number; dots: NeckDot[]; links: [NeckDot, NeckDot][]; caption: string }`
  - `function neckMap(kind: MapKind, key: string, minor?: boolean): NeckMap`. `key` is a tonic such as `'G'` or `'Bb'`.

- [ ] **Step 1: Write the failing tests**

`tests/engine/neck.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { Note } from 'tonal';
import { MAP_KINDS, OPEN, neckMap, type NeckDot } from '../../supabase/functions/_shared/engine/neck.ts';

const KEYS = ['G', 'C', 'E', 'Eb', 'D', 'F#', 'Bb', 'F', 'A'];
const midi = (d: NeckDot) => OPEN[d.string] + d.fret;

describe('neckMap', () => {
  it('keeps every dot on the neck, frets 0–16, for every kind and key (Review Focus 1)', () => {
    for (const kind of MAP_KINDS) for (const key of KEYS) {
      const m = neckMap(kind, key);
      for (const d of m.dots) {
        expect(d.fret, `${kind} ${key}`).toBeGreaterThanOrEqual(0);
        expect(d.fret, `${kind} ${key}`).toBeLessThanOrEqual(16);
        expect(d.fret).toBeGreaterThanOrEqual(m.from);
        expect(d.fret).toBeLessThanOrEqual(m.to);
      }
      expect(m.caption.length).toBeGreaterThan(0);
    }
  });
  it('unisons: each pair is the same pitch, 5 frets apart except G→B (4), and only that pair is flagged', () => {
    const m = neckMap('unisons', 'G');
    expect(m.links).toHaveLength(5);
    for (const [a, b] of m.links) {
      expect(midi(a)).toBe(midi(b));
      expect(a.fret).toBe(a.string === 3 ? 4 : 5);
      expect(!!a.flag).toBe(a.string === 3);
    }
  });
  it('octaves: every link is 12 half steps, with the +1 shift only when crossing G→B', () => {
    for (const key of KEYS) {
      const m = neckMap('octaves', key);
      expect(m.dots.every(d => Note.chroma(d.label) === Note.chroma(key)), key).toBe(true);
      expect(m.links.length, key).toBeGreaterThan(0);
      for (const [a, b] of m.links) {
        expect(midi(b) - midi(a)).toBe(12);
        const skip = b.string - a.string;
        const crosses = a.string <= 3 && b.string >= 4;
        expect(b.fret - a.fret, `${key} ${a.string}→${b.string}`).toBe((skip === 2 ? 2 : -3) + (crosses ? 1 : 0));
        expect(!!b.flag).toBe(crosses);
      }
    }
  });
  it('intervals: 3, 5, b7 and 8 sit 4, 7, 10 and 12 half steps above their root, from roots on strings 6 and 5', () => {
    const SEMI: Record<string, number> = { 3: 4, 5: 7, b7: 10, 8: 12 };
    for (const key of KEYS) {
      const m = neckMap('intervals', key);
      const roots = m.dots.filter(d => d.root);
      expect(roots.map(r => r.string).sort(), key).toEqual([0, 1]);
      expect(m.links).toHaveLength(8);
      for (const [r, d] of m.links) expect(midi(d) - midi(r), `${key} ${d.label}`).toBe(SEMI[d.label]);
    }
  });
  it('grid: roots spell I, IV, V and vi of the key, labelled 1/4/5/6 with chord names', () => {
    const m = neckMap('grid', 'G');
    expect(m.dots.map(d => `${d.label} ${d.note}`)).toEqual(['1 G', '4 C', '5 D', '6 Em']);
    for (const key of KEYS) {
      const semis = neckMap('grid', key).dots.map(d => ((midi(d) - Note.chroma(key)!) % 12 + 12) % 12);
      expect(semis, key).toEqual([0, 5, 7, 9]);
    }
  });
  it('one_string: gaps follow the major formula, or natural minor when minor (Review Focus 3)', () => {
    const gaps = (minor: boolean, key: string) => {
      const ds = neckMap('one_string', key, minor).dots;
      expect(new Set(ds.map(d => d.string)).size).toBe(1);
      return ds.slice(1).map((d, k) => (d.fret - ds[k].fret === 1 ? 'H' : 'W')).join('');
    };
    for (const key of KEYS) {
      expect(gaps(false, key), key).toBe('WWHWWWH');
      expect(gaps(true, key), key).toBe('WHWWHWW');
    }
  });
  it('names notes with flats in flat keys (Review Focus 2)', () => {
    expect(neckMap('grid', 'Bb').dots.map(d => d.note)).toEqual(['Bb', 'Eb', 'F', 'Gm']);
    expect(neckMap('octaves', 'Eb').dots[0].label).toBe('Eb');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/engine/neck.test.ts`
Expected: FAIL, because `neck.ts` doesn't exist.

- [ ] **Step 3: Implement**

`supabase/functions/_shared/engine/neck.ts`:
```ts
import { Interval, Note, Scale } from 'tonal';

export type MapKind = 'unisons' | 'octaves' | 'intervals' | 'grid' | 'one_string';
export const MAP_KINDS: MapKind[] = ['unisons', 'octaves', 'intervals', 'grid', 'one_string'];
/** One labelled spot on the neck; `note` is an extra name shown above the dot, `flag` marks the G→B shift. */
export interface NeckDot { string: number; fret: number; label: string; note?: string; root?: boolean; flag?: boolean }
export interface NeckMap { from: number; to: number; dots: NeckDot[]; links: [NeckDot, NeckDot][]; caption: string }

/** Open strings as MIDI numbers, index 0 = low E (string 6) … 5 = high E (string 1). */
export const OPEN = [40, 45, 50, 55, 59, 64];
const at = (s: number, f: number) => OPEN[s] + f;
/** Lowest fret ≥ min on string s that sounds pitch class pc. */
const fretOf = (s: number, pc: number, min = 0) => { let f = ((pc - OPEN[s]) % 12 + 12) % 12; while (f < min) f += 12; return f; };
const span = (dots: NeckDot[]) => ({ from: Math.min(...dots.map(d => d.fret)), to: Math.max(...dots.map(d => d.fret)) });

/** A calculated neck map for `key` (a tonic such as 'G' or 'Bb'); `minor` picks natural minor for one_string. */
export function neckMap(kind: MapKind, key: string, minor = false): NeckMap {
  const tonic = /^[A-G][#b]?/.exec(key)?.[0] ?? 'C';
  const pc = Note.chroma(tonic)!;
  const flats = /^[A-G]b$/.test(tonic) || tonic === 'F';
  const name = (m: number) => Note.pitchClass(flats ? Note.fromMidi(m) : Note.fromMidiSharps(m));
  switch (kind) {
    case 'unisons': {
      const dots: NeckDot[] = [];
      const links: [NeckDot, NeckDot][] = [];
      for (let s = 0; s < 5; s++) {
        const gap = OPEN[s + 1] - OPEN[s];
        const flag = gap === 4 || undefined;
        const a: NeckDot = { string: s, fret: gap, label: name(at(s, gap)), flag };
        const b: NeckDot = { string: s + 1, fret: 0, label: name(OPEN[s + 1]), flag };
        dots.push(a, b); links.push([a, b]);
      }
      return { from: 0, to: 5, dots, links,
        caption: 'Each joined pair is the same note: fret 5 matches the next string up played open, except fret 4 on string 3 (flagged).' };
    }
    case 'octaves': {
      const dots: NeckDot[] = [];
      for (let s = 0; s < 6; s++) for (let f = fretOf(s, pc); f <= 12; f += 12) dots.push({ string: s, fret: f, label: name(at(s, f)), root: true });
      const links: [NeckDot, NeckDot][] = [];
      for (const a of dots) for (const b of dots) {
        const skip = b.string - a.string;
        if ((skip === 2 || skip === 3) && at(b.string, b.fret) - at(a.string, a.fret) === 12) {
          if (a.string <= 3 && b.string >= 4) b.flag = true;
          links.push([a, b]);
        }
      }
      return { from: 0, to: 12, dots, links,
        caption: `Every ${tonic} on the neck. Skip one string: up 2 frets. Skip two strings: back 3 frets. Crossing from string 3 to string 2 adds one fret (flagged).` };
    }
    case 'intervals': {
      const dots: NeckDot[] = [];
      const links: [NeckDot, NeckDot][] = [];
      const steps: [string, number][] = [['3', 4], ['5', 7], ['b7', 10], ['8', 12]];
      for (const s0 of [0, 1]) {
        const r = fretOf(s0, pc, 1);
        const root: NeckDot = { string: s0, fret: r, label: 'R', note: tonic, root: true };
        dots.push(root);
        for (const [label, semi] of steps) {
          let best: NeckDot | null = null;
          for (const s of [s0 + 1, s0 + 2]) {
            const f = at(s0, r) + semi - OPEN[s];
            if (f >= 0 && (!best || Math.abs(f - r) < Math.abs(best.fret - r))) best = { string: s, fret: f, label };
          }
          dots.push(best!); links.push([root, best!]);
        }
      }
      return { ...span(dots), dots, links,
        caption: `R is ${tonic}. From a root on string 6 or 5: the 3rd is one string up, one fret back; the 5th is one string up, two frets up; the b7 is two strings up, same fret; 8 is the octave.` };
    }
    case 'grid': {
      const r = fretOf(0, pc);
      const dots: NeckDot[] = [[1, 0, ''], [4, 5, ''], [5, 7, ''], [6, 9, 'm']].map(([n, semi, suffix]) => {
        let best: NeckDot | null = null;
        for (const s of [0, 1]) for (const extra of [0, 12]) {
          const f = fretOf(s, (pc + (semi as number)) % 12) + extra;
          if (!best || Math.abs(f - r) < Math.abs(best.fret - r)) best = { string: s, fret: f, label: String(n), note: `${name(at(s, f))}${suffix}` };
        }
        if (n === 1) best!.root = true;
        return best!;
      });
      return { ...span(dots), dots, links: [],
        caption: 'The 1, 4, 5 and 6 chords of the key as one grid of roots. The shape is the same in every key; only the starting fret moves.' };
    }
    case 'one_string': {
      let s = 0;
      for (const c of [1, 2, 3]) if (fretOf(c, pc) < fretOf(s, pc)) s = c;
      const f0 = fretOf(s, pc);
      const semis = [...Scale.get(`${tonic} ${minor ? 'minor' : 'major'}`).intervals.map(i => Interval.semitones(i)!), 12];
      const dots: NeckDot[] = semis.map((x, k) => ({ string: s, fret: f0 + x, label: String((k % 7) + 1), note: name(at(s, f0 + x)), root: k % 7 === 0 }));
      const gaps = dots.slice(1).map((d, k) => (d.fret - dots[k].fret === 1 ? 'H' : 'W'));
      return { ...span(dots), dots, links: dots.slice(1).map((d, k) => [dots[k], d] as [NeckDot, NeckDot]),
        caption: `${tonic} ${minor ? 'natural minor' : 'major'} along string ${6 - s}: ${gaps.join('-')}.` };
    }
  }
}
```
Note: `grid` gets the `1` root from string 6 at fret `r` automatically, because that candidate has distance 0.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/engine/neck.test.ts && npx tsc --noEmit -p .`
Expected: all PASS, no type errors. If the frets 0–16 bound fails for `intervals` (root at fret 12, with the 5th and octave at 14), the bound holds. If a key exceeds it, read the failing case before changing any code.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/engine/neck.ts tests/engine/neck.test.ts
git commit -m "feat(engine): calculated neck maps — unisons, octaves, intervals, grid, one-string"
```

---

### Task 2: Recipes, curriculum and seed

**Files:**
- Modify: `supabase/functions/_shared/engine/recipes.ts` (types at lines 3–8; the fretboard recipes at about lines 299–336; add the 4 new recipes after `fretboard.l2.pentatonic_per_shape` / in level order)
- Modify: `supabase/seed/curriculum.ts:50-60`
- Regenerate: `supabase/seed.sql`
- Test: `tests/engine/recipes.test.ts`, `tests/seed/curriculum.test.ts`

**Interfaces:**
- Consumes: `MapKind`, `MAP_KINDS` from Task 1.
- Produces:
  - `type Card = 'pattern' | 'rhythm' | 'note_caller' | 'scale' | 'triads' | 'chords' | 'neck_map' | 'none'`
  - `type StepElement = 'card' | 'chords' | 'metronome' | 'note_caller'`
  - `SkillRecipe.map?: MapKind` and `SkillRecipe.show?: StepElement[][]`
  - skill ids `fretboard.l1.b_string_rule`, `fretboard.l2.interval_shapes`, `fretboard.l2.progression_grid`, `fretboard.l4.one_string_scale`

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine/recipes.test.ts` (inside the file, after the existing describe; add `MAP_KINDS` to the imports from `'../../supabase/functions/_shared/engine/neck.ts'`):
```ts
describe('fretboard shortcuts recipes', () => {
  const SHORTCUTS = ['fretboard.l1.notes_e_a', 'fretboard.l1.b_string_rule', 'fretboard.l1.octave_shapes',
    'fretboard.l2.interval_shapes', 'fretboard.l2.caged_linked', 'fretboard.l2.pentatonic_per_shape',
    'fretboard.l2.progression_grid', 'fretboard.l4.one_string_scale'];
  const ELEMENTS = ['card', 'chords', 'metronome', 'note_caller'];
  it('gives every shortcut skill a per-step show list matching its steps', () => {
    for (const id of SHORTCUTS) {
      const r = RECIPES[id];
      expect(r, id).toBeDefined();
      expect(r.show?.length, id).toBe(r.steps.length);
    }
  });
  it('uses only known step elements, and never note_caller on a note_caller card', () => {
    for (const [id, r] of Object.entries(RECIPES)) for (const els of r.show ?? []) {
      for (const e of els) expect(ELEMENTS, id).toContain(e);
      if (r.card === 'note_caller') expect(els, id).not.toContain('note_caller');
    }
  });
  it('shows the metronome on every step that carries the bpm ladder', () => {
    for (const [id, r] of Object.entries(RECIPES)) r.show?.forEach((els, k) => {
      if (r.steps[k].includes('{start_bpm}')) expect(els, `${id} step ${k + 1}`).toContain('metronome');
    });
  });
  it('gives every neck_map recipe a valid map kind', () => {
    for (const [id, r] of Object.entries(RECIPES)) if (r.card === 'neck_map') expect(MAP_KINDS, id).toContain(r.map);
  });
  it('wires the new skills to the agreed cards and maps', () => {
    expect(RECIPES['fretboard.l1.b_string_rule']).toMatchObject({ card: 'neck_map', map: 'unisons' });
    expect(RECIPES['fretboard.l1.octave_shapes']).toMatchObject({ card: 'neck_map', map: 'octaves' });
    expect(RECIPES['fretboard.l2.interval_shapes']).toMatchObject({ card: 'neck_map', map: 'intervals' });
    expect(RECIPES['fretboard.l2.progression_grid']).toMatchObject({ card: 'neck_map', map: 'grid', majorKeyOnly: true });
    expect(RECIPES['fretboard.l4.one_string_scale']).toMatchObject({ card: 'neck_map', map: 'one_string' });
  });
});
```
In the same file, change the fretboard card assertion (currently `expect(['note_caller', 'triads', 'scale'], s.id).toContain(RECIPES[s.id].card);`) to:
```ts
      expect(['note_caller', 'triads', 'scale', 'neck_map'], s.id).toContain(RECIPES[s.id].card);
```
Append to `tests/seed/curriculum.test.ts` inside `describe('curriculum', …)`:
```ts
  it('has the fretboard shortcut skills at the agreed levels', () => {
    expect(byId.get('fretboard.l1.b_string_rule')).toMatchObject({ level: 1, pass_metric: 'clean_reps' });
    expect(byId.get('fretboard.l2.interval_shapes')).toMatchObject({ level: 2, pass_metric: 'clean_reps' });
    expect(byId.get('fretboard.l2.progression_grid')).toMatchObject({ level: 2, pass_metric: 'bpm' });
    expect(byId.get('fretboard.l4.one_string_scale')).toMatchObject({ level: 4, pass_metric: 'bpm' });
  });
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/engine/recipes.test.ts tests/seed/curriculum.test.ts`
Expected: FAIL. The recipes and skills don't exist yet, and `map` isn't on the type.

- [ ] **Step 3: Types**

In `recipes.ts` replace lines 3–8:
```ts
import type { MapKind } from './neck.ts';

export type Card = 'pattern' | 'rhythm' | 'note_caller' | 'scale' | 'triads' | 'chords' | 'neck_map' | 'none';
/** What a step shows besides its text: the recipe's card, the chord panel, the tempo card, or the note-calling drill. */
export type StepElement = 'card' | 'chords' | 'metronome' | 'note_caller';

export interface SkillRecipe {
  card: Card; patterns?: string[]; grid?: string; gridName?: string; degrees?: number[];
  steps: string[]; listenFor: string;
  majorKeyOnly?: boolean; // planner.ts keeps this skill's day off a minor-family style scale; its steps assume a major key.
  map?: MapKind; // the neck map a 'neck_map' card draws (engine/neck.ts)
  show?: StepElement[][]; // per step, what Player shows besides the text (new_skill blocks only); omit = whole block's elements
}
```
(Keep the existing `export type Card` line deleted. It moves into this block.)

- [ ] **Step 4: Replace the four upgraded recipes and add the four new ones**

Replace `'fretboard.l1.notes_e_a'`, `'fretboard.l1.octave_shapes'`, `'fretboard.l2.caged_linked'` and `'fretboard.l2.pentatonic_per_shape'` with the block below, which also inserts the new L1/L2 skills. Then add `'fretboard.l4.one_string_scale'` after `'fretboard.l4.triads_lower_sets'`.
```ts
  'fretboard.l1.notes_e_a': {
    card: 'note_caller',
    steps: [
      'Strings 6 and 5 are E and A when played open. The dots on the neck at frets 3, 5, 7, 9 and 12 are your landmarks: on string 6 they are G, A, B, C# and E; on string 5 they are C, D, E, F# and A.',
      'Between two letter names there is one fret for the sharp or flat, except E to F and B to C, which sit right next to each other.',
      'Press "Start calling notes". Find each called note on string 6 or 5 before the next bar, starting from the nearest landmark.',
      'Say the note out loud as you play it.', 'Aim for {target_reps} clean passes in a row.',
    ],
    show: [[], [], ['card', 'metronome'], ['card', 'metronome'], ['card', 'metronome']],
    listenFor: 'Finding each note before the next click of beat 1.',
  },
  'fretboard.l1.b_string_rule': {
    card: 'neck_map', map: 'unisons',
    steps: [
      'Play string 6 at fret 5, then string 5 open: the same note, A. Each string is tuned to fret 5 of the string below it.',
      'Check each pair up the neck: fret 5 on string 5 matches open string 4, and fret 5 on string 4 matches open string 3. Then the odd one out: fret 4 on string 3 matches open string 2.',
      'Why the odd one out? Strings are 5 frets apart (a 4th), except strings 3 to 2, which are 4 frets apart (a major 3rd); that keeps chord shapes small enough for one hand. Finish with fret 5 on string 2 against open string 1, saying "five, five, five, four, five".',
      'Aim for {target_reps} clean passes in a row, hearing each pair ring as one note.',
    ],
    show: [['card'], ['card'], ['card'], []],
    listenFor: 'Each pair sounding as one note, with no wobble between them.',
  },
  'fretboard.l1.octave_shapes': {
    card: 'neck_map', map: 'octaves',
    steps: [
      'An octave is the same note, 12 frets higher. The card shows every {degrees:1} on the neck, joined by octave shapes.',
      'Skip one string and go up 2 frets: string 6 to 4, or string 5 to 3. Skip two strings and go back 3 frets: string 6 to 3.',
      'When a shape crosses from string 3 to string 2, add one fret: string 5 to 2 is back 2 frets, string 4 to 2 is up 3. That is the B-string rule again.',
      'Press "Start calling notes". Find the called note on string 6 or 5, then its octave with a shape, saying the note name at both spots.',
      'Aim for {target_reps} clean passes in a row.',
    ],
    show: [['card'], ['card'], ['card'], ['note_caller', 'metronome'], ['note_caller', 'metronome']],
    listenFor: 'Landing on the note and its octave before the next click of beat 1.',
  },
  'fretboard.l2.interval_shapes': {
    card: 'neck_map', map: 'intervals',
    steps: [
      'Find {degrees:1} on string 6: that is the root (R). Every other dot on the card is measured from it.',
      'The 3rd (a major 3rd) is one string up and one fret back; the 5th is one string up and two frets up. Play R, 3, 5 and say "root, third, fifth".',
      'The b7 is two strings up at the same fret, and the octave (8) is two strings up, two frets up. Play R, 3, 5, b7, 8.',
      'Now start from {degrees:1} on string 5: the shapes are identical, because strings 5, 4 and 3 are also 5 frets apart.',
      'Aim for {target_reps} clean passes in a row, naming each note\'s number as you play it.',
    ],
    show: [['card'], ['card'], ['card'], ['card'], []],
    listenFor: 'Each note landing cleanly as you name it, with the root always found first.',
  },
  'fretboard.l2.caged_linked': {
    card: 'scale', degrees: [1],
    steps: [
      'CAGED links five chord shapes — C, A, G, E and D — that each play {chord1} at a different spot up the neck.',
      'Play {chord1} in a shape you know, then find the next CAGED shape up the neck sharing the same root note, {degrees:1}.',
      'Move shape to shape up the neck in CAGED order, saying "root" out loud as you land on {degrees:1} in each new shape before you strum.',
      'Aim for {target_reps} clean passes in a row.',
    ],
    show: [['card'], ['card'], ['card'], []],
    listenFor: 'Every string ringing clean in each new shape, with the root always findable first.',
  },
  'fretboard.l2.pentatonic_per_shape': {
    card: 'scale', degrees: [1, 3, 5],
    steps: [
      'Start with box 1. A pentatonic box has five notes instead of seven: two notes fewer than the full scale box shown for today\'s position.',
      'Find {chord1}\'s CAGED shape, then play the pentatonic box wrapped around it, using {degrees:1,3,5} as your anchor notes.',
      'Climb the box root to root, saying "root" out loud each time you land on {degrees:1}.',
      LADDER,
    ],
    show: [['card'], ['card'], ['card'], ['card', 'metronome']],
    listenFor: 'Landing on the root note cleanly in tune every time you climb through the box.',
  },
  'fretboard.l2.progression_grid': {
    card: 'neck_map', map: 'grid', majorKeyOnly: true,
    steps: [
      'Chords in a key are numbered from the home note: 1 is {degrees:1}, 4 is {degrees:4}, 5 is {degrees:5} and 6 is {degrees:6}. The card shows their roots as one grid.',
      'Play the four roots as single notes, 1-4-5-6, saying the numbers out loud: 1 on string 6, 4 straight across on string 5, 5 two frets up from it, and 6 where the card shows it.',
      'If you know barre chords, play each root as its chord: 1, 4 and 5 major, 6 minor. Otherwise keep playing the roots, one per bar.',
      LADDER,
    ],
    show: [['card'], ['card'], ['card', 'metronome'], ['card', 'metronome']],
    listenFor: 'Each change landing on the beat as you say its number.',
  },
```
And after `'fretboard.l4.triads_lower_sets'`:
```ts
  'fretboard.l4.one_string_scale': {
    card: 'neck_map', map: 'one_string',
    steps: [
      'A scale is a recipe of whole steps (W, two frets) and half steps (H, one fret). The card shows today\'s scale along a single string, starting on {degrees:1}.',
      'Climb it slowly from 1 up to 1 an octave higher, saying each W or H as you move.',
      'Come back down the same string, saying the numbers this time: 1, 7, 6, 5, 4, 3, 2, 1.',
      LADDER,
    ],
    show: [['card'], ['card'], ['card'], ['card', 'metronome']],
    listenFor: 'Even notes up and down the string, with each gap the size the formula says.',
  },
```

- [ ] **Step 5: Curriculum skills**

In `supabase/seed/curriculum.ts`, change these lines (keep the others as they are):
```ts
  skill('fretboard.l1.notes_e_a', 'Notes on strings 6 and 5', 'Landmark frets 3-5-7-9-12, then name any note on the low E and A strings instantly.', 'clean_reps', 3, { theory_topic_id: 'theory.l1.degrees' }),
  skill('fretboard.l1.b_string_rule', 'The B-string rule', 'Strings are 5 frets apart except G to B (4): why, and how it shifts every shape.', 'clean_reps', 3, { theory_topic_id: 'theory.l1.intervals' }),
  skill('fretboard.l1.octave_shapes', 'Octave shapes', 'Find every octave of a note: skip one string up 2, skip two back 3, plus the B-string shift.', 'clean_reps', 3, { theory_topic_id: 'theory.l1.intervals' }),
  skill('fretboard.l2.interval_shapes', 'Interval shapes', 'Where the 3rd, 5th, b7 and octave sit from any root on strings 6 and 5.', 'clean_reps', 3, { theory_topic_id: 'theory.l1.intervals' }),
  skill('fretboard.l2.caged_linked', 'CAGED shapes linked', 'Play one chord in all five CAGED shapes up the neck, naming the root in each.', 'clean_reps', 3),
  skill('fretboard.l2.pentatonic_per_shape', 'Pentatonic per CAGED shape', 'Box 1 first, then the pentatonic box that sits around each CAGED shape.', 'bpm', 70, { theory_topic_id: 'theory.l1.scale_construction' }),
  skill('fretboard.l2.progression_grid', 'The progression grid', 'I-IV-V-vi as one movable grid of roots on strings 6 and 5, by number.', 'bpm', 60, { theory_topic_id: 'theory.l2.diatonic_qualities' }),
```
and after `fretboard.l4.triads_lower_sets`:
```ts
  skill('fretboard.l4.one_string_scale', 'Scales on one string', 'The key\'s scale along a single string, counting whole and half steps.', 'bpm', 70, { theory_topic_id: 'theory.l1.scale_construction' }),
```

- [ ] **Step 6: Run the tests, regenerate the seed, check the glossary**

Run: `npx vitest run tests/engine tests/seed && npx tsc --noEmit -p .`
Expected: PASS. If the "renders every written recipe in every key" test throws on `{degrees:6}` for some key, read `resolveDegree` in `render.ts`. Degree 6 must resolve in major keys, so fix the recipe text, not the renderer.
Run: `npm run seed:sql && node scripts/render-glossary.ts && grep -n "b_string_rule\|interval_shapes\|progression_grid\|one_string_scale" docs/glossary-review.md`
Expected: `seed.sql` regenerated. Each new recipe lists terms, with no `⚠️ none`. If a step uses a music word the glossary lacks, add the entry per the CLAUDE.md upkeep rule and re-run `npx vitest run tests/engine/glossary.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/engine/recipes.ts supabase/seed/curriculum.ts supabase/seed.sql tests/engine/recipes.test.ts tests/seed/curriculum.test.ts docs/glossary-review.md supabase/functions/_shared/engine/glossary.ts
git commit -m "feat(engine): fretboard shortcut recipes and skills with per-step elements"
```

---

### Task 3: `stepElements`, `FretGrid`, `NeckMap` and the Player wiring

**Files:**
- Modify: `src/lib/lesson.ts` (add `stepElements` after `blockCard`)
- Create: `src/components/FretGrid.tsx`, `src/components/NeckMap.tsx`
- Modify: `src/components/ScaleBoard.tsx`, `src/theme.css`, `src/screens/Player.tsx`
- Test: `tests/app/blockText.test.ts`

**Interfaces:**
- Consumes: `neckMap`, `NeckMap`, `NeckDot` (Task 1); `SkillRecipe`, `StepElement` (Task 2).
- Produces:
  - `stepElements(recipe: SkillRecipe | undefined, kind: BlockKind, step: number, stepCount: number): StepElement[] | null` (null = per-block behaviour)
  - `FretGrid` props `{ from: number; to: number; dots: GridDot[]; links?: [GridDot, GridDot][]; label: string }`, where `GridDot = NeckDot & { dim?: boolean }`

- [ ] **Step 1: Write the failing tests** (append to `tests/app/blockText.test.ts`; add `stepElements` to the import from `'../../src/lib/lesson.ts'` and `RECIPES` from `'../../supabase/functions/_shared/engine/recipes.ts'`)
```ts
describe('stepElements', () => {
  const r = RECIPES['fretboard.l1.octave_shapes'];
  it('returns the current step\'s elements on a new_skill block', () => {
    expect(stepElements(r, 'new_skill', 0, r.steps.length)).toEqual(['card']);
    expect(stepElements(r, 'new_skill', 3, r.steps.length)).toEqual(['note_caller', 'metronome']);
  });
  it('falls back to per-block (null) for retest blocks, whose steps shift (Review Focus 5)', () => {
    expect(stepElements(r, 'retest', 0, 3)).toBeNull();
  });
  it('falls back when the stored lesson has a different number of steps (Review Focus 4)', () => {
    expect(stepElements(r, 'new_skill', 0, r.steps.length - 1)).toBeNull();
  });
  it('falls back for recipes without show, and with no recipe', () => {
    expect(stepElements(RECIPES['fretboard.l3.triads_321'], 'new_skill', 0, 4)).toBeNull();
    expect(stepElements(undefined, 'warmup', 0, 3)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/app/blockText.test.ts`
Expected: FAIL. `stepElements` is not a function.

- [ ] **Step 3: Implement `stepElements`** in `src/lib/lesson.ts`

Change the recipes import to `import { recipeFor, type Card, type SkillRecipe, type StepElement } from '../../supabase/functions/_shared/engine/recipes.ts';` and add after `blockCard`:
```ts
/**
 * What the current step shows besides its text, or null for the whole block's elements. Only new_skill blocks gate per
 * step: retest prepends a line (indexes shift) and stored lessons may predate the recipe's current steps.
 */
export function stepElements(recipe: SkillRecipe | undefined, kind: BlockKind, step: number, stepCount: number): StepElement[] | null {
  if (kind !== 'new_skill' || !recipe?.show || recipe.show.length !== stepCount) return null;
  return recipe.show[step] ?? null;
}
```
Run: `npx vitest run tests/app/blockText.test.ts`. Expected: PASS.

- [ ] **Step 4: Extract `FretGrid`, and keep `ScaleBoard` the same**

`src/components/FretGrid.tsx`:
```tsx
import type { NeckDot } from '../../supabase/functions/_shared/engine/neck.ts';

export type GridDot = NeckDot & { dim?: boolean };
const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const COL = 44;
const Y = (string: number) => 16 + (5 - string) * 24; // tab view: high e on top, as in the picking pattern

/** Horizontal fretboard from fret `from` to `to`: labelled dots (roots in marigold), optional links and G→B flags. */
export function FretGrid({ from, to, dots, links = [], label }: { from: number; to: number; dots: GridDot[]; links?: [GridDot, GridDot][]; label: string }) {
  const X = (fret: number) => 40 + (fret - from + 0.5) * COL;
  const W = 40 + (to - from + 1) * COL + 4;
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={160} viewBox={`0 0 ${W} 160`} role="img" aria-label={label}>
        {[0, 1, 2, 3, 4, 5].map(s => (
          <g key={s}>
            <text x={8} y={Y(s)} className="pk-name">{STRING_NAMES[s]}</text>
            <line x1={40} x2={W - 4} y1={Y(s)} y2={Y(s)} className="pk-string" />
          </g>
        ))}
        {Array.from({ length: to - from + 2 }, (_, k) => from + k).filter(f => f > 0).map(f => ( // wire left of fret f; f = 1 is the nut
          <line key={f} x1={40 + (f - from) * COL} x2={40 + (f - from) * COL} y1={Y(5)} y2={Y(0)} className={f === 1 ? 'cd-nut-line' : 'cd-fret'} />
        ))}
        {Array.from({ length: to - from + 1 }, (_, k) => from + k).filter(f => f > 0).map(f => (
          <text key={f} x={X(f)} y={152} className="fret-num">{f}</text>
        ))}
        {links.map(([a, b]) => (
          <line key={`${a.string}-${a.fret}-${b.string}-${b.fret}`} x1={X(a.fret)} y1={Y(a.string)} x2={X(b.fret)} y2={Y(b.string)} className="nm-link" />
        ))}
        {dots.map(d => {
          const root = d.root ? ' cd-root' : '';
          return (
            <g key={`${d.string}-${d.fret}`} opacity={d.dim ? 0.25 : undefined}>
              <circle cx={X(d.fret)} cy={Y(d.string)} r={10} className={`cd-dot${root}${d.flag ? ' nm-flag' : ''}`} />
              <text x={X(d.fret)} y={Y(d.string) + 1} className={`cd-label${root}`}>{d.label}</text>
              {d.note && <text x={X(d.fret)} y={Y(d.string) - 14} className="pk-count">{d.note}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```
In `src/components/ScaleBoard.tsx`:
- Delete `STRING_NAMES`, `COL` and `Y`, but keep a local `STRING_NAMES` for the aria label.
- Replace the whole `<div style={{ overflowX: 'auto' }}>…</div>` with:
```tsx
      <FretGrid from={from} to={to} label={label}
        dots={notes.map(n => ({ string: n.string, fret: n.fret, label: String(n.degree), root: n.degree === 1, dim: !!highlight && !highlight.includes(n.degree) }))} />
```
- Add `import { FretGrid } from './FretGrid.tsx';`, and keep `const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];` for `label`.

Append to `src/theme.css`:
```css
.nm-link { stroke: var(--muted); stroke-width: 2; opacity: 0.5; }
.cd-dot.nm-flag { stroke: var(--gold); stroke-width: 2.5; stroke-dasharray: 3 2; }
```

- [ ] **Step 5: `NeckMap` component**

`src/components/NeckMap.tsx`:
```tsx
import type { NeckMap as Map } from '../../supabase/functions/_shared/engine/neck.ts';
import { FretGrid } from './FretGrid.tsx';

const STRING_NUMBER = (s: number) => 6 - s;

/** A calculated neck map (engine/neck.ts): labelled dots, links between related spots, and a one-line caption. */
export function NeckMap({ map, title }: { map: Map; title: string }) {
  const label = `${title}: ` + map.dots.map(d => `string ${STRING_NUMBER(d.string)} fret ${d.fret} ${d.label}${d.note ? ` ${d.note}` : ''}`).join(', ');
  return (
    <section className="card" aria-label={title}>
      <div className="row"><b>{title}</b></div>
      <FretGrid from={map.from} to={map.to} dots={map.dots} links={map.links} label={label} />
      <p className="muted" style={{ fontSize: 13 }}>{map.caption}</p>
    </section>
  );
}
```

- [ ] **Step 6: Wire Player**

In `src/screens/Player.tsx`:
1. Imports: add `stepElements` to the import from `'../lib/lesson.ts'`, plus `import { NeckMap } from '../components/NeckMap.tsx';`, `import { neckMap } from '../../supabase/functions/_shared/engine/neck.ts';` and `import type { StepElement } from '../../supabase/functions/_shared/engine/recipes.ts';`.
2. Directly after `const [step, setStep] = useState(0);` add:
```ts
  const els = stepElements(recipe, block.kind, step, steps.length);
  const on = (e: StepElement) => els === null || els.includes(e);
```
3. Change these JSX conditions (leave everything else as is):
   - `{showChords && <ChordPanel` → `{showChords && on('chords') && <ChordPanel`
   - `{card === 'scale' && <ScaleBoard` → `{card === 'scale' && on('card') && <ScaleBoard`
   - `{card === 'triads' && <TriadBoard` → `{card === 'triads' && on('card') && <TriadBoard`
   - `{pattern && !pattern.strokes && skillPatterns.length > 1 && (` → `{pattern && on('card') && !pattern.strokes && skillPatterns.length > 1 && (`
   - `{pattern && chords.length > 0 && <PickingPattern` → `{pattern && on('card') && chords.length > 0 && <PickingPattern`
   - `{card === 'note_caller' && <NoteCaller metro={metro} />}` → `{(card === 'note_caller' ? on('card') : !!els?.includes('note_caller')) && <NoteCaller metro={metro} />}`
   - `{hasMetro && (` (the Metronome block) → `{hasMetro && on('metronome') && (`
4. After the TriadBoard line add:
```tsx
      {card === 'neck_map' && recipe?.map && on('card') && (
        <NeckMap title={SKILLS_BY_ID.get(cardSkill!)?.name ?? 'Neck map'} map={neckMap(recipe.map, plan.key, /^(minor|aeolian)$/.test(plan.music.scale.name))} />
      )}
```
   (Review Focus 3: a minor-key day passes `minor = true`, so `one_string` shows natural minor.)

- [ ] **Step 7: Full check**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: all pass, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/lib/lesson.ts src/components/FretGrid.tsx src/components/NeckMap.tsx src/components/ScaleBoard.tsx src/theme.css src/screens/Player.tsx tests/app/blockText.test.ts
git commit -m "feat(app): neck-map card and per-step elements for new-skill blocks"
```

---

### Task 4: Migration for the live database

**Files:**
- Create: `supabase/migrations/20261001000001_fretboard_shortcuts.sql`
- Test: `tests/db/fretboard_shortcuts.test.ts`

**Interfaces:**
- Consumes: the regenerated `supabase/seed.sql` rows (Task 2).

- [ ] **Step 1: Write the failing DB test**

`tests/db/fretboard_shortcuts.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';
const SQL = readFileSync(join(import.meta.dirname, '..', '..', 'supabase', 'migrations', '20261001000001_fretboard_shortcuts.sql'), 'utf8');
const NEW = ['fretboard.l1.b_string_rule', 'fretboard.l2.interval_shapes', 'fretboard.l2.progression_grid', 'fretboard.l4.one_string_scale'];
const U = '00000000-0000-4000-8000-0000000000f1';
let client: pg.Client;

beforeAll(async () => { client = new pg.Client({ connectionString: DB_URL }); await client.connect(); });
afterAll(async () => { await client.end(); });

describe('fretboard shortcuts migration', () => {
  it('upserts the new skills and leaves existing progress untouched, and is safe to re-run', async () => {
    await client.query('begin');
    try {
      await client.query(`insert into auth.users (id, email) values ($1, 'f@test.dev')`, [U]);
      await client.query(`insert into public.skill_progress (user_id, skill_id, status, score) values ($1, 'fretboard.l1.octave_shapes', 'mastered', 3)`, [U]);
      await client.query(SQL);
      await client.query(SQL);
      const skills = await client.query('select id, level from public.skills where id = any($1) order by id', [NEW]);
      expect(skills.rows.map(r => r.id)).toEqual([...NEW].sort());
      const name = await client.query(`select name, description from public.skills where id = 'fretboard.l1.octave_shapes'`);
      expect(name.rows[0].description).toContain('B-string');
      const prog = await client.query('select status, score from public.skill_progress where user_id = $1', [U]);
      expect(prog.rows).toEqual([{ status: 'mastered', score: 3 }]);
    } finally {
      await client.query('rollback');
    }
  });
});
```
Run: `npx vitest run tests/db/fretboard_shortcuts.test.ts`
Expected: FAIL. The migration file doesn't exist (ENOENT).
(If `skill_progress` has other required columns, read `supabase/migrations/20260928000001_core_schema.sql` at the `create table public.skill_progress` block and add them to the insert.)

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20261001000001_fretboard_shortcuts.sql`:
- Header line: `-- Fretboard shortcuts (spec 2026-10-01): 4 new skills, 4 reworded. Upsert only; never touches skill_progress.`
- Then copy the exact `insert into public.skills (…) values` line and the `on conflict (id) do update …;` clause from `supabase/seed.sql`.
- Between them, put only the 8 rows for `fretboard.l1.notes_e_a`, `fretboard.l1.b_string_rule`, `fretboard.l1.octave_shapes`, `fretboard.l2.interval_shapes`, `fretboard.l2.caged_linked`, `fretboard.l2.pentatonic_per_shape`, `fretboard.l2.progression_grid` and `fretboard.l4.one_string_scale`, copied from `seed.sql`. Separate the rows with commas, with no trailing comma.

Find them with: `grep -n "fretboard.l1.notes_e_a\|b_string_rule\|fretboard.l1.octave_shapes\|interval_shapes\|caged_linked\|pentatonic_per_shape\|progression_grid\|one_string_scale" supabase/seed.sql`

- [ ] **Step 3: Apply locally and run the tests**

Run: `supabase migration up && npx vitest run tests/db/fretboard_shortcuts.test.ts && npm run test:db`
Expected: the migration applies, and all DB tests PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261001000001_fretboard_shortcuts.sql tests/db/fretboard_shortcuts.test.ts
git commit -m "feat(db): migration — fretboard shortcut skills (upsert, progress untouched)"
```

---

### Task 5: Check by eye and handoff

- [ ] **Step 1: Make a local lesson that uses a new skill**

Run (local DB only):
```bash
docker exec supabase_db_musiclessons psql -U postgres -c "update lessons set skill_id='fretboard.l1.octave_shapes', track='fretboard', plan = jsonb_set(jsonb_set(plan,'{skill_id}','\"fretboard.l1.octave_shapes\"'),'{track}','\"fretboard\"') where lesson_date='2026-10-01' and user_id=(select id from auth.users where email='phase3@test.dev');"
```
This only changes the plan. The stored `content` steps still belong to the old skill, so the steps count won't match. That's the Review Focus 4 fallback case: check that the block shows its card per-block and nothing disappears.

- [ ] **Step 2: Check the gated path with real steps**

Regenerate that lesson's content through the engine:
```bash
supabase functions serve
```
Run it in a second terminal, then call `generate-lesson` for the test user as described in README "LLM setup", or set `content.blocks[1].instructions` to the rendered octave steps with a node one-off. In the app (`http://127.0.0.1:5173`; unregister any stale service worker first), check:
- step 1 shows the octave neck map and no metronome or chord panel;
- step 4 shows the note caller and metronome but no neck map;
- "More about this" is present on every step.

- [ ] **Step 3: Handoff**

Write `docs/SESSION_HANDOFF_<date>.md` covering what shipped, the deploy order and next steps. The deploy order is:
1. `supabase db push` (migration)
2. `supabase functions deploy generate-lesson`
3. merge to `main` (Netlify)

Next steps: retrofit per-step elements onto the other recipes and the warmup/apply blocks. Run `npm run vault:sync`, then commit. **Do not deploy without the owner's go-ahead.**
