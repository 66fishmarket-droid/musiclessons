# Lesson through-line — design

**Date:** 2026-10-07 · **Status:** approved in chat, spec awaiting review

## Problem
The owner, on 2026-10-07's lesson (fretboard, G, funk "The One + scratch", G Dorian):
- The lesson opened on G Dorian with no reason given. "What is Dorian, why am I playing it" was only under "More".
- The funk groove seemed unrelated to the Dorian scale. In fact Dorian was picked *because* it is funk's scale
  (`music.ts:165`, `style.scales[0]`), but nothing said so and Apply never used it.
- Create (question and answer over the chords) felt like an afterthought.
- Sections that genuinely don't relate should say so ("now something different") and still explain where the
  material is used.

How a lesson is assembled today: picks are mostly independent. The style drives the scale and progression. The skill
drives the theory topic. Track, key, create task and review are chosen separately. No engine text connects blocks.
The only framing is LLM colour (`title`, `why_it_matters`, per-block `more`).

## Decisions (owner, 2026-10-07)
1. **Link where natural only.** The planner keeps choosing sections as it does now; no daily theme.
2. **Where a link exists, say it and play it.** The step text uses the earlier material, not just mentions it.
3. **Framing is engine-written** (project rule: structural explanations never come from the LLM). Reuse the glossary,
   skill descriptions and style data.

## Design

### 1. `lessonThread` (new, `supabase/functions/_shared/lesson/thread.ts`)
A pure function: `lessonThread(plan, skillMap, task) → { path: string[]; blocks: Record<BlockKind, { intro: string; bridge: string }> }`.
It decides the links from the plan:

| Link | Condition |
|---|---|
| `scale→apply` | the day has a style and the scale came from it (`plan.music.scale.name === style.scales[0]`) |
| `apply→create` | always: Create uses `{chords}`, the same chords as Apply |
| `apply→record` | always: Record records the Apply groove |
| `new_skill↔style` | the skill is tagged with today's style (`skill.styles?.includes(style)`) |
| everything else | no link: the bridge is a "Change of focus" line |

### 2. Per-block intro (what and why, always visible)
One or two sentences above the steps. Sources:

| Block | Intro from |
|---|---|
| warmup | the scale's glossary entry (`plain`) plus, when linked, "the scale {style} players use" |
| new_skill / retest | `skill.description` |
| apply | style profile name + rhythm or progression name + `feel.accents` (e.g. "beat 1 heavy, chank on 2 and 4"); with no style, the circle-of-fifths line (§4) |
| create | a new `why` field on each `CreateTask` (5 short engine-written lines) |
| review | fixed: "Spaced review: a quick pass over things you learned earlier, so they stick." |
| reset, record | none (empty string, the UI shows nothing) |

### 3. Bridge (first thing each block says about where it sits)
- Linked: e.g. Apply "Same G Dorian notes, now over the Gm7 groove. Funk players solo and fill with this scale."
  Create "Same Gm7 as Apply."
- Unlinked: "Change of focus: {one clause on what this is}. Nothing carries over from the scale here."
  E.g. new_skill (B-string rule): "Change of focus: finding any note fast on the B string. This is fretboard
  mapping, separate from today's scale."
- Warmup has no bridge (it opens the lesson); the lesson-level path does that job.

### 4. Circle-of-fifths framing on no-style days
When the day has no style and the progression is the default I–IV–V–I, the Apply intro says: "{IV} and {V} sit
either side of {I} on the circle of fifths, so I–IV–V sounds like leaving home and coming back." The terms are
already in the glossary (`circle_of_fifths`, `twelve_bar` uses the same idea).

### 5. Play the link (Apply)
When `scale→apply` holds, Apply gets one extra step after the rhythm/chord steps, before "hum or sing":
> "Every fourth bar, swap the groove for a short {key} {scale} phrase from the warm-up shape: four notes, ending on
> the note {degrees:1}. Then straight back into the groove."

- That step shows the scale card and the chords (the "show what you say" rule). `FIXED_SHOW.apply` becomes keyed by
  step count (3 = today's, 4 = with the link step) so `stepElements` still matches.
- Create already shows the scale on its degree steps; its bridge now says the notes are from the warm-up scale when
  `scale→apply` holds.

### 6. Today's path (lesson top)
`content.path`: 3–5 short lines, one per block that has an intro, linked ones joined with "→". Rendered on
`Today.tsx` above the block list. Example:
> Warm-up: G Dorian, the minor scale funk players use → Apply plays it over a Gm7 funk groove.
> New skill: the B-string rule (separate: finding notes on the neck).
> Create: a question-and-answer phrase on Gm7.

### 7. Theory review uses the day's scale where it fits
`steps.ts:125` forces `scale: 'major'` for every theory review. Topics whose text doesn't say "major" or rely on a
major chord (checked one by one; at least `theory.l1.degrees`) render with the day's scale instead. A list
`THEORY_DAY_SCALE` in `theory.ts` names them.

## Data and UI
- `EngineBlock` and `BlockContent` gain `intro?: string; bridge?: string`; `LessonContent` gains `path?: string[]`.
  Optional, so stored lessons (and the fallback lesson) still render.
- `Player.tsx`: intro (normal text) then bridge (muted, one line) above the step text. `Today.tsx`: path list.
- Glossary terms in intros and bridges get the existing term highlighting (`termsIn`). Any new term gets a glossary
  entry in the same commit (`node scripts/render-glossary.ts`).
- LLM colour is unchanged; the prompt gets the path so `more` doesn't repeat it.
- `generate-lesson` must be redeployed; Netlify for the UI.

## Testing
- `tests/lesson/thread.test.ts`, sweeping every practice skill × style profile (plus no style) × a few keys:
  - every block except reset/record has a non-empty intro;
  - every non-warmup block's bridge is either a link line or starts "Change of focus";
  - the Apply link step appears exactly when `scale→apply` holds, and `stepElements` gives it the scale and chords.
- Today's plan as a fixture: path, the Apply link step, and the B-string "Change of focus" bridge.
- The existing `tests/lesson/steps.test.ts` catalogue guard keeps passing.

## Out of scope (parked)
- Easiest chord shape first (`chordVoicings` takes chords-db order; ChordPanel shows `[0]`). Next chunk.
- Explanation depth adapting to progress and time away (the existing returning-learner idea).
- Re-theming the planner so all picks serve one theme (owner chose links-where-natural).
