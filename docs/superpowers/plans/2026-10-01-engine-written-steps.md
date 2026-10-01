# Engine-Written Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every instruction the learner reads is written by the engine from the same data the on-screen cards draw. The LLM writes only colour: title, why, theory card, songs, and a per-block "More about this".

**Architecture:**
- Per-skill **recipes** (step templates with `{slots}`) and a **Create library** live in the shared engine.
- `buildSteps(plan)` renders them into block instructions. The planner picks today's pattern (`pattern_id`) and Create task (`create_task_id`).
- The LLM returns a smaller *colour* object, checked by `validateColour`. `assembleLesson` merges the engine steps with the colour; the fallback is the same steps with template colour.
- The Player reads each block's card from the recipe.

**Tech stack:** TypeScript shared by Deno (edge function) and Vite/React 19 (app), `tonal`, Vitest 3.2.

**Spec:** `docs/superpowers/specs/2026-09-30-engine-written-steps-design.md`

## Global Constraints

- **Imports:** engine and lesson code under `supabase/functions/_shared/` must stay Deno-compatible. Use relative imports with explicit `.ts` extensions, and no Node built-ins.
- **Dependencies:** no new ones.
- **Line endings:** write files with LF (Write/Edit tools, or Python `open(p,'wb')`). No CRLF.
- **Prompt version:** `PROMPT_VERSION = 'gc-2026-10-01'`.
- **`more`:** at most 400 characters per block. It must not contain a tempo (`\d+ ?bpm`) or a rep count (`\d+ (clean )?reps?`).
- **Skill names:** the LLM may name only skills in `met_skills` (has a `skill_progress` row, or today's/retest skill), or a skill name that already appears in that lesson's engine-written steps.
- **Old lessons:** lessons stored before this change (with `tips`/`explanation`, without `listen_for`/`more`/`pattern_id`/`create_task_id`) must still render.
- **Git:** work on `dev`; commit per task. **Ask Matt before merging to `main` or deploying the function.**
- **Secrets:** never `cat` `.env.local`, `.env.hosted` or `supabase/functions/.env`.
- **Checks:** `npm test` (unit), `npm run typecheck`, `npm run build`. DB tests: `npm run test:db`, with local Supabase running.

## Review Focus

1. **The LLM echoes a technique named in the engine steps** (e.g. "ghost strums" on an Apply block whose rhythm has ghost strokes). This must not be rejected as an unmet skill. *Test in Task 7.*
2. **Keys with flats, sharps and minor scales** (F major, B♭ minor, F♯ major). `{degrees}` must spell the scale's own note names ("F♯, A♯ and C♯", never "G♭…"), and nothing may throw. *Test in Task 2, across 12 tonics × major/minor.*
3. **Old stored lessons open in the Player** and from the offline cache without crashing. They show `tips`/`explanation` under "More about this" and no empty "Listen for". *Test in Task 8 (`blockText`).*
4. **Apply on a day with no style rhythm** (`plan.music.rhythm === null`). The steps fall back to steady down-strums in quarter notes, and the card shows that same rhythm. *Test in Task 6.*
5. **Retest of a pattern skill that isn't today's skill.** The retest uses that skill's first recipe pattern, never `plan.pattern_id`, which belongs to today's skill. *Test in Task 6.*

---

## File map

| File | Responsibility |
|---|---|
| `supabase/functions/_shared/engine/patterns.ts` (modify) | `patternCounts`; drop `SKILL_PATTERNS` (moves into recipes) |
| `supabase/functions/_shared/engine/render.ts` (create) | `SlotCtx`, `slotContext`, `renderSteps`, `listNotes` |
| `supabase/functions/_shared/engine/recipes.ts` (create) | `Card`, `SkillRecipe`, `RECIPES`, `recipeFor` |
| `supabase/functions/_shared/engine/create.ts` (create) | `CREATE_TASKS`, `pickCreateTask` |
| `supabase/functions/_shared/engine/planner.ts` + `types.ts` (modify) | `plan.pattern_id`, `plan.create_task_id`; `LessonSummary.create_task_id` |
| `supabase/functions/_shared/lesson/state.ts` (modify) | carry `create_task_id` from the stored plan |
| `supabase/functions/_shared/lesson/steps.ts` (create) | `buildSteps`, `APPLY_DEFAULT_GRID`, `RESETS` |
| `supabase/functions/_shared/lesson/contract.ts` (modify) | `Colour`, `COLOUR_JSON_SCHEMA`, `validateColour`, new `BlockContent` |
| `supabase/functions/_shared/lesson/prompt.ts` (modify) | the shorter colour-only prompt; the brief gains `steps` and `met_skills` |
| `supabase/functions/_shared/lesson/fallback.ts` (modify) | `fallbackColour`, `assembleLesson` |
| `supabase/functions/_shared/lesson/generate.ts`, `service.ts` (modify) | write colour → assemble |
| `src/lib/lesson.ts` (modify) | `blockText` (old/new content normaliser) |
| `src/lib/skillInfo.ts` (modify) | patterns from `RECIPES` |
| `src/components/ScaleBoard.tsx` (modify) | `highlight?: number[]` |
| `src/components/TriadBoard.tsx` (create) | the triad shapes card |
| `src/screens/Player.tsx` (modify) | card from the recipe, `pattern_id` default, Listen for, More about this |
| `src/lib/noteCaller.ts` (modify) | delete `NOTE_CALLER_SKILLS` |

---

### Task 1: `patternCounts`, a picking pattern in words

**Files:**
- Modify: `supabase/functions/_shared/engine/patterns.ts`
- Test: `tests/engine/patterns.test.ts`

**Interfaces:**
- Consumes: `PickPattern`, `rhythmCounts` (existing; same count labels).
- Produces: `patternCounts(p: PickPattern): string`, e.g. `'1 thumb + ring together · 2 index · 3 thumb (alternate bass) + middle together · 4 index'`.

- [ ] **Step 1: Write the failing test.** Add `patternCounts` to the import from `patterns.ts` and append:

```ts
describe('patternCounts', () => {
  it('spells a pinch pattern count by count', () => {
    expect(patternCounts(PATTERNS.pinch))
      .toBe('1 thumb + ring together · 2 index · 3 thumb (alternate bass) + middle together · 4 index');
  });
  it('labels off-beats and triplets like rhythmCounts', () => {
    expect(patternCounts(PATTERNS.giuliani_pimi)).toBe('1 thumb · 1& index · 2 middle · 2& index · 3 thumb · 3& index · 4 middle · 4& index');
    expect(patternCounts(PATTERNS.giuliani_pim).startsWith('1 thumb · 1-trip index · 1-let middle · 2 thumb')).toBe(true);
  });
  it('skips rests (Travis beat 1&)', () => {
    expect(patternCounts(PATTERNS.travis).startsWith('1 thumb + middle together · 2 thumb (alternate bass) · 2& index')).toBe(true);
  });
  it('covers every pattern without throwing', () => {
    for (const p of Object.values(PATTERNS)) expect(patternCounts(p).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/engine/patterns.test.ts`. Expect FAIL: `patternCounts is not a function`.

- [ ] **Step 3: Implement** in `patterns.ts`. Put it after `rhythmCounts`; reuse its `COUNT_SUB`:

```ts
const FINGER_WORD = { p: 'thumb', i: 'index', m: 'middle', a: 'ring' } as const;

/** A picking pattern in words, count by count ("1 thumb + ring together · 2 index"), so steps match the animated card. */
export function patternCounts(p: PickPattern): string {
  const barLen = p.beatsPerBar * p.stepsPerBeat;
  return p.steps.flatMap((step, k) => {
    if (step.length === 0) return [];
    const inBar = k % barLen;
    const count = `${Math.floor(inBar / p.stepsPerBeat) + 1}${COUNT_SUB[p.stepsPerBeat][inBar % p.stepsPerBeat]}`;
    const words = step.map(n => `${FINGER_WORD[n.finger]}${n.finger === 'p' && n.role === 'alt' ? ' (alternate bass)' : ''}`);
    return [`${count} ${words.join(' + ')}${step.length > 1 ? ' together' : ''}`];
  }).join(' · ');
}
```

- [ ] **Step 4: Run** the same test. Expect PASS. If the Travis or `pim` strings differ, read the `PATTERNS` table and correct the **expected string only** where the pattern data makes it right.

- [ ] **Step 5: Commit.**

```bash
git add supabase/functions/_shared/engine/patterns.ts tests/engine/patterns.test.ts
git commit -m "feat(engine): patternCounts spells a picking pattern count by count"
```

---

### Task 2: `renderSteps`, filling `{slots}` from today's plan

**Files:**
- Create: `supabase/functions/_shared/engine/render.ts`
- Test: `tests/engine/render.test.ts`

**Interfaces:**
- Consumes: `LessonPlan` (types.ts), `PATTERNS`, `patternCounts`, `rhythmPattern`, `rhythmCounts`, `voiceRoles` (patterns.ts), `Target`.
- Produces:
  - `interface SlotCtx { key; scale; chords: string[]; scaleNotes: string[]; target: Target | null; pattern: PickPattern | null; rhythm: PickPattern | null; rootString: number | null }`
  - `slotContext(plan: LessonPlan, opts: { target?: Target | null; patternId?: string | null; grid?: string | null }): SlotCtx`
  - `renderSteps(templates: string[], ctx: SlotCtx): string[]`, which throws `Error('unfilled slot {x}')` on an unknown slot or missing data
  - `listNotes(notes: string[]): string` ("G, B and D")

Slot table (from spec §4.1): `{key} {scale} {chords} {chord1} {degrees:a,b,…} {root_string} {start_bpm} {target_bpm} {target_reps} {pattern_name} {pattern_counts} {rhythm_name} {rhythm_counts}`.

- [ ] **Step 1: Write the failing test.** Create `tests/engine/render.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildMusic } from '../../supabase/functions/_shared/engine/music.ts';
import { listNotes, renderSteps, slotContext } from '../../supabase/functions/_shared/engine/render.ts';
import { PLAN } from '../lesson/fixtures.ts';

const withKey = (key: string) => ({ ...PLAN, key, music: buildMusic({ key, track: PLAN.track, style: null, element: null }) });

describe('listNotes', () => {
  it('joins with commas and "and"', () => {
    expect(listNotes(['G'])).toBe('G');
    expect(listNotes(['G', 'B'])).toBe('G and B');
    expect(listNotes(['G', 'B', 'D'])).toBe('G, B and D');
  });
});

describe('renderSteps', () => {
  const ctx = slotContext(PLAN, { target: { metric: 'bpm', start: 46, target: 70 }, patternId: 'pinch', grid: 'B---D---B---D---' });
  it('fills every slot from the plan', () => {
    expect(renderSteps([
      '{key} {scale}: {chords}, start on {chord1}.',
      'Sing {degrees:1,3,5}.',
      'Thumb on string {root_string}.',
      '{start_bpm} to {target_bpm} bpm.',
      '{pattern_name}: {pattern_counts}',
      '{rhythm_name}: {rhythm_counts}',
    ], ctx)).toEqual([
      'G major: {G} {C} {D} {G}, start on {G}.',
      'Sing G, B and D.',
      'Thumb on string 6.',
      '46 to 70 bpm.',
      'Pinch and pluck: 1 thumb + ring together · 2 index · 3 thumb (alternate bass) + middle together · 4 index',
      "Today's rhythm: 1 thumb plays the bass note · 2 strum down · 3 thumb plays the bass note · 4 strum down",  // a recipe grid without a name (Task 3 adds gridName)
    ]);
  });
  it('throws on unknown slots and on slots with no data', () => {
    expect(() => renderSteps(['{nope}'], ctx)).toThrow('unfilled slot {nope}');
    expect(() => renderSteps(['{target_reps}'], ctx)).toThrow('unfilled slot {target_reps}');
    expect(() => renderSteps(['{pattern_name}'], slotContext(PLAN, {}))).toThrow('unfilled slot {pattern_name}');
  });
  it('spells degrees in the scale\'s own names in every key, major and minor', () => {
    for (const tonic of ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'F', 'Bb', 'Eb', 'Ab', 'Db']) {
      const c = slotContext(withKey(tonic), {});
      const [line] = renderSteps(['{degrees:1,3,5}'], c);
      expect(line.startsWith(c.scaleNotes[0])).toBe(true);
    }
    expect(renderSteps(['{degrees:1,3,5}'], slotContext(withKey('F#'), {}))).toEqual(['F#, A# and C#']);
  });
});
```

`PLAN` (from `tests/lesson/fixtures.ts`) is a rhythm lesson in G over `G C D G`, so `{chords}` renders `{G} {C} {D} {G}`. Check the fixture test in `tests/lesson/contract.test.ts:6`. If `buildMusic` picks minor for a minor first chord, the major-key loop still covers minor scales through relative keys. Also add an explicit minor case: `slotContext({ ...PLAN, music: { ...PLAN.music, scale: { ...PLAN.music.scale, name: 'minor', notes: ['E','F#','G','A','B','C','D'] } } }, {})` must give `'E, G and B'` for `{degrees:1,3,5}`.

- [ ] **Step 2: Run** `npx vitest run tests/engine/render.test.ts`. Expect FAIL: module not found.

- [ ] **Step 3: Implement** `render.ts`:

```ts
import { PATTERNS, patternCounts, rhythmCounts, rhythmPattern, voiceRoles, type PickPattern } from './patterns.ts';
import type { LessonPlan, Target } from './types.ts';

export interface SlotCtx {
  key: string; scale: string; chords: string[]; scaleNotes: string[]; target: Target | null;
  pattern: PickPattern | null; rhythm: PickPattern | null; rootString: number | null;
}

/** "G" · "G and B" · "G, B and D". */
export function listNotes(notes: string[]): string {
  return notes.length <= 1 ? notes.join('') : `${notes.slice(0, -1).join(', ')} and ${notes.at(-1)}`;
}

/** Everything a step template may mention, from the same plan data the cards draw. */
export function slotContext(plan: LessonPlan, opts: { target?: Target | null; patternId?: string | null; grid?: string | null }): SlotCtx {
  const { music } = plan;
  const chord1 = music.progression.chords[0];
  const v = chord1 ? music.voicings[chord1]?.[0] : undefined;
  const rhythm = opts.grid
    ? rhythmPattern('Today\'s rhythm', opts.grid.split(''))
    : music.rhythm ? rhythmPattern(music.rhythm.name, music.rhythm.grid) : null;
  return {
    key: plan.key, scale: music.scale.name, chords: music.progression.chords, scaleNotes: music.scale.notes,
    target: opts.target ?? null, pattern: opts.patternId ? PATTERNS[opts.patternId] ?? null : null, rhythm,
    rootString: v && chord1 ? 6 - voiceRoles(v, chord1).bass : null, // guitarists count strings 6 (low E) to 1
  };
}

const braced = (cs: string[]) => cs.map(c => `{${c}}`).join(' ');

/** Fills {slots}; throws on an unknown slot or one with no data, so a bad recipe fails its test, not the learner. */
export function renderSteps(templates: string[], ctx: SlotCtx): string[] {
  const t = ctx.target;
  const value = (slot: string): string | null => {
    const deg = /^degrees:([\d,]+)$/.exec(slot);
    if (deg) return listNotes(deg[1].split(',').map(d => ctx.scaleNotes[Number(d) - 1]).filter(Boolean));
    switch (slot) {
      case 'key': return ctx.key;
      case 'scale': return ctx.scale;
      case 'chords': return ctx.chords.length ? braced(ctx.chords) : null;
      case 'chord1': return ctx.chords[0] ? `{${ctx.chords[0]}}` : null;
      case 'root_string': return ctx.rootString !== null ? String(ctx.rootString) : null;
      case 'start_bpm': return t?.metric === 'bpm' && t.start !== null ? String(t.start) : null;
      case 'target_bpm': return t?.metric === 'bpm' && t.target !== null ? String(t.target) : null;
      case 'target_reps': return t?.metric === 'clean_reps' && t.target !== null ? String(t.target) : null;
      case 'pattern_name': return ctx.pattern?.name ?? null;
      case 'pattern_counts': return ctx.pattern ? patternCounts(ctx.pattern) : null;
      case 'rhythm_name': return ctx.rhythm?.name ?? null;
      case 'rhythm_counts': return ctx.rhythm ? rhythmCounts(ctx.rhythm) : null;
      default: return null;
    }
  };
  return templates.map(tpl => tpl.replace(/\{([a-z_]+(?::[\d,]+)?)\}/g, (_, slot: string) => {
    const v = value(slot);
    if (v === null) throw new Error(`unfilled slot {${slot}}`);
    return v;
  }));
}
```

Note that chord names in rendered steps stay in braces (`{G}`). The Player's `ChordText` already turns braced chords into tappable chips.

- [ ] **Step 4: Run** the test. Expect PASS.

- [ ] **Step 5: Commit.**

```bash
git add supabase/functions/_shared/engine/render.ts tests/engine/render.test.ts
git commit -m "feat(engine): renderSteps fills step templates from the plan"
```

---

### Task 3: Recipes, with the 10 fingerstyle recipes

**Files:**
- Create: `supabase/functions/_shared/engine/recipes.ts`
- Modify: `supabase/functions/_shared/engine/patterns.ts` (delete `SKILL_PATTERNS`), `supabase/functions/_shared/engine/render.ts` (`gridName` option), `src/lib/skillInfo.ts`, `supabase/functions/_shared/lesson/prompt.ts` (the `picking_pattern` line now reads recipes; it is removed in Task 7)
- Test: `tests/engine/recipes.test.ts`, and update `tests/engine/patterns.test.ts` and `tests/app/skillInfo.test.ts`

**Interfaces:**
- Consumes: `renderSteps`, `slotContext` (Task 2), `PATTERNS`.
- Produces:

```ts
export type Card = 'pattern' | 'rhythm' | 'note_caller' | 'scale' | 'triads' | 'chords' | 'none';
export interface SkillRecipe {
  card: Card; patterns?: string[]; grid?: string; gridName?: string; degrees?: number[];
  steps: string[]; listenFor: string;
}
export const RECIPES: Record<string, SkillRecipe>;
/** The skill's recipe, or a generic one built from its curriculum description until the recipe is written. */
export function recipeFor(skill: Skill): SkillRecipe;
```

and `slotContext(plan, { …, gridName?: string | null })`, which names a recipe grid.

- [ ] **Step 1: Write the failing test.** Create `tests/engine/recipes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildMusic } from '../../supabase/functions/_shared/engine/music.ts';
import { PATTERNS, rhythmPattern } from '../../supabase/functions/_shared/engine/patterns.ts';
import { RECIPES, recipeFor } from '../../supabase/functions/_shared/engine/recipes.ts';
import { renderSteps, slotContext } from '../../supabase/functions/_shared/engine/render.ts';
import { targetFor } from '../../supabase/functions/_shared/engine/planner.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';
import { PLAN } from '../lesson/fixtures.ts';

const KEYS = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb'];
const practice = SKILLS.filter(s => s.track !== 'theory');

describe('recipes', () => {
  it('has a recipe for every fingerstyle skill, with known patterns', () => {
    for (const s of practice.filter(x => x.track === 'fingerstyle')) {
      const r = RECIPES[s.id];
      expect(r, s.id).toBeDefined();
      expect(r.card).toBe('pattern');
      for (const p of r.patterns ?? []) expect(PATTERNS[p], `${s.id} → ${p}`).toBeDefined();
    }
  });
  it('renders every written recipe in every key without an unfilled slot', () => {
    for (const [id, r] of Object.entries(RECIPES)) {
      const skill = SKILLS.find(s => s.id === id)!;
      for (const key of KEYS) {
        const plan = { ...PLAN, key, music: buildMusic({ key, track: skill.track === 'theory' ? 'rhythm' : skill.track, style: null, element: null }) };
        const ctx = slotContext(plan, { target: targetFor(skill), patternId: r.patterns?.[0] ?? null, grid: r.grid ?? null, gridName: r.gridName ?? null });
        expect(() => renderSteps(r.steps, ctx), `${id} in ${key}`).not.toThrow();
      }
      if (r.grid) expect(() => rhythmPattern(r.gridName ?? id, r.grid!.split(''))).not.toThrow();
      expect(r.listenFor.length, id).toBeGreaterThan(0);
    }
  });
  it('falls back to a generic recipe built from the description', () => {
    const s = SKILLS.find(x => !RECIPES[x.id] && x.track !== 'theory');
    if (!s) return; // every recipe written (Task 14 turns this into a hard requirement)
    const r = recipeFor(s);
    expect(r.card).toBe('none');
    expect(r.steps[0]).toBe(s.description);
  });
});
```

Also update the other tests:
- `tests/engine/patterns.test.ts`: remove `SKILL_PATTERNS` from the import, and delete the test `'maps every fingerstyle skill to known patterns'`. The recipes test covers it.
- `tests/app/skillInfo.test.ts`: keep its expectations. The Giuliani patterns stay `['giuliani_pim','giuliani_pmi','giuliani_pimi','giuliani_pima']`.

- [ ] **Step 2: Run** `npx vitest run tests/engine/recipes.test.ts`. Expect FAIL: module not found.

- [ ] **Step 3: Implement** `recipes.ts` with the 10 fingerstyle recipes. The content is condensed from `SKILL_GUIDES` (`skillGuides.ts`), and the patterns are the old `SKILL_PATTERNS` order. **p-i-m-a and pinches lists `pinch` first**, because the skill is named for it (spec §1).

```ts
import type { Skill } from './types.ts';

export type Card = 'pattern' | 'rhythm' | 'note_caller' | 'scale' | 'triads' | 'chords' | 'none';
export interface SkillRecipe {
  card: Card; patterns?: string[]; grid?: string; gridName?: string; degrees?: number[];
  steps: string[]; listenFor: string;
}

const LADDER = 'Start at {start_bpm} bpm. Add 5 bpm after each clean pass, up to {target_bpm}; drop back 5 after two misses in a row.';
const THROUGH = 'Once it is even, keep it going through {chords}, one chord per bar. The card shows each change.';

/** What the learner is told to do for each practice skill (spec §4). Slots: engine/render.ts. */
export const RECIPES: Record<string, SkillRecipe> = {
  'fingerstyle.l1.pima_pinches': {
    card: 'pattern', patterns: ['pinch', 'giuliani_pima'],
    steps: [
      'Fret {chord1}. Rest your thumb on string {root_string} (the root) and your index, middle and ring fingers on the top three strings.',
      'A pinch is the thumb and a finger plucking at the same instant. Play {pattern_name}: {pattern_counts}.',
      THROUGH, LADDER,
    ],
    listenFor: 'Both notes of each pinch landing as one sound, and every string at the same volume.',
  },
  'fingerstyle.l1.giuliani_arpeggios': {
    card: 'pattern', patterns: ['giuliani_pim', 'giuliani_pmi', 'giuliani_pimi', 'giuliani_pima'],
    steps: [
      'Fret {chord1}. Thumb on string {root_string} (the root); index, middle and ring on the top three strings.',
      'Play {pattern_name}: {pattern_counts}.', THROUGH, LADDER,
    ],
    listenFor: 'Even volume across the fingers, and the bass note ringing under the treble.',
  },
  'fingerstyle.l2.thumb_single_bass': {
    card: 'pattern', patterns: ['thumb_steady'],
    steps: [
      'Fret {chord1}. Your thumb plays string {root_string} (the root) once on every beat; the fingers stay still on the top strings.',
      'Rest the edge of your picking hand lightly on the strings by the bridge so the bass thuds a little.',
      'Count out loud while it runs: {pattern_counts}. The thumb must not drift.', THROUGH, LADDER,
    ],
    listenFor: 'Identical spacing and volume on every beat.',
  },
  'fingerstyle.l2.alternating_thumb': {
    card: 'pattern', patterns: ['thumb_alt'],
    steps: [
      'Fret {chord1}. The thumb alternates: the root on string {root_string}, then the alternate bass string the card shows.',
      'Play {pattern_name}: {pattern_counts}. Fingers stay off for now.', THROUGH, LADDER,
    ],
    listenFor: 'A steady boom-boom bass with no gap when the thumb changes string.',
  },
  'fingerstyle.l3.travis_basic': {
    card: 'pattern', patterns: ['thumb_alt', 'travis'],
    steps: [
      'Get {pattern_name} automatic on {chord1} first: {pattern_counts}.',
      'Then switch the card to Travis and add the fingers between the thumb notes, keeping the thumb exactly as it was.',
      THROUGH, LADDER,
    ],
    listenFor: 'The thumb never waiting for the fingers; the treble notes falling between the bass notes.',
  },
  'fingerstyle.l3.travis_changes': {
    card: 'pattern', patterns: ['travis'],
    steps: [
      'Play {pattern_name} on {chord1}: {pattern_counts}.',
      'Before you start the loop, look at where the root and alternate bass sit on each chord of {chords}.',
      'Play through {chords}, one chord per bar. Change the fretting hand a beat early if you need to; the thumb keeps time.', LADDER,
    ],
    listenFor: 'An unbroken bass line across every chord change.',
  },
  'fingerstyle.l4.accompaniment_patterns': {
    card: 'pattern', patterns: ['ballad', 'waltz', 'travis'],
    steps: [
      'Play {pattern_name} over {chords}, one chord per bar: {pattern_counts}.',
      'Switch the card to each of the other patterns and play the same chords with it.',
      'Keep the thumb on the root of each chord whatever the fingers do.', LADDER,
    ],
    listenFor: 'Each pattern keeping its own feel at the same tempo.',
  },
  'fingerstyle.l4.sing_over_pattern': {
    card: 'pattern', patterns: ['thumb_alt', 'ballad', 'travis'],
    steps: [
      'Run {pattern_name} through {chords}, one chord per bar, until you stop thinking about it.',
      'Hum one steady note over it for a full pass.', 'Now speak any line of words in rhythm over it.',
      'Now sing the line. If the hands stumble, go back to humming.',
    ],
    listenFor: 'The picking staying identical when the voice comes in.',
  },
  'fingerstyle.l5.melody_over_thumb': {
    card: 'pattern', patterns: ['thumb_steady', 'thumb_alt'],
    steps: [
      'Run {pattern_name} on {chord1}: {pattern_counts}.',
      'With a free finger, pick {degrees:1,3,5} one at a time on the top strings, on the beat, while the thumb carries on.',
      'Then move those notes between the beats. Stay on {chord1} until the bass never stops.', LADDER,
    ],
    listenFor: 'The bass carrying on untouched under every melody note.',
  },
  'fingerstyle.l5.arrange_own_song': {
    card: 'pattern', patterns: ['travis', 'ballad'],
    steps: [
      'Pick one of your songs and the pattern on the card that suits its feel.',
      'For each chord, find the root the thumb will play. Practise the changes with {chords} first.',
      'Play the whole song with the pattern, then record a full take with the app\'s recorder.',
    ],
    listenFor: 'The guitar supporting the voice, never competing with it.',
  },
};

/** The skill's recipe, or a generic one from its description until the recipe is written. */
export function recipeFor(skill: Skill): SkillRecipe {
  return RECIPES[skill.id] ?? {
    card: 'none',
    steps: [skill.description, skill.pass_metric === 'bpm' ? LADDER : 'Work through it slowly, then rate yourself honestly.'],
    listenFor: 'Clean, even time.',
  };
}
```

In `render.ts`:
- add `gridName?: string | null` to the `opts` type;
- use `rhythmPattern(opts.gridName ?? "Today's rhythm", opts.grid.split(''))`.

In `patterns.ts`:
- delete the `SKILL_PATTERNS` export and its doc comment.

In `src/lib/skillInfo.ts`:
- replace the `SKILL_PATTERNS` import with `import { RECIPES } from '../../supabase/functions/_shared/engine/recipes.ts';`;
- set `patterns: (RECIPES[id]?.patterns ?? []).map(p => PATTERNS[p])`.

In `supabase/functions/_shared/lesson/prompt.ts`:
- change the import to `PATTERNS, rhythmCounts, rhythmPattern` plus `RECIPES` from `../engine/recipes.ts`;
- set `picking_pattern: plan.skill_id ? PATTERNS[RECIPES[plan.skill_id]?.patterns?.[0] ?? '']?.name ?? null : null`. This is temporary; Task 7 rewrites the brief. Update `tests/lesson/prompt.test.ts`'s Giuliani expectation only if it changes (it stays `'p-i-m'`).

- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expect all tests to PASS and the typecheck to be clean.

- [ ] **Step 5: Commit.**

```bash
git add supabase/functions/_shared/engine/recipes.ts supabase/functions/_shared/engine/patterns.ts supabase/functions/_shared/engine/render.ts supabase/functions/_shared/lesson/prompt.ts src/lib/skillInfo.ts tests
git commit -m "feat(engine): skill recipes with the 10 fingerstyle recipes; patterns move into recipes"
```

---

### Task 4: The Create library

**Files:**
- Create: `supabase/functions/_shared/engine/create.ts`
- Test: `tests/engine/create.test.ts`

**Interfaces:**
- Consumes: `renderSteps`, `slotContext`.
- Produces:
  - `interface CreateTask { id: string; prompt: string; steps: string[]; songwriting?: string[] }`
  - `CREATE_TASKS: CreateTask[]`
  - `pickCreateTask(date: string, skillId: string, recent: (string | null)[]): string`, where `recent` is the newest-first `create_task_id`s of earlier lessons.

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, expect, it } from 'vitest';
import { CREATE_TASKS, pickCreateTask } from '../../supabase/functions/_shared/engine/create.ts';
import { renderSteps, slotContext } from '../../supabase/functions/_shared/engine/render.ts';
import { PLAN } from '../lesson/fixtures.ts';

describe('Create library', () => {
  it('renders every task for the fixture plan', () => {
    const ctx = slotContext(PLAN, {});
    for (const t of CREATE_TASKS) expect(() => renderSteps([t.prompt, ...t.steps], ctx), t.id).not.toThrow();
  });
  it('says what the hands and the voice do in every task', () => {
    for (const t of CREATE_TASKS) expect(t.steps.join(' '), t.id).toMatch(/sing|say/i);
  });
  it('never repeats any of the last three tasks', () => {
    const recent = ['melody_135', 'question_answer', 'rhyming_couplet'];
    for (const d of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']) {
      expect(recent).not.toContain(pickCreateTask(d, 'rhythm.l1.locked_8ths', recent));
    }
  });
  it('picks a task that uses the day\'s songwriting skill', () => {
    expect(pickCreateTask('2026-10-01', 'songwriting.l2.melody_skeleton', [])).toBe('question_answer');
  });
  it('rotates by date', () => {
    const picks = new Set(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].map(d => pickCreateTask(d, 'x', [])));
    expect(picks.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run tests/engine/create.test.ts`. Expect FAIL: module not found.

- [ ] **Step 3: Implement** `create.ts`:

```ts
export interface CreateTask { id: string; prompt: string; steps: string[]; songwriting?: string[] }

const RECORD = 'Record it with the app\'s recorder and listen back once.';

/** Songwriting micro-tasks for the Create block (spec §6); same slots as recipes. */
export const CREATE_TASKS: CreateTask[] = [
  {
    id: 'melody_135', songwriting: ['songwriting.l1.core_loops'],
    prompt: 'Make up a four-bar tune using only {degrees:1,3,5} while you play {chords}, one bar each.',
    steps: [
      'A four-bar tune is a short melody that lasts four bars: one bar per chord, four beats per bar.',
      'Find it first: pick {degrees:1,3,5} one note at a time on the top strings until you like the order. The fretboard shows them as 1, 3 and 5.',
      'Now play {chords} with the day\'s rhythm and sing (or hum) the tune over it, one bar per chord.', RECORD,
    ],
  },
  {
    id: 'question_answer', songwriting: ['songwriting.l2.melody_skeleton', 'songwriting.l2.section_contrast'],
    prompt: 'Sing a two-bar question that ends on {degrees:5}, then a two-bar answer that ends on {degrees:1}, over {chords}.',
    steps: [
      'Play {chords}, one bar per chord.',
      'Over the first two bars, sing a short phrase that ends on {degrees:5}. It sounds unfinished, like a question.',
      'Over the last two bars, sing a phrase that ends on {degrees:1}. It sounds like home, the answer.', RECORD,
    ],
  },
  {
    id: 'rhyming_couplet', songwriting: ['songwriting.l1.object_writing'],
    prompt: 'Write two rhyming lines about something in the room and sing them on {degrees:1} and {degrees:5} over {chords}.',
    steps: [
      'Look around and pick one object. Write two short lines about it that rhyme.',
      'Play {chords}, one bar per chord, and say the lines in time with the strum.',
      'Now sing them: the first line on {degrees:1}, the second on {degrees:5}.', RECORD,
    ],
  },
  {
    id: 'new_feel', songwriting: ['songwriting.l5.style_transplant'],
    prompt: 'Keep {chords} and change one thing about the rhythm.',
    steps: [
      'Play {chords} with the day\'s rhythm, one bar per chord.',
      'Change exactly one thing: move the bass note to a different beat, or leave one strum out.',
      'Hum or sing any line over the new feel and notice what changed in the mood.', RECORD,
    ],
  },
  {
    id: 'one_note_verse', songwriting: ['songwriting.l3.prechorus_tension'],
    prompt: 'Sing a line on one note, {degrees:1}, over {chords} and let the chords do the moving.',
    steps: [
      'Play {chords}, one bar per chord.',
      'Sing or speak any line of words, keeping every syllable on {degrees:1}.',
      'Listen to how the same note feels different over each chord.', RECORD,
    ],
  },
];

/** Today's Create task: one using today's songwriting skill if any, else rotate by date, never one of the last three. */
export function pickCreateTask(date: string, skillId: string, recent: (string | null)[]): string {
  const last3 = new Set(recent.slice(0, 3));
  const forSkill = CREATE_TASKS.find(t => t.songwriting?.includes(skillId) && !last3.has(t.id));
  if (forSkill) return forSkill.id;
  const pool = CREATE_TASKS.filter(t => !last3.has(t.id));
  const day = Math.floor(Date.parse(date) / 86_400_000);
  return (pool.length ? pool : CREATE_TASKS)[day % (pool.length || CREATE_TASKS.length)].id;
}
```

- [ ] **Step 4: Run** the test. Expect PASS.

- [ ] **Step 5: Commit.**

```bash
git add supabase/functions/_shared/engine/create.ts tests/engine/create.test.ts
git commit -m "feat(engine): Create library with rotation"
```

---

### Task 5: The planner picks `pattern_id` and `create_task_id`

**Files:**
- Modify: `supabase/functions/_shared/engine/types.ts`, `supabase/functions/_shared/engine/planner.ts`, `supabase/functions/_shared/lesson/state.ts`
- Test: `tests/engine/planner.test.ts`, `tests/lesson/state.test.ts`

**Interfaces:**
- Consumes: `RECIPES` (Task 3), `pickCreateTask` (Task 4).
- Produces:
  - `LessonPlan.pattern_id: string | null` and `LessonPlan.create_task_id: string`;
  - `LessonSummary.create_task_id: string | null`;
  - `LessonRowLite.plan` gains `create_task_id?: string | null`.

- [ ] **Step 1: Write the failing tests.** Append to `tests/engine/planner.test.ts` (it already imports `planLesson` and fixtures; reuse its state builder or `newUserState` from `tests/lesson/fixtures.ts`):

```ts
describe('pattern and create task', () => {
  const pinch = 'fingerstyle.l1.pima_pinches';
  const seen = (n: number) => Array.from({ length: n }, (_, i) => ({
    date: `2026-10-0${i + 1}`, track: 'fingerstyle' as const, skill_id: pinch, key: 'G', style_element: null,
    want_more_time: null, status: 'completed' as const, create_task_id: null,
  }));
  const planFor = (n: number) => {
    const skills = SKILLS.filter(s => s.id === pinch);
    return planLesson(newUserState({ today: '2026-10-09', skills, recentLessons: seen(n) }), NO_STYLES);
  };
  it('starts on the first pattern and rotates each time the skill comes back', () => {
    expect(planFor(0).pattern_id).toBe('pinch');
    expect(planFor(1).pattern_id).toBe('giuliani_pima');
    expect(planFor(2).pattern_id).toBe('pinch');
  });
  it('has no pattern for a skill without a pattern card', () => {
    expect(planLesson(newUserState(), NO_STYLES).pattern_id).toBeNull();
  });
  it('always picks a known Create task', () => {
    expect(CREATE_TASKS.map(t => t.id)).toContain(planLesson(newUserState(), NO_STYLES).create_task_id);
  });
});
```

Add the imports if missing: `SKILLS` from `supabase/seed/curriculum.ts`, `CREATE_TASKS` from `engine/create.ts`, and `newUserState, NO_STYLES` from `../lesson/fixtures.ts`.

If `planLesson` with a one-skill `skills` array fails because the planner needs other tracks, give `skills: SKILLS` and set `progress` so fingerstyle is the only unfinished track. Read `pickTrack` (planner.ts:41) and pick the simplest state that forces `pinch`. The rotation expectation stays the same.

In `tests/lesson/state.test.ts`, extend an existing `toPlannerState` case: a row whose `plan` is `{ style_element: null, create_task_id: 'rhyming_couplet' }` gives `recentLessons[0].create_task_id === 'rhyming_couplet'`, and a row with `plan: null` gives `null`.

- [ ] **Step 2: Run** `npx vitest run tests/engine/planner.test.ts tests/lesson/state.test.ts`. Expect FAIL on `pattern_id`/`create_task_id` being undefined.

- [ ] **Step 3: Implement.**

`types.ts`:
- `LessonSummary` gains `create_task_id: string | null;`
- `LessonPlan` gains `pattern_id: string | null; create_task_id: string;`

`planner.ts`: add the imports `RECIPES` (`./recipes.ts`) and `pickCreateTask` (`./create.ts`). In `planLesson`, before `return`:

```ts
  const patterns = RECIPES[skill.id]?.card === 'pattern' ? RECIPES[skill.id].patterns ?? [] : [];
  const timesSeen = state.recentLessons.filter(l => l.skill_id === skill.id).length;
  const pattern_id = patterns.length ? patterns[timesSeen % patterns.length] : null;
  const create_task_id = pickCreateTask(state.today, skill.id, state.recentLessons.map(l => l.create_task_id));
```

and add `pattern_id, create_task_id,` to the returned object.

`state.ts`:
- `LessonRowLite.plan` type: `{ style_element?: StyleChoice | null; create_task_id?: string | null } | null`;
- in `toPlannerState`'s map, add `create_task_id: l.plan?.create_task_id ?? null`.

Fix any other `LessonSummary` literals the typecheck flags (tests/fixtures) by adding `create_task_id: null`.

- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expect PASS and clean.

- [ ] **Step 5: Commit.**

```bash
git add supabase/functions/_shared tests
git commit -m "feat(engine): planner picks today's picking pattern and Create task"
```

---

### Task 6: `buildSteps`, engine-written block content

**Files:**
- Create: `supabase/functions/_shared/lesson/steps.ts`
- Modify: `supabase/functions/_shared/lesson/fallback.ts` (re-export `targetText`)
- Test: `tests/lesson/steps.test.ts`

**Interfaces:**
- Consumes: `recipeFor` (Task 3), `CREATE_TASKS` (Task 4), `renderSteps`/`slotContext` (Task 2), `targetText` (fallback.ts), `STYLE_CATALOG`, `LessonPlan` with `pattern_id`/`create_task_id` (Task 5).
- Produces:

```ts
export interface EngineBlock { kind: BlockKind; instructions: string[]; target_text: string; listen_for: string }
export const APPLY_DEFAULT_GRID = 'D---D---D---D---';  // steady down-strums, quarter notes
export function buildSteps(plan: LessonPlan, skills: Map<string, Skill>): { blocks: EngineBlock[]; create_prompt: string };
```

- [ ] **Step 1: Write the failing test.** Create `tests/lesson/steps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import { STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';
import { APPLY_DEFAULT_GRID, buildSteps } from '../../supabase/functions/_shared/lesson/steps.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';
import { NO_STYLES, PLAN, SKILL_MAP, newUserState } from './fixtures.ts';

describe('buildSteps', () => {
  it('writes one block per plan block, same kinds, every block with at least one step', () => {
    const { blocks } = buildSteps(PLAN, SKILL_MAP);
    expect(blocks.map(b => b.kind)).toEqual(PLAN.blocks.map(b => b.kind));
    for (const b of blocks) expect(b.instructions.length, b.kind).toBeGreaterThan(0);
  });
  it('writes Apply from the rhythm counts and the chords', () => {
    const plan = planLesson(newUserState(), STYLE_CATALOG);
    const apply = buildSteps(plan, SKILL_MAP).blocks.find(b => b.kind === 'apply')!;
    expect(apply.instructions[0]).toContain(plan.music.rhythm!.name);
    expect(apply.instructions.join(' ')).toContain(`{${plan.music.progression.chords[0]}}`);
  });
  it('falls back to steady down-strums on Apply when the day has no style rhythm', () => {
    const noRhythm = { ...PLAN, music: { ...PLAN.music, rhythm: null } };
    const apply = buildSteps(noRhythm, SKILL_MAP).blocks.find(b => b.kind === 'apply')!;
    expect(apply.instructions[0]).toBe('Steady down-strums: 1 strum down · 2 strum down · 3 strum down · 4 strum down');
    expect(APPLY_DEFAULT_GRID).toBe('D---D---D---D---');
  });
  it('describes today\'s pattern on new_skill and the skill\'s first pattern on a retest', () => {
    const pinch = SKILLS.find(s => s.id === 'fingerstyle.l1.pima_pinches')!;
    const plan = {
      ...PLAN, skill_id: pinch.id, pattern_id: 'giuliani_pima',
      retest: { skill_id: pinch.id, target: { metric: 'bpm' as const, start: 39, target: 60 } },
      blocks: [
        { kind: 'retest' as const, minutes: 2, items: [{ ref: `skill:${pinch.id}`, target: { metric: 'bpm' as const, start: 39, target: 60 } }] },
        { kind: 'new_skill' as const, minutes: 10, items: [{ ref: `skill:${pinch.id}`, target: { metric: 'bpm' as const, start: 39, target: 60 } }] },
      ],
    };
    const [retest, newSkill] = buildSteps(plan, SKILL_MAP).blocks;
    expect(newSkill.instructions.join(' ')).toContain('p-i-m-a');
    expect(retest.instructions.join(' ')).toContain('Pinch and pluck');
    expect(newSkill.listen_for).toMatch(/pinch/);
  });
  it('uses the planned Create task for the Create block and create_prompt', () => {
    const { blocks, create_prompt } = buildSteps({ ...PLAN, create_task_id: 'rhyming_couplet' }, SKILL_MAP);
    expect(create_prompt).toMatch(/rhyming lines/);
    expect(blocks.find(b => b.kind === 'create')!.instructions[0]).toMatch(/pick one object/);
  });
  it('builds for every non-theory skill as today\'s skill without throwing', () => {
    for (const s of SKILLS.filter(x => x.track !== 'theory')) {
      const plan = planLesson(newUserState({ skills: [s, ...SKILLS.filter(x => x.track === 'theory')] }), NO_STYLES);
      expect(() => buildSteps({ ...plan, skill_id: s.id }, SKILL_MAP), s.id).not.toThrow();
    }
  });
});
```

If `planLesson` cannot run with a single practice skill, build the plan with `planLesson(newUserState(), NO_STYLES)` and override `skill_id`, `pattern_id` (`recipeFor(s).patterns?.[0] ?? null`) and the `new_skill` block's item ref and target (`targetFor(s)`). The assertion stays the same.

- [ ] **Step 2: Run** `npx vitest run tests/lesson/steps.test.ts`. Expect FAIL: module not found.

- [ ] **Step 3: Implement** `steps.ts`:

```ts
import { CREATE_TASKS } from '../engine/create.ts';
import { recipeFor } from '../engine/recipes.ts';
import { renderSteps, slotContext } from '../engine/render.ts';
import { STYLE_CATALOG } from '../engine/styles.ts';
import type { BlockKind, LessonPlan, PlanBlock, Skill } from '../engine/types.ts';
import type { Target } from '../engine/types.ts';

/** A plan target as plain words (moved here from fallback.ts, which re-exports it). */
export function targetText(t: Target | null): string {
  if (!t) return '';
  if (t.metric === 'bpm' && t.target !== null) return `Start at ${t.start} bpm, reach ${t.target} bpm cleanly.`;
  if (t.metric === 'clean_reps' && t.target !== null) return `${t.target} clean reps in a row.`;
  return 'Rate yourself honestly, 1–5.';
}

export interface EngineBlock { kind: BlockKind; instructions: string[]; target_text: string; listen_for: string }
export const APPLY_DEFAULT_GRID = 'D---D---D---D---';
const RESETS = [
  'Put the guitar down for 30 seconds and shake out both hands.',
  'Put the guitar down. Close your eyes and picture the shape you just played.',
  'Put the guitar down for 30 seconds and breathe out slowly twice.',
  'Put the guitar down and hum the last thing you played.',
];

/** Every instruction the learner reads, from the plan: recipes, block templates and the Create library (spec §5). */
export function buildSteps(plan: LessonPlan, skills: Map<string, Skill>): { blocks: EngineBlock[]; create_prompt: string } {
  const day = Math.floor(Date.parse(plan.date) / 86_400_000);
  const skillOf = (id: string) => skills.get(id);
  const task = CREATE_TASKS.find(t => t.id === plan.create_task_id) ?? CREATE_TASKS[0];
  const base = slotContext(plan, {});

  const recipeSteps = (skillId: string, b: PlanBlock, today: boolean) => {
    const skill = skillOf(skillId);
    if (!skill) return { steps: [`Practise ${skillId}.`], listen: '' };
    const r = recipeFor(skill);
    const patternId = r.card === 'pattern' ? (today ? plan.pattern_id : r.patterns?.[0]) ?? null : null;
    const ctx = slotContext(plan, { target: b.items[0]?.target ?? null, patternId, grid: r.grid ?? null, gridName: r.gridName ?? null });
    return { steps: renderSteps(r.steps, ctx), listen: r.listenFor };
  };

  const build = (b: PlanBlock): EngineBlock => {
    const target_text = targetText(b.items[0]?.target ?? null);
    const make = (instructions: string[], listen_for = ''): EngineBlock => ({ kind: b.kind, instructions, target_text, listen_for });
    switch (b.kind) {
      case 'warmup': return make(renderSteps([
        'Hum or lip-trill for 30 seconds to wake your voice up.',
        'Play {key} {scale} in the position shown, saying each note\'s number (1 is {degrees:1}) as you play it.',
        'Play it again, singing each note.',
      ], base));
      case 'new_skill': {
        const r = recipeSteps(plan.skill_id, b, true);
        return make(r.steps, r.listen);
      }
      case 'retest': {
        const id = plan.retest?.skill_id ?? plan.skill_id;
        const r = recipeSteps(id, b, false);
        return make([`Cold retest: ${skillOf(id)?.name ?? id}. One attempt at the target, no practice run first.`, ...r.steps.slice(0, 2)], r.listen); // first two steps: set-up plus the pattern/rhythm line
      }
      case 'review': return make(b.items.map(i => {
        const [type, ref] = [i.ref.slice(0, i.ref.indexOf(':')), i.ref.slice(i.ref.indexOf(':') + 1)];
        if (type === 'style') return renderSteps([`${STYLE_CATALOG.elements.find(e => e.id === ref)?.name ?? ref}: play it once through {chords}.`], base)[0];
        if (type === 'skill' && skillOf(ref)) return `${skillOf(ref)!.name}: ${recipeSteps(ref, { ...b, items: [i] }, false).steps[0]}`;
        return `Review: ${skillOf(ref)?.name ?? ref}.`;
      }));
      case 'apply': {
        const ctx = plan.music.rhythm ? base : slotContext(plan, { grid: APPLY_DEFAULT_GRID, gridName: 'Steady down-strums' });
        return make(renderSteps([
          '{rhythm_name}: {rhythm_counts}',
          'Play it on {chord1} until it is steady, then through {chords}, one chord per bar.',
          'Keep the picking hand going and hum or sing any tune over it.',
        ], ctx));
      }
      case 'create': return make(renderSteps(task.steps, base));
      case 'record': return make([
        'Record one take of the Apply groove with your singing, using the recorder below.',
        'Listen back once, all the way through.',
        'Rate it 1–5 and note one thing to fix tomorrow.',
      ]);
      case 'reset': return make([RESETS[day % RESETS.length]]);
    }
  };
  return { blocks: plan.blocks.map(build), create_prompt: renderSteps([task.prompt], base)[0] };
}
```

In `fallback.ts`, replace the `targetText` function with `export { targetText } from './steps.ts';`. `steps.ts` must not import from `fallback.ts`, so Task 7 can import `buildSteps` into `fallback.ts` without a cycle.

- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expect PASS. If the no-rhythm case gives `'Steady down-strums: 1 strum down · 2 strum down · 3 strum down · 4 strum down'`, the fallback path is right.

- [ ] **Step 5: Commit.**

```bash
git add supabase/functions/_shared/lesson/steps.ts tests/lesson/steps.test.ts
git commit -m "feat(lesson): buildSteps writes every block's instructions from recipes, templates and the Create library"
```

---

### Task 7: The LLM writes colour only (contract, prompt, generate, fallback, service)

**Files:**
- Modify: `supabase/functions/_shared/lesson/contract.ts`, `prompt.ts`, `generate.ts`, `fallback.ts`, `service.ts`
- Test: `tests/lesson/contract.test.ts`, `prompt.test.ts`, `generate.test.ts`, `fallback.test.ts`, `tests/lesson/fixtures.ts`, and `tests/db/generate-lesson.test.ts` (shape only)

**Interfaces:**
- Consumes: `buildSteps` (Task 6).
- Produces:

```ts
// contract.ts
export interface BlockContent { kind: BlockKind; instructions: string[]; target_text: string; listen_for: string; more: string; tips?: string; explanation?: string }
export interface LessonContent { title; why_it_matters; theory_card; songs: Song[]; create_prompt: string; blocks: BlockContent[]; fallback?: true }
export interface Colour { title: string; why_it_matters: string; theory_card: string; songs: Song[]; blocks: { kind: BlockKind; more: string }[] }
export const COLOUR_JSON_SCHEMA; // strict schema for Colour
export function validateColour(raw: unknown, plan: LessonPlan, skills: Map<string, Skill>, ctx: { metSkills: string[]; stepsText: string }, opts?: { minSongs?: number }): { ok: true; colour: Colour } | { ok: false; errors: string[] };
// fallback.ts
export function fallbackColour(plan: LessonPlan, skills: Map<string, Skill>): Colour;
export function assembleLesson(plan: LessonPlan, skills: Map<string, Skill>, colour: Colour, fallback?: boolean): LessonContent;
// prompt.ts
export interface PromptInput { plan; skills; style; settings; recent; questions; metSkills: string[] }
// generate.ts
export async function writeLesson(messages, plan, skills, complete, models, metSkills: string[]): Promise<Written>; // content is assembled
```

`validateLesson` is replaced by `validateColour`, and `LESSON_JSON_SCHEMA` by `COLOUR_JSON_SCHEMA`. Delete the old ones and fix their imports; `scripts/compare-models.ts` is the known other caller, so update it to the new names.

- [ ] **Step 1: Write the failing tests.**

In `tests/lesson/fixtures.ts`, replace `validContent` with:

```ts
/** Minimal colour that passes validateColour for `plan`. */
export function validColour(plan: LessonPlan = PLAN): Colour {
  return {
    title: `Accents in ${plan.key}`, why_it_matters: 'Accents make a strum sound like a song.', theory_card: 'Keys relate by fifths.',
    songs: [1, 2, 3].map(i => ({ title: `Song ${i}`, artist: 'Artist', why: 'Steady strumming.', capo: 0 })),
    blocks: plan.blocks.map(b => ({ kind: b.kind, more: `Why the ${b.kind} block matters.` })),
  };
}
export const MET = { metSkills: [] as string[], stepsText: '' };
```

In `tests/lesson/contract.test.ts`:
- replace every `validateLesson(x, PLAN, SKILL_MAP)` with `validateColour(x, PLAN, SKILL_MAP, MET)`, and `validContent()` with `validColour()`;
- in the chord tests, put the text under test in `blocks[0].more` instead of `instructions`;
- delete the assertions about `instructions`/`tips`/`explanation`/`create_prompt` being required;
- add:

```ts
describe('validateColour rules', () => {
  const withMore = (more: string) => ({ ...validColour(), blocks: validColour().blocks.map((b, i) => (i === 0 ? { ...b, more } : b)) });
  it('rejects a tempo or rep count', () => {
    expect(validateColour(withMore('Push to 90 bpm.'), PLAN, SKILL_MAP, MET)).toMatchObject({ ok: false });
    expect(validateColour(withMore('Do 5 clean reps.'), PLAN, SKILL_MAP, MET)).toMatchObject({ ok: false });
    expect(validateColour(withMore('Four bars per chord.'), PLAN, SKILL_MAP, MET)).toMatchObject({ ok: true });
  });
  it('rejects a more over 400 characters', () => {
    expect(validateColour(withMore('x'.repeat(401)), PLAN, SKILL_MAP, MET)).toMatchObject({ ok: false });
  });
  it('rejects naming a curriculum skill the learner has not met', () => {
    expect(validateColour(withMore('Next you will learn Travis picking.'), PLAN, SKILL_MAP, MET)).toMatchObject({ ok: false });
    expect(validateColour(withMore('Like your Travis picking.'), PLAN, SKILL_MAP, { ...MET, metSkills: ['fingerstyle.l3.travis_basic'] })).toMatchObject({ ok: true });
  });
  it('allows a skill name that the engine steps already use (Review Focus 1)', () => {
    expect(validateColour(withMore('Ghost strums keep the hand moving.'), PLAN, SKILL_MAP, { ...MET, stepsText: '2 muted strum down · ghost strums' })).toMatchObject({ ok: true });
  });
  it('allows today\'s skill name', () => {
    const today = SKILL_MAP.get(PLAN.skill_id)!.name;
    expect(validateColour(withMore(`${today} is today.`), PLAN, SKILL_MAP, MET)).toMatchObject({ ok: true });
  });
});
```

In `tests/lesson/fallback.test.ts`:
- `fallbackLesson(plan, skills)` becomes `assembleLesson(plan, skills, fallbackColour(plan, skills), true)`;
- assert `blocks[i].instructions` equals `buildSteps(plan, skills).blocks[i].instructions`, every `more === ''`, and `fallback === true`;
- keep the "valid for every non-theory skill" loop, asserting `validateColour(fallbackColour(...), plan, skills, { metSkills: [], stepsText: '' }, { minSongs: 0 })` is ok.

In `tests/lesson/generate.test.ts`:
- the fake `complete` returns `JSON.stringify(validColour())`;
- `writeLesson(messages, PLAN, SKILL_MAP, complete, models, [])`;
- assert `result.content.blocks[0].instructions` equals `buildSteps(PLAN, SKILL_MAP).blocks[0].instructions`, and `result.content.blocks[0].more === validColour().blocks[0].more`;
- for the all-fail case, assert `content.fallback === true` and non-empty instructions.

In `tests/lesson/prompt.test.ts`:
- replace the rule assertions with:

```ts
    expect(SYSTEM_PROMPT).toMatch(/do not restate or contradict/);
    expect(SYSTEM_PROMPT).not.toMatch(/instructions: 2 to 5/);
    expect(SYSTEM_PROMPT).not.toMatch(/App tools:/);
```

- the brief gains `expect(brief.steps).toHaveLength(PLAN.blocks.length)` and `expect(brief.met_skills).toEqual([SKILL_MAP.get(PLAN.skill_id)!.name])`, with `buildMessages({ …, metSkills: [] })`;
- delete the `picking_pattern` and `NOTE_CALLER_SKILLS` assertions;
- set `PROMPT_VERSION` in the regex check to still match `gc-2026-10-01`.

- [ ] **Step 2: Run** `npm test`. Expect FAIL across `tests/lesson/*` (missing exports).

- [ ] **Step 3: Implement.**

**`contract.ts`:**
- Replace `BlockContent`/`LessonContent` with the interfaces above, and add `Colour`.
- `COLOUR_JSON_SCHEMA`: the same shape as the old schema without `create_prompt`, with `blocks.items` = `{ kind: enum, more: string }`, both required, and `additionalProperties: false`.
- `validateColour`:
  - keep the object/songs/fallback checks from `validateLesson`;
  - check that the block count and kinds match `plan.blocks`, that `more` is a string of at most 400 characters, and that `title`/`why_it_matters`/`theory_card` are non-empty;
  - chord checks: run the existing loop over `strings({ ...o, songs: undefined })`;
  - then add:

```ts
  const TEMPO = /\b\d+\s?bpm\b/i, REPS = /\b\d+\s+(?:clean\s+)?reps?\b/i;
  const allowedNames = new Set([plan.skill_id, plan.retest?.skill_id, ...ctx.metSkills].filter(Boolean).map(id => skills.get(id!)?.name.toLowerCase()).filter(Boolean));
  const steps = ctx.stepsText.toLowerCase();
  for (const text of strings({ ...o, songs: undefined })) {
    if (TEMPO.test(text)) errors.push(`tempo in text: ${text.match(TEMPO)![0]}`);
    if (REPS.test(text)) errors.push(`rep count in text: ${text.match(REPS)![0]}`);
    const lower = text.toLowerCase();
    for (const s of skills.values()) {
      const name = s.name.toLowerCase();
      if (s.track !== 'theory' && lower.includes(name) && !allowedNames.has(name) && !steps.includes(name)) errors.push(`unmet skill named: ${s.name}`);
    }
  }
```

**`fallback.ts`:**
- Keep `targetText`.
- `fallbackColour(plan, skills)`: the old `fallbackLesson` fields `title`/`why_it_matters`/`theory_card`/`songs`, plus `blocks: plan.blocks.map(b => ({ kind: b.kind, more: '' }))`.
- `assembleLesson`:

```ts
export function assembleLesson(plan: LessonPlan, skills: Map<string, Skill>, colour: Colour, fallback = false): LessonContent {
  const { blocks, create_prompt } = buildSteps(plan, skills);
  return {
    title: colour.title, why_it_matters: colour.why_it_matters, theory_card: colour.theory_card, songs: colour.songs, create_prompt,
    blocks: blocks.map((b, i) => ({ ...b, more: colour.blocks[i]?.more ?? '' })),
    ...(fallback ? { fallback: true as const } : {}),
  };
}
```

(`targetText` already lives in `steps.ts` since Task 6, so importing `buildSteps` into `fallback.ts` makes no cycle.)

**`prompt.ts`:** `PROMPT_VERSION = 'gc-2026-10-01'`. `SYSTEM_PROMPT` becomes:

```
You add colour to a daily guitar lesson. The learner is a beginner singer-songwriter who accompanies their own singing. The app's engine has already written every instruction the learner follows; they are in the brief as `steps` and are fixed: do not restate or contradict them, add steps, or give tempos or rep counts.

Return one JSON object that matches the response schema. No markdown fences, no text outside the JSON.

Rules:
1. blocks: exactly one entry per plan block, in the same order, with the same kind. `more` is 2 to 4 sentences, at most 400 characters: a common mistake and its fix, why this works, or a link to something the learner met before. "" for the reset block.
2. Chords: name only chords listed in allowed_chords, written in braces, e.g. {Am7}. Do not name chords in songs.
3. Skills: name only skills in met_skills or words already used in steps. Never mention fills, licks or techniques the learner has not met.
4. Plain words: explain any music term in the same sentence, in everyday words. Write progressions as chord names, never Roman numerals.
5. theory_card: 3 to 5 sentences on why today's material works, tied to theory_topic.
6. songs: exactly 3 real, well-known songs where today's skill or style element can be heard. capo is the fret from 0 to 12 that brings the song closest to today's key with open shapes. If unsure a song fits, choose another.
7. Address the learner as "you". Never refer to the learner as he or she.
8. Use recent_lessons and recent_questions only to avoid repeating yourself and to connect to what the learner has been asking about.
```

`buildMessages`: `PromptInput` gains `metSkills: string[]`. The brief:
- drops `picking_pattern`;
- keeps `music` (including `rhythm_counts`);
- gains:

```ts
    steps: buildSteps(plan, skills).blocks.map(b => ({ kind: b.kind, instructions: b.instructions, listen_for: b.listen_for })),
    met_skills: [...new Set([plan.skill_id, plan.retest?.skill_id, ...metSkills].filter(Boolean))].map(id => skills.get(id!)?.name ?? id!),
```

Remove the now-unused imports (`PATTERNS`, `RECIPES`).

**`generate.ts`:**
- `writeLesson(…, metSkills: string[] = [])`: compute `stepsText = buildSteps(plan, skills).blocks.flatMap(b => b.instructions).join(' ')` once;
- validate with `validateColour(parseJson(text), plan, skills, { metSkills, stepsText })`;
- on success, return `{ content: assembleLesson(plan, skills, v.colour), … }`;
- when all fail, return `assembleLesson(plan, skills, fallbackColour(plan, skills), true)`;
- use `COLOUR_JSON_SCHEMA`.

**`service.ts`:**
- `const metSkills = rows.progress.map(p => p.skill_id);`
- pass it to `buildMessages({ …, metSkills })` and `writeLesson(…, metSkills)`.

**`scripts/compare-models.ts`:** switch to `COLOUR_JSON_SCHEMA`/`validateColour` with `{ metSkills: [], stepsText }` and `assembleLesson`. Keep its report format.

- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expect PASS and clean. Then, with local Supabase running, run `npm run test:db` and expect PASS. If `tests/db/generate-lesson.test.ts` asserts `tips`/`explanation`, change it to `listen_for`/`more`.

- [ ] **Step 5: Commit.**

```bash
git add supabase/functions/_shared scripts/compare-models.ts tests
git commit -m "feat(lesson): LLM writes colour only; engine steps assembled into every lesson and the fallback"
```

---

### Task 8: The Player reads the recipe card, Listen for, and More about this

**Files:**
- Modify: `src/lib/lesson.ts`, `src/screens/Player.tsx`, `src/components/ScaleBoard.tsx`, `src/lib/noteCaller.ts`
- Create: `src/components/TriadBoard.tsx`
- Test: `tests/app/helpers.test.ts` (or a new `tests/app/blockText.test.ts`), `tests/app/noteCaller.test.ts`

**Interfaces:**
- Consumes: `recipeFor` (Task 3), `plan.pattern_id` (Task 5), `BlockContent` (Task 7), `plan.music.triads` (`TriadShape[]`, music.ts).
- Produces:
  - `blockText(content: LessonContent, i: number): { instructions: string[]; target_text: string; listen_for: string; more: string[] }`, where `more` is `[more]` for new lessons and `[tips, explanation]` (non-empty ones) for old lessons;
  - `ScaleBoard({ scale, highlight?: number[] })`;
  - `TriadBoard({ triads: TriadShape[] })`.

- [ ] **Step 1: Write the failing tests.** Create `tests/app/blockText.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { blockText } from '../../src/lib/lesson.ts';

const base = { title: 't', why_it_matters: 'w', theory_card: 'c', songs: [], create_prompt: 'p' };
describe('blockText', () => {
  it('reads new engine + colour content', () => {
    const c = { ...base, blocks: [{ kind: 'warmup' as const, instructions: ['a'], target_text: '', listen_for: 'l', more: 'm' }] };
    expect(blockText(c, 0)).toEqual({ instructions: ['a'], target_text: '', listen_for: 'l', more: ['m'] });
  });
  it('reads lessons stored before engine-written steps (tips/explanation, no listen_for) (Review Focus 3)', () => {
    const old = { ...base, blocks: [{ kind: 'warmup', instructions: ['a'], target_text: 'x', tips: 'tip', explanation: '' }] };
    expect(blockText(old as never, 0)).toEqual({ instructions: ['a'], target_text: 'x', listen_for: '', more: ['tip'] });
  });
  it('is safe on a missing block', () => {
    expect(blockText({ ...base, blocks: [] }, 3)).toEqual({ instructions: [''], target_text: '', listen_for: '', more: [] });
  });
});
```

In `tests/app/noteCaller.test.ts`:
- delete the `NOTE_CALLER_SKILLS` test and its import;
- add to `tests/engine/recipes.test.ts` (fretboard recipes come in Task 11) nothing yet. The note-caller card is asserted in Task 11.

- [ ] **Step 2: Run** `npx vitest run tests/app/blockText.test.ts`. Expect FAIL: `blockText` is not exported.

- [ ] **Step 3: Implement.**

`src/lib/lesson.ts`:

```ts
/** One block's text, reading both engine-written lessons and ones stored before them (tips/explanation). */
export function blockText(content: LessonContent, i: number): { instructions: string[]; target_text: string; listen_for: string; more: string[] } {
  const b = content.blocks[i] as (Partial<BlockContent> & { tips?: string; explanation?: string }) | undefined;
  if (!b) return { instructions: [''], target_text: '', listen_for: '', more: [] };
  const more = b.more !== undefined ? [b.more] : [b.tips ?? '', b.explanation ?? ''];
  return { instructions: b.instructions?.length ? b.instructions : [''], target_text: b.target_text ?? '', listen_for: b.listen_for ?? '', more: more.filter(Boolean) };
}
```

(Import `BlockContent`/`LessonContent` types from the contract.)

`src/components/ScaleBoard.tsx`:
- add `highlight?: number[]`;
- when it's set, dots whose `degree` isn't in `highlight` get `opacity={0.25}`;
- the caption adds "Bright dots: the notes to sing.".

`src/components/TriadBoard.tsx`: a card listing each `TriadShape` as a mini horizontal fretboard, using the same helpers and classes as `ScaleBoard` (`pk-string`, `cd-dot`, `cd-root`, `cd-label`):
- one row of dots per shape over its three `strings`;
- the label shows the `inversion` ("root position", "1st inversion", "2nd inversion");
- the root note dot is marigold, i.e. the string whose note equals the triad root.

Keep it under 60 lines. Base it on `ScaleBoard`'s SVG code, with frets from `min(frets)-1` to `max(frets)+1`.

`src/screens/Player.tsx`:
1. `const text = blockText(content, i);` replaces `content.blocks[i]`. `steps` = `text.instructions`, and `text?.target_text` becomes `text.target_text`.
2. The card comes from the recipe:

```ts
  const cardSkill = block.kind === 'retest' ? plan.retest?.skill_id : block.kind === 'new_skill' ? plan.skill_id : undefined;
  const recipe = cardSkill ? recipeFor(SKILLS_BY_ID.get(cardSkill)!) : undefined;   // SKILLS_BY_ID: new Map(SKILLS.map(s => [s.id, s])) at module scope
  const card = block.kind === 'apply' ? 'rhythm' : recipe?.card ?? 'none';
```

   Then:
   - **`pattern`:** the skill patterns come from `recipe.patterns`. The initial `pi` is the index of `plan.pattern_id` when `block.kind === 'new_skill'` (older plans without `pattern_id` use 0), and 0 for a retest.
   - **`rhythm`:**
     - on Apply, `rhythmPattern(rhythm.name, rhythm.grid)`, or `rhythmPattern('Steady down-strums', APPLY_DEFAULT_GRID.split(''))` when `plan.music.rhythm` is null (Review Focus 4);
     - on skill blocks, `rhythmPattern(recipe.gridName ?? 'Today\'s rhythm', recipe.grid.split(''))` when `recipe.grid` is set, else the day's rhythm.
   - **`note_caller`:** `<NoteCaller metro={metro} />` (replaces the `NOTE_CALLER_SKILLS` check).
   - **`scale`:** `<ScaleBoard scale={plan.music.scale} highlight={recipe?.degrees} />`.
   - **`triads`:** `<TriadBoard triads={plan.music.triads} />`.
   - **`chords`:** covered by `showChords`.
   - **`showChords`** = `block.kind === 'apply' || block.kind === 'create' || card === 'pattern' || card === 'rhythm' || card === 'chords'`.
   - Warmup and create keep their `ScaleBoard`; create keeps its `Recorder`; record keeps its `Recorder`.
3. Under the step card, when `text.listen_for` is set: `<p className="muted"><b>Listen for:</b> {text.listen_for}</p>`.
4. Replace the "Tips & why" `<details>` with `{text.more.length > 0 && (<details className="card"><summary>More about this</summary>{text.more.map(m => <p key={m}>{m}</p>)}</details>)}`.
5. The drone: on a `scale` card with `degrees` (ear & voice), show the Metronome's drone chip as it is today (`hasMetro` stays). No change is needed beyond the highlight.

`src/lib/noteCaller.ts`: delete `NOTE_CALLER_SKILLS`.

- [ ] **Step 4: Run** `npm test`, `npm run typecheck` and `npm run build`. Expect PASS, clean and built.

- [ ] **Step 5: Manual check (5 min).**
  1. Run `supabase start`, then `supabase functions serve`, then `npm run dev`.
  2. Delete today's lesson for `phase3@test.dev`: `docker exec -i supabase_db_musiclessons psql -U postgres -c "delete from lessons l using auth.users u where u.id=l.user_id and u.email='phase3@test.dev' and l.lesson_date=current_date"`.
  3. Sign in at http://127.0.0.1:5173 with the code from Mailpit (http://127.0.0.1:55324).
  4. On every block, check the steps against the card: pattern name, counts and chord changes; the rhythm's counts against its arrows; the Create steps against the tools shown.
  5. Open an old lesson from the local DB (any row with `tips`) by setting `gc.lesson` in localStorage to that row, and check it renders.

- [ ] **Step 6: Commit.**

```bash
git add src tests
git commit -m "feat(app): Player shows each block's recipe card, Listen for, and More about this; old lessons still render"
```

---

### Tasks 9–13: The remaining 51 recipes, one track per task

Each task has the **same structure**. Only the track, the card rules, the sources and the worked example change. A recipe is content: draft it from the sources, keep every step a single action, use slots for anything that depends on the day, and never name a technique the curriculum hasn't reached at that level.

**Recipe rules (all tracks):**
- 2–5 steps of 30 words or fewer each, in the imperative, in plain words. Explain any term in the same sentence.
- Name chords only through `{chord1}`/`{chords}`. Name notes only through `{degrees:…}`.
- End with `LADDER` for `bpm` skills. For `clean_reps` skills, end with `'Aim for {target_reps} clean passes in a row.'`. For `self` skills, end with a rate-yourself step.
- `listenFor`: one sentence, what good sounds like.
- `card` follows the spec §4.2 table.

**The steps of each task:**

- [ ] **Step 1: Write the failing test.** Append to `tests/engine/recipes.test.ts`:

```ts
  it('has a recipe for every <TRACK> skill with the right card', () => {
    for (const s of SKILLS.filter(x => x.track === '<TRACK>')) {
      expect(RECIPES[s.id], s.id).toBeDefined();
      expect(<ALLOWED_CARDS>, s.id).toContain(RECIPES[s.id].card);
    }
  });
```

- [ ] **Step 2: Run** `npx vitest run tests/engine/recipes.test.ts`. Expect FAIL, listing the missing ids.
- [ ] **Step 3: Write the recipes** into `RECIPES` in `recipes.ts`, grouped under a `// <Track>` comment, following the worked example.
- [ ] **Step 4: Run** `npm test`. Expect PASS; the render-in-every-key test covers the new recipes.
- [ ] **Step 5: Show Matt the track.** Run `node -e` or a small script that prints each recipe rendered for G major over `{G} {C} {G} {D}`, paste it into chat, and wait for "ok" or edits. **Do not commit before Matt's ok.**
- [ ] **Step 6: Commit** with `git commit -m "feat(engine): <track> recipes"`.

| Task | Track | `<ALLOWED_CARDS>` | Sources | Worked example |
|---|---|---|---|---|
| 9 | `rhythm` (10) | `['rhythm']` | curriculum descriptions; `Music_Lessons Vault/Research/guitar_methods/`, `…/styles/` | below |
| 10 | `ear_voice` (10) | `['scale']` (with `degrees`) | `…/Research/ear_voice_songwriting/` | below |
| 11 | `fretboard` (11) | `['note_caller','triads','scale']` | `…/Research/guitar_methods/` | below |
| 12 | `fills` (10) | `['chords']` | `…/Research/guitar_methods/`, `…/styles/` | below |
| 13 | `songwriting` (10) | `['chords','none']` | `…/Research/ear_voice_songwriting/` | below |

**Worked examples** (copy the shape):

```ts
  // Rhythm: a grid in style-grid tokens (B bass, P fingers, D/U strum, d/u muted ghost, x mute, - rest), 16 slots = one 4/4 bar in 16ths.
  'rhythm.l1.accents_palm_mute': {
    card: 'rhythm', grid: 'D-U-d-u-D-U-d-u-', gridName: 'Accents with palm mutes',
    steps: [
      'Palm muting: rest the edge of your picking hand on the strings right by the bridge, so they thud instead of ring.',
      'Strum on {chord1}: {rhythm_counts}. Lift the palm for the bright arrows; keep it down for the faded (muted) ones.',
      'Then through {chords}, one chord per bar.', LADDER,
    ],
    listenFor: 'Loud open strums and soft thuds, with the time never wavering.',
  },
  // Ear & voice: scale card, degrees highlighted; drone from the metronome card.
  'ear_voice.l1.sing_135': {
    card: 'scale', degrees: [1, 3, 5],
    steps: [
      'Turn on the drone. Play {degrees:1} on the guitar and sing it: that is 1, the home note.',
      'Sing up 1-3-5, that is {degrees:1,3,5}, then back down. Play each note first if you lose it.',
      'Now sing 5-4-3-2-1: {degrees:5,4,3,2,1}.', 'Rate yourself 1–5 on how close each note felt.',
    ],
    listenFor: 'Each sung note blending with the drone instead of wobbling against it.',
  },
  // Fretboard: note_caller for the two note skills; triads for the triad skills; scale for the rest.
  'fretboard.l1.notes_e_a': {
    card: 'note_caller',
    steps: [
      'Strings 6 and 5 are E and A when played open; each fret up is the next note (E, F, F#, G…).',
      'Press "Start calling notes". Find each called note on string 6 or 5 before the next bar.',
      'Say the note out loud as you play it.', 'Aim for {target_reps} clean passes in a row.',
    ],
    listenFor: 'Finding each note before the next click of beat 1.',
  },
  // Fills: chord panel; strings and frets named in words until a tab card exists (spec §8).
  'fills.l1.open_chord_pulloffs': {
    card: 'chords',
    steps: [
      'A pull-off: fret a note, then flick that finger off the string sideways so the open string below it sounds, without picking again.',
      'On {chord1}, pull off one fretted note to its open string on beat 4, then land back on the chord on beat 1.',
      'Go through {chords}, one pull-off at the end of each bar.', LADDER,
    ],
    listenFor: 'The pulled-off note as loud as a picked one, and beat 1 landing on time.',
  },
  // Songwriting: chords or none; always end with the recorder or a written line.
  'songwriting.l1.core_loops': {
    card: 'chords',
    steps: [
      'Play {chords}, one bar each, until it loops without a gap.',
      'Now start the same loop from the second chord, then from the third. Each start gives the same chords a different mood.',
      'Hum over your favourite start and note which one felt most like a chorus.', 'Rate yourself 1–5 on how smooth the loop felt.',
    ],
    listenFor: 'The loop landing back on its first chord without a hiccup.',
  },
```

Fretboard triad skills (`l3.*`, `l4.*` triads) use `card: 'triads'`, and their steps refer to "the shapes on the card". `buildMusic` only fills `plan.music.triads` for `track === 'fretboard'`, so they stay consistent.

---

### Task 14: Every practice skill has a recipe (coverage lock)

**Files:**
- Modify: `tests/engine/recipes.test.ts`, `supabase/functions/_shared/engine/recipes.ts` (the doc comment on `recipeFor`)

- [ ] **Step 1: Replace** the generic-fallback test with:

```ts
  it('has a recipe for every practice skill', () => {
    expect(SKILLS.filter(s => s.track !== 'theory' && !RECIPES[s.id]).map(s => s.id)).toEqual([]);
  });
```

- [ ] **Step 2: Run** `npm test`. Expect PASS. If it fails, the listed ids are missing from Tasks 9–13; add them.
- [ ] **Step 3:** Keep `recipeFor`'s generic branch. It still protects a skill added to the curriculum later. Update its doc comment to say that.
- [ ] **Step 4: Commit** with `git commit -m "test(engine): every practice skill has a recipe"`.

---

### Task 15: Local check per track, then ship (ask first)

- [ ] **Step 1:** For one skill per track, generate a local lesson.
  1. Delete today's local lesson for `phase3@test.dev`.
  2. Set its `skill_progress` so the planner lands on that track. Or edit `plan.skill_id` and `plan.pattern_id` after generation, then regenerate the content by deleting the row and calling the function (README "Run locally").
  3. Read every block's steps against its card in the browser.
- [ ] **Step 2:** Run `npm test`, `npm run test:db`, `npm run typecheck` and `npm run build`. All must be green.
- [ ] **Step 3:** Write the session handoff (`docs/SESSION_HANDOFF_<date>.md`), then push `dev`.
- [ ] **Step 4: Ask Matt.** Wait for an explicit yes, then:
  1. open and merge a PR `dev → main` (Netlify auto-deploys);
  2. run `supabase functions deploy generate-lesson --no-verify-jwt --project-ref uoytcppwovhteqklezmq`.
- [ ] **Step 5:** Check that the live bundle contains `More about this`, and that `POST` to the function without auth gives a 400 or 401 (not a 5xx).
