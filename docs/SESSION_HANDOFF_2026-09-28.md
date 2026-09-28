# Session Handoff — 2026-09-28 (Phase 1 build)

## What we did this session
Phase 1 of `docs/superpowers/plans/2026-09-28-phase1-foundation.md` is complete on `dev`. All 13 tasks are done; nothing has been pushed or merged.

**Commits** (`git log --oneline 62ec4a1..dev`)

| Task | Commit | What |
|---|---|---|
| 1 | `7f9041c` | Make specs moved to `legacy/make/`; TS toolchain (Node 24 type stripping, Vitest 3, TS 5.9) |
| 2 | `40e1523` | `scripts/vault/lib.ts`: `renderNote`, `syncNotes` (only writes/prunes `generated: true`, never `_notes/`) |
| 3 | `3b0cfaf`, `d541e24` | `scripts/vault-sync-code.ts` code graph + `.githooks/` background sync after commit/merge/checkout |
| 4 | `b9e15db` | `engine/keys.ts` (`nextKey`), `engine/roman.ts` (`normalizeRoman`, `romanToChords`) |
| 5 | `1faccee` | `scripts/merge-styles.ts` → `engine/styles.data.json`: 24 styles, 108 patterns |
| 6 | `620d26d` | `engine/music.ts`: scale positions, chord voicings (chords-db), triad inversions, `buildMusic` |
| 7 | `604ecb3` | `engine/types.ts`, `supabase/seed/curriculum.ts` (74 skills), `supabase/seed.sql` |
| 8 | `6a143c8` | `engine/templates.ts`: 25/30/40-minute block templates |
| 9 | `27887be` | `engine/planner.ts`: `planLesson` (track, style element, skill, key, retest, review, blocks, music) |
| 10 | `671cade` | Migrations: core schema + RLS; `complete_lesson()` scoring/review RPC |
| 11 | `77b549c` | `scripts/legacy/transform.ts` + `scripts/import-legacy.ts` |
| 12 | `f590739` | Vault sync for Styles/, Curriculum/, Development/ |
| Review fixes | `941b7a4`, `ea168e0` | See "Final review" below |

**Verification:** `npm test` passes 105/105 and `npm run test:db` passes 12/12. `npm run typecheck` is clean and `npm run vault:sync` runs clean.

**Legacy import (local DB, login `66Fishmarket@gmail.com`):**
- 129 sheet rows became 115 lessons: 114 completed, and 1 skipped (a `Delivered` row).
- 14 same-date duplicates were dropped (re-runs on 2025-08-27 and 2025-10-02…10-06). The later `GeneratedAt` was kept.
- 8 repairs, all on 2025-08-22…25: `JamPrompt` held a status, and confidence was in the `NeedReinforce` column.
- 0 unmapped subfocuses; 1 lesson's feedback was filled from the Feedback tab.
- 26 `skill_progress` rows, 8 of them mastered and scheduled for review.
- Sheet tabs were pulled via the Google Drive export (.xlsx) and converted to `data/legacy/*.csv` (gitignored).

**Styles:** 34 of the 108 rhythm patterns are unverified and need an ear check. Filter the `Styles/` notes on `verified_patterns`. The one unverified progression is `son_salsa` `im bIII ivm V`.

**Final review** (fresh reviewer, whole branch): no Critical findings; 2 Important, both fixed test-first.
- `complete_lesson` scored a block logged without pass/fail as a fail. It now skips it; a "more time" request still applies its −2.
- Re-running the legacy import overwrote progress made in the app. The `skill_progress` upsert now uses `ignoreDuplicates`.

## What's next
1. Open `Music_Lessons Vault/Curriculum/Rhythm & Groove.md` in Obsidian. Check that the ✅ marks look right against your memory of the Make lessons (2 min).
2. Decide whether to push `dev` / open a PR to `main`. Nothing has been pushed.
3. Ear-check the 34 unverified style patterns. Flip `verified` in the vault draft JSON, then run `npm run styles:merge`.
4. Phase 2: write the plan. It covers the edge functions (`generate-lesson` calls `planLesson`), OpenRouter account setup, and the Kimi vs Qwen side-by-side test for the default LLM.
5. Phase 2 also needs a `settings` row on signup (a trigger or defaults in the edge function). The planner needs it, and nothing creates it yet.

## Design decisions already made
- Local Supabase runs on **553xx ports**: API 55321, DB 55322, Studio 55323. Windows/Hyper-V reserves 54030–54883, so the default 543xx ports cannot bind.
- Migration `20260928000002` was edited in place for the null-result fix. It had never been deployed. From now on, add new migrations; don't edit these ones.
- Legacy `Delivered` rows import as `skipped` because they were never confirmed. This is the one deliberate deviation from the spec.
- Unrecorded pass/fail on a block means "not scored"; it is not treated as a fail.
- The legacy import never overwrites `skill_progress` rows or lessons created by the app, so it is safe to re-run.
- Hooks use `core.hooksPath .githooks` (local git config) and run the code-graph sync in the background. They never block git.
- `vault-sync-dev.ts` calls git with `execFileSync` (an argument array) because `cmd.exe` treats `|` in the format string as a pipe.

## Known issues / gotchas
- **Deferred minors from the review (not fixed):**
  - 29 legacy lessons have `track='theory'`, which is not a planner `Track`. The Phase 2 loader should map these to null.
  - `clean_reps` skills drop 1 rep on a fail; spec §6 only describes a bpm drop.
  - The vault prune matches `generated: true` anywhere in a file. A generated note you duplicate inside a managed folder gets deleted. Keep your own notes in `_notes/`.
  - `_score_skill` and `_schedule_review` can be called directly by an authenticated user, but only on their own data. Revoke execute before going live.
  - The import report counts repairs and feedback fills for rows that were later dropped as duplicates.
  - `core.hooksPath` is not set automatically on a fresh clone.
- **`supabase db reset` wipes the legacy import.** Re-run `npm run import:legacy -- --email 66Fishmarket@gmail.com` afterwards.
- `supabase db reset` sometimes ends with a `502` from the gateway restart. The reset itself still applies; check with `select count(*) from public.skills` (it should be 74).
- `tests/db/import-legacy.test.ts` creates and deletes a user `import-test@test.dev` in the local DB and needs `.env.local`.
- The Supabase CLI is v2.75; v2.118 is available. The upgrade isn't needed yet.
