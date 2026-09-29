# Session Handoff — 2026-09-29b

Detailed build notes for Phase 3 are in `docs/SESSION_HANDOFF_2026-09-29.md`; read it if you need file-level detail. This file is the entry point for the next session.

## What we did this session
**Phase 3 (the practice app) is merged to `main`.** PR #3 is merge commit `0a718f1`. `main`, `origin/main` and local `dev` all contain it. Local `dev` is 3 commits ahead of `origin/dev` because it holds this handoff plus the fast-forward merge; push it.
- **App:** a Vite 7 + React 19 PWA in `src/`. It runs locally with `npm run dev` or `npm run preview`, both on http://127.0.0.1:5173.
  - Screens: `SignIn`, `Today`, `Player`, `Done` in `src/screens/`.
  - Pure logic: `src/lib/` and `src/audio/`, with tests in `tests/app/`.
- **Design:** the "Diwali hybrid" — the Stage player, the Instrument chord panel on Apply blocks, the Notebook-style Done list, and powder bursts over night-plum `#140B1F`.
  - Spec: `docs/superpowers/specs/2026-09-29-today-ui-design.md`.
  - Mockups: https://claude.ai/artifact/H3hkGH4qeQpD9Gbkx4RG48 (row D).
  - Research: `Music_Lessons Vault/Research/app_ux/` (53 notes).
- **Engine additions:**
  - `engine/patterns.ts`: role-based picking patterns worked out from semitones in any tuning.
  - `TUNINGS` + `noteAt(string, fret, tuning)` in `music.ts`.
  - `engine/skillGuides.ts`: "About this skill" guides for all 10 fingerstyle skills.
- **Spec §14** in `2026-09-28-guitar-coach-design.md` covers the later chord-engine phase: an instrument-agnostic voicing generator, progression-aware voicings (neck region, capo, grouping, lick room), tunings in the curriculum, and guides for the other tracks.
- **Tests:** 224 unit, 15 DB, and the typecheck is clean. A fresh reviewer went over the whole branch; every Important finding was fixed test-first.

## What's next
1. **(2 min)** `git push origin dev`, so `origin/dev` catches up with `main` and this handoff.
2. **(10 min)** Phone check on the local network:
   - run `npx vite --host 0.0.0.0` and open `http://<PC LAN IP>:5173` on the phone;
   - sign in with the **code** from http://127.0.0.1:55324, using the test account `phase3@test.dev` or your own;
   - play one block with the phone on the music stand.
   - Check: readability, the screen staying awake, recording, the plucked pattern audio, install to home screen.
3. **Task 15, deploy** (plan `docs/superpowers/plans/2026-09-29-phase3-practice-app.md`). **Ask before every step**:
   1. pause the `4n4l-engine` Supabase project;
   2. create the hosted `musiclessons` project, then `supabase db push --include-seed`;
   3. set secrets and run `supabase functions deploy generate-lesson --no-verify-jwt`;
   4. in the dashboard: add the user first, **then** turn sign-ups off, paste the magic-link template, set Site URL / Redirect URLs;
   5. run the legacy import with `--dry-run` first;
   6. create the Netlify site with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
   - Before deploying, decide whether the PWA should keep `registerType: 'autoUpdate'`, which reloads the page on a new deploy and could cut a session, or switch to `'prompt'`.
4. **Deferred minors**, only if they bite. The list is in `SESSION_HANDOFF_2026-09-29.md`; top picks are the metronome catch-up burst and a network timeout on the startup sync.
5. **Phase 4:** the `ask` edge function (the Ask button), Theory Explorer, Progress, Asked, and `vault-sync-asked`.

## Design decisions already made
- **Hybrid layout:**
  - the Stage player on every block;
  - the Instrument chord panel on Apply;
  - the Notebook results list on Done.
- **Diwali palette:** each block type has one colour — marigold for warm-up, rani pink for new skill, peacock teal for apply, violet for create, saffron for record, blue for retest and review.
- **Marigold** is used for every primary button and every chord root.
- **Plain CSS tokens** in `src/theme.css`; no router, no UI library.
- **The player judges pass/fail, not the mic.** "Clean at N" **below** a bpm target is saved as `passed = null` with `value_reached`, and is unscored (`verdictFor`). Only reaching the target is a pass; "Not yet" is a miss.
- **Sign-in:** email link **plus a 6-digit code**, with `shouldCreateUser: false`.
- **Offline:**
  - completions queue in `gc.pending` and flush on the next open, before the lesson fetch;
  - today's lesson is cached in `gc.lesson`, and yesterday's copy is never served;
  - a relaunch while offline with an expired token serves that cache instead of SignIn.
- **Phase 3 still takes chord shapes from `chords-db`.** The chord generator is a later phase (spec §14).
- **Picking patterns name roles, not strings.** The thumb takes `bass` (the lowest root) and `alt` (the 5th if it sits below the treble); the fingers take `t1`/`t2`/`t3`, the top sounding strings.
- **Skill guides live in code** (`engine/skillGuides.ts`), promoted from vault research by hand. There is no DB column.
- **Execute permission on `_score_skill` / `_schedule_review` is kept.** `complete_lesson` is security invoker, so the user needs it.
- **No Ask button, 10-minute day or weekly target in Phase 3.** See UI spec §6.

## Known issues / gotchas
- **Write files with LF.** Python text-mode writes on Windows produce CRLF and make whole files show as changed. Use the Write/Edit tools, or `open(p,'wb')`. There is deliberately no `.gitattributes`, because it would renormalise the CRLF files in `legacy/`.
- **Local mail is Mailpit, not Inbucket.** The API is `http://127.0.0.1:55324/api/v1/messages`; the web UI is on the same port.
- **`supabase stop` can leave `supabase_vector_musiclessons` stuck restarting.** `docker rm -f` it; it is the log shipper and holds no data. Then `supabase start`.
- **`supabase functions serve` must be running** for `generate-lesson` locally. `supabase start` alone doesn't serve functions.
- **Local test account `phase3@test.dev`** has a copy of the Giuliani lesson dated 2026-09-29. Remove it with `delete from auth.users where email='phase3@test.dev'`.
- **Never `cat` `.env.local` or `supabase/functions/.env`.** They hold the service-role key and the OpenRouter key; append with `>>` only.
- **`vite` is pinned to ^7.3**, because Vitest 3.2 needs Vite 7. That is also why `@vitejs/plugin-react` stays on 5.x (6.x needs Vite 8).
- **The main JS chunk is over 500 KB** (engine + chords-db JSON, about 70 KB gzipped). Vite warns; it is harmless for now.
- **Not yet verified on a real phone:** wake lock, mic recording, pattern audio, install to home screen.
