# Guitar Coach — Design Spec

- **Date:** 2026-09-28
- **Status:** Approved 2026-09-28
- **Replaces:** Make.com "Daily Lesson Generator" + "Feedback Ingestor" (dormant since 2026-02-21). Specs move to `legacy/make/`.
- **Research base:** `Music_Lessons Vault/Research/` (58 notes + style research) and `Pedagogy/_notes/Lesson Anatomy.md`.

---

## 1. Goal

A daily practice web app that turns one intermediate rhythm guitarist into a **singer-songwriter accompanist**:

- Stronger rhythm.
- Fills and licks inside rhythm parts.
- Fingerstyle accompaniment for the learner's own singing.
- Triads and voicings across the whole neck.
- Ear and voice trained with the guitar.
- Songwriting harmony and form: sections, bridges, key changes.
- Music theory that sticks.
- Fluency in **all major guitar styles**: their grooves, harmony and forms, so folk-style lyrics can be set in any of them (e.g. funk or soul).

**Success looks like:**
- 20–40 min daily sessions the learner actually completes.
- Every block has a measured target.
- Progress is visible per track.
- No repeated or invented content.
- Any "what is a ninth?" question is answered on the spot.

**Non-goals (v1):**
- Multiple users (the schema supports them later).
- A lead-guitar curriculum.
- Sung-pitch grading.
- Storing recordings.
- A free-form coach chat.

---

## 2. Architecture

```
React PWA (Vite, Netlify)
   │  supabase-js (auth, reads, writes)
   ▼
Supabase
   ├─ Postgres + RLS          source of truth
   ├─ DB function complete_lesson()   scoring + review scheduling
   └─ Edge Functions (Deno)
        ├─ generate-lesson    plan → music content → LLM prose → validate → save
        └─ ask                LLM + chord_info / scale_info tools
                 │
                 ▼
          OpenRouter (OpenAI-compatible) → Kimi / Qwen / any model
```

**Engine code:** the pure TypeScript engine lives in `supabase/functions/_shared/engine/`. The edge functions and the frontend (through a Vite path alias) both import it, so there is one copy of the music logic.

**Libraries:**
- `tonal` handles scales, chords, intervals and keys.
- `chords-db` supplies guitar fingerings.
- The metronome, drone and chord preview use native Web Audio.
- Fretboard and chord diagrams are in-house SVG components.

**LLM:**
- The `openai` npm client is pointed at OpenRouter.
- Configuration: `LLM_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL`, plus `LLM_FALLBACK_MODEL` for a retry on a different model.
- The default model is chosen by a side-by-side test (§12, Phase 2).

**Auth:** Supabase magic-link email; every table uses RLS keyed on `user_id = auth.uid()`.

---

## 3. Curriculum

There are six **tracks**. Each track has five **levels**, and each level holds 2–4 **skills**. The full skill list is authored in `supabase/seed/curriculum.ts` during Phase 1, from the research ladders summarised below.

| Level | Rhythm & Groove | Fretboard & Voicings | Fingerstyle | Fills & Licks | Ear & Voice | Songwriting & Harmony |
|---|---|---|---|---|---|---|
| 1 | Locked 8ths/16ths, palm mute, accents | Note names on strings 6/5, octaves | p-i-m-a mapping, pinches, Giuliani arpeggios | Sus/add hammer-ons in open chords | Pitch matching; sing 1-3-5 over a drone | I–IV–V–vi, prosody basics, object writing |
| 2 | Chuck on 2 & 4, ghost strums | CAGED linked + pentatonic per shape | Alternating thumb alone | Bass walks | All 7 degrees with resolutions; sing roots | Verse/chorus contrast (≥2 levers) |
| 3 | Syncopation, anticipations, 6/8, shuffle | Triads on strings 1–3, all inversions | Travis over chord changes | Mayfield/Hendrix double-stops | Sing R-3-5 while strumming; 3rds/6ths harmony | Pre-chorus; borrowed iv, ♭VII, ♭VI |
| 4 | Dynamics as arrangement | Voice-leading inversions; lower string sets | Accompaniment patterns + hum/speak/sing | Sliding 3rds/6ths | Colour notes; hearing borrowed chords; melody over strum | Bridges designed backwards |
| 5 | Be-the-band (bass + backbeat + stabs) | 3rds/6ths shapes, 7th-chord shells | Melody/fills over steady thumb; arranging own songs | Pentatonic fills from the shape around the current chord | Harmony while strumming; transcribing | Pivot-chord and truck-driver key changes |

**Theory ladder.** It is a 7th list with the same shape, but it never takes the new-skill slot. It is delivered through theory cards and review quizzes.
- **L1:** intervals, scale construction, degrees.
- **L2:** triads, diatonic chord qualities.
- **L3:** 7ths, sus and add.
- **L4:** 9/11/13 extensions, slash chords, inversions.
- **L5:** modes, chord-scale fit, harmonising a melody.

**Styles.** A style is a dimension like key, not a 7th track. A style profile covers each major guitar genre, grouped by **family** (each family can have sub-styles):

| Family | Styles |
|---|---|
| Folk & roots | folk, Americana/alt-country, Celtic (DADGAD) |
| Blues | blues (country and electric) |
| Soul & R&B | soul (gospel, Motown, Stax), R&B/neo-soul |
| Funk | funk |
| Rock | classic rock, hard rock, indie/alternative, punk/pop-punk, metal (rhythm fundamentals) |
| Pop | pop / pop-rock |
| Country | country, bluegrass |
| Jazz | jazz comping, gypsy jazz |
| Caribbean | reggae, ska/rocksteady |
| Latin & Iberian | bossa nova/samba, Afro-Cuban/son, flamenco/rumba |
| African | highlife, soukous |

The list is data, so adding a style means adding one profile.
- **Style profiles live in code as data** (`engine/styles.ts`), drafted from `Research/styles/style_profiles.draft.json`. Each profile holds:
  - feel (subdivision, tempo range, accents);
  - 16-slot rhythm patterns;
  - chord colours;
  - progression families as Roman numerals, so they can be put into any key;
  - forms;
  - fill vocabulary;
  - scales;
  - common keys;
  - lyric traits;
  - reference tracks;
  - a learning ladder.
- **Style elements, not style weeks.** Each profile is broken into **elements**, each with an id: a rhythm pattern, a progression family, a fill figure or a form device (e.g. `flamenco.rumba_strum`, `blues.quick_change`, `funk.16th_chank`). Lessons mix styles freely. The Apply block puts today's skill into one style element, e.g. "play this D progression with a flamenco rumba strum, which looks like this…".
  - **Style pick:** least recently used, with **core** styles (default folk, blues, funk, soul; editable in Settings) weighted ×2.
  - **Element pick:** the next element on that style's learning ladder, or a spaced revisit of one already seen.
  - **Load rule:** a *new* style element appears at most every other session. Other sessions revisit a known element, which keeps to "one new concept per session".
  - **Tracked like everything else:** seen elements become `review_items` (`item_type = 'style'`), so the patterns are revisited on the normal spacing.
- **Style-native skills** carry a `styles` tag (e.g. 12-bar shuffle, funk 16th scratch on 9th chords, Cropper/Mayfield soul double-stops, folk drone/open-tuning figures). Skills without a tag suit any style. The planner prefers skills whose style matches today's style element, at the track's level.
- **Style theory** feeds the theory cards: why I7 can be home in blues, one-chord funk vamps and extensions, gospel IV–I and 6ths, modal folk.
- **Style transplant** is a Songwriting exercise type. Take a lyric and progression (usually folk) and re-set it in a style's groove, chord colours, harmonic rhythm and form, keeping the lyric and melody shape. Change one lever at a time, in this order: groove → chord colour → harmonic rhythm → mode → form and phrasing. Code handles the first four; the LLM handles phrasing. The daily Create block uses today's style element; the weekly session picks a style you've seen at least 3 elements of.
- **Roman numeral convention:** minor chords are always written with an explicit `m` (`iim7` → Dm7 in C, `vim`, `ivm`). `tonal` ignores case, so `ii7` would silently give D7. The Phase 1 profile check converts every numeral in every key and flags any whose chord quality doesn't match the profile's intent.
- **Verified flag:** every rhythm pattern and element has `verified: boolean`. Research marked `inferred` merges as `verified: false`, and the planner only picks verified elements. You can flip the flag after checking a pattern by ear.

**Skill fields:**
- `id`, `track`, `level`, `name`, `description`.
- `pass_metric`: `bpm` | `clean_reps` | `self`.
- `default_target`.
- `allowed_keys` (null = any; e.g. open-friendly keys for L1 fingerstyle).
- `theory_topic_id` (optional link to a theory skill).
- `styles` (null = any style).

---

## 4. Lesson anatomy

Session templates live in code as data (`engine/templates.ts`), so block order can change without schema work.

**Default 30-minute template:**

| # | Block | Min | Content |
|---|---|---|---|
| 1 | Warm-up | 3 | Lip-trill/hum; play **and sing** today's key scale in one position, naming degrees |
| 2 | Cold retest | 2 | Yesterday's new skill, one attempt at yesterday's tempo |
| 3 | New skill | 9 | One concept: Hear → Learn → Play; tempo ladder from 60–70% of target; error loop |
| — | Reset | 0.5 | Listen to the reference / visualise |
| 4 | Mixed review | 5 | 2–3 due review items from other tracks (including theory quizzes), shuffled |
| 5 | Apply | 6 | Today's skill in a progression set in **one style element** (e.g. a rumba strum or a quick-change blues), singing over it |
| 6 | Create | 3 | A songwriting micro-constraint in today's key, often using today's style element |
| 7 | Record & rate | 2 | Record, listen back, rate, one-line "fix tomorrow" |

**Other templates:**
- **25-minute:** shrink blocks 3–5.
- **40-minute:** stretch blocks 3–5.
- **Weekly songwriting session:** replaces the normal lesson on the weekday set in settings (default Sunday). It assembles the week's Create fragments into verse + chorus (+ bridge from week 3). Required fields are key, progression per section, the contrast levers used, and a central idea. It ends with one sing-and-strum take. Every other week it's a **style transplant** of an existing song instead.

**Every lesson also carries a "Why it works" theory card.**

**Hard rules (enforced by code):**
1. Exactly one new concept per session.
2. Every block has a code-generated target and a pass/fail.
3. The review block is never empty if anything is due; yesterday's new skill is always retested.
4. The warm-up is ≤15% of the session.
5. Every session ends with a rated take.
6. Ear and voice work is always in the day's key, octave-shifted to the saved vocal range.
7. Fills: at most one per 4 bars.

---

## 5. Data model

All tables have `user_id uuid references auth.users` plus RLS. Timestamps are `timestamptz`.

| Table | Key columns |
|---|---|
| `skills` | `id text pk`, `track`, `level`, `name`, `description`, `pass_metric`, `default_target`, `allowed_keys text[]`, `theory_topic_id`, `styles text[]` — seeded; no `user_id` |
| `skill_progress` | `user_id`, `skill_id`, `status` (`active`/`mastered`), `score int`, `current_target numeric`, `last_seen`, `last_key` — unique `(user_id, skill_id)` |
| `lessons` | `id`, `user_id`, `lesson_date date`, `template`, `track`, `skill_id`, `key`, `style_element`, `plan jsonb`, `content jsonb`, `status` (`planned`/`completed`/`skipped`), `confidence 1–5`, `want_more_time bool`, `notes`, `llm_model`, `prompt_version`, `source` (`app`/`legacy`) — unique `(user_id, lesson_date)` |
| `exercise_logs` | `lesson_id`, `block_index`, `item_ref`, `passed bool`, `value_reached numeric`, `note` |
| `review_items` | `user_id`, `item_type` (`skill`/`theory`/`style`), `ref`, `interval_days`, `next_due date`, `last_result` — unique `(user_id, item_type, ref)` |
| `questions` | `user_id`, `lesson_id null`, `block_index null`, `question`, `answer`, `created_at` |
| `songs` | `user_id`, `title`, `key`, `sections jsonb`, `central_idea`, `notes`, `updated_at` |
| `settings` | `user_id pk`, `session_minutes` (25/30/40), `vocal_low`, `vocal_high`, `songwriting_weekday`, `style_core text[]` |

---

## 6. Engine rules (pure TypeScript, unit-tested)

**Track pick:**
- Priority for each track = `days_since_track_last_new_skill × (1 + fail_rate_last_5_blocks)`.
- Exclude yesterday's track unless `want_more_time`.
- Ties go to the track order above.

**Skill pick:**
- The track's level is the lowest level that still has an un-mastered skill.
- Pick the stalest `active` skill at that level.
- If `want_more_time` is set, keep the same skill and key.

**Key:**
- Circle of fifths `G D A E C F Bb Eb Ab Db Gb`, stepping from the track's last key.
- Skip keys that aren't in the skill's `allowed_keys`.
- Held on repeat days.

**Scoring** (inside `complete_lesson()`, per new-skill block):

| Result | Score change | Target change |
|---|---|---|
| Pass | +1 | +5 bpm or +1 rep |
| Pass and exceeded target | +2 | +5 bpm or +1 rep |
| Fail | −1 | −5 bpm |
| `want_more_time` | −2 | none |

- When `score ≥ 3`, the skill becomes `mastered`, its score resets to 0, and a `review_items` row is created.
- When `score ≤ −3`, the score resets to 0 and the target drops by 10%.

**Style element:**
- Style = the least recently used style (core styles weighted ×2), excluding yesterday's.
- Element = the next element on that style's ladder if the last new element was ≥2 sessions ago; otherwise a due or seen element.
- Repeat days keep the same element.

**Review scheduling:**
- Intervals are `1 → 3 → 7 → 14 → 30 → 60` days.
- A pass moves the item up one interval; a fail resets it to 1.
- Each lesson takes 2–3 due items, oldest first, from outside today's track.

**Theory card:** today's skill's `theory_topic_id` if it has one; otherwise the next un-mastered theory topic. A theory topic is mastered through quiz reviews, using the same ±3 rule.

**Music content:** built with `tonal` and `chords-db`:
- scale positions in the key;
- chord voicings for the day's progression;
- triad inversions per string set;
- fretboard maps.

The output is `plan.music`, and it is the **only** chord and scale source the LLM may reference.

---

## 7. AI

**`generate-lesson`** runs when the app opens and there is no lesson for today; it returns the existing row otherwise.
1. `plan = planLesson(state)` — engine.
2. `music = buildMusic(plan)` — engine.
3. The LLM receives a fixed system prompt (cached), the plan, the music, the style profile, the last 7 lesson summaries and the last 10 question topics. It returns JSON:
   - lesson level: `title`, `why_it_matters`, `theory_card`, `songs[3]` (`title`, `artist`, `why`, `capo`), `create_prompt`;
   - per block: `instructions[]`, `target_text`, `tips`, `explanation`.
4. **Validate:**
   - the JSON matches the schema;
   - every chord name appears in `plan.music.chords`;
   - there is exactly one block per plan block.
   - On failure, retry once on `LLM_FALLBACK_MODEL`. If that also fails, save a **plan-only lesson** built from engine data and templated text.
5. Save the row with `llm_model` and `prompt_version` taken from the actual config.

**`ask`** takes `{lesson_id?, block_index?, question}`.
- Context: the block's plan and content.
- Tools: `chord_info(name)` and `scale_info(name)`, backed by `tonal` and `chords-db`, returning notes, formula, degrees and voicings.
- At most 3 tool rounds.
- The Q&A is saved to `questions`.

**OpenRouter:**
- Prepaid credits.
- A per-key spend limit (suggest $5/month).
- The model is set by env var.
- In account settings, exclude providers that train on prompts.

---

## 8. App screens

| Screen | Content |
|---|---|
| **Today** | The block-by-block player: timer, target, metronome at the block tempo, drone or backing in the key, fretboard and chord SVGs, pass/fail and value-reached logging, an **Ask** button per block. Record & rate uses MediaRecorder for listen-back only (nothing is uploaded). Finish calls `complete_lesson()`. |
| **Theory Explorer** | Any chord or scale gives notes, formula, degrees, voicings across the neck and an audio preview. No LLM. |
| **Progress** | Level per track plus the theory ladder, target history per skill, streak, lesson history (including 129 imported legacy lessons). |
| **Songbook** | `songs` CRUD; the weekly session writes into it. |
| **Asked** | Searchable list of `questions`. |
| **Settings** | Session length, vocal range, songwriting weekday, core styles. |

**PWA:** installable, and today's lesson is cached for offline use.

---

## 9. Migration from Google Sheets

- **Input:** CSV exports of `Lessons`, `SubFocusProgress` and `Feedback` from sheet `1GoXKmCQQCmX67qF9_aKae-g1kqFVbmTL70xwNyzbf34`.
- **Script:** `scripts/import-legacy.ts` with `--dry-run`, which prints a report before any write.
- **Lessons** are imported as `source = 'legacy'`, `status` as-is, with content stored in `content.legacy`. Known column shifts are repaired:
  - `JamPrompt = "Completed"` → null;
  - a numeric `Feedback_NeedReinforce` is treated as confidence.
  - Rows that can't be repaired are flagged in the report, not guessed.
- **SubFocusProgress** is mapped to new skills through an explicit table in the script. It's reviewed in the dry-run.
  - An old Tier ≥ 3 → `mastered` (the skill enters review).
  - Anything else → `active`.
  - Unmapped subfocuses are listed.
- **New tracks:** Fingerstyle and Fills start at level 1.
- **Feedback rows** are used only to fill gaps in lesson feedback.

---

## 10. Obsidian vault

**Location:** `Music_Lessons Vault/` in the repo folder, gitignored. Frontmatter contract: `_meta/Frontmatter Contract.md`.

`npm run vault:sync` runs deterministic Node scripts; no LLM is involved. **Git hooks** (`post-commit`, `post-merge`, `post-checkout`) run the code sync in the background, so the code notes build up from the first commit, the same way Bill's do.

| Script | Output | Source |
|---|---|---|
| `vault-sync-curriculum` | `Curriculum/<Track>/<Skill>.md` | `skills` + `skill_progress` |
| `vault-sync-asked` | `Asked/<date> <topic>.md` | `questions` |
| `vault-sync-code` | `Codebase/` (see below) | TypeScript compiler API over `src/`, `supabase/functions/`, `scripts/` |
| `vault-sync-styles` | `Styles/<Style>.md` | `engine/styles.ts` |
| `vault-sync-dev` | `Development/Timeline.md` | `docs/SESSION_HANDOFF_*.md` + git log |

**Code graph** (mirrors Bill's `vault_sync_code.py` frontmatter so the same Bases views work):
- **One note per function or method:** `Codebase/<path>/<module>.<name>.md`. The frontmatter holds:
  - `kind`, `file`, `line`, `loc`, `signature`, `summary`, `body_hash`;
  - `parent` (the file hub);
  - `calls` and `called_by` (wikilinks, resolved with the TypeScript type checker);
  - `unresolved_calls`, `tables` (Supabase tables touched), `tested_by`;
  - `duplicate_count`, `dead_candidate`, `test_only`;
  - tags `code/ts`, `layer/<engine|edge|ui|script|db>`, `kind/…`, `visibility/…`.
- **One hub per source file,** listing its functions.
- **Action hubs** in `Codebase/_actions/`: one per entry point (edge function, DB function/RPC, React screen, npm script), linking down to everything it reaches.
- **`summary`** comes from the function's JSDoc first line; functions without one get `summary: ""` and are counted in `_meta/sync.log`. LLM summaries (as Bill uses) can be added later.
- **`_meta/Code Map.base`** lists functions filterable by layer, dead candidates, duplicates and untested code.

**Rules:**
- Generated notes carry `generated: true` and are pruned and rewritten on each run.
- `_notes/` folders are never touched.
- Research reaches the app one way only: by hand into `supabase/seed/curriculum.ts`. There is no vault → DB script until one is needed.

---

## 11. Error handling

| Failure | Behaviour |
|---|---|
| LLM error, timeout or invalid output | Retry on the fallback model, then serve the plan-only lesson. The user always gets a lesson. |
| `ask` fails | Show the error; keep the question text in the input. |
| `complete_lesson()` fails | Keep the logs locally and retry on the next open. Nothing is lost. |
| Offline | Serve the cached lesson; queue the logs. |
| Import finds bad rows | Flag them in the report; don't write guesses. |

---

## 12. Testing and phases

**Tests:**
- Vitest for the engine: planner, scoring, review scheduling, key cycle, theory card, templates. The legacy `spec/tests/fixtures` become cases.
- A schema test for LLM output.
- A dry-run report for the import.
- One end-to-end smoke test: generate → complete → progress and review rows updated.

**Phases** (each gets its own implementation plan):

1. **Foundation.**
   - Repo restructure (`legacy/make/`).
   - Supabase schema + RLS + `complete_lesson()`.
   - The engine with tests, and the curriculum seed.
   - The legacy import.
   - Style profiles (`engine/styles.ts`), merged from the 5 research drafts, with the numeral check.
   - `vault-sync-curriculum`, `vault-sync-styles`, `vault-sync-dev`.
   - `vault-sync-code` + git hooks, set up **first**, so every later commit is mapped.
2. **Generation.**
   - `generate-lesson` with validation and fallback.
   - Kimi vs Qwen side-by-side: 3 fixed plans; the user picks the default.
3. **Practice app.**
   - The Today player: metronome, drone, diagrams, logging, record & rate.
   - Auth, PWA, Netlify deploy.
4. **Understanding.**
   - `ask` + tools.
   - Theory Explorer, Progress, Asked.
   - `vault-sync-asked`.
5. **Songwriting.** Songbook + the weekly session template.

**Later (not specced):**
- Mic pitch checking; spike first to test detection while strumming.
- Stored recordings.
- Coach chat.
- Vault → DB promotion.

---

## 13. Open decisions

1. Default LLM: **decided 2026-09-28** by the Phase 2 side-by-side (`docs/superpowers/model-comparison-2026-09-28.html`): default `qwen/qwen3.7-plus`, fallback `moonshotai/kimi-k2.6`, both with reasoning off (with it on, each took ~100 s per lesson).
2. Direct provider vs OpenRouter: OpenRouter assumed. A direct provider only changes `LLM_BASE_URL` and the key.
