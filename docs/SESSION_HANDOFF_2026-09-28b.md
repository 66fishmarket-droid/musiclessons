# Session Handoff — 2026-09-28b (Phase 2 build)

## What we did this session
Phase 2 of `docs/superpowers/plans/2026-09-28-phase2-generation.md` is complete on `dev` (13 commits, `48e33af..`). Nothing has been pushed.

**Lesson layer** (`supabase/functions/_shared/lesson/`). It is Deno-safe and shared with the Node scripts.
- `contract.ts`:
  - the `LessonContent` types and `LESSON_JSON_SCHEMA` (strict structured output);
  - `validateLesson`: one block per plan block in order, 3 songs with capo 0–12, and only allowed chords;
  - `allowedChords`: the plan's chords plus every chord in the day's curriculum text. A dash-joined progression like "Dsus4–D–Dsus2" counts as three chords.
- `fallback.ts`: `fallbackLesson`, the plan-only lesson, whose songs come from the style's reference tracks.
- `prompt.ts`: `SYSTEM_PROMPT` (16 rules), `buildMessages` (the JSON brief) and `PROMPT_VERSION = gc-2026-09-28b`.
- `llm.ts`: `openRouterComplete` over fetch. It sets `reasoning: {enabled:false}`, `provider.data_collection: 'deny'` and a 55 s timeout.
- `generate.ts`: `writeLesson` tries the primary model, then the fallback model, then the plan-only lesson. It never throws. `parseJson` handles fenced and prose-wrapped JSON.
- `state.ts`: `toPlannerState` applies default settings and maps legacy `track='theory'` rows to null. `fetchStateRows` runs the RLS-scoped reads.
- `service.ts`:
  - `checkDate`: YYYY-MM-DD, within ±1 day of UTC;
  - `getOrCreateLesson`: returns the existing row, or plans, writes and inserts one. On a race (duplicate key `23505`) it re-reads the winning row.
  - Model attempts are stored in `content.generation`.

**Edge function:** `supabase/functions/generate-lesson/index.ts` plus `deno.json`. It takes `POST {date}` with a user JWT and returns the lesson row: 400 for a bad date, 401 when not signed in.

**Scripts:**
- `scripts/dev-session.ts` (`npm run dev:session`) prints a local access token. It is local-only.
- `scripts/compare-models.ts` (`npm run compare:models`) runs the side-by-side comparison.

**Model decision:** default `qwen/qwen3.7-plus`, fallback `moonshotai/kimi-k2.6`.
- Recorded in spec §13 and `docs/superpowers/model-comparison-2026-09-28.html`. Artifact: https://claude.ai/artifact/Hr1zvURcuXVn2WBbiPCQy5
- With reasoning off, both scored 3/3 valid. Kimi averaged 8 s and about $0.005 per lesson; Qwen 22 s and about $0.002.
- **Today's real lesson** for 66Fishmarket@gmail.com is "Giuliani Arpeggios & Boom-Chick in G": fingerstyle, key G, written by Qwen first time in 22 s for $0.002. OpenRouter spend so far is about $0.30.

**Tests:** 157 unit (`npm test`), 15 DB (`npm run test:db`), typecheck clean, and vault sync clean. `Codebase/_actions/action.generate-lesson.md` exists.

**Final review** (fresh reviewer, whole branch): no Critical findings; 2 Important.
- Fixed test-first: high vocal-range notes (`E5`, `G5`) were read as power chords, and suffixed chords like `C7sus4` weren't checked.
- One part deliberately not fixed; see the decisions below.

## What's next
1. Glance at today's lesson text (`select content from lessons where lesson_date = current_date`). Is the tone right for you? (2 min)
2. Decide whether to push `dev` and open a PR to `main`.
3. Phase 3 plan (the practice app):
   - the Today player, with the metronome, drone and SVG diagrams;
   - `{Chord}` chips you can tap for voicings;
   - auth UI, PWA and Netlify deploy.
   - The client sends the **local date** and allows more than 115 s for `generate-lesson`.
   - **Before any hosted deploy: turn off open signup or restrict it to an allowlist.** An open signup lets strangers spend LLM credit.
4. Phase 3 addition from the user: link each suggested song to an Ultimate Guitar search (`ultimate-guitar.com/search.php?search_type=title&value=<title artist>`). UG has no public API.
5. New idea for a later phase: a **tab library**. See memory `project_tab_library.md`.
   - `tabs/` holds UG PDFs exported by the user's Cowork process. They are **image-only**, with no text layer.
   - The plan is vision-LLM transcription to structured sections and chords-over-lyrics, stored per user.
   - The goals are interactive play-along tabs, and lessons that reuse a song's chord structure in other positions, as barres or as triads.

## Design decisions already made
- **Reasoning is off** for lesson writing. With it on, both models took about 100 s and up to 20k tokens.
- **`generate-lesson` has `verify_jwt = false`** in `config.toml`. CLI 2.75's gateway can't verify ES256 tokens, so `auth.getUser(token)` in `index.ts` is the only auth gate. A missing or forged token gets 401. Re-enable the gateway check when the CLI supports ES256.
- **fetch instead of the `openai` npm client.** Identical in Node and Deno, and no dependency.
- **Chord check scope:**
  - Songs are excluded, because real songs have their own chords.
  - Unbraced plain triads and slash chords ("try an F") are **not** checked. Checking them would flag string names like "E–A–D strings" and cause false fallbacks.
  - The braces rule in the prompt carries it; it held in all 7 live generations.
- **Bare-chord numbers** are limited to 6/7/9/11/13/69. As a result, a bare `E5` power chord is unchecked; `{E5}` in braces still is.
- **Two simultaneous first-opens** both pay for one model call each. The unique key keeps one row (a `ponytail:` comment marks this).
- `tabs/` is gitignored. The files are copyrighted tabs and lyrics and stay local.

## Known issues / gotchas
- **Never `cat` `supabase/functions/.env`.** It holds the OpenRouter key. To change a model, use the `grep`/`sed` pattern in plan Task 7 Step 8.
- **The functions `.env` is read only by `supabase functions serve`**, not by `supabase start`. Local runs need `functions serve` running.
- **Deferred minors from review:**
  - `validateLesson` stores the model's object as-is, so extra keys reach `lessons.content`.
  - 500 responses return the raw error text; only signed-in users can see it.
  - A device in the wrong timezone can create tomorrow's lesson early.
  - If a plan chord ever fails to parse, braced non-chords would pass the check.
- **Lesson quality notes** from the first real lesson:
  - It said "embouchure", a wind-instrument word, for a guitar warm-up.
  - All three songs came back with capo 0, and capo accuracy looks weak.
  - If this keeps happening, adjust the prompt (rule 12) and bump `PROMPT_VERSION`.
- The Phase 1 deferred minors are still open: the vault prune matches `generated: true` anywhere in a file, and `_score_skill` / `_schedule_review` still need execute revoked before going live.
