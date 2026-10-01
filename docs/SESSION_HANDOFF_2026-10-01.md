# Session Handoff — 2026-10-01

**Engine-written lesson steps are built on `dev`, not merged or deployed.** Every instruction the learner reads now comes from the engine, using the same data the on-screen cards draw. The LLM writes colour only. The live app (https://guitar-coach-66.netlify.app) still runs the previous version.

- Spec: `docs/superpowers/specs/2026-09-30-engine-written-steps-design.md`
- Plan: `docs/superpowers/plans/2026-10-01-engine-written-steps.md` (15 tasks, run subagent-driven, each task reviewed plus a final whole-branch review)

## What we did this session
- **Earlier today (live):**
  - The Apply rhythm chart (strum arrows, played through the chords): PR #7.
  - The pattern toggle for skills with more than one pattern: `ec55217`, on `dev` only.
  - Prompt fixes for the invented thumb bass and the fill talk: `ec55217`, on `dev` only.
- **Engine (shared by the app and the edge function):**
  - `engine/render.ts`:
    - `slotContext` and `renderSteps` fill `{slots}`. An unknown slot, or one with no data, throws.
    - `{degrees:N}` = the note with degree N in the day's **actual** scale. When the scale lacks that degree (pentatonic 4/7), it falls back to the parent: major, or natural minor for minor-family scales.
  - `engine/music.ts`:
    - `scalePositions` now labels each dot by interval degree (pentatonic 1,2,3,5,6).
    - `triads` are always built from `chords[0]`, so a triad retest on any track has shapes to show.
  - `engine/patterns.ts`: `patternCounts` (a picking pattern in words) and `APPLY_DEFAULT_GRID`.
  - `engine/recipes.ts`: `RECIPES` covers all **61 practice skills**.
    - Each recipe has a `card`, optional `patterns`/`grid`/`degrees`, `steps` and `listenFor`.
    - `majorKeyOnly` is set on borrowed_colour, secondary_dominants, colour_notes, borrowed_chords_by_ear and pentatonic_fills_caged. For these the planner drops a minor-family style, so their note names stay right.
  - `engine/create.ts`: 5 Create tasks with rotation. None of the last 3 repeats, and songwriting days get a matching task.
  - `engine/planner.ts`: `plan.pattern_id` rotates each time the skill comes back, and a repeat day keeps yesterday's pattern. It also sets `plan.create_task_id`.
- **Lesson pipeline (`supabase/functions/_shared/lesson/`):**
  - `steps.ts` `buildSteps(plan)` writes every block's `instructions`, `target_text` and `listen_for`.
  - Review items render only the first recipe step. For style items it's the rhythm counts or the progression's chords.
  - `contract.ts`: `COLOUR_JSON_SCHEMA` and `validateColour`. A lesson is rejected for:
    - chords not in the plan;
    - naming a skill not in `met_skills` and not already used in the steps;
    - any `\d+ bpm` or rep count;
    - a `more` over 400 characters.
  - `prompt.ts` `gc-2026-10-01`: the colour-only system prompt. The brief carries `steps`, `met_skills` and `avoid_names`.
  - `service.ts` / `generate.ts` / `fallback.ts`: `buildSteps` runs once per request. `assembleLesson` combines the steps with the colour. The fallback has the same steps with `more: ''`.
- **App:**
  - `blockText`/`blockCard` in `src/lib/lesson.ts`. Old stored lessons show `tips`/`explanation` under "More about this" and never crash on unknown skills.
  - The Player reads each block's card from the recipe: pattern, rhythm, note caller, scale with bright degrees, triads or chords. It shows "Listen for" and "More about this".
  - New `TriadBoard`; `ScaleBoard` gains `highlight`.
- **Tools:** `node scripts/render-recipes.ts [key]` prints every recipe rendered for a key. The G-major sheet is `docs/recipe-review-2026-10-01.md`.
- **Tests:** 301 unit tests and 15 DB tests pass; typecheck and build are clean.
  - A property test builds steps for every skill × 6 keys × every style without throwing.
  - The final reviewer also checked 160,716 plans with no throws.
- **Local check:** a generated Giuliani + shuffle-boogie lesson came back valid on the first model attempt (Qwen, $0.0019). Every block's steps matched its card.

## What's next
1. **(15 min) Matt skims `docs/recipe-review-2026-10-01.md`** (61 recipes, G major) and flags wording or teaching he'd change. The worth-a-look list is in Known issues.
2. **Ask, then merge `dev` → `main`** (PR). Netlify auto-deploys.
3. **Ask, then deploy the function:** `supabase functions deploy generate-lesson --no-verify-jwt --project-ref uoytcppwovhteqklezmq`. **The app and the function must ship together.** The new Player reads `listen_for`/`more`. The old app still renders new lessons, because it only reads `instructions`/`tips`, but it would hide "More about this".
4. On the phone: play a full lesson and check each block's steps against its card.
5. After a few days live, look at `content.generation[].errors` for `unmet skill named:` rejections.
6. Next spec: the **Ask button** with library tools (skill/recipe lookup, progress, recent lessons). After that, a **tab card for fills**.

## Design decisions already made
- The engine writes every instruction. The LLM writes title, why, theory card, songs and a per-block `more` (2–4 sentences, colour only).
- Recipes are code: drafted by Claude, reviewed by Matt, never generated at runtime.
- `{degrees:N}` follows the day's actual mode; the parent scale is used only for degrees the scale lacks.
- `majorKeyOnly` skills never get a minor-family style. The style is dropped for that day, not the skill.
- Review items show one recipe step only, so tempo-ladder slots never render without a target.
- Retest shows the skill's first pattern and first two recipe steps. The New skill block shows today's `pattern_id`.
- A repeat ("more time") day keeps yesterday's pattern.
- Cards never claim more than they draw. The chords card is chords-db's first voicing (usually open), so fills recipes describe barre and CAGED shapes in words.

## Known issues / gotchas
- **Worth Matt's eye in the review sheet:**
  - anticipations: the card's audio changes chord at the bar line while the text says change early.
  - voice_leading_inversions: the triads card shows only {chord1}'s shapes.
  - triads_lower_sets: explains sus/dim but never has you play one.
  - modulation: no target key slot.
  - borrowed/secondary-dominant construction.
- The skill-name check matches substrings. Ordinary phrases that are skill names ("key changes") are listed to the model as `avoid_names`. A rejection only costs a retry or the fallback, never the steps.
- Every stored plan now carries `music.triads` (a small size increase).
- `recipeFor`'s generic fallback (description plus a ladder) only fires for a skill added to the curriculum later. The coverage test fails first.
- `buildSteps` can throw only if a plan can't be rendered. The property tests make that very unlikely, and a throw would be a 500 with no lesson.
- Test data: the local `phase3@test.dev` 2026-09-29 lesson has a hand-edited `plan.skill_id`.
