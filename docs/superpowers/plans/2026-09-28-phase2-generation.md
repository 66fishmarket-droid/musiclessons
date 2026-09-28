# Phase 2 — Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opening the app always gets today's lesson. The `generate-lesson` edge function plans it with the Phase 1 engine, has an LLM write the text, validates that text against the plan, retries on a fallback model, and saves a plan-only lesson if both models fail. The user picks the default model from a real Kimi vs Qwen comparison.

**Architecture:**
- **Shared lesson layer.** A new layer, `supabase/functions/_shared/lesson/`, sits beside the engine and follows the same purity rules. Everything that can be tested without a network lives there:
  - the content contract and its validator;
  - the plan-only fallback;
  - the prompt builder;
  - a fetch-based OpenRouter client;
  - the model-retry writer;
  - the DB → `PlannerState` loader;
  - the get-or-create service.
- **Edge function.** `supabase/functions/generate-lesson/index.ts` is a thin Deno wrapper. It handles CORS and auth, reads env, and calls the service.
- **Comparison.** A Node script sends 3 fixed plans through each candidate model and writes one HTML page for the user to choose from.

**Tech Stack:**
- Everything from Phase 1: Node 24, TypeScript 5.9, Vitest 3, `tonal`, `chords-db`, `@supabase/supabase-js` 2.117, and the Supabase CLI 2.75.
- The Supabase Edge Runtime 1.70 (Deno 2.1).
- The OpenRouter chat completions API with `response_format: json_schema`.

**Spec:** `docs/superpowers/specs/2026-09-28-guitar-coach-design.md` (§2 Architecture, §4 hard rules, §7 AI, §11 error handling, §12 Phase 2).

**Verified before writing (2026-09-28):**
- A throwaway edge function imported `planLesson` and returned a plan under `supabase functions serve`. It used the `deno.json` import map shown in Task 6, including the npm JSON import from `chords-db`.
- The OpenRouter models API lists `moonshotai/kimi-k2.6` ($0.65 in / $3.41 out per 1M tokens) and `qwen/qwen3.7-plus` ($0.32 / $1.28). Both support `response_format` and `structured_outputs`.

**Spec deviations (deliberate):**
1. **Client:** plain `fetch` instead of the `openai` npm client. It needs no dependency, is identical in Node and Deno, and is trivial to stub. OpenRouter is OpenAI-compatible either way.
2. **Allowed chords:** the chord check (spec §7.4) allows the plan's chords **plus chords named in the day's curriculum text**. For example, `fills.l1.sus_add_hammers` says "Dsus4–D–Dsus2", and without this the LLM would be rejected for quoting the skill.
3. **Songs:** `songs` are excluded from the chord check, because real songs have their own chords.

## Global Constraints

- **Branch and commits:** work on `dev` and commit after every task. **Never push, and never merge to `main`, without asking the user.**
- **Imports:**
  - All relative imports use the explicit `.ts` extension.
  - JSON imports use `with { type: 'json' }`.
- **`supabase/functions/_shared/lesson/**`** follows the same purity rule as the engine:
  - no `node:*`, no `process` and no `Deno.*`;
  - imports are limited to `tonal`, sibling or engine files, and **type-only** imports from `@supabase/supabase-js`.
  - Only `supabase/functions/generate-lesson/index.ts` reads env.
- **No TypeScript-only runtime syntax.** No `enum`, `namespace` or parameter properties (`erasableSyntaxOnly`).
- **Every exported function** gets a one-line JSDoc summary. The code graph reads it.
- **LLM configuration:**
  - Env names are exactly `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` and `LLM_FALLBACK_MODEL` (spec §2).
  - They live in `supabase/functions/.env`, which is gitignored by `.env*`.
  - **Never print, `cat`, commit or echo that file or the key.**
- **Chord convention:** LLM text writes every chord in braces, e.g. `{Am7}`. The UI will render these as chord chips in Phase 3.
- **Cost:** tests never touch the network; the LLM is always a stub. Paid calls happen only in Task 7 Step 6 and Task 8 Step 3.
- **Local Supabase** runs on ports 553xx: API `http://127.0.0.1:55321` and DB `55322`. Windows reserves 54030–54883.
- **Pronouns:** prompts and templated text never use he/she for the learner. Use "you".

## Review Focus

1. **Two first-opens race** (phone and laptop at once). Both must get the same lesson: exactly one row, and no 500 from the `(user_id, lesson_date)` unique key. *(Task 6)*
2. **The model returns fenced or prose-wrapped JSON, or garbage.** Fenced and wrapped JSON still parse. Garbage leads to the fallback model, then the plan-only lesson. `writeLesson` never throws. *(Task 4)*
3. **The model names a chord that isn't in the plan** ("try a Bm7"). That output is rejected. The word "A" and note names ("the E string") are never mistaken for chords, and chords named in the day's curriculum text are allowed. *(Task 1)*
4. **A malformed date, or one more than a day away from server UTC.** The function returns a 400 and writes nothing. A late-night local date one day off UTC is still accepted. *(Task 6)*
5. **The real imported account: legacy lessons only, no `settings` row, and 29 lessons with `track='theory'`.** It still gets a valid plan. A legacy theory lesson can never make the planner return track `'theory'`. *(Task 5)*

---

## File structure

```
supabase/functions/_shared/lesson/
  contract.ts     LessonContent types, LESSON_JSON_SCHEMA, chordKey, allowedChords, validateLesson
  fallback.ts     targetText, fallbackLesson (plan-only lesson)
  prompt.ts       PROMPT_VERSION, SYSTEM_PROMPT, ChatMessage, buildMessages
  llm.ts          Completion, Complete, openRouterComplete (fetch)
  generate.ts     parseJson, writeLesson (model retry → fallback)
  state.ts        DEFAULT_SETTINGS, StateRows, toPlannerState, lessonSummaries, fetchStateRows
  service.ts      InputError, checkDate, getOrCreateLesson
supabase/functions/generate-lesson/
  index.ts        Deno.serve wrapper (CORS, auth, env)
  deno.json       import map
scripts/dev-session.ts        prints a local access token for curl testing
scripts/compare-models.ts     side-by-side HTML
tests/lesson/fixtures.ts      shared PLAN, SKILL_MAP, validContent (not a test file)
tests/lesson/*.test.ts        unit tests (no network)
tests/db/generate-lesson.test.ts   service against local Supabase (stub LLM)
tests/scripts/compare-models.test.ts
docs/superpowers/model-comparison-<date>.html   generated in Task 7, committed as the decision record
```

---

### Task 1: Lesson content contract and validator

**Files:**
- Create: `supabase/functions/_shared/lesson/contract.ts`
- Create: `tests/lesson/fixtures.ts`
- Test: `tests/lesson/contract.test.ts`

**Interfaces:**
- Consumes (Phase 1):
  - `planLesson(state, catalog?)`;
  - the types `LessonPlan`, `BlockKind`, `Skill`, `PlannerState`, `StyleCatalog`;
  - `SKILLS` from `supabase/seed/curriculum.ts`.
- Produces:
  - `interface Song { title: string; artist: string; why: string; capo: number }`
  - `interface BlockContent { kind: BlockKind; instructions: string[]; target_text: string; tips: string; explanation: string }`
  - `interface LessonContent { title; why_it_matters; theory_card; songs: Song[]; create_prompt; blocks: BlockContent[]; fallback?: true }`
  - `type Validation = { ok: true; content: LessonContent } | { ok: false; errors: string[] }`
  - `LESSON_JSON_SCHEMA: object`
  - `chordKey(name: string): string | null`
  - `allowedChords(plan: LessonPlan, skills: Map<string, Skill>): string[]`
  - `validateLesson(raw: unknown, plan: LessonPlan, skills: Map<string, Skill>, opts?: { minSongs?: number }): Validation`
  - From `tests/lesson/fixtures.ts`:
    - `SKILL_MAP`, `NO_STYLES`, `newUserState(over?)`;
    - `PLAN`: a brand-new user with no styles, which gives track `rhythm` in `G` over `G C D G` with 6 blocks;
    - `validContent(plan?)`.

- [ ] **Step 1: Write the shared test fixtures**

`tests/lesson/fixtures.ts`:
```ts
import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import type { StyleCatalog } from '../../supabase/functions/_shared/engine/styles.ts';
import type { LessonPlan, PlannerState, Skill } from '../../supabase/functions/_shared/engine/types.ts';
import type { LessonContent } from '../../supabase/functions/_shared/lesson/contract.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';

export const SKILL_MAP = new Map<string, Skill>(SKILLS.map(s => [s.id, s]));
export const NO_STYLES: StyleCatalog = { profiles: [], elements: [] };
export const newUserState = (over: Partial<PlannerState> = {}): PlannerState => ({
  today: '2026-10-10', settings: { session_minutes: 30, style_core: ['folk'], vocal_low: null, vocal_high: null },
  skills: SKILLS, progress: [], reviewItems: [], recentLessons: [], recentLogs: [], ...over,
});
/** Brand-new user, no styles: rhythm in G over I–IV–V–I, blocks warmup/new_skill/reset/apply/create/record. */
export const PLAN: LessonPlan = planLesson(newUserState(), NO_STYLES);

/** Minimal content that passes validateLesson for `plan`. */
export function validContent(plan: LessonPlan = PLAN): LessonContent {
  return {
    title: `Accents in ${plan.key}`, why_it_matters: 'Accents make a strum sound like a song.', theory_card: 'Keys relate by fifths.',
    create_prompt: `Write two lines over {${plan.music.progression.chords[0]}}.`,
    songs: [1, 2, 3].map(i => ({ title: `Song ${i}`, artist: 'Artist', why: 'Steady strumming.', capo: 0 })),
    blocks: plan.blocks.map(b => ({ kind: b.kind, instructions: [`Do the ${b.kind} block.`], target_text: '', tips: '', explanation: '' })),
  };
}
```

- [ ] **Step 2: Write the failing tests**

`tests/lesson/contract.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { allowedChords, chordKey, validateLesson } from '../../supabase/functions/_shared/lesson/contract.ts';
import { PLAN, SKILL_MAP, validContent } from './fixtures.ts';

describe('fixture plan', () => {
  it('is a rhythm lesson in G over G C D G with six blocks', () => {
    expect(PLAN).toMatchObject({ track: 'rhythm', key: 'G', retest: null, review: [] });
    expect(PLAN.music.progression.chords).toEqual(['G', 'C', 'D', 'G']);
    expect(PLAN.blocks.map(b => b.kind)).toEqual(['warmup', 'new_skill', 'reset', 'apply', 'create', 'record']);
  });
});

describe('chordKey', () => {
  it('ignores spelling but not structure', () => {
    expect(chordKey('A#m7')).toBe(chordKey('Bbm7'));
    expect(chordKey('Amin7')).toBe(chordKey('Am7'));
    expect(chordKey('Am7')).not.toBe(chordKey('A7'));
    expect(chordKey('Hm7')).toBeNull();
  });
});

describe('allowedChords', () => {
  it('is the plan progression plus voicings', () => expect(allowedChords(PLAN, SKILL_MAP)).toEqual(['G', 'C', 'D']));
  it('adds chords named in the day\'s curriculum text', () => {
    const plan = { ...PLAN, skill_id: 'fills.l1.sus_add_hammers' };
    expect(allowedChords(plan, SKILL_MAP)).toEqual(expect.arrayContaining(['Dsus4', 'Dsus2']));
  });
});

describe('validateLesson', () => {
  it('accepts content that matches the plan', () => expect(validateLesson(validContent(), PLAN, SKILL_MAP)).toMatchObject({ ok: true }));
  it('rejects non-objects', () => expect(validateLesson('x', PLAN, SKILL_MAP)).toEqual({ ok: false, errors: ['not a JSON object'] }));
  it('needs exactly one block per plan block, in order', () => {
    const c = validContent();
    expect(validateLesson({ ...c, blocks: c.blocks.slice(1) }, PLAN, SKILL_MAP)).toMatchObject({ ok: false, errors: expect.arrayContaining(['blocks: expected 6, got 5']) });
    const swapped = [c.blocks[1], c.blocks[0], ...c.blocks.slice(2)];
    expect(validateLesson({ ...c, blocks: swapped }, PLAN, SKILL_MAP)).toMatchObject({
      ok: false, errors: expect.arrayContaining(['blocks[0].kind: expected warmup, got new_skill']) });
  });
  it('needs three songs with a capo from 0 to 12, unless relaxed', () => {
    const c = validContent();
    expect(validateLesson({ ...c, songs: c.songs.slice(1) }, PLAN, SKILL_MAP)).toMatchObject({ ok: false, errors: ['songs: expected 3, got 2'] });
    expect(validateLesson({ ...c, songs: [{ ...c.songs[0], capo: 14 }, ...c.songs.slice(1)] }, PLAN, SKILL_MAP))
      .toMatchObject({ ok: false, errors: ['songs[0].capo: expected 0-12'] });
    expect(validateLesson({ ...c, songs: [] }, PLAN, SKILL_MAP, { minSongs: 0 })).toMatchObject({ ok: true });
  });
  it('rejects chords that are not in the plan, braced or bare', () => {
    const c = validContent();
    const braced = { ...c, create_prompt: 'Swap in {Bm7} for colour.' };
    expect(validateLesson(braced, PLAN, SKILL_MAP)).toEqual({ ok: false, errors: ['chord not in plan: Bm7'] });
    const bare = { ...c, blocks: c.blocks.map((b, i) => (i === 1 ? { ...b, tips: 'Try a Bm7 instead.' } : b)) };
    expect(validateLesson(bare, PLAN, SKILL_MAP)).toEqual({ ok: false, errors: ['chord not in plan: Bm7'] });
  });
  it('never mistakes the article "A" or note names for chords', () => {
    const c = { ...validContent(), why_it_matters: 'A steady pulse matters: mute the E string and let the {G} ring. A B C are notes.' };
    expect(validateLesson(c, PLAN, SKILL_MAP)).toMatchObject({ ok: true });
  });
  it('accepts other spellings of plan chords and curriculum-named chords', () => {
    const plan = { ...PLAN, skill_id: 'fills.l1.sus_add_hammers' };
    const c = { ...validContent(plan), why_it_matters: 'Hammer {Dsus4} to {Gmaj}.' };
    expect(validateLesson(c, plan, SKILL_MAP)).toMatchObject({ ok: true });
  });
  it('does not chord-check songs', () => {
    const c = validContent();
    const songs = [{ ...c.songs[0], why: 'Built on Am6 Dm6 E7.' }, ...c.songs.slice(1)];
    expect(validateLesson({ ...c, songs }, PLAN, SKILL_MAP)).toMatchObject({ ok: true });
  });
  it('refuses a model-supplied fallback flag', () => {
    expect(validateLesson({ ...validContent(), fallback: true }, PLAN, SKILL_MAP)).toEqual({ ok: false, errors: ['fallback: not allowed'] });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/lesson/contract.test.ts`
Expected: FAIL, because `supabase/functions/_shared/lesson/contract.ts` can't be resolved.

- [ ] **Step 4: Implement `contract.ts`**

`supabase/functions/_shared/lesson/contract.ts`:
```ts
import { Chord, Note } from 'tonal';
import type { BlockKind, LessonPlan, Skill } from '../engine/types.ts';

export interface Song { title: string; artist: string; why: string; capo: number }
export interface BlockContent { kind: BlockKind; instructions: string[]; target_text: string; tips: string; explanation: string }
export interface LessonContent {
  title: string; why_it_matters: string; theory_card: string; songs: Song[]; create_prompt: string;
  blocks: BlockContent[];
  /** Set only on the plan-only lesson built by fallbackLesson. */
  fallback?: true;
}
export type Validation = { ok: true; content: LessonContent } | { ok: false; errors: string[] };

const BLOCK_KINDS: BlockKind[] = ['warmup', 'retest', 'new_skill', 'reset', 'review', 'apply', 'create', 'record'];
const str = { type: 'string' } as const;

/** Structured-output schema sent to the model (strict mode: every property required, no extras). */
export const LESSON_JSON_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'why_it_matters', 'theory_card', 'songs', 'create_prompt', 'blocks'],
  properties: {
    title: str, why_it_matters: str, theory_card: str, create_prompt: str,
    songs: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'artist', 'why', 'capo'],
      properties: { title: str, artist: str, why: str, capo: { type: 'integer' } } } },
    blocks: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['kind', 'instructions', 'target_text', 'tips', 'explanation'],
      properties: { kind: { type: 'string', enum: BLOCK_KINDS }, instructions: { type: 'array', items: str },
        target_text: str, tips: str, explanation: str } } },
  },
};

const BRACED = /\{([^{}]+)\}/g;
// Unbraced chord symbols must carry a quality or number, so the article "A" and note names ("the E string") never match.
const BARE = /(?<![\w#])[A-G][#b]?(?:(?:maj|min|m|dim|aug|sus|add|°|ø)\d{0,2}|\d{1,2})(?:b5|#5|b9|#9|#11)?(?:\/[A-G][#b]?)?(?![\w#])/g;

/** Spelling-independent chord identity: tonic pitch class + intervals ("A#m7" = "Bbm7" = "Bbmin7"); null if not a chord. */
export function chordKey(name: string): string | null {
  const c = Chord.get(name);
  return c.empty || !c.tonic ? null : `${Note.chroma(c.tonic)}:${c.intervals.join(',')}`;
}

/** Chords the lesson may name: the plan's progression and voicings plus chords the day's curriculum text names. */
export function allowedChords(plan: LessonPlan, skills: Map<string, Skill>): string[] {
  const text = [plan.skill_id, plan.retest?.skill_id, plan.theory_topic_id]
    .map(id => (id ? skills.get(id)?.description ?? '' : '')).join(' ');
  const named = [...text.matchAll(BARE)].map(m => m[0]).filter(c => chordKey(c) !== null);
  return [...new Set([...plan.music.progression.chords, ...Object.keys(plan.music.voicings), ...named])];
}

const isStr = (v: unknown): v is string => typeof v === 'string';
const nonEmpty = (v: unknown): v is string => isStr(v) && v.trim().length > 0;
const strings = (v: unknown): string[] =>
  isStr(v) ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];

/** Checks model output against the plan: shape, one block per plan block in order, songs, and only allowed chords. */
export function validateLesson(raw: unknown, plan: LessonPlan, skills: Map<string, Skill>, { minSongs = 3 } = {}): Validation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, errors: ['not a JSON object'] };
  const o = raw as Record<string, unknown>;
  const errors: string[] = [];
  if ('fallback' in o) errors.push('fallback: not allowed');
  for (const k of ['title', 'why_it_matters', 'theory_card', 'create_prompt']) if (!nonEmpty(o[k])) errors.push(`${k}: missing`);

  const songs = Array.isArray(o.songs) ? o.songs : [];
  if (songs.length < minSongs || songs.length > 3) errors.push(`songs: expected ${minSongs === 3 ? '3' : `${minSongs}-3`}, got ${songs.length}`);
  songs.forEach((s, i) => {
    const x = (s ?? {}) as Record<string, unknown>;
    if (!nonEmpty(x.title) || !nonEmpty(x.artist) || !isStr(x.why)) errors.push(`songs[${i}]: title and artist required`);
    if (!Number.isInteger(x.capo) || (x.capo as number) < 0 || (x.capo as number) > 12) errors.push(`songs[${i}].capo: expected 0-12`);
  });

  const blocks = Array.isArray(o.blocks) ? o.blocks : [];
  if (blocks.length !== plan.blocks.length) errors.push(`blocks: expected ${plan.blocks.length}, got ${blocks.length}`);
  blocks.forEach((b, i) => {
    const x = (b ?? {}) as Record<string, unknown>;
    const want = plan.blocks[i]?.kind;
    if (want && x.kind !== want) errors.push(`blocks[${i}].kind: expected ${want}, got ${String(x.kind)}`);
    if (!Array.isArray(x.instructions) || x.instructions.length === 0 || !x.instructions.every(nonEmpty)) {
      errors.push(`blocks[${i}].instructions: need at least one`);
    }
    for (const k of ['target_text', 'tips', 'explanation']) if (!isStr(x[k])) errors.push(`blocks[${i}].${k}: expected text`);
  });

  const allowed = new Set(allowedChords(plan, skills).map(chordKey));
  const bad = new Set<string>();
  for (const text of strings({ ...o, songs: undefined })) {
    for (const [, name] of text.matchAll(BRACED)) if (!allowed.has(chordKey(name.trim()))) bad.add(name.trim());
    for (const [name] of text.replace(BRACED, ' ').matchAll(BARE)) if (!allowed.has(chordKey(name))) bad.add(name);
  }
  bad.forEach(c => errors.push(`chord not in plan: ${c}`));
  return errors.length ? { ok: false, errors } : { ok: true, content: o as unknown as LessonContent };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/lesson/contract.test.ts && npm run typecheck`
Expected: PASS (13 tests), and `tsc` exits 0.
- If `{Gmaj}` is rejected, `tonal` doesn't alias `maj` to a major triad. Change that test string to `{GM}`, and ledger it as a test-data fix; it isn't a validator change.
- If the fixture-plan test fails, the Phase 1 planner changed. Read the actual `PLAN` and update only the fixture assertions.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/lesson/contract.ts tests/lesson/fixtures.ts tests/lesson/contract.test.ts
git commit -m "feat(lesson): LLM content contract and plan-bound validator"
```

---

### Task 2: Plan-only fallback lesson

**Files:**
- Create: `supabase/functions/_shared/lesson/fallback.ts`
- Test: `tests/lesson/fallback.test.ts`

**Interfaces:**
- Consumes:
  - `LessonContent`, `BlockContent` and `validateLesson` (Task 1);
  - `STYLE_CATALOG` (Phase 1);
  - `PLAN`, `SKILL_MAP` and `newUserState` (Task 1 fixtures).
- Produces:
  - `targetText(t: Target | null): string`
  - `fallbackLesson(plan: LessonPlan, skills: Map<string, Skill>): LessonContent`, which always has `fallback: true`, 0–3 songs, and passes `validateLesson(…, { minSongs: 0 })`.

- [ ] **Step 1: Write the failing tests**

`tests/lesson/fallback.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import { STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';
import { validateLesson } from '../../supabase/functions/_shared/lesson/contract.ts';
import { fallbackLesson, targetText } from '../../supabase/functions/_shared/lesson/fallback.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';
import { PLAN, SKILL_MAP, newUserState } from './fixtures.ts';

describe('targetText', () => {
  it.each([
    [{ metric: 'bpm', target: 70, start: 46 }, 'Start at 46 bpm, reach 70 bpm cleanly.'],
    [{ metric: 'clean_reps', target: 3, start: null }, '3 clean reps in a row.'],
    [{ metric: 'self', target: null, start: null }, 'Rate yourself honestly, 1–5.'],
    [null, ''],
  ] as const)('%j → %s', (t, want) => expect(targetText(t)).toBe(want));
});

describe('fallbackLesson', () => {
  it('builds a valid plan-only lesson from engine data', () => {
    const c = fallbackLesson(PLAN, SKILL_MAP);
    expect(c.fallback).toBe(true);
    expect(c.title).toBe(`${SKILL_MAP.get(PLAN.skill_id)!.name} in G`);
    expect(c.blocks.map(b => b.kind)).toEqual(PLAN.blocks.map(b => b.kind));
    expect(c.blocks.find(b => b.kind === 'apply')!.instructions[0]).toContain('{G} {C} {D} {G}');
    expect(c.blocks.find(b => b.kind === 'new_skill')!.target_text).toBe('Start at 46 bpm, reach 70 bpm cleanly.');
    const { fallback: _flag, ...rest } = c;
    expect(validateLesson(rest, PLAN, SKILL_MAP, { minSongs: 0 })).toMatchObject({ ok: true });
  });
  it('is valid for every non-theory skill, including ones whose text names chords', () => {
    const base = planLesson(newUserState(), STYLE_CATALOG);
    for (const s of SKILLS.filter(x => x.track !== 'theory')) {
      const plan = { ...base, skill_id: s.id, track: s.track as typeof base.track };
      const { fallback: _f, ...c } = fallbackLesson(plan, SKILL_MAP);
      expect(validateLesson(c, plan, SKILL_MAP, { minSongs: 0 }), s.id).toMatchObject({ ok: true });
    }
  });
  it('uses the style\'s reference tracks as songs', () => {
    const plan = planLesson(newUserState(), STYLE_CATALOG);
    expect(plan.style_element).not.toBeNull();
    const c = fallbackLesson(plan, SKILL_MAP);
    expect(c.songs.length).toBeGreaterThan(0);
    expect(c.songs.every(s => s.capo === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lesson/fallback.test.ts`
Expected: FAIL, because `fallback.ts` can't be resolved.

- [ ] **Step 3: Implement `fallback.ts`**

`supabase/functions/_shared/lesson/fallback.ts`:
```ts
import { STYLE_CATALOG } from '../engine/styles.ts';
import type { BlockKind, LessonPlan, PlanBlock, Skill, Target } from '../engine/types.ts';
import type { BlockContent, LessonContent } from './contract.ts';

/** A plan target as plain words ("Start at 46 bpm, reach 70 bpm cleanly."); "" when the block has none. */
export function targetText(t: Target | null): string {
  if (!t) return '';
  if (t.metric === 'bpm' && t.target !== null) return `Start at ${t.start} bpm, reach ${t.target} bpm cleanly.`;
  if (t.metric === 'clean_reps' && t.target !== null) return `${t.target} clean reps in a row.`;
  return 'Rate yourself honestly, 1–5.';
}

const braced = (chords: string[]) => chords.map(c => `{${c}}`).join(' ');

function refName(ref: string, skills: Map<string, Skill>): string {
  const i = ref.indexOf(':');
  const [type, id] = [ref.slice(0, i), ref.slice(i + 1)];
  if (type === 'style') return STYLE_CATALOG.elements.find(e => e.id === id)?.name ?? id;
  return skills.get(id)?.name ?? id;
}

/** Plan-only lesson from engine data and templated text, served when every model fails (spec §11). */
export function fallbackLesson(plan: LessonPlan, skills: Map<string, Skill>): LessonContent {
  const skill = skills.get(plan.skill_id);
  const topic = plan.theory_topic_id ? skills.get(plan.theory_topic_id) : undefined;
  const { music } = plan;
  const chords = braced(music.progression.chords);
  const style = plan.style_element ? STYLE_CATALOG.profiles.find(p => p.id === plan.style_element!.style) : undefined;
  const text: Record<BlockKind, (b: PlanBlock) => string[]> = {
    warmup: () => ['Hum or lip-trill for 30 seconds to wake your voice up.',
      `Play the ${music.key} ${music.scale.name} scale in one position, singing each note and naming its degree.`],
    retest: () => [`Cold retest: ${skills.get(plan.retest?.skill_id ?? '')?.name ?? 'yesterday\'s skill'}, one attempt, no practice run.`],
    new_skill: () => [skill?.description ?? plan.skill_id, 'Loop it slowly. If you miss twice in a row, drop 5 bpm or simplify, then build back up.'],
    reset: () => ['Put the guitar down for 30 seconds. Listen back or picture the shape.'],
    review: b => b.items.map(i => `Review: ${refName(i.ref, skills)}.`),
    apply: () => [`Play ${chords} (${music.progression.roman.join(' ')})${music.rhythm ? ` with the ${music.rhythm.name} pattern` : ''} and sing over it.`],
    create: () => [`Write two lines of lyric or melody over ${chords} in ${music.key}.`],
    record: () => ['Record one take of today\'s skill, listen back, rate it 1–5 and note one thing to fix tomorrow.'],
  };
  const blocks: BlockContent[] = plan.blocks.map(b => ({
    kind: b.kind, instructions: text[b.kind](b), target_text: targetText(b.items[0]?.target ?? null), tips: '', explanation: '',
  }));
  return {
    title: `${skill?.name ?? plan.skill_id} in ${plan.key}`,
    why_it_matters: skill?.description ?? plan.skill_id,
    theory_card: topic ? `${topic.name}: ${topic.description}` : (skill?.description ?? plan.skill_id),
    songs: (style?.reference_tracks ?? []).slice(0, 3).map(t => ({ title: t.title, artist: t.artist, why: t.why, capo: 0 })),
    create_prompt: `Write two lines over ${chords} in ${plan.key}.`,
    blocks,
    fallback: true,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lesson/fallback.test.ts && npm run typecheck`
Expected: PASS (7 tests), and `tsc` exits 0.
- If the "every non-theory skill" test fails on a chord, that skill's description names a chord the `BARE` pattern misses, for example a slash chord with no quality. Do **not** weaken the validator. Ledger the failing skill and wrap its chords in braces in the templated text, if they come from `music`.
- If the chord comes from the curriculum description, ledger it and stop. It's a curriculum-text issue for the user.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/lesson/fallback.ts tests/lesson/fallback.test.ts
git commit -m "feat(lesson): plan-only fallback lesson from engine data"
```

---

### Task 3: Prompt builder

**Files:**
- Create: `supabase/functions/_shared/lesson/prompt.ts`
- Test: `tests/lesson/prompt.test.ts`

**Interfaces:**
- Consumes: `allowedChords` (Task 1); `LessonPlan`, `Settings`, `Skill` and `StyleProfile` (Phase 1).
- Produces:
  - `interface ChatMessage { role: 'system' | 'user'; content: string }`
  - `interface PromptInput { plan: LessonPlan; skills: Map<string, Skill>; style: StyleProfile | null; settings: Settings; recent: string[]; questions: string[] }`
  - `PROMPT_VERSION: string`, which is stored on every lesson row, and `SYSTEM_PROMPT: string`.
  - `buildMessages(input: PromptInput): ChatMessage[]`. It returns `[system, user]`. The user content is the line `Write today's lesson for this plan:` followed by pretty JSON. Task 6's stub model parses that JSON.

- [ ] **Step 1: Write the failing tests**

`tests/lesson/prompt.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import { STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';
import { PROMPT_VERSION, SYSTEM_PROMPT, buildMessages } from '../../supabase/functions/_shared/lesson/prompt.ts';
import { PLAN, SKILL_MAP, newUserState } from './fixtures.ts';

const briefOf = (content: string) => JSON.parse(content.slice(content.indexOf('\n') + 1));
const settings = { ...newUserState().settings, vocal_low: 'A2', vocal_high: 'E4' };

describe('buildMessages', () => {
  const msgs = buildMessages({
    plan: PLAN, skills: SKILL_MAP, style: null, settings,
    recent: Array.from({ length: 9 }, (_, i) => `lesson ${i}`), questions: Array.from({ length: 12 }, (_, i) => `question ${i}`),
  });
  const brief = briefOf(msgs[1].content);

  it('sends the fixed system prompt first', () => {
    expect(msgs[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT });
    expect(msgs[1].content.startsWith("Write today's lesson for this plan:\n")).toBe(true);
    expect(PROMPT_VERSION).toMatch(/^gc-\d{4}-\d{2}-\d{2}$/);
  });
  it('briefs the plan: skill, theory topic, key, chords and blocks in order', () => {
    expect(brief).toMatchObject({
      key: 'G', track: 'rhythm', session: 'standard_30', is_repeat: false, style: null, vocal_range: 'A2–E4',
      skill: { id: PLAN.skill_id, name: SKILL_MAP.get(PLAN.skill_id)!.name },
      theory_topic: { id: PLAN.theory_topic_id }, allowed_chords: ['G', 'C', 'D'],
      music: { scale: 'G major', progression: { roman: ['I', 'IV', 'V', 'I'], chords: ['G', 'C', 'D', 'G'] } },
    });
    expect(brief.blocks.map((b: { kind: string }) => b.kind)).toEqual(PLAN.blocks.map(b => b.kind));
    expect(brief.blocks.find((b: { kind: string }) => b.kind === 'new_skill').items[0].target).toEqual({ metric: 'bpm', target: 70, start: 46 });
  });
  it('caps history at 7 lessons and 10 questions', () => {
    expect(brief.recent_lessons).toHaveLength(7);
    expect(brief.recent_questions).toHaveLength(10);
  });
  it('names today\'s style element', () => {
    const plan = planLesson(newUserState(), STYLE_CATALOG);
    const style = STYLE_CATALOG.profiles.find(p => p.id === plan.style_element!.style)!;
    const b = briefOf(buildMessages({ plan, skills: SKILL_MAP, style, settings, recent: [], questions: [] })[1].content);
    expect(b.style).toMatchObject({ name: style.name, element: { kind: plan.style_element!.kind, is_new: true } });
    expect(b.style.element.name).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lesson/prompt.test.ts`
Expected: FAIL, because `prompt.ts` can't be resolved.

- [ ] **Step 3: Implement `prompt.ts`**

`supabase/functions/_shared/lesson/prompt.ts`:
```ts
import type { StyleProfile } from '../engine/styles.ts';
import type { LessonPlan, Settings, Skill } from '../engine/types.ts';
import { allowedChords } from './contract.ts';

export interface ChatMessage { role: 'system' | 'user'; content: string }
export interface PromptInput {
  plan: LessonPlan; skills: Map<string, Skill>; style: StyleProfile | null; settings: Settings;
  /** One-line summaries, newest first (capped at 7). */
  recent: string[];
  /** Recent question texts, newest first (capped at 10). */
  questions: string[];
}

/** Bump when SYSTEM_PROMPT or the brief's shape changes; stored on every lesson row. */
export const PROMPT_VERSION = 'gc-2026-09-28';

export const SYSTEM_PROMPT = `You write the text for a daily guitar practice app. The learner is a singer-songwriter who accompanies their own singing. The app's engine has already decided everything musical: the skill, key, chords, scale, rhythm, targets and block timings. You explain and coach; you never change the plan.

Return one JSON object that matches the response schema. No markdown fences, no text outside the JSON.

Rules:
1. blocks: exactly one entry per plan block, in the same order, with the same kind.
2. Chords: name only chords listed in allowed_chords, and write every chord name in braces, e.g. {Am7}. Never suggest substitutions, extensions or other chords. Do not name chords in songs.
3. Targets: never invent tempos or rep counts. target_text restates the block's plan target in plain words, or is "" when the block has none.
4. One new concept: only the new_skill block teaches something new. retest and review blocks test what was already learned.
5. instructions: 2 to 5 short imperative steps per block, about 25 words each at most. The new_skill block follows Hear, then Learn, then Play, and starts the tempo ladder at the plan's start tempo.
6. warmup: hum or lip-trill, then play and sing today's scale in one position, naming the degrees.
7. Ear and voice work stays in today's key and inside vocal_range when it is given.
8. Fills: at most one fill per 4 bars.
9. apply: today's skill over today's progression in today's style element, singing over it.
10. create: one songwriting micro-constraint in today's key using today's progression or style element; create_prompt states it in one sentence.
11. theory_card: 3 to 5 sentences on why today's material works, tied to theory_topic.
12. songs: exactly 3 real, well-known songs where this skill or style element can be heard. capo is the fret from 0 to 12 that brings the song closest to today's key with open shapes. If you are unsure a song fits, choose another.
13. tips: one common mistake and its fix. explanation: one or two sentences on why the block matters. Either may be "" for the reset block.
14. Address the learner as "you". Never refer to the learner as he or she.
15. Use recent_lessons and recent_questions only to avoid repeating yourself and to connect to what the learner has been asking about.`;

/** The fixed system prompt plus a JSON brief of today's plan for the model. */
export function buildMessages({ plan, skills, style, settings, recent, questions }: PromptInput): ChatMessage[] {
  const named = (id: string | null | undefined) => {
    const s = id ? skills.get(id) : undefined;
    return s ? { id: s.id, name: s.name, description: s.description } : null;
  };
  const chosen = plan.style_element;
  const element = style && chosen ? [...style.rhythm_patterns, ...style.progressions].find(e => e.id === chosen.element_id) : undefined;
  const brief = {
    date: plan.date, session: plan.template, track: plan.track, key: plan.key, is_repeat: plan.is_repeat,
    skill: named(plan.skill_id), theory_topic: named(plan.theory_topic_id),
    retest: plan.retest ? { skill: named(plan.retest.skill_id), target: plan.retest.target } : null,
    review: plan.review.map(r => ({ type: r.item_type, ref: r.ref, name: skills.get(r.ref)?.name ?? r.ref })),
    style: style ? {
      name: style.name, family: style.family, feel: style.feel,
      element: element && chosen ? { name: element.name, kind: chosen.kind, is_new: chosen.is_new } : null,
    } : null,
    music: {
      scale: `${plan.music.scale.tonic} ${plan.music.scale.name}`, scale_notes: plan.music.scale.notes,
      progression: plan.music.progression, rhythm: plan.music.rhythm,
    },
    allowed_chords: allowedChords(plan, skills),
    blocks: plan.blocks.map(b => ({ kind: b.kind, minutes: b.minutes, items: b.items })),
    vocal_range: settings.vocal_low && settings.vocal_high ? `${settings.vocal_low}–${settings.vocal_high}` : null,
    recent_lessons: recent.slice(0, 7),
    recent_questions: questions.slice(0, 10),
  };
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Write today's lesson for this plan:\n${JSON.stringify(brief, null, 2)}` },
  ];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lesson/prompt.test.ts && npm run typecheck`
Expected: PASS (4 tests), and `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/lesson/prompt.ts tests/lesson/prompt.test.ts
git commit -m "feat(lesson): system prompt and plan brief"
```

---

### Task 4: OpenRouter client and model-retry writer

**Files:**
- Create: `supabase/functions/_shared/lesson/llm.ts`, `supabase/functions/_shared/lesson/generate.ts`
- Test: `tests/lesson/llm.test.ts`, `tests/lesson/generate.test.ts`

**Interfaces:**
- Consumes: `ChatMessage` (Task 3); `LESSON_JSON_SCHEMA`, `validateLesson` and `LessonContent` (Task 1); `fallbackLesson` (Task 2).
- Produces:
  - `interface Completion { text: string; cost: number | null }`
  - `type Complete = (model: string, messages: ChatMessage[], schema: object) => Promise<Completion>`
  - `interface LlmConfig { baseUrl: string; apiKey: string; timeoutMs?: number }`
  - `openRouterComplete(cfg: LlmConfig, fetchFn?: typeof fetch): Complete`
  - `interface Attempt { model: string; errors: string[]; cost: number | null; ms: number }`
  - `interface Written { content: LessonContent; llm_model: string; attempts: Attempt[] }`
  - `parseJson(text: string): unknown`, which returns `undefined` when the text isn't parseable.
  - `writeLesson(messages, plan, skills, complete, models: (string | undefined)[]): Promise<Written>`. It never throws; `llm_model` is `'fallback'` when no model succeeds.

- [ ] **Step 1: Write the failing tests**

`tests/lesson/llm.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { openRouterComplete } from '../../supabase/functions/_shared/lesson/llm.ts';

const msgs = [{ role: 'user' as const, content: 'hi' }];
function fakeFetch(status: number, body: unknown, seen: { url?: string; init?: RequestInit } = {}): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    seen.url = url; seen.init = init;
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

describe('openRouterComplete', () => {
  it('posts a strict json_schema request that excludes providers that train on prompts', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const complete = openRouterComplete({ baseUrl: 'https://openrouter.ai/api/v1/', apiKey: 'k' },
      fakeFetch(200, { choices: [{ message: { content: '{"a":1}' } }], usage: { cost: 0.0123 } }, seen));
    expect(await complete('moonshotai/kimi-k2.6', msgs, { type: 'object' })).toEqual({ text: '{"a":1}', cost: 0.0123 });
    expect(seen.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((seen.init!.headers as Record<string, string>).Authorization).toBe('Bearer k');
    expect(JSON.parse(seen.init!.body as string)).toMatchObject({
      model: 'moonshotai/kimi-k2.6', messages: msgs,
      response_format: { type: 'json_schema', json_schema: { name: 'lesson', strict: true, schema: { type: 'object' } } },
      provider: { data_collection: 'deny', require_parameters: true }, usage: { include: true },
    });
  });
  it('throws on HTTP errors and empty content', async () => {
    await expect(openRouterComplete({ baseUrl: 'u', apiKey: 'k' }, fakeFetch(429, 'rate limited'))('m', msgs, {})).rejects.toThrow(/LLM 429: rate limited/);
    await expect(openRouterComplete({ baseUrl: 'u', apiKey: 'k' }, fakeFetch(200, { choices: [] }))('m', msgs, {})).rejects.toThrow(/no content/);
  });
});
```

`tests/lesson/generate.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseJson, writeLesson } from '../../supabase/functions/_shared/lesson/generate.ts';
import type { Complete } from '../../supabase/functions/_shared/lesson/llm.ts';
import type { ChatMessage } from '../../supabase/functions/_shared/lesson/prompt.ts';
import { PLAN, SKILL_MAP, validContent } from './fixtures.ts';

const good = JSON.stringify(validContent());
const msgs: ChatMessage[] = [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }];
/** A stub model that gives the scripted answers in order (an Error is thrown). */
function scripted(answers: (string | Error)[], calls: string[] = []): Complete {
  return async model => {
    calls.push(model);
    const a = answers.shift();
    if (a === undefined) throw new Error('no answer scripted');
    if (a instanceof Error) throw a;
    return { text: a, cost: 0.001 };
  };
}

describe('parseJson', () => {
  it('reads plain, fenced and prose-wrapped JSON', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJson('Here you go: {"a":1} Enjoy!')).toEqual({ a: 1 });
  });
  it('returns undefined for garbage', () => expect(parseJson('no json here')).toBeUndefined());
});

describe('writeLesson', () => {
  it('returns the first valid answer without calling the fallback model', async () => {
    const calls: string[] = [];
    const w = await writeLesson(msgs, PLAN, SKILL_MAP, scripted([good], calls), ['m1', 'm2']);
    expect(w).toMatchObject({ llm_model: 'm1', attempts: [{ model: 'm1', errors: [], cost: 0.001 }] });
    expect(calls).toEqual(['m1']);
  });
  it('retries on the fallback model when the first answer is invalid', async () => {
    const w = await writeLesson(msgs, PLAN, SKILL_MAP, scripted(['{"title":"x"}', `\`\`\`json\n${good}\n\`\`\``]), ['m1', 'm2']);
    expect(w.llm_model).toBe('m2');
    expect(w.attempts[0].errors.length).toBeGreaterThan(0);
    expect(w.content.fallback).toBeUndefined();
  });
  it('serves the plan-only lesson when every model fails, without throwing', async () => {
    const w = await writeLesson(msgs, PLAN, SKILL_MAP, scripted([new Error('timeout'), 'not json']), ['m1', 'm2']);
    expect(w.llm_model).toBe('fallback');
    expect(w.content.fallback).toBe(true);
    expect(w.attempts.map(a => a.errors)).toEqual([['timeout'], ['not a JSON object']]);
  });
  it('skips blank and duplicate model names, and calls nothing when none is set', async () => {
    const calls: string[] = [];
    await writeLesson(msgs, PLAN, SKILL_MAP, scripted([good], calls), ['', undefined, 'm1', 'm1']);
    expect(calls).toEqual(['m1']);
    const none: string[] = [];
    expect((await writeLesson(msgs, PLAN, SKILL_MAP, scripted([], none), [undefined, ''])).llm_model).toBe('fallback');
    expect(none).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lesson/llm.test.ts tests/lesson/generate.test.ts`
Expected: FAIL, because `llm.ts` and `generate.ts` can't be resolved.

- [ ] **Step 3: Implement `llm.ts`**

`supabase/functions/_shared/lesson/llm.ts`:
```ts
import type { ChatMessage } from './prompt.ts';

export interface Completion { text: string; cost: number | null }
export type Complete = (model: string, messages: ChatMessage[], schema: object) => Promise<Completion>;
export interface LlmConfig { baseUrl: string; apiKey: string; timeoutMs?: number }

/** OpenRouter (OpenAI-compatible) chat client over fetch: strict JSON-schema output, no-training providers only, cost reported. */
export function openRouterComplete({ baseUrl, apiKey, timeoutMs = 55_000 }: LlmConfig, fetchFn: typeof fetch = fetch): Complete {
  return async (model, messages, schema) => {
    const res = await fetchFn(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, messages, temperature: 0.7,
        response_format: { type: 'json_schema', json_schema: { name: 'lesson', strict: true, schema } },
        provider: { data_collection: 'deny', require_parameters: true },
        usage: { include: true },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`LLM ${res.status}: ${body.slice(0, 200)}`);
    const json = JSON.parse(body) as { choices?: { message?: { content?: unknown } }[]; usage?: { cost?: unknown } };
    const text = json.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('LLM returned no content');
    return { text, cost: typeof json.usage?.cost === 'number' ? json.usage.cost : null };
  };
}
```

- [ ] **Step 4: Implement `generate.ts`**

`supabase/functions/_shared/lesson/generate.ts`:
```ts
import type { LessonPlan, Skill } from '../engine/types.ts';
import { LESSON_JSON_SCHEMA, validateLesson, type LessonContent } from './contract.ts';
import { fallbackLesson } from './fallback.ts';
import type { Complete } from './llm.ts';
import type { ChatMessage } from './prompt.ts';

export interface Attempt { model: string; errors: string[]; cost: number | null; ms: number }
export interface Written { content: LessonContent; llm_model: string; attempts: Attempt[] }

/** Parses model output, tolerating ```json fences and prose around the object; undefined when unparseable. */
export function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch { /* try the outermost braces */ }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* unparseable */ } }
  return undefined;
}

/** Tries each configured model in order; the first valid lesson wins, else the plan-only lesson. Never throws. */
export async function writeLesson(
  messages: ChatMessage[], plan: LessonPlan, skills: Map<string, Skill>, complete: Complete, models: (string | undefined)[],
): Promise<Written> {
  const attempts: Attempt[] = [];
  for (const model of [...new Set(models.filter((m): m is string => !!m && m.trim() !== ''))]) {
    const t0 = Date.now();
    try {
      const { text, cost } = await complete(model, messages, LESSON_JSON_SCHEMA);
      const v = validateLesson(parseJson(text), plan, skills);
      attempts.push({ model, errors: v.ok ? [] : v.errors, cost, ms: Date.now() - t0 });
      if (v.ok) return { content: v.content, llm_model: model, attempts };
    } catch (e) {
      attempts.push({ model, errors: [(e as Error).message], cost: null, ms: Date.now() - t0 });
    }
  }
  return { content: fallbackLesson(plan, skills), llm_model: 'fallback', attempts };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/lesson/llm.test.ts tests/lesson/generate.test.ts && npm run typecheck`
Expected: PASS (8 tests), and `tsc` exits 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/_shared/lesson/llm.ts supabase/functions/_shared/lesson/generate.ts tests/lesson/llm.test.ts tests/lesson/generate.test.ts
git commit -m "feat(lesson): OpenRouter fetch client and model-retry writer with plan-only fallback"
```

---

### Task 5: Planner state loader

**Files:**
- Create: `supabase/functions/_shared/lesson/state.ts`
- Test: `tests/lesson/state.test.ts`

**Interfaces:**
- Consumes: `TRACKS` and the planner types (Phase 1); the `SupabaseClient` **type** from `@supabase/supabase-js`.
- Produces:
  - `DEFAULT_SETTINGS: Settings`, matching the DB column defaults: 30 minutes and `['folk','blues','funk','soul']`.
  - `interface LessonRowLite { lesson_date: string; track: string | null; skill_id: string | null; key: string | null; want_more_time: boolean | null; status: 'planned' | 'completed' | 'skipped'; plan: { style_element?: StyleChoice | null } | null; confidence: number | null; notes: string | null }`
  - `interface StateRows { settings: Settings | null; skills: Skill[]; progress: SkillProgress[]; reviews: ReviewItem[]; lessons: LessonRowLite[]; logs: { passed: boolean | null; lessons: { lesson_date: string; track: string | null } | null }[]; questions: string[] }`
  - `toPlannerState(rows: StateRows, today: string): PlannerState`
  - `lessonSummaries(lessons: LessonRowLite[], n?: number): string[]`
  - `fetchStateRows(db: SupabaseClient, today: string): Promise<StateRows>`. RLS scopes every query to the caller. It's covered by Task 6's DB test.

- [ ] **Step 1: Write the failing tests**

`tests/lesson/state.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import { TRACKS } from '../../supabase/functions/_shared/engine/types.ts';
import {
  DEFAULT_SETTINGS, lessonSummaries, toPlannerState, type LessonRowLite, type StateRows,
} from '../../supabase/functions/_shared/lesson/state.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';

const rows = (over: Partial<StateRows> = {}): StateRows =>
  ({ settings: null, skills: SKILLS, progress: [], reviews: [], lessons: [], logs: [], questions: [], ...over });
const lesson = (lesson_date: string, track: string | null, over: Partial<LessonRowLite> = {}): LessonRowLite => ({
  lesson_date, track, skill_id: track ? `${track}.x` : null, key: 'G', want_more_time: false, status: 'completed',
  plan: {}, confidence: 4, notes: null, ...over,
});

describe('toPlannerState', () => {
  it('uses the DB default settings when no row is saved', () => {
    expect(toPlannerState(rows(), '2026-10-10').settings).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ session_minutes: 30, style_core: ['folk', 'blues', 'funk', 'soul'], vocal_low: null, vocal_high: null });
  });
  it('drops lessons from today on, nulls tracks outside the six, and reads the style element from the plan', () => {
    const s = toPlannerState(rows({ lessons: [
      lesson('2026-10-10', 'rhythm'),
      lesson('2026-10-09', 'theory', { skill_id: 'theory.l1.intervals' }),
      lesson('2026-10-08', 'fills', { plan: { style_element: { style: 'folk', element_id: 'folk.boom_chick', kind: 'rhythm', is_new: true } } }),
    ] }), '2026-10-10');
    expect(s.recentLessons.map(l => [l.date, l.track, l.skill_id])).toEqual([['2026-10-09', null, null], ['2026-10-08', 'fills', 'fills.x']]);
    expect(s.recentLessons[1].style_element?.element_id).toBe('folk.boom_chick');
    expect(s.recentLessons[0].style_element).toBeNull();
  });
  it('keeps new-skill logs only for the six tracks and before today', () => {
    const s = toPlannerState(rows({ logs: [
      { passed: true, lessons: { lesson_date: '2026-10-10', track: 'rhythm' } },
      { passed: false, lessons: { lesson_date: '2026-10-09', track: 'ear_voice' } },
      { passed: true, lessons: { lesson_date: '2026-10-08', track: 'theory' } },
      { passed: true, lessons: null },
    ] }), '2026-10-10');
    expect(s.recentLogs).toEqual([{ date: '2026-10-09', track: 'ear_voice', passed: false }]);
  });
  it('plans a valid lesson for a legacy-only account with no settings row', () => {
    const s = toPlannerState(rows({ lessons: [
      lesson('2026-10-09', 'theory', { skill_id: 'theory.l1.intervals', want_more_time: true }),
      lesson('2026-02-23', null, { status: 'skipped' }),
    ] }), '2026-10-10');
    const plan = planLesson(s);
    expect(plan.is_repeat).toBe(false);
    expect(TRACKS).toContain(plan.track);
  });
});

describe('lessonSummaries', () => {
  it('writes one line per lesson, newest first, capped', () => {
    const ls = [lesson('2026-10-09', 'rhythm', { notes: 'shaky', confidence: 3, want_more_time: true }), lesson('2026-10-08', null, { confidence: null })];
    expect(lessonSummaries(ls)).toEqual([
      '2026-10-09: rhythm.x in G (completed, confidence 3/5, wanted more time, notes: shaky)',
      '2026-10-08: legacy lesson in G (completed)',
    ]);
    expect(lessonSummaries(ls, 1)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/lesson/state.test.ts`
Expected: FAIL, because `state.ts` can't be resolved.

- [ ] **Step 3: Implement `state.ts`**

`supabase/functions/_shared/lesson/state.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TRACKS, type PlannerState, type ReviewItem, type Settings, type Skill, type SkillProgress, type StyleChoice, type Track,
} from '../engine/types.ts';

/** Mirrors the settings table's column defaults (used until the user saves settings). */
export const DEFAULT_SETTINGS: Settings = { session_minutes: 30, style_core: ['folk', 'blues', 'funk', 'soul'], vocal_low: null, vocal_high: null };

export interface LessonRowLite {
  lesson_date: string; track: string | null; skill_id: string | null; key: string | null; want_more_time: boolean | null;
  status: 'planned' | 'completed' | 'skipped'; plan: { style_element?: StyleChoice | null } | null;
  confidence: number | null; notes: string | null;
}
export interface StateRows {
  settings: Settings | null; skills: Skill[]; progress: SkillProgress[]; reviews: ReviewItem[];
  /** Before today, newest first. */
  lessons: LessonRowLite[];
  /** new_skill logs with their lesson, newest first. */
  logs: { passed: boolean | null; lessons: { lesson_date: string; track: string | null } | null }[];
  questions: string[];
}

const asTrack = (t: string | null | undefined): Track | null => ((TRACKS as readonly string[]).includes(t ?? '') ? (t as Track) : null);

/** DB rows → planner input: default settings when none saved; legacy tracks outside the six (e.g. 'theory') become null. */
export function toPlannerState(rows: StateRows, today: string): PlannerState {
  return {
    today,
    settings: rows.settings ?? DEFAULT_SETTINGS,
    skills: rows.skills, progress: rows.progress, reviewItems: rows.reviews,
    recentLessons: rows.lessons.filter(l => l.lesson_date < today).map(l => {
      const track = asTrack(l.track);
      return {
        date: l.lesson_date, track, skill_id: track ? l.skill_id : null, key: l.key,
        style_element: l.plan?.style_element ?? null, want_more_time: l.want_more_time, status: l.status,
      };
    }),
    recentLogs: rows.logs.flatMap(l => {
      const track = asTrack(l.lessons?.track);
      return track && l.lessons && l.lessons.lesson_date < today ? [{ date: l.lessons.lesson_date, track, passed: l.passed }] : [];
    }),
  };
}

/** One-line summaries of the most recent lessons for the model brief. */
export function lessonSummaries(lessons: LessonRowLite[], n = 7): string[] {
  return lessons.slice(0, n).map(l => `${l.lesson_date}: ${l.skill_id ?? 'legacy lesson'} in ${l.key ?? '?'} (${l.status}` +
    `${l.confidence ? `, confidence ${l.confidence}/5` : ''}${l.want_more_time ? ', wanted more time' : ''}${l.notes ? `, notes: ${l.notes}` : ''})`);
}

/** Reads everything the planner needs for the signed-in user; RLS scopes every query to them. */
export async function fetchStateRows(db: SupabaseClient, today: string): Promise<StateRows> {
  const must = (r: { data: unknown; error: unknown }): unknown => { if (r.error) throw r.error; return r.data; };
  const [settings, skills, progress, reviews, lessons, logs, questions] = await Promise.all([
    db.from('settings').select('session_minutes, style_core, vocal_low, vocal_high').maybeSingle(),
    db.from('skills').select('id, track, level, name, description, pass_metric, default_target, allowed_keys, theory_topic_id, styles'),
    db.from('skill_progress').select('skill_id, status, score, current_target, last_seen, last_key'),
    db.from('review_items').select('item_type, ref, interval_days, next_due, last_result'),
    db.from('lessons').select('lesson_date, track, skill_id, key, want_more_time, status, plan, confidence, notes')
      .lt('lesson_date', today).order('lesson_date', { ascending: false }).limit(60),
    db.from('exercise_logs').select('passed, lessons!inner(lesson_date, track)').eq('block_kind', 'new_skill')
      .order('created_at', { ascending: false }).limit(50),
    db.from('questions').select('question').order('created_at', { ascending: false }).limit(10),
  ]);
  return {
    settings: must(settings) as Settings | null,
    skills: must(skills) as Skill[],
    progress: must(progress) as SkillProgress[],
    reviews: must(reviews) as ReviewItem[],
    lessons: must(lessons) as LessonRowLite[],
    logs: must(logs) as StateRows['logs'],
    questions: (must(questions) as { question: string }[]).map(q => q.question),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/lesson/state.test.ts && npm run typecheck`
Expected: PASS (5 tests), and `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/lesson/state.ts tests/lesson/state.test.ts
git commit -m "feat(lesson): DB rows to planner state with default settings and legacy track mapping"
```

---

### Task 6: `getOrCreateLesson` service and the `generate-lesson` edge function

**Files:**
- Create: `supabase/functions/_shared/lesson/service.ts`
- Create: `supabase/functions/generate-lesson/index.ts`, `supabase/functions/generate-lesson/deno.json`
- Create: `scripts/dev-session.ts`
- Modify: `package.json`, adding the `dev:session` script.
- Test: `tests/lesson/service.test.ts` (unit) and `tests/db/generate-lesson.test.ts` (local Supabase).

**Interfaces:**
- Consumes:
  - `planLesson` and `STYLE_CATALOG` (Phase 1);
  - `writeLesson` (Task 4) and `Complete`;
  - `buildMessages` and `PROMPT_VERSION` (Task 3);
  - `fetchStateRows`, `toPlannerState` and `lessonSummaries` (Task 5);
  - the RPC `complete_lesson(p_lesson_id, p_logs, p_confidence, p_want_more_time, p_notes)` (Phase 1).
- Produces:
  - `class InputError extends Error`
  - `checkDate(date: unknown, now: Date): string`
  - `interface LessonRecord { id: string; lesson_date: string; status: string; template: string; track: string | null; skill_id: string | null; key: string | null; plan: unknown; content: unknown; llm_model: string | null; prompt_version: string | null }`
  - `getOrCreateLesson(db: SupabaseClient, date: string, complete: Complete, models: (string | undefined)[]): Promise<LessonRecord>`
  - HTTP: `POST /functions/v1/generate-lesson` with body `{ "date": "YYYY-MM-DD" }` and a user JWT. It returns a `LessonRecord` (200), `{ error }` with 400 for a bad date, 401 when not signed in, or 500.
  - `npm run -s dev:session -- --email <e>` prints an access token for a **local** user.

- [ ] **Step 1: Write the failing unit test**

`tests/lesson/service.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { InputError, checkDate } from '../../supabase/functions/_shared/lesson/service.ts';

const now = new Date('2026-10-10T23:30:00Z');

describe('checkDate', () => {
  it.each(['2026-10-09', '2026-10-10', '2026-10-11'])('accepts %s (a local date within a day of UTC)', d => expect(checkDate(d, now)).toBe(d));
  it.each([['2026-10-12'], ['2026-10-08'], ['2026-02-30'], ['10/10/2026'], [undefined], [20261010]])('rejects %j', d => {
    expect(() => checkDate(d, now)).toThrow(InputError);
  });
});
```

- [ ] **Step 2: Write the failing DB test**

`tests/db/generate-lesson.test.ts`:
```ts
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Complete } from '../../supabase/functions/_shared/lesson/llm.ts';
import { PROMPT_VERSION } from '../../supabase/functions/_shared/lesson/prompt.ts';
import { getOrCreateLesson } from '../../supabase/functions/_shared/lesson/service.ts';

process.loadEnvFile(join(import.meta.dirname, '..', '..', '.env.local'));
const SUPABASE_URL = process.env.SUPABASE_URL!;
const EMAIL = 'generate-test@test.dev';
const PASSWORD = 'local-test-password-1';
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let db: SupabaseClient;
let userId = '';

/** A stub model that answers with minimal valid content for whatever plan it is briefed on. */
function stub(calls: string[], fail = false): Complete {
  return async (model, messages) => {
    calls.push(model);
    if (fail) throw new Error('model down');
    const user = messages[1].content;
    const brief = JSON.parse(user.slice(user.indexOf('\n') + 1)) as { blocks: { kind: string }[] };
    return { cost: 0, text: JSON.stringify({
      title: 't', why_it_matters: 'w', theory_card: 'c', create_prompt: 'p',
      songs: [1, 2, 3].map(i => ({ title: `Song ${i}`, artist: 'Artist', why: 'w', capo: 0 })),
      blocks: brief.blocks.map(b => ({ kind: b.kind, instructions: [`Do ${b.kind}.`], target_text: '', tips: '', explanation: '' })),
    }) };
  };
}

beforeAll(async () => {
  const { data: list } = await admin.auth.admin.listUsers();
  for (const u of list.users.filter(u => u.email === EMAIL)) await admin.auth.admin.deleteUser(u.id);
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
  db = createClient(SUPABASE_URL, process.env.ANON_KEY!, { auth: { persistSession: false } });
  const { error: signInError } = await db.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (signInError) throw signInError;
});
afterAll(async () => { if (userId) await admin.auth.admin.deleteUser(userId); });

describe('getOrCreateLesson', () => {
  it('creates the lesson once, returns the same row afterwards, and completes end to end', async () => {
    const calls: string[] = [];
    const first = await getOrCreateLesson(db, '2026-10-01', stub(calls), ['stub-a', 'stub-b']);
    expect(first).toMatchObject({ lesson_date: '2026-10-01', status: 'planned', llm_model: 'stub-a', prompt_version: PROMPT_VERSION });
    const again = await getOrCreateLesson(db, '2026-10-01', stub(calls), ['stub-a']);
    expect(again.id).toBe(first.id);
    expect(calls).toEqual(['stub-a']);

    const plan = first.plan as { skill_id: string; blocks: { kind: string }[] };
    const blockIndex = plan.blocks.findIndex(b => b.kind === 'new_skill');
    const { error } = await db.rpc('complete_lesson', {
      p_lesson_id: first.id, p_confidence: 4, p_want_more_time: false, p_notes: null,
      p_logs: [{ block_index: blockIndex, block_kind: 'new_skill', item_ref: `skill:${plan.skill_id}`, passed: true, value_reached: null }],
    });
    expect(error).toBeNull();
    const { data: progress } = await db.from('skill_progress').select('score').eq('skill_id', plan.skill_id).single();
    expect(progress?.score).toBe(1);
    const { data: reviews } = await db.from('review_items').select('item_type');
    expect(reviews?.some(r => r.item_type === 'theory')).toBe(true);
  });

  it('saves the plan-only lesson when every model fails', async () => {
    const row = await getOrCreateLesson(db, '2026-10-02', stub([], true), ['stub-a', 'stub-b']);
    expect(row.llm_model).toBe('fallback');
    expect(row.content).toMatchObject({ fallback: true, generation: [{ model: 'stub-a' }, { model: 'stub-b' }] });
  });

  it('converges on one row when two first-opens race', async () => {
    const [a, b] = await Promise.all([
      getOrCreateLesson(db, '2026-10-03', stub([]), ['stub-a']),
      getOrCreateLesson(db, '2026-10-03', stub([]), ['stub-a']),
    ]);
    expect(a.id).toBe(b.id);
    const { count } = await db.from('lessons').select('id', { count: 'exact', head: true }).eq('lesson_date', '2026-10-03');
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/lesson/service.test.ts; npm run test:db`
Expected: both FAIL, because `service.ts` can't be resolved. The Phase 1 DB tests still pass.

- [ ] **Step 4: Implement `service.ts`**

`supabase/functions/_shared/lesson/service.ts`:
```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { planLesson } from '../engine/planner.ts';
import { STYLE_CATALOG } from '../engine/styles.ts';
import type { Skill } from '../engine/types.ts';
import { writeLesson } from './generate.ts';
import type { Complete } from './llm.ts';
import { PROMPT_VERSION, buildMessages } from './prompt.ts';
import { fetchStateRows, lessonSummaries, toPlannerState } from './state.ts';

/** A bad request from the client (HTTP 400). */
export class InputError extends Error {}

/** Validates the client's local date: a real YYYY-MM-DD within one day of the server's UTC date. */
export function checkDate(date: unknown, now: Date): string {
  const real = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date))
    && new Date(date).toISOString().slice(0, 10) === date;
  if (!real) throw new InputError(`date must be YYYY-MM-DD, got ${JSON.stringify(date)}`);
  if (Math.abs(Date.parse(date as string) - Date.parse(now.toISOString().slice(0, 10))) > 86_400_000) {
    throw new InputError(`date ${date} is more than a day from today`);
  }
  return date as string;
}

export interface LessonRecord {
  id: string; lesson_date: string; status: string; template: string; track: string | null; skill_id: string | null;
  key: string | null; plan: unknown; content: unknown; llm_model: string | null; prompt_version: string | null;
}
const COLUMNS = 'id, lesson_date, status, template, track, skill_id, key, plan, content, llm_model, prompt_version';

/** Today's lesson for the signed-in user: the existing row, or plan → model text (with fallback) → insert. Races converge on one row. */
export async function getOrCreateLesson(
  db: SupabaseClient, date: string, complete: Complete, models: (string | undefined)[],
): Promise<LessonRecord> {
  const existing = async (): Promise<LessonRecord | null> => {
    const { data, error } = await db.from('lessons').select(COLUMNS).eq('lesson_date', date).maybeSingle();
    if (error) throw error;
    return data as LessonRecord | null;
  };
  const found = await existing();
  if (found) return found;

  const rows = await fetchStateRows(db, date);
  const state = toPlannerState(rows, date);
  const plan = planLesson(state);
  const skills = new Map<string, Skill>(rows.skills.map(s => [s.id, s]));
  const style = plan.style_element ? STYLE_CATALOG.profiles.find(p => p.id === plan.style_element!.style) ?? null : null;
  const messages = buildMessages({ plan, skills, style, settings: state.settings, recent: lessonSummaries(rows.lessons), questions: rows.questions });
  // ponytail: two simultaneous first-opens both pay for a model call; the unique key keeps one row. Add a claim row if cost matters.
  const written = await writeLesson(messages, plan, skills, complete, models);

  const { data, error } = await db.from('lessons').insert({
    lesson_date: date, template: plan.template, track: plan.track, skill_id: plan.skill_id, key: plan.key,
    style_element: plan.style_element?.element_id ?? null, plan,
    content: { ...written.content, generation: written.attempts },
    llm_model: written.llm_model, prompt_version: PROMPT_VERSION,
  }).select(COLUMNS).single();
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const winner = await existing();
      if (winner) return winner;
    }
    throw error;
  }
  return data as LessonRecord;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/lesson/service.test.ts && npm run test:db && npm run typecheck`
Expected: service unit tests PASS (9). `test:db` PASS: 12 from Phase 1 plus 3 new, 15 in total. `tsc` exits 0.
- If sign-in fails with "Email logins are disabled", check `[auth.email] enable_signup` in `supabase/config.toml`. It should be `true` by default. Ledger any change.

- [ ] **Step 6: Write the edge function and its import map**

`supabase/functions/generate-lesson/deno.json`:
```json
{
  "imports": {
    "tonal": "npm:tonal@6.4.3",
    "@tombatossals/chords-db/": "npm:/@tombatossals/chords-db@0.5.1/",
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2.117.2"
  }
}
```

`supabase/functions/generate-lesson/index.ts`:
```ts
import { createClient } from '@supabase/supabase-js';
import { openRouterComplete } from '../_shared/lesson/llm.ts';
import { InputError, checkDate, getOrCreateLesson } from '../_shared/lesson/service.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

// POST { date: 'YYYY-MM-DD' } (the client's local date) → today's lesson row for the caller, created on first open.
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const date = checkDate((body as { date?: unknown }).date, new Date());
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false },
    });
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return reply({ error: 'not signed in' }, 401);
    const complete = openRouterComplete({
      baseUrl: Deno.env.get('LLM_BASE_URL') || 'https://openrouter.ai/api/v1', apiKey: Deno.env.get('LLM_API_KEY') ?? '',
    });
    return reply(await getOrCreateLesson(db, date, complete, [Deno.env.get('LLM_MODEL'), Deno.env.get('LLM_FALLBACK_MODEL')]));
  } catch (e) {
    console.error(e);
    return reply({ error: (e as Error).message }, e instanceof InputError ? 400 : 500);
  }
});
```

- [ ] **Step 7: Write `scripts/dev-session.ts` and its npm script**

`scripts/dev-session.ts`:
```ts
/**
 * Prints an access token for a user on the LOCAL Supabase, for curl-testing edge functions.
 *   node --env-file=.env.local scripts/dev-session.ts --email you@example.com
 * Creates the user if missing. Refuses to run against anything but 127.0.0.1/localhost.
 */
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { isMain } from './vault/lib.ts';

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { email: { type: 'string' } } });
  if (!values.email) throw new Error('--email is required');
  const url = process.env.SUPABASE_URL ?? '';
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error(`Refusing: ${url || 'SUPABASE_URL'} is not a local Supabase`);
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  if (!list.users.some(u => u.email?.toLowerCase() === values.email!.toLowerCase())) {
    const { error } = await admin.auth.admin.createUser({ email: values.email, email_confirm: true });
    if (error) throw error;
  }
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: values.email });
  if (linkError) throw linkError;
  const anon = createClient(url, process.env.ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (error || !data.session) throw error ?? new Error('no session returned');
  console.log(data.session.access_token);
}

if (isMain(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
```

```bash
npm pkg set "scripts.dev:session=node --env-file=.env.local scripts/dev-session.ts"
```

- [ ] **Step 8: Serve the function and call it as a throwaway local user**

Run it in the background: `supabase functions serve`. Wait for the line `Serving functions on http://127.0.0.1:55321/functions/v1/<function-name>`.

Then:
```bash
TOKEN=$(npm run -s dev:session -- --email dev-check@test.dev)
curl -s -X POST http://127.0.0.1:55321/functions/v1/generate-lesson \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"date\":\"$(date -u +%F)\"}" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log(r.error ?? [r.lesson_date,r.track,r.key,r.llm_model,r.content.title].join(' | '))})"
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:55321/functions/v1/generate-lesson \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"date":"1999-01-01"}'
```

Expected:
- The first call prints a line like `2026-09-28 | rhythm | G | fallback | …`. `llm_model` is `fallback` if `LLM_MODEL` is still blank, or the model ID if the user has already set one.
- The second call prints `400`.
- Stop the serve process afterwards, then delete the check user:

```bash
docker exec supabase_db_musiclessons psql -U postgres -c "delete from auth.users where email = 'dev-check@test.dev'"
```

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/_shared/lesson/service.ts supabase/functions/generate-lesson scripts/dev-session.ts package.json tests/lesson/service.test.ts tests/db/generate-lesson.test.ts
git commit -m "feat(edge): generate-lesson function with get-or-create service and race-safe insert"
```

---

### Task 7: Kimi vs Qwen side-by-side, and the user's choice

**Files:**
- Create: `scripts/compare-models.ts`
- Modify: `package.json`, adding the `compare:models` script.
- Test: `tests/scripts/compare-models.test.ts`
- Generated and committed: `docs/superpowers/model-comparison-<YYYY-MM-DD>.html`
- Modify: `docs/superpowers/specs/2026-09-28-guitar-coach-design.md` §13, recording the decision.
- Modify (not committed): `supabase/functions/.env`, setting `LLM_MODEL` and `LLM_FALLBACK_MODEL`.

**Interfaces:**
- Consumes:
  - `planLesson` and `STYLE_CATALOG` (Phase 1);
  - `buildMessages` (Task 3);
  - `openRouterComplete` (Task 4) and `parseJson` (Task 4);
  - `validateLesson`, `LESSON_JSON_SCHEMA` and `LessonContent` (Task 1);
  - `DEFAULT_SETTINGS` (Task 5).
- Produces:
  - `DEFAULT_MODELS: string[]`
  - `FIXTURES: { name: string; state: PlannerState }[]`
  - `interface Result { fixture: string; plan: LessonPlan; model: string; ok: boolean; errors: string[]; content: LessonContent | null; cost: number | null; ms: number }`
  - `renderComparison(results: Result[], models: string[], date: string): string`

- [ ] **Step 1: Write the failing tests**

`tests/scripts/compare-models.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { planLesson } from '../../supabase/functions/_shared/engine/planner.ts';
import { STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';
import { FIXTURES, renderComparison } from '../../scripts/compare-models.ts';

describe('FIXTURES', () => {
  it('cover a first lesson, a retest-and-review day and a repeat day on three tracks', () => {
    const plans = FIXTURES.map(f => planLesson(f.state, STYLE_CATALOG));
    expect(new Set(plans.map(p => p.track)).size).toBe(3);
    expect(plans[1].retest?.skill_id).toBe('fills.l1.sus_add_hammers');
    expect(plans[1].review.length).toBeGreaterThan(0);
    expect(plans[2]).toMatchObject({ is_repeat: true, track: 'fingerstyle', key: 'D', template: 'standard_25' });
  });
});

describe('renderComparison', () => {
  it('escapes model output, lists validation errors and meets the page contract', () => {
    const plan = planLesson(FIXTURES[0].state, STYLE_CATALOG);
    const html = renderComparison([{
      fixture: FIXTURES[0].name, plan, model: 'm1', ok: false, errors: ['chord not in plan: Bm7'],
      content: { title: '<script>alert(1)</script>', blocks: 'not an array' } as never, cost: 0.0123, ms: 1500,
    }], ['m1', 'm2'], '2026-09-28');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('chord not in plan: Bm7');
    expect(html).toContain('<title>Model Comparison</title>');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).toContain('not run');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/scripts/compare-models.test.ts`
Expected: FAIL, because `scripts/compare-models.ts` can't be resolved.

- [ ] **Step 3: Implement `scripts/compare-models.ts`**

`scripts/compare-models.ts`:
```ts
/**
 * Side-by-side model test (spec §12, Phase 2): three fixed plans through each model, one HTML page to pick the default.
 *   node --env-file=supabase/functions/.env scripts/compare-models.ts [--models a,b]
 * Costs a few cents per model. Writes docs/superpowers/model-comparison-<date>.html.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { planLesson } from '../supabase/functions/_shared/engine/planner.ts';
import { STYLE_CATALOG } from '../supabase/functions/_shared/engine/styles.ts';
import type { LessonPlan, PlannerState, Skill } from '../supabase/functions/_shared/engine/types.ts';
import { LESSON_JSON_SCHEMA, validateLesson, type LessonContent } from '../supabase/functions/_shared/lesson/contract.ts';
import { parseJson } from '../supabase/functions/_shared/lesson/generate.ts';
import { openRouterComplete } from '../supabase/functions/_shared/lesson/llm.ts';
import { buildMessages } from '../supabase/functions/_shared/lesson/prompt.ts';
import { DEFAULT_SETTINGS } from '../supabase/functions/_shared/lesson/state.ts';
import { SKILLS } from '../supabase/seed/curriculum.ts';
import { REPO_ROOT, isMain, today } from './vault/lib.ts';

export const DEFAULT_MODELS = ['moonshotai/kimi-k2.6', 'qwen/qwen3.7-plus'];
const SKILL_MAP = new Map<string, Skill>(SKILLS.map(s => [s.id, s]));
const base = (over: Partial<PlannerState>): PlannerState => ({
  today: '2026-10-10', settings: DEFAULT_SETTINGS, skills: SKILLS, progress: [], reviewItems: [], recentLessons: [], recentLogs: [], ...over,
});

/** A first lesson, a mid-progress day with retest and review, and a 25-minute "more time" repeat with a style element. */
export const FIXTURES: { name: string; state: PlannerState }[] = [
  { name: 'First lesson', state: base({}) },
  { name: 'Mid-progress with retest and review', state: base({
    progress: [
      { skill_id: 'rhythm.l1.locked_8ths', status: 'mastered', score: 0, current_target: 90, last_seen: '2026-09-20', last_key: 'D' },
      { skill_id: 'rhythm.l1.accents_palm_mute', status: 'mastered', score: 0, current_target: 85, last_seen: '2026-09-25', last_key: 'A' },
      { skill_id: 'fills.l1.sus_add_hammers', status: 'active', score: 1, current_target: 75, last_seen: '2026-10-09', last_key: 'G' },
    ],
    reviewItems: [
      { item_type: 'skill', ref: 'rhythm.l1.locked_8ths', interval_days: 3, next_due: '2026-10-08', last_result: true },
      { item_type: 'theory', ref: 'theory.l1.intervals', interval_days: 1, next_due: '2026-10-09', last_result: true },
    ],
    recentLessons: [
      { date: '2026-10-09', track: 'fills', skill_id: 'fills.l1.sus_add_hammers', key: 'G', style_element: null, want_more_time: false, status: 'completed' },
      { date: '2026-10-07', track: 'rhythm', skill_id: 'rhythm.l1.accents_palm_mute', key: 'A', style_element: null, want_more_time: false, status: 'completed' },
    ],
  }) },
  { name: 'Repeat day, 25 minutes', state: base({
    settings: { ...DEFAULT_SETTINGS, session_minutes: 25, vocal_low: 'A2', vocal_high: 'E4' },
    recentLessons: [{
      date: '2026-10-09', track: 'fingerstyle', skill_id: 'fingerstyle.l1.pima_pinches', key: 'D',
      style_element: { style: 'folk', element_id: 'folk.boom_chick', kind: 'rhythm', is_new: true }, want_more_time: true, status: 'completed',
    }],
  }) },
];

export interface Result {
  fixture: string; plan: LessonPlan; model: string; ok: boolean; errors: string[];
  content: LessonContent | null; cost: number | null; ms: number;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const chordify = (s: unknown) => esc(s).replace(/\{([^{}]+)\}/g, '<b class="chord">$1</b>');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown) => (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;

function lessonHtml(c: Record<string, unknown>): string {
  const blocks = arr(c.blocks).map(rec).map(b => `<section class="block"><h4>${esc(b.kind)}</h4><ol>` +
    arr(b.instructions).map(i => `<li>${chordify(i)}</li>`).join('') + '</ol>' +
    (b.target_text ? `<p class="target">Target: ${chordify(b.target_text)}</p>` : '') +
    (b.tips ? `<p class="muted">Tip: ${chordify(b.tips)}</p>` : '') +
    (b.explanation ? `<p class="muted">${chordify(b.explanation)}</p>` : '') + '</section>').join('');
  const songs = arr(c.songs).map(rec).map(s => `<li>${esc(s.title)} (${esc(s.artist)}, capo ${esc(s.capo)}): ${esc(s.why)}</li>`).join('');
  return `<h3>${esc(c.title)}</h3><p>${chordify(c.why_it_matters)}</p>` +
    `<details><summary>Theory card</summary><p>${chordify(c.theory_card)}</p></details>${blocks}` +
    `<p><strong>Create:</strong> ${chordify(c.create_prompt)}</p><p><strong>Songs</strong></p><ul>${songs}</ul>`;
}

const CSS = `:root{--bg:#fbfaf7;--fg:#1d1c1a;--muted:#6b675f;--line:#e2ded5;--card:#fff;--ok:#1f7a3f;--bad:#b3261e;--accent:#8a4b12}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#161513;--fg:#ece9e2;--muted:#a19c92;--line:#34312c;--card:#1f1d1a;--ok:#6cc58a;--bad:#f2867d;--accent:#e0a867}}
:root[data-theme="dark"]{--bg:#161513;--fg:#ece9e2;--muted:#a19c92;--line:#34312c;--card:#1f1d1a;--ok:#6cc58a;--bad:#f2867d;--accent:#e0a867}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px}
.muted{color:var(--muted)}.ok{color:var(--ok);font-weight:600}.bad{color:var(--bad)}.chord{color:var(--accent)}
table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px}
.col{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;min-width:0;overflow-wrap:anywhere}
.block{border-top:1px solid var(--line);padding-top:8px}.block h4{margin:8px 0 4px;text-transform:capitalize}.model{font-weight:600}`;

/** Renders the results as one self-contained HTML page: a summary table, then each fixture with a column per model. */
export function renderComparison(results: Result[], models: string[], date: string): string {
  const summary = models.map(m => {
    const r = results.filter(x => x.model === m);
    const cost = r.reduce((t, x) => t + (x.cost ?? 0), 0);
    const secs = r.length ? r.reduce((t, x) => t + x.ms, 0) / r.length / 1000 : 0;
    return `<tr><td>${esc(m)}</td><td>${r.filter(x => x.ok).length}/${r.length}</td><td>${secs.toFixed(1)} s</td><td>$${cost.toFixed(4)}</td></tr>`;
  }).join('');
  const sections = [...new Set(results.map(r => r.fixture))].map(name => {
    const rs = results.filter(r => r.fixture === name);
    const p = rs[0].plan;
    const cols = models.map(m => {
      const r = rs.find(x => x.model === m);
      if (!r) return `<div class="col"><p class="model">${esc(m)}</p><p class="muted">not run</p></div>`;
      const status = r.ok ? '<span class="ok">valid</span>'
        : `<span class="bad">invalid</span><ul class="bad">${r.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`;
      return `<div class="col"><p class="model">${esc(m)} · ${status} · ${(r.ms / 1000).toFixed(1)} s · $${(r.cost ?? 0).toFixed(4)}</p>` +
        `${r.content ? lessonHtml(rec(r.content)) : ''}</div>`;
    }).join('');
    return `<h2>${esc(name)}</h2><p class="muted">${esc(p.track)} · ${esc(p.skill_id)} · key ${esc(p.key)} · ` +
      `${esc(p.music.progression.chords.join(' '))}${p.style_element ? ` · style ${esc(p.style_element.element_id)}` : ''}</p><div class="grid">${cols}</div>`;
  }).join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>Model Comparison</title><style>${CSS}</style></head><body><main><h1>Model comparison</h1>` +
    `<p class="muted">${esc(date)} · the same three plans sent to each model. Pick the one you would rather practise from.</p>` +
    `<table><thead><tr><th>Model</th><th>Valid</th><th>Avg time</th><th>Cost</th></tr></thead><tbody>${summary}</tbody></table>` +
    `${sections}</main></body></html>`;
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { models: { type: 'string' } } });
  const models = values.models ? values.models.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_MODELS;
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY is missing: add it to supabase/functions/.env');
  const complete = openRouterComplete({ baseUrl: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1', apiKey, timeoutMs: 120_000 });
  const results: Result[] = [];
  for (const f of FIXTURES) {
    const plan = planLesson(f.state, STYLE_CATALOG);
    const style = plan.style_element ? STYLE_CATALOG.profiles.find(p => p.id === plan.style_element!.style) ?? null : null;
    const messages = buildMessages({ plan, skills: SKILL_MAP, style, settings: f.state.settings, recent: [], questions: [] });
    await Promise.all(models.map(async model => {
      const t0 = Date.now();
      try {
        const { text, cost } = await complete(model, messages, LESSON_JSON_SCHEMA);
        const parsed = parseJson(text);
        const v = validateLesson(parsed, plan, SKILL_MAP);
        results.push({ fixture: f.name, plan, model, ok: v.ok, errors: v.ok ? [] : v.errors,
          content: (parsed ?? null) as LessonContent | null, cost, ms: Date.now() - t0 });
      } catch (e) {
        results.push({ fixture: f.name, plan, model, ok: false, errors: [(e as Error).message], content: null, cost: null, ms: Date.now() - t0 });
      }
    }));
  }
  const date = today();
  const out = join(REPO_ROOT, 'docs', 'superpowers', `model-comparison-${date}.html`);
  writeFileSync(out, renderComparison(results, models, date));
  for (const m of models) {
    const r = results.filter(x => x.model === m);
    console.log(`${m}: ${r.filter(x => x.ok).length}/${r.length} valid, avg ${(r.reduce((t, x) => t + x.ms, 0) / r.length / 1000).toFixed(1)} s, ` +
      `$${r.reduce((t, x) => t + (x.cost ?? 0), 0).toFixed(4)}`);
    r.filter(x => !x.ok).forEach(x => console.log(`  ${x.fixture}: ${x.errors.slice(0, 3).join('; ')}`));
  }
  console.log(`→ ${out}`);
}

if (isMain(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
```

```bash
npm pkg set "scripts.compare:models=node --env-file=supabase/functions/.env scripts/compare-models.ts"
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/scripts/compare-models.test.ts && npm test && npm run typecheck`
Expected: PASS (2 tests); the full suite PASS; `tsc` exits 0.
- If the fixture test fails on track or key, the Phase 1 planner picked differently. Adjust only the `FIXTURES` states, not the assertions' intent: three distinct tracks, a retest on day 2, and a repeat on day 3. Ledger it.

- [ ] **Step 5: Commit the script**

```bash
git add scripts/compare-models.ts tests/scripts/compare-models.test.ts package.json
git commit -m "feat: Kimi vs Qwen side-by-side comparison script"
```

- [ ] **Step 6: Run the comparison (paid: about $0.05–0.25)**

First check that the key is present **without printing it**: `grep -c '^LLM_API_KEY=sk-or-' supabase/functions/.env`. Expected: `1`. If it isn't, stop and ask the user to add it.

Run: `npm run compare:models`
Expected: one summary line per model (e.g. `moonshotai/kimi-k2.6: 3/3 valid, avg 25.1 s, $0.0350`) and `→ …/docs/superpowers/model-comparison-<date>.html`.
- A model may fail with `404 … No endpoints found matching your data policy`. That means no provider for it satisfies "no training on prompts" (spec §7). Report it to the user; **do not relax** `data_collection: 'deny'`.
- If a model returns invalid lessons, read its errors. A prompt fault that affects both models, such as both naming chords outside the plan, is fixed in `SYSTEM_PROMPT`. Bump `PROMPT_VERSION`, re-run once and ledger it. A fault in one model alone is part of the comparison, so leave it.

- [ ] **Step 7: Publish the page and ask the user to choose**

- Publish `docs/superpowers/model-comparison-<date>.html` as a private artifact. Load `artifact-design` first; the page already uses `:root` tokens, dark mode and a 16px gutter.
- Send the link with the summary table.
- **Stop and ask:** "Which model should be the default, and which the fallback?" Don't pick for the user.

- [ ] **Step 8: Record the choice**

Set the two variables without reading or printing the file. `DEFAULT` and `FALLBACK` are the user's picks:
```bash
F=supabase/functions/.env
for kv in "LLM_MODEL=$DEFAULT" "LLM_FALLBACK_MODEL=$FALLBACK" "LLM_BASE_URL=https://openrouter.ai/api/v1"; do
  k=${kv%%=*}
  if grep -q "^$k=" "$F"; then sed -i "s|^$k=.*|$kv|" "$F"; else echo "$kv" >> "$F"; fi
done
grep -E '^LLM_(MODEL|FALLBACK_MODEL|BASE_URL)=' "$F"
```
Expected: the three lines are printed, and the key line isn't among them.

In the spec, replace §13 item 1 with:
```markdown
1. Default LLM: **decided 2026-MM-DD** by the Phase 2 side-by-side (`docs/superpowers/model-comparison-<date>.html`): default `<DEFAULT>`, fallback `<FALLBACK>`.
```

- [ ] **Step 9: Commit the decision record**

```bash
git add docs/superpowers/model-comparison-*.html docs/superpowers/specs/2026-09-28-guitar-coach-design.md
git commit -m "docs: model comparison results and default LLM decision"
```

---

### Task 8: End-to-end check with the real account, and the handoff

**Files:**
- Modify: `README.md`, adding a Phase 2 setup section.
- Create: `docs/SESSION_HANDOFF_<YYYY-MM-DD>.md`. Add a suffix `b`, `c`, … if that file already exists.

- [ ] **Step 1: Run everything**

Run: `npm test && npm run test:db && npm run typecheck && npm run vault:sync`
Expected: every suite passes, `tsc` exits 0, and the vault syncs. `Codebase/_actions/action.generate-lesson.md` now exists. Copy the pass counts into the handoff.

- [ ] **Step 2: Add the setup section to `README.md`**

Append:
````markdown
## LLM setup (Phase 2)
`supabase/functions/.env` (gitignored, never commit it):
```
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-...
LLM_MODEL=<default model id>
LLM_FALLBACK_MODEL=<fallback model id>
```
Run locally: `supabase functions serve`, then `TOKEN=$(npm run -s dev:session -- --email you@example.com)` and
`curl -X POST http://127.0.0.1:55321/functions/v1/generate-lesson -H "Authorization: Bearer $TOKEN" -d '{"date":"YYYY-MM-DD"}'`.
Compare models: `npm run compare:models -- --models a,b` (paid, a few cents).
````

- [ ] **Step 3: Generate today's real lesson for the user's account (paid: about $0.01)**

Run `supabase functions serve` in the background, then:
```bash
TOKEN=$(npm run -s dev:session -- --email 66Fishmarket@gmail.com)
curl -s -X POST http://127.0.0.1:55321/functions/v1/generate-lesson \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"date\":\"$(date +%F)\"}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);if(r.error){console.log(r.error);return}const c=r.content;console.log([r.lesson_date,r.track,r.skill_id,r.key,r.llm_model].join(' | '));console.log(c.title);c.blocks.forEach(b=>console.log('- '+b.kind+': '+b.instructions[0]));console.log('attempts: '+JSON.stringify(c.generation.map(a=>[a.model,a.errors.length,a.cost])))})"
```
Expected: `llm_model` is the chosen default model or the fallback model, not `fallback`. A title and one line per block follow.
- If it says `fallback`, read `attempts` and use superpowers:systematic-debugging. Don't re-run blindly: every call costs money.
- Stop the serve process afterwards. The lesson row stays; it is the user's real lesson for today.

- [ ] **Step 4: Write the handoff**

Use the session-handoff format with 4 sections: what we did, what's next, decisions, and gotchas. It must record:
- the Phase 2 commits (`git log --oneline <phase-2 base>..dev`);
- the test counts;
- the comparison summary, the chosen models and the cost so far;
- today's real lesson title;
- the spec deviations listed in this plan's header;
- open items for Phase 3: the Today player, auth UI, PWA and Netlify deploy. The PWA must send the local date to `generate-lesson` and render `{Chord}` braces as chips.
- the deferred minors carried from Phase 1 that are still open.

- [ ] **Step 5: Commit and ask before any push or merge**

```bash
git add README.md docs/SESSION_HANDOFF_*.md
git commit -m "docs: Phase 2 session handoff"
```

Ask the user whether to push `dev` or open a PR to `main`. Do neither without a yes.
