# Lesson Through-line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every lesson says what each section is and why, how it links to the previous one (or that it's a change of focus), and plays the scale in Apply when the scale came from the day's style.

**Architecture:** A new pure function `lessonThread(plan, skills)` in `supabase/functions/_shared/lesson/thread.ts` works out the links and writes each block's `intro` and `bridge`, plus the lesson `path`. `buildSteps` merges these into its blocks and adds the Apply link step. `assembleLesson` stores `path`. The app renders intro/bridge in Player and the path on Today. All text is engine-written; the LLM colour layer is unchanged except that it now sees the path.

**Tech Stack:** TypeScript, Vitest, React (Vite PWA), Supabase edge functions (Deno), tonal.

**Spec:** `docs/superpowers/specs/2026-10-07-lesson-through-line-design.md`

## Global Constraints

- Framing text is engine-written, never LLM (CLAUDE.md "Learner-first explanations").
- "Link where natural only": the planner is not changed.
- New fields are optional on stored content (`BlockContent.intro?`, `bridge?`, `LessonContent.path?`); old lessons and the fallback lesson must still render.
- Every step that asks the learner to play something shows it ("show what you say"): the Apply link step shows the scale card.
- A new music term in engine-written text needs a glossary entry in the same commit (`node scripts/render-glossary.ts`).
- Instructions say "the note G", never a bare "on G".
- Bridges always start with one of: `Change of focus: `, `Same `, `Part of today's `.
- **Spec deviation (deliberate):** the Apply intro does not quote `feel.accents`. Those strings carry many undefined terms
  (tumbao, golpe, clave, chank, tresillo), which would each need a glossary entry. The intro uses style + element name only.
  Task 4 updates the spec to match.
- Work on `dev`. Ask before merging to `main` or deploying.

## Review Focus

1. **Stored lessons from before this change** (no `intro`/`bridge`/`path`): Player and Today must render with no empty boxes. Pinned in Task 3 (`blockText` defaults test).
2. **A style whose first scale is `major`** (folk, country, pop…): the warm-up intro still reads naturally, and Apply still gets the link step. Pinned in Task 1 (sweep covers every profile) and Task 2 (folk Apply link step test).
3. **A one-chord vamp day** (funk Im7): the Apply link step and the vamp line must both appear, in order, with no "then through". Pinned in Task 2 (FUNK_PLAN apply test).
4. **A plan with no review or retest block**: the path must not mention them. Pinned in Task 1 (PLAN path test).
5. **Profile names with parentheses** ("Country (classic/Nashville + modern)"): the intro/bridge must use the short name "Country". Pinned in Task 1 (`shortStyleName` test).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/functions/_shared/lesson/thread.ts` (new) | `lessonThread`: links, per-block intro/bridge, path |
| `supabase/functions/_shared/engine/create.ts` | `CreateTask` gains `label` and `why` |
| `supabase/functions/_shared/lesson/steps.ts` | merge thread into blocks, Apply link step, theory day-scale, `EngineSteps` type |
| `supabase/functions/_shared/engine/theory.ts` | `THEORY_DAY_SCALE`; `theory.l1.degrees` text uses `{scale}` |
| `supabase/functions/_shared/lesson/contract.ts` | optional `intro`, `bridge`, `path` on stored content |
| `supabase/functions/_shared/lesson/fallback.ts`, `generate.ts`, `prompt.ts` | use `EngineSteps`; store `path`; brief carries intro/bridge/path |
| `src/lib/lesson.ts` | `blockText`/`blockTerms` carry intro/bridge; `stepElements` handles the 4-step Apply |
| `src/screens/Player.tsx`, `src/screens/Today.tsx` | render intro/bridge and path |
| `tests/lesson/fixtures.ts` | `FUNK_PLAN` (today's real lesson) |
| `tests/lesson/thread.test.ts` (new), `tests/lesson/steps.test.ts`, `tests/app/blockText.test.ts`, `tests/lesson/prompt.test.ts` | tests |

---

### Task 1: `lessonThread` and Create task labels

**Files:**
- Create: `supabase/functions/_shared/lesson/thread.ts`
- Modify: `supabase/functions/_shared/engine/create.ts` (interface + 5 tasks)
- Modify: `tests/lesson/fixtures.ts`
- Test: `tests/lesson/thread.test.ts`

**Interfaces:**
- Consumes: `LessonPlan`, `Skill` (`engine/types.ts`); `STYLE_CATALOG` (`engine/styles.ts`); `termsIn` (`engine/glossary.ts`); `recipeFor` (`engine/recipes.ts`); `CREATE_TASKS` (`engine/create.ts`).
- Produces:
  - `export interface BlockThread { intro: string; bridge: string }`
  - `export interface LessonThread { scaleInApply: boolean; path: string[]; blocks: Partial<Record<BlockKind, BlockThread>> }`
  - `export function lessonThread(plan: LessonPlan, skills: Map<string, Skill>): LessonThread`
  - `export const shortStyleName = (name: string) => string`
  - `CreateTask.label: string`, `CreateTask.why: string`
  - fixture `FUNK_PLAN: LessonPlan`

- [ ] **Step 1: Add the fixture**

Append to `tests/lesson/fixtures.ts` (add the imports at the top):

```ts
import { buildMusic } from '../../supabase/functions/_shared/engine/music.ts';
import { elementsOf, STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';

const FUNK = STYLE_CATALOG.profiles.find(p => p.id === 'funk')!;
const SCRATCH = elementsOf(FUNK).find(e => e.id === 'funk.the_one_scratch')!;
/** 2026-10-07's real lesson: B-string rule in G, funk "The One + scratch", so G dorian over a Gm7 vamp, question and answer. */
export const FUNK_PLAN: LessonPlan = {
  ...PLAN, key: 'G', track: 'fretboard', skill_id: 'fretboard.l1.b_string_rule', create_task_id: 'question_answer',
  music: buildMusic({ key: 'G', track: 'fretboard', style: FUNK, element: SCRATCH }),
  style_element: { style: 'funk', element_id: SCRATCH.id, kind: 'rhythm', is_new: true },
};
```

(`fixtures.ts` already imports `StyleCatalog` as a type from `styles.ts`; merge the import lines.)

- [ ] **Step 2: Write the failing tests**

Create `tests/lesson/thread.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildMusic } from '../../supabase/functions/_shared/engine/music.ts';
import { targetFor } from '../../supabase/functions/_shared/engine/planner.ts';
import { elementsOf, STYLE_CATALOG } from '../../supabase/functions/_shared/engine/styles.ts';
import { GLOSSARY } from '../../supabase/functions/_shared/engine/glossary.ts';
import type { LessonPlan } from '../../supabase/functions/_shared/engine/types.ts';
import { lessonThread, shortStyleName } from '../../supabase/functions/_shared/lesson/thread.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';
import { FUNK_PLAN, PLAN, SKILL_MAP } from './fixtures.ts';

const BRIDGE = /^(Change of focus: |Same |Part of today's )/;

describe('lessonThread', () => {
  it('links the funk day: Dorian is funk\'s scale, so Apply plays it; the B-string rule is a change of focus', () => {
    const t = lessonThread(FUNK_PLAN, SKILL_MAP);
    expect(t.scaleInApply).toBe(true);
    const dorian = GLOSSARY.find(g => g.id === 'dorian')!;
    expect(t.blocks.warmup!.intro).toContain(dorian.plain);
    expect(t.blocks.warmup!.intro).toContain('Funk players');
    expect(t.blocks.new_skill!.bridge).toBe('Change of focus: The B-string rule. Nothing carries over from the G dorian warm-up here.');
    expect(t.blocks.apply!.bridge).toContain('Same G dorian notes, now over the {Gm7} groove');
    expect(t.blocks.create!.bridge).toBe('Same {Gm7} as Apply. The notes come from the G dorian warm-up.');
    expect(t.path[0]).toBe('Warm-up: G dorian → Apply plays it over a Funk groove on {Gm7}.');
    expect(t.path).toContain('New skill: The B-string rule (separate from the scale).');
  });
  it('explains I–IV–V–I with the circle of fifths on a no-style day, and the path skips blocks the day lacks', () => {
    const t = lessonThread(PLAN, SKILL_MAP);
    expect(t.scaleInApply).toBe(false);
    const [i, iv, v] = PLAN.music.progression.chords;
    expect(t.blocks.apply!.intro).toContain(`{${iv}} and {${v}} sit either side of {${i}} on the circle of fifths`);
    expect(t.blocks.apply!.bridge).toMatch(/^Change of focus: /);
    expect(t.path.some(l => l.startsWith('Review'))).toBe(false); // PLAN has no review block
    expect(t.path.some(l => l.startsWith('Apply: strumming'))).toBe(true);
  });
  it('shortens profile names with a bracketed qualifier', () => {
    expect(shortStyleName('Country (classic/Nashville + modern)')).toBe('Country');
    expect(shortStyleName('R&B / neo-soul')).toBe('R&B / neo-soul');
  });
  it('gives every block but reset/record an intro and every later block a bridge, for every skill × style × key', () => {
    const retestSkill = SKILLS.find(s => s.id === 'rhythm.l1.locked_8ths')!;
    const theoryTopic = SKILLS.find(s => s.track === 'theory')!;
    const practice = SKILLS.filter(s => s.track !== 'theory');
    const choices = [{ profile: null, element: null }, ...STYLE_CATALOG.profiles.map(p => ({ profile: p, element: elementsOf(p)[0] }))];
    for (const { profile, element } of choices) for (const key of ['C', 'G', 'Bb', 'E']) {
      const music = buildMusic({ key, track: 'rhythm', style: profile, element });
      for (const skill of practice) {
        const plan: LessonPlan = {
          ...PLAN, key, skill_id: skill.id, music,
          style_element: element ? { style: profile!.id, element_id: element.id, kind: element.kind, is_new: false } : null,
          retest: { skill_id: retestSkill.id, target: targetFor(retestSkill) },
          review: [{ item_type: 'theory', ref: theoryTopic.id }],
          blocks: [
            { kind: 'retest', minutes: 2, items: [{ ref: `skill:${retestSkill.id}`, target: targetFor(retestSkill) }] },
            ...PLAN.blocks.slice(0, 3), // warmup, new_skill, reset
            { kind: 'review', minutes: 5, items: [{ ref: `theory:${theoryTopic.id}`, target: null }] },
            ...PLAN.blocks.slice(3), // apply, create, record
          ],
        };
        const t = lessonThread(plan, SKILL_MAP);
        const where = `${profile?.id ?? 'none'} ${key} ${skill.id}`;
        for (const b of plan.blocks) {
          const bt = t.blocks[b.kind];
          if (b.kind === 'reset') { expect(bt, where).toBeUndefined(); continue; }
          if (b.kind !== 'record') expect(bt?.intro, `${where} ${b.kind}`).toBeTruthy();
          if (b.kind !== 'warmup') expect(bt?.bridge, `${where} ${b.kind}`).toMatch(BRIDGE);
        }
        expect(t.path.length, where).toBeGreaterThan(0);
        expect(t.path.length, where).toBeLessThanOrEqual(5);
        expect(t.scaleInApply, where).toBe(!!profile && profile.scales[0] === music.scale.name);
      }
    }
  });
});
```

Check `PLAN.blocks` order first: `tests/lesson/fixtures.ts` says warmup/new_skill/reset/apply/create/record. If it differs, adjust the two `slice` calls.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/lesson/thread.test.ts`
Expected: FAIL, cannot resolve `thread.ts`.

- [ ] **Step 4: Add `label` and `why` to Create tasks**

In `supabase/functions/_shared/engine/create.ts`, change the interface:

```ts
/** `show`: per step, what Player shows besides the text (the prompt card is always on); the recorder only on RECORD.
 * `label` names the task in the lesson path; `why` is the Create block's always-visible intro (lesson/thread.ts). */
export interface CreateTask { id: string; label: string; why: string; prompt: string; steps: string[]; show: StepElement[][]; songwriting?: string[] }
```

Add to each task, right after `id`:

| id | label | why |
|---|---|---|
| `melody_135` | `'a four-bar tune on 1, 3 and 5'` | `'Notes 1, 3 and 5 are the chord\'s own notes, so a tune built from them always fits: the safest way into writing a melody.'` |
| `question_answer` | `'a question-and-answer phrase'` | `'Most melodies are phrases that ask and answer: ending on 5 sounds open, ending on 1 sounds finished. Two bars each is the shortest version of that.'` |
| `rhyming_couplet` | `'a sung rhyming couplet'` | `'Words on a held pitch are a song in miniature, and holding the pitch lets you hear the chords colour it.'` |
| `new_feel` | `'a new feel for the same chords'` | `'Changing one thing in the rhythm shows how much of a song\'s mood lives in the groove rather than the chords.'` |
| `one_note_verse` | `'a one-note verse line'` | `'Holding one pitch while the chords move is how many verses work: the harmony changes the note\'s colour under you.'` |

- [ ] **Step 5: Write `thread.ts`**

Create `supabase/functions/_shared/lesson/thread.ts`:

```ts
import { CREATE_TASKS } from '../engine/create.ts';
import { termsIn } from '../engine/glossary.ts';
import { recipeFor } from '../engine/recipes.ts';
import { STYLE_CATALOG } from '../engine/styles.ts';
import type { BlockKind, LessonPlan, Skill } from '../engine/types.ts';

export interface BlockThread { intro: string; bridge: string }
export interface LessonThread {
  /** The scale came from today's style, so Apply plays it (spec 2026-10-07 §5). */
  scaleInApply: boolean;
  /** Today's path: 1–5 lines for the Today screen. */
  path: string[];
  /** reset gets no entry; record gets a bridge only; warmup an intro only. */
  blocks: Partial<Record<BlockKind, BlockThread>>;
}

/** "Country (classic/Nashville + modern)" → "Country": profile names carry a bracketed qualifier the learner doesn't need. */
export const shortStyleName = (name: string): string => name.replace(/\s*\(.*\)\s*$/, '');

const braced = (chords: string[]) => [...new Set(chords)].map(c => `{${c}}`).join(' ');

/** How today's blocks connect: a what-and-why intro per block, a bridge naming the link or the change of focus,
 * and the lesson path. Links only where the plan already has them (owner, 2026-10-07: "link where natural only"). */
export function lessonThread(plan: LessonPlan, skills: Map<string, Skill>): LessonThread {
  const { key, music } = plan;
  const scale = `${key} ${music.scale.name}`;
  const chords = braced(music.progression.chords);
  const has = (k: BlockKind) => plan.blocks.some(b => b.kind === k);
  const profile = plan.style_element ? STYLE_CATALOG.profiles.find(p => p.id === plan.style_element!.style) : undefined;
  const element = plan.style_element ? STYLE_CATALOG.elements.find(e => e.id === plan.style_element!.element_id) : undefined;
  const style = profile ? shortStyleName(profile.name) : '';
  const scaleInApply = !!profile && profile.scales[0] === music.scale.name;
  const skill = skills.get(plan.skill_id);
  const sameScale = !!skill && recipeFor(skill).card === 'scale';
  const inStyle = !!skill && !!profile && !!skill.styles?.includes(profile.id);
  const retest = plan.retest ? skills.get(plan.retest.skill_id) : undefined;
  const task = CREATE_TASKS.find(t => t.id === plan.create_task_id) ?? CREATE_TASKS[0];
  const scaleTerm = termsIn([music.scale.name])[0];
  const [i, iv, v] = music.progression.chords;
  const iivvi = !profile && music.progression.roman.join(' ') === 'I IV V I';

  const blocks: LessonThread['blocks'] = {
    warmup: {
      intro: `${scaleTerm?.plain ?? `${scale} is today's scale.`}${scaleInApply ? ` It's today's scale because ${style} players build their phrases from it, and Apply uses it.` : ''}`,
      bridge: '',
    },
    retest: {
      intro: retest?.description ?? '',
      bridge: `Change of focus: a cold check on ${retest?.name ?? 'an earlier skill'} from an earlier lesson.`,
    },
    new_skill: {
      intro: skill?.description ?? '',
      bridge: sameScale ? `Same ${scale} as the warm-up.`
        : inStyle ? `Part of today's ${style} style.`
        : `Change of focus: ${skill?.name ?? plan.skill_id}. Nothing carries over from the ${scale} warm-up here.`,
    },
    review: {
      intro: 'Spaced review: a quick pass over things you learned earlier, so they stick.',
      bridge: 'Change of focus: a quick pass over earlier material.',
    },
    apply: {
      intro: profile && element ? `${style} groove: ${element.name}.`
        : iivvi ? `{${iv}} and {${v}} sit either side of {${i}} on the circle of fifths: home, its two nearest neighbours, then home again. That's why it sounds settled.`
        : `Strumming ${chords} with today's rhythm.`,
      bridge: scaleInApply
        ? `Same ${scale} notes, now over the ${chords} groove: ${style} players build their phrases from this scale.`
        : 'Change of focus: rhythm. The warm-up scale isn\'t used here; this is about locking the strum to the beat.',
    },
    create: {
      intro: task.why,
      bridge: `Same ${chords} as Apply.${scaleInApply ? ` The notes come from the ${scale} warm-up.` : ''}`,
    },
    record: { intro: '', bridge: 'Same groove as Apply.' },
  };

  const path: string[] = [];
  if (has('warmup')) path.push(`Warm-up: ${scale}${scaleInApply ? ` → Apply plays it over a ${style} groove on ${chords}.` : '.'}`);
  if (has('new_skill')) path.push(`New skill: ${skill?.name ?? plan.skill_id}${sameScale || inStyle ? '.' : ' (separate from the scale).'}`);
  if (has('apply') && !scaleInApply) path.push(`Apply: ${profile ? `${style} groove` : 'strumming'} on ${chords}.`);
  if (has('review')) { const n = plan.review.length; path.push(`Review: ${n} earlier item${n === 1 ? '' : 's'}.`); }
  if (has('create')) path.push(`Create: ${task.label} on ${chords}.`);

  for (const k of Object.keys(blocks) as BlockKind[]) if (!has(k)) delete blocks[k];
  return { scaleInApply, path: path.slice(0, 5), blocks };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/lesson/thread.test.ts`
Expected: PASS (4 tests). If the warm-up intro test fails because the dorian entry's `plain` wording differs, read it in `glossary.ts` (id `dorian`) — the test compares against the live entry, so a failure means `termsIn` didn't find it: check `music.scale.name` is `'dorian'`.

- [ ] **Step 7: Glossary check**

Run: `node scripts/render-glossary.ts` and `npx vitest run tests/engine/glossary.test.ts`
Expected: no new failures. The new text uses only existing terms (scale, phrase, groove, circle of fifths, chord, melody, rhythm, harmony); if the glossary test flags a term, add the entry before committing.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/lesson/thread.ts supabase/functions/_shared/engine/create.ts tests/lesson/thread.test.ts tests/lesson/fixtures.ts
git commit -m "lessonThread: intro, bridge and path that say how today's sections link

Owner found 2026-10-07's lesson disjointed: Dorian came from the funk style but nothing said so.
Links only where the plan already has them; everything else is called a change of focus."
```

---

### Task 2: Engine steps carry the thread, Apply plays the scale, theory uses the day's scale

**Files:**
- Modify: `supabase/functions/_shared/lesson/steps.ts:21-25` (EngineBlock), `:49` (buildSteps signature), `:102-104` (make), `:120-126` (theory review), `:129-141` (apply), `:155` (return)
- Modify: `supabase/functions/_shared/engine/theory.ts` (header comment, `theory.l1.degrees`, new `THEORY_DAY_SCALE`)
- Modify: `supabase/functions/_shared/lesson/contract.ts:8,12-17` (optional fields)
- Modify: `supabase/functions/_shared/lesson/fallback.ts:24-34`, `supabase/functions/_shared/lesson/generate.ts:29`, `supabase/functions/_shared/lesson/prompt.ts:18`
- Test: `tests/lesson/steps.test.ts`, `tests/lesson/fallback.test.ts`

**Interfaces:**
- Consumes: `lessonThread` (Task 1), `FUNK_PLAN` (Task 1).
- Produces:
  - `export interface EngineSteps { blocks: EngineBlock[]; create_prompt: string; path: string[] }` from `steps.ts`
  - `EngineBlock.intro: string`, `EngineBlock.bridge: string`
  - `BlockContent.intro?: string`, `BlockContent.bridge?: string`, `LessonContent.path?: string[]`
  - `export const THEORY_DAY_SCALE: ReadonlySet<string>` from `theory.ts`
  - Apply link step text (index 2 of 4): `Every fourth bar, swap the groove for a short {key} {scale} phrase from the warm-up shape: four notes, ending on the note {degrees:1}. Then straight back into the groove.`

- [ ] **Step 1: Write the failing tests**

Add to `tests/lesson/steps.test.ts` inside `describe('buildSteps', …)` (import `FUNK_PLAN` from `./fixtures.ts`, `assembleLesson`, `fallbackColour` from `../../supabase/functions/_shared/lesson/fallback.ts`):

```ts
  it('plays the warm-up scale in Apply when it came from the style (funk vamp: link step after the vamp line)', () => {
    const apply = buildSteps(FUNK_PLAN, SKILL_MAP).blocks.find(b => b.kind === 'apply')!;
    expect(apply.instructions).toHaveLength(4);
    expect(apply.instructions[1]).toContain('one-chord vamp');
    expect(apply.instructions[2]).toBe('Every fourth bar, swap the groove for a short G dorian phrase from the warm-up shape: four notes, ending on the note G. Then straight back into the groove.');
    expect(apply.instructions.join(' ')).not.toContain('then through');
  });
  it('adds the link step on a major-scale style day too (folk), and not on a no-style day', () => {
    const folk = STYLE_CATALOG.profiles.find(p => p.id === 'folk')!;
    const el = elementsOf(folk)[0];
    const plan = { ...PLAN, music: buildMusic({ key: 'G', track: 'rhythm', style: folk, element: el }),
      style_element: { style: 'folk', element_id: el.id, kind: el.kind, is_new: false } };
    expect(buildSteps(plan, SKILL_MAP).blocks.find(b => b.kind === 'apply')!.instructions[2]).toContain('G major phrase');
    expect(buildSteps(PLAN, SKILL_MAP).blocks.find(b => b.kind === 'apply')!.instructions).toHaveLength(3);
  });
  it('puts the thread on every block and the path on the stored lesson', () => {
    const steps = buildSteps(FUNK_PLAN, SKILL_MAP);
    expect(steps.blocks.find(b => b.kind === 'new_skill')!.bridge).toMatch(/^Change of focus: /);
    expect(steps.blocks.find(b => b.kind === 'reset')!).toMatchObject({ intro: '', bridge: '' });
    expect(steps.path[0]).toContain('G dorian →');
    const lesson = assembleLesson(FUNK_PLAN, SKILL_MAP, fallbackColour(FUNK_PLAN, SKILL_MAP), true, steps);
    expect(lesson.path).toEqual(steps.path);
    expect(lesson.blocks[0].intro).toBe(steps.blocks[0].intro);
  });
  it('reviews scale degrees in the day\'s scale, not forced major', () => {
    const plan = { ...FUNK_PLAN, review: [{ item_type: 'theory' as const, ref: 'theory.l1.degrees' }],
      blocks: [...FUNK_PLAN.blocks, { kind: 'review' as const, minutes: 5, items: [{ ref: 'theory:theory.l1.degrees', target: null }] }] };
    const review = buildSteps(plan, SKILL_MAP).blocks.find(b => b.kind === 'review')!;
    expect(review.instructions[0]).toContain('Play G dorian, the notes G, A, Bb, C, D, E');
  });
```

Before writing the last assertion, check how `listNotes` (`engine/render.ts`) joins notes (comma list vs "and") by running `npx vitest run tests/lesson/steps.test.ts -t degrees` once after Step 3 and adjusting the expected string to the exact rendered list — the point of the test is "G dorian" and "Bb" (dorian's b3), not the punctuation.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/lesson/steps.test.ts`
Expected: FAIL (3 apply instructions; `path` undefined; "G major" in the review).

- [ ] **Step 3: Implement**

`supabase/functions/_shared/engine/theory.ts`: in the header comment replace "lesson/steps.ts renders these against the key's MAJOR scale (so a minor-flavoured style day can't give wrong notes); the text says "{key} major" wherever the scale matters." with "lesson/steps.ts renders these against the key's MAJOR scale (so a minor-flavoured style day can't give wrong notes), except topics in THEORY_DAY_SCALE, whose text works in any 7-note scale and uses {scale}." Change `theory.l1.degrees` to:

```ts
  'theory.l1.degrees':
    'every note in a key has a number. Play {key} {scale}, the notes {degrees:1,2,3,4,5,6,7}, saying 1 to 7 as you go, then jump straight to 1, 3 and 5 by number.',
```

and append after the `THEORY_REVIEWS` object:

```ts
/** Theory reviews that read right in the day's scale (spec 2026-10-07 §7); every other topic stays in {key} major. */
export const THEORY_DAY_SCALE: ReadonlySet<string> = new Set(['theory.l1.degrees']);
```

`supabase/functions/_shared/lesson/steps.ts`:

```ts
import { THEORY_DAY_SCALE, THEORY_REVIEWS } from '../engine/theory.ts';
import { lessonThread } from './thread.ts';
```

```ts
export interface EngineBlock {
  kind: BlockKind; instructions: string[]; target_text: string; listen_for: string;
  /** What the block is and why (always visible), and how it links to what came before; '' when none (lesson/thread.ts). */
  intro: string; bridge: string;
  /** Review only, one per step: a style rhythm item's grid so the app can draw its card (the catalogue stays server-side); null otherwise. */
  rhythms?: (ReviewRhythm | null)[];
}
/** buildSteps' output: the blocks, the Create prompt card and the lesson path for the Today screen. */
export interface EngineSteps { blocks: EngineBlock[]; create_prompt: string; path: string[] }
```

Signature: `export function buildSteps(plan: LessonPlan, skills: Map<string, Skill>): EngineSteps {` and after `const base = slotContext(plan, {});` add `const thread = lessonThread(plan, skills);`.

`make` becomes:

```ts
    const make = (instructions: string[], listen_for = ''): EngineBlock => ({
      kind: b.kind, instructions, target_text, listen_for,
      intro: thread.blocks[b.kind]?.intro ?? '', bridge: thread.blocks[b.kind]?.bridge ?? '',
    });
```

Theory review line:

```ts
          return renderSteps([`${skillOf(ref)?.name ?? ref}: ${THEORY_REVIEWS[ref]}`], { ...base, scale: THEORY_DAY_SCALE.has(ref) ? base.scale : 'major' })[0];
```

Apply case:

```ts
      case 'apply': {
        const ctx = plan.music.rhythm ? base : slotContext(plan, { grid: APPLY_DEFAULT_GRID, gridName: 'Steady down-strums' });
        // A one-chord progression (funk's Dorian vamp) has no "through" to play, so say why it's one chord instead.
        const vamp = new Set(plan.music.progression.chords).size === 1;
        return make(renderSteps([
          '{rhythm_name}: {rhythm_counts}',
          vamp
            ? 'This is a one-chord vamp: stay on {chord1} for 8 bars or more. Nothing changes in the harmony, so all the interest is in the rhythm; keep it tight and even.'
            : 'Play it on {chord1} until it is steady, then through {chords}, one chord per bar.',
          // The scale came from today's style: play it, don't just mention it (spec 2026-10-07 §5). Shown with the scale card (src/lib/lesson.ts).
          ...(thread.scaleInApply ? ['Every fourth bar, swap the groove for a short {key} {scale} phrase from the warm-up shape: four notes, ending on the note {degrees:1}. Then straight back into the groove.'] : []),
          'Keep the picking hand going and hum or sing any tune over it.',
        ], ctx));
      }
```

Return: `return { blocks: plan.blocks.map(build), create_prompt: renderSteps([task.prompt], base)[0], path: thread.path };`

`supabase/functions/_shared/lesson/contract.ts`:

```ts
export interface BlockContent { kind: BlockKind; instructions: string[]; target_text: string; listen_for: string; more: string; tips?: string; explanation?: string; rhythms?: (ReviewRhythm | null)[];
  /** Engine-written framing (lesson/thread.ts); absent on lessons stored before 2026-10-07. */
  intro?: string; bridge?: string }
```

and in `LessonContent` add `/** Today's path (lesson/thread.ts); absent on lessons stored before 2026-10-07. */ path?: string[];`

`fallback.ts`: import `type EngineSteps` instead of `type EngineBlock`; parameter `steps: EngineSteps = buildSteps(plan, skills),`; destructure `const { blocks, create_prompt, path } = steps;` and add `path,` after `create_prompt,` in the returned object.

`generate.ts:29`: `steps: EngineSteps = buildSteps(plan, skills),` and fix its import (`type EngineSteps` from `./steps.ts`; drop `EngineBlock` if now unused).

`prompt.ts:18`: `steps?: EngineSteps;` and fix the import likewise.

- [ ] **Step 4: Run the lesson and engine suites**

Run: `npx vitest run tests/lesson tests/engine && npx tsc --noEmit -p .`
Expected: all PASS, tsc silent. If an existing test builds an `EngineBlock` literal without `intro`/`bridge` (grep `listen_for: ''` in `tests/`), add `intro: '', bridge: ''` to it.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared tests/lesson
git commit -m "Steps carry intro/bridge/path; Apply plays the style's scale; degrees review in the day's scale

The warm-up scale came from the style but Apply never used it, and the degrees review said G major on a G dorian day."
```

---

### Task 3: App renders the thread

**Files:**
- Modify: `src/lib/lesson.ts:72-76` (show table), `:81-87` (stepElements), `:107-119` (blockText, blockTerms)
- Modify: `src/screens/Player.tsx` (after the About button ~line 151; ScaleBoard lines ~163-166)
- Modify: `src/screens/Today.tsx` (after `why_it_matters`, ~line 43)
- Test: `tests/app/blockText.test.ts`

**Interfaces:**
- Consumes: `BlockContent.intro?`, `bridge?`, `LessonContent.path?` (Task 2).
- Produces: `blockText(...)` return gains `intro: string; bridge: string`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/app/blockText.test.ts`:

```ts
describe('thread text', () => {
  it('defaults intro and bridge to empty on lessons stored before they existed', () => {
    const content = { title: '', why_it_matters: '', theory_card: '', songs: [], create_prompt: '',
      blocks: [{ kind: 'warmup', instructions: ['x'], target_text: '', listen_for: '', more: '' }] } as never;
    expect(blockText(content, 0)).toMatchObject({ intro: '', bridge: '' });
  });
  it('finds glossary terms in the intro', () => {
    const content = { title: '', why_it_matters: '', theory_card: '', songs: [], create_prompt: '',
      blocks: [{ kind: 'warmup', instructions: ['x'], target_text: '', listen_for: '', more: '', intro: 'Dorian is natural minor with a raised 6th.', bridge: '' }] } as never;
    expect(blockTerms(content, 0).map(t => t.id)).toContain('dorian');
  });
  it('shows the scale card and chords on the Apply link step', () => {
    expect(stepElements(undefined, 'apply', 2, 4)).toEqual(['card', 'scale', 'chords', 'metronome']);
    expect(stepElements(undefined, 'apply', 2, 3)).toEqual(['card', 'chords', 'metronome']); // older 3-step Apply
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/app/blockText.test.ts`
Expected: FAIL (no `intro` key; 4-step Apply returns null).

- [ ] **Step 3: Implement `src/lib/lesson.ts`**

Below `FIXED_SHOW`:

```ts
// Apply with the link step (lesson/steps.ts, scale from today's style): the third step plays the warm-up scale, so show it.
const APPLY_LINK_SHOW: StepElement[][] = [['card', 'metronome'], ['card', 'chords', 'metronome'], ['card', 'scale', 'chords', 'metronome'], ['card', 'chords', 'metronome']];
```

In `stepElements`, replace `: FIXED_SHOW[kind];` with:

```ts
    : kind === 'apply' && stepCount === APPLY_LINK_SHOW.length ? APPLY_LINK_SHOW
    : FIXED_SHOW[kind];
```

`blockText`:

```ts
export function blockText(content: LessonContent, i: number): { instructions: string[]; target_text: string; listen_for: string; more: string[]; intro: string; bridge: string } {
  const b = content.blocks[i] as (Partial<BlockContent> & { tips?: string; explanation?: string }) | undefined;
  if (!b) return { instructions: [''], target_text: '', listen_for: '', more: [], intro: '', bridge: '' };
  const more = b.more !== undefined ? [b.more] : [b.tips ?? '', b.explanation ?? ''];
  return { instructions: b.instructions?.length ? b.instructions : [''], target_text: b.target_text ?? '', listen_for: b.listen_for ?? '', more: more.filter(Boolean), intro: b.intro ?? '', bridge: b.bridge ?? '' };
}
```

`blockTerms`: `return termsIn([t.intro, t.bridge, ...t.instructions, t.target_text, t.listen_for, createPrompt, ...t.more]);`

- [ ] **Step 4: Render in Player and Today**

`src/screens/Player.tsx`, directly after the `{skillId && <button … About this skill ›</button>}` line:

```tsx
      {(text.intro || text.bridge) && (
        <section className="stack-sm" aria-label="What and why">
          {text.intro && <p><ChordText text={text.intro} onChord={setSheet} /></p>}
          {text.bridge && <p className="muted"><ChordText text={text.bridge} onChord={setSheet} /></p>}
        </section>
      )}
```

and change `{block.kind === 'create' && on('scale') && <ScaleBoard scale={plan.music.scale} />}` to:

```tsx
      {(block.kind === 'create' || block.kind === 'apply') && on('scale') && <ScaleBoard scale={plan.music.scale} />}
```

`src/screens/Today.tsx`, after `<p className="text-2">{content.why_it_matters}</p>`:

```tsx
        {content.path && content.path.length > 0 && (
          <ul className="stack-sm" aria-label="Today's path" style={{ paddingLeft: 18, margin: 0 }}>
            {content.path.map(line => <li key={line} className="text-2">{line.replace(/[{}]/g, '')}</li>)}
          </ul>
        )}
```

- [ ] **Step 5: Run app tests, type check, build**

Run: `npx vitest run tests/app tests/lesson && npx tsc --noEmit -p . && npm run build`
Expected: PASS, tsc silent, build succeeds.

- [ ] **Step 6: Check it in the browser**

Run `npm run dev` against the local stack (README) or with today's FUNK lesson content, open Today and the Apply block, and confirm: path list under the summary; intro + muted bridge above the step card on each block; Apply step 3 shows the scale card. Screenshot Today and Apply step 3.

- [ ] **Step 7: Commit**

```bash
git add src tests/app
git commit -m "Player shows each block's what-and-why and its link; Today shows the lesson path

Owner had to open 'More' to learn why the lesson opened on Dorian."
```

---

### Task 4: LLM brief sees the thread; spec, glossary and deploy prep

**Files:**
- Modify: `supabase/functions/_shared/lesson/prompt.ts` (PROMPT_VERSION, rule 1, brief `steps`, `path`)
- Modify: `docs/superpowers/specs/2026-10-07-lesson-through-line-design.md` (§2 apply row)
- Test: `tests/lesson/prompt.test.ts`

**Interfaces:**
- Consumes: `EngineSteps` with `intro`/`bridge`/`path` (Task 2).
- Produces: brief JSON fields `path: string[]` and `steps[].intro`, `steps[].bridge`.

- [ ] **Step 1: Write the failing test**

Add to `tests/lesson/prompt.test.ts` (use whatever helper that file already uses to call `buildMessages`; parse the user message JSON the same way its other tests do):

```ts
  it('gives the model the lesson path and each block\'s intro and bridge, so `more` doesn\'t repeat them', () => {
    const brief = JSON.parse(buildMessages({ ...INPUT, plan: FUNK_PLAN }).at(-1)!.content);
    expect(brief.path[0]).toContain('G dorian →');
    expect(brief.steps.find((s: { kind: string }) => s.kind === 'apply')).toMatchObject({ bridge: expect.stringContaining('Same G dorian notes') });
    expect(SYSTEM_PROMPT).toContain('intro and bridge');
  });
```

(`INPUT` = the file's existing base `PromptInput`; if it's named differently, use that name.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/lesson/prompt.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `prompt.ts`:
- `export const PROMPT_VERSION = 'gc-2026-10-07';`
- Rule 1, after "a link to something the learner met before.": add ` Each step block already has an intro and bridge saying what it is and how it links; do not repeat them.`
- Brief: `steps: engineSteps.blocks.map(b => ({ kind: b.kind, intro: b.intro, bridge: b.bridge, instructions: b.instructions, listen_for: b.listen_for })),` and add `path: engineSteps.path,` after `steps`.

Spec §2 Apply row: replace `style profile name + rhythm or progression name + \`feel.accents\` (e.g. "beat 1 heavy, chank on 2 and 4")` with `short style name + element name ("Funk groove: The One + scratch"); feel.accents left out because its terms (tumbao, golpe, clave…) have no glossary entries`.

- [ ] **Step 4: Full verification**

Run: `npx vitest run tests/engine tests/lesson tests/app tests/scripts && npx tsc --noEmit -p . && node scripts/render-glossary.ts`
Expected: all PASS (DB tests in `tests/db` need the local Supabase stack and are out of scope), tsc silent.

- [ ] **Step 5: Commit, then stop for deploy approval**

```bash
git add supabase/functions/_shared/lesson/prompt.ts tests/lesson/prompt.test.ts docs/superpowers/specs/2026-10-07-lesson-through-line-design.md docs/glossary-review.md
git commit -m "Colour brief carries the lesson path and block intros so 'more' doesn't repeat them"
git push origin dev
```

Deploy needs owner approval (CLAUDE.md). When approved: PR dev → main, merge, `supabase functions deploy generate-lesson --project-ref uoytcppwovhteqklezmq`, wait for the Netlify bundle hash to change. Tomorrow's lesson is the first to carry the thread; today's stored lesson keeps rendering without it.
