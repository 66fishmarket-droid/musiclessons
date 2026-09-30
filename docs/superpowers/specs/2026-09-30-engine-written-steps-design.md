# Engine-written steps: design

**Date:** 2026-09-30
**Status:** approved in conversation, section by section. The written spec is awaiting review.
**Supersedes:** in `2026-09-28-guitar-coach-design.md`, the parts saying the LLM writes block instructions, tips, explanations and `create_prompt`.

## 1. Problem

On a real phone, the lesson text disagreed with what the app showed. Examples:
- It said "pinch pattern" while the card played p-i-m-a.
- It invented thumb bass notes for Old Faithful, which has none.
- It told a beginner to "add at most one fill per four bars".
- The Create steps didn't say whether to sing or play.

The cause is the design, not the wording. The engine decides the music and draws the cards. The LLM then writes the steps from a JSON summary of that plan, so it paraphrases, adds things and leaks planning rules. Three rounds of extra prompt rules (17–19) have not stopped this.

## 2. Goal and success criteria

- **Goal:** everything the learner is told to *do* is written by the engine, from the same data the cards draw. The LLM adds colour only. Its real job is answering questions: the Ask button, in the next spec.
- **Success:**
  1. On any block, the steps and the card never contradict each other.
  2. The fallback lesson (used when every model fails) has the full steps and loses only the colour text.
  3. A test renders every recipe and template against sample plans in every key and fails on any unfilled slot, unknown pattern, or rhythm token the chart can't draw.
- **Out of scope:**
  - the Ask button and its library tools (next spec);
  - a tab card for fills licks (§8);
  - melody generation.

## 3. Who writes what

| Content | Writer |
|---|---|
| Block `instructions`, `target_text`, `listen_for` | Engine |
| `create_prompt` and the Create block steps | Engine (Create library, §6) |
| Today's picking pattern / rhythm / card choice | Engine (planner) |
| `title`, `why_it_matters`, `theory_card`, `songs` | LLM |
| Per-block `more` (2–4 sentences, shown folded as "More about this") | LLM |

The LLM gets the engine-written steps as fixed facts. It must not restate them as instructions, add steps, or name tempos or rep counts.

## 4. Skill recipes

These are new, in `supabase/functions/_shared/engine/recipes.ts`. There is one recipe per practice skill: 61 skills across 6 tracks. Theory skills stay theory-card topics only.

```ts
export type Card = 'pattern' | 'rhythm' | 'note_caller' | 'scale' | 'triads' | 'chords' | 'none';
export interface SkillRecipe {
  card: Card;
  patterns?: string[];  // card 'pattern': PATTERNS ids in teaching order
  grid?: string;        // card 'rhythm': the skill's own grid in the style-grid tokens; else the day's style rhythm
  degrees?: number[];   // card 'scale': degrees to highlight (e.g. sing 1-3-5)
  steps: string[];      // templates with {slots}
  listenFor: string;
}
export const RECIPES: Record<string, SkillRecipe>;
```

- The 10 fingerstyle recipes are built from `SKILL_GUIDES`. `SKILL_PATTERNS` folds into `recipe.patterns`, and `SKILL_GUIDES` stays for the "About this skill" sheet.
- The other 51 are drafted from `Music_Lessons Vault/Research/` and the curriculum descriptions, then skimmed by Matt before merge.

### 4.1 Slots

These are filled by `renderSteps(template, ctx)`:

| Slot | Source | Example (G, {G} {C} {G} {D}) |
|---|---|---|
| `{key}` `{scale}` | `plan.key`, `music.scale.name` | G · major |
| `{chords}` `{chord1}` | `music.progression.chords` | {G} {C} {G} {D} · {G} |
| `{degrees:a,b,c}` | `music.scale.notes` | G, B and D |
| `{root_string}` | `voiceRoles(voicing).bass` | string 6 |
| `{start_bpm}` `{target_bpm}` `{target_reps}` | block item target | 46 · 70 · 3 |
| `{pattern_name}` `{pattern_counts}` | today's pattern + `patternCounts()` | Pinch and pluck · 1 thumb + ring together · 2 index · … |
| `{rhythm_name}` `{rhythm_counts}` | recipe grid or `music.rhythm` + `rhythmCounts()` | Boom-chick · 1 thumb plays the bass note · 2 strum down · … |

- An unknown slot, or a slot with no data, throws.
- `patternCounts(p)` is new, beside `rhythmCounts`. It spells a picking pattern out count by count, with finger and role words ("thumb (alternate bass) + middle together").

### 4.2 Card mapping

| Track | Card |
|---|---|
| fingerstyle | pattern |
| rhythm | rhythm (the skill's grid, or the day's style rhythm) |
| fretboard | note_caller (notes skills), triads (triad skills), scale (the rest) |
| ear_voice | scale with `degrees` plus the drone |
| fills | chords (until a tab card exists, §8) |
| songwriting | chords or none |

The Player reads the card from the recipe instead of today's hard-coded rules: `NOTE_CALLER_SKILLS`, the pattern-from-`skillInfo` lookup, and the Apply rhythm branch. `NOTE_CALLER_SKILLS` is deleted.

### 4.3 Today's pattern

The planner adds `plan.pattern_id` (null when the card isn't `pattern`):
- the first pattern the first time the skill is met;
- after that, `patterns[timesSeen % patterns.length]`, where `timesSeen` counts `recentLessons` with the same `skill_id`.

The steps describe `plan.pattern_id`. The Player shows it first, and the toggle still offers the recipe's other patterns.

## 5. Block templates

These live in `lesson/steps.ts`, together with `buildSteps(plan, skills): BlockContent[]`.

| Block | Steps | Card |
|---|---|---|
| warmup | hum/lip-trill 30 s · play {key} {scale} in the shown position saying the degree numbers · again, singing each note | scale |
| new_skill | the skill's recipe steps | the recipe card |
| retest | "Cold retest: {name}. One attempt at {target}, no practice run first." · first recipe step | that skill's card |
| review | per item: "{name}: {first recipe step}" (style items: "{element name}: {rhythm_counts}") | none |
| apply | "{rhythm_name}: {rhythm_counts}" · on {chord1} until steady, then {chords}, one chord per bar · keep the hand going and hum or sing any tune over it | rhythm + chords |
| create | the chosen Create task (§6) | chords + scale + recorder |
| record | record one take of the Apply groove with singing · listen back · rate 1–5 and note one thing to fix | recorder |
| reset | one of four fixed lines, rotated by date | none |

- `target_text` keeps `targetText()` from `fallback.ts`.
- `listen_for` comes from the recipe on new_skill and retest, and is empty elsewhere.

## 6. Create library

This is new, in `engine/create.ts`: `CREATE_TASKS: { id; prompt: string; steps: string[]; songwriting?: string[] }[]`, using the same slots as the recipes.

The first set:
- `melody_135`: pick a tune note by note using only {degrees:1,3,5} → play {chords} with the day's rhythm and sing it → record it.
- `question_answer`: bars 1–2 end on {degrees:5} (unfinished), bars 3–4 end on {degrees:1} (home).
- `rhyming_couplet`: two lines about something in the room, said in time over {chords}, then sung on {degrees:1} and {degrees:5}.
- `new_feel`: the same {chords}; change one thing in the rhythm (where the bass falls, or drop one strum).
- `one_note_verse`: sing a line on {degrees:1} over {chords}; the chords do the moving.

**How the planner picks** (`plan.create_task_id`):
- on songwriting-skill days, a task listing that skill in `songwriting`;
- otherwise rotation by date, skipping the tasks used in the last 3 lessons.

`create_prompt` is the task's `prompt`, rendered.

## 7. LLM contract

### Input
The brief as now, plus:
- `steps`: each block's rendered instructions and `listen_for`, marked "fixed; do not restate or contradict";
- `met_skills`: the names of skills with a `skill_progress` row, plus today's.

The prompt shrinks. Rules about instructions, targets, apply, create, reset, fills and the tool list (5–10, 13, 16, 18, 19) go. New rules:
- `more` adds colour only: a common mistake, why it works, or a link to earlier lessons;
- never name a skill outside `met_skills`, a tempo, or a rep count.

### Output
`{ title, why_it_matters, theory_card, songs, blocks: { kind, more }[] }`

### Validation
`validateLesson` rejects a lesson that has:
- a chord outside the plan (existing check);
- a skill name from the curriculum that isn't in `met_skills`;
- any `\d+ ?bpm` or rep count;
- a `more` over 400 characters;
- a block count or kind that doesn't match the plan.

On rejection, the next model is tried, then the fallback.

### Stored content
```ts
interface BlockContent { kind; instructions: string[]; target_text: string; listen_for: string; more: string }
```
- `generate-lesson` merges the engine's `buildSteps` output with the LLM's colour before saving.
- `fallbackLesson` = `buildSteps` + `more: ''` + templated title, why and theory card (as now).
- Lessons already stored keep `tips`/`explanation`. The Player renders `more ?? [tips, explanation]`, so past lessons display unchanged.
- `PROMPT_VERSION` moves to `gc-2026-10-01`.

## 8. Known gaps and decisions

- **Fills tab card:** fills skills need a small tab or lick card (G-run, hammer-ons). Until one exists, their recipes name strings and frets in words, and the card is `chords`. It's the next card to build after Ask.
- **Recipe review:** the 51 new recipes are drafted by Claude and skimmed by Matt. They are code, versioned in git, and never generated at runtime.
- **Rhythm accents:** the grid tokens have no accent mark. The accents recipe uses full-colour vs faded (ghost) arrows to show accented vs muted strokes. Add a `>` token if that proves unclear.
- The toggle between a skill's patterns stays: `plan.pattern_id` is only the default.

## 9. Testing

- **Unit:**
  - `renderSteps` on every recipe and every Create task × 12 keys × major/minor sample plans;
  - `patternCounts` on every pattern;
  - planner `pattern_id` rotation and `create_task_id` rotation;
  - `buildSteps` block kinds match `plan.blocks`;
  - the new validation rules, each with a rejecting case.
- **Contract:** the prompt test asserts `steps` and `met_skills` are in the brief, and that the retired rules are gone.
- **Manual:** generate lessons locally for one skill per track; check every block's steps against its card on the phone.

## 10. Build order

1. `patternCounts`, `renderSteps` and slot tests.
2. `recipes.ts`: the 10 fingerstyle recipes, and the Player reading `card` from the recipe.
3. Block templates plus the Create library, and `buildSteps`. Wire them into `generate-lesson` and the fallback.
4. The LLM contract change: prompt, schema, validation, `more` in the Player.
5. The 51 remaining recipes, track by track; Matt skims each track.
6. Local generation per track, then the phone check, then merge and deploy (ask first).
