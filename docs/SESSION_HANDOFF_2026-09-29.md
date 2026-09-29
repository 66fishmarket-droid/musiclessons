# Session Handoff — 2026-09-29 (Phase 3: practice app)

## What we did
1. **App UX research.** We ran three parallel agents and wrote 53 notes to `Music_Lessons Vault/Research/app_ux/` (start at `_index.md`). They cover guitar lesson apps, guitar tools, and best-in-class practice UX from outside guitar.
2. **Design.** We published three mockup directions and the user chose a **hybrid**:
   - the "Stage" full-screen player;
   - the "Instrument" chord panel for chord blocks;
   - the "Notebook" results list on the Done screen;
   - all on a "Diwali" palette of soft powder bursts over a dark night-plum background.
   - Mockups: https://claude.ai/artifact/H3hkGH4qeQpD9Gbkx4RG48 (row D). Spec: `docs/superpowers/specs/2026-09-29-today-ui-design.md`.
3. **Phase 3 built on `dev`** (plan `docs/superpowers/plans/2026-09-29-phase3-practice-app.md`, Tasks 1–14). It is a Vite + React PWA in `src/`:
   - **Sign-in:** email with a link **and a 6-digit code**, because the link alone fails inside an installed iOS PWA. `shouldCreateUser: false` means no new accounts can be made.
   - **Today:** date, week dots, block list, "Why it works", Ultimate Guitar song links, "About this skill", and Start / Resume / Done-for-today.
   - **Player:**
     - progress rail sized by block minutes, timer with an end chime, steps with tappable `{Chord}` chips;
     - voicing sheet with Fingers/Intervals;
     - chord panel for Apply (current and next chord, progression chips);
     - metronome (lookahead Web Audio, tempo ladder chips, beat dots), drone, recorder (in memory only);
     - picking-pattern animation;
     - Space and → / ← (or PageUp/PageDown) for foot pedals, ignored while typing;
     - the screen stays awake;
     - resumes the same block after a reload.
   - **Done:** best bpm, clean count, minutes, a result per block, take playback, 1–5 rating, "Fix tomorrow", "need more time". Save calls `complete_lesson`; when offline, the completion is queued and retried on the next open.
   - **PWA:** installable with PNG icons. The app shell is precached; today's lesson is cached in `localStorage` (`gc.lesson`).
4. **Engine additions:**
   - `engine/patterns.ts`: **role-based** picking patterns. The thumb takes the root and the alternate bass; the fingers take the top three sounding strings. Roles are worked out from semitones in any tuning.
   - `TUNINGS` + `noteAt(string, fret, tuning)`.
   - `engine/skillGuides.ts`: "About this skill" guides for all 10 fingerstyle skills.
5. **Spec §14 (a later phase):**
   - an instrument-agnostic chord generator (tuning + string count);
   - progression-aware voicing choice (neck region, capo suggestions, grouping, **lick room**);
   - alternate tunings in the curriculum;
   - guides for the other tracks.

## Decisions made during the build
- **Clean below the bpm target is progress, not a pass** (`verdictFor` in `src/lib/session.ts`). The browser end-to-end test showed `complete_lesson` raising the target from 60 to 65 after "Clean at 53". Now:
  - clean at or above the target → `passed: true`;
  - clean below → `passed: null` with `value_reached`, which is logged but unscored;
  - "Not yet" → `false`.
- **The local mail server is Mailpit** (API `/api/v1/messages`), on the same port 55324.
- `dist/` and `dev-dist/` are gitignored.

## Tests
- 215 unit tests and 15 DB tests pass. The typecheck is clean and the build precaches 29 entries.
- **Checked in desktop Chrome:**
  - the code sign-in;
  - every block;
  - the metronome and keys;
  - the chord panel and voicing sheet;
  - resume after a reload;
  - Done → saved to the DB;
  - offline save → sync on the next open;
  - the offline shell and lesson;
  - the About sheet and pattern animation.

## Final review (fresh reviewer) and fixes
The verdict was "with fixes": no Critical issues and 3 Important. Two Minors were re-graded Important because they affect daily use. All five are fixed test-first (224 unit tests pass):
1. **Offline relaunch after the sign-in token expired showed SignIn.** It now serves today's cached lesson, or shows "You're offline". Checked in the browser with an expired token and the API gateway stopped.
2. **Day rollover.** A PWA left open overnight loads the new day's lesson when it comes back to the foreground. It never does this mid-session.
3. **Recorder.** Leaving the record block stops the take and still keeps it, releases the mic, and can't open two mic streams.
4. **iOS audio.** Audio now resumes when iOS reports the `interrupted` state after a call or screen lock.
5. **Resume.** Coming back to a block whose time had already run out restarts its clock instead of showing overtime.

Line endings: every Phase 3 file is normalised to LF. Windows rewrites had made whole files show as changed.

## Not yet checked (needs your phone)
- Readability from a music stand, the screen staying awake, and the microphone permission and recording.
- Hearing the plucked pattern pitches.
- Installing to the home screen.

## Known minors (deferred)
- The metronome can burst missed beats after background throttling, and the beat dot can re-light after Stop.
- The startup sync and the Done save have no network timeout, so they can hang on a stalled connection. Nothing is lost.
- Some server errors (anything other than "lesson not found") are retried silently forever, with no "waiting to sync" message.
- Reopening offline after Done shows Start again. Doing the lesson again is harmless.
- Keys ignore auto-repeat and modifier keys (Alt+← also moves back a block), and the arrow keys still work while a sheet is open.
- Saving the session can throw if browser storage is blocked or full.
- `voiceRoles` breaks if a chord shape sounds fewer than 3 strings.
- "Minutes practised" counts time the app was closed.
- The auto-updating service worker could reload the page mid-session after a deploy. Revisit at Task 15.
- Apply and review blocks start the metronome at the new-skill **start** tempo instead of the tempo you reached earlier in the session.
- The main JS chunk is over 500 KB (the engine + the chords-db JSON; about 70 KB gzipped).

## Next
1. **Task 15: deploy.** It stops for your yes at each step:
   1. pause the `4n4l-engine` Supabase project;
   2. create the hosted project;
   3. set secrets and deploy the function;
   4. dashboard auth settings;
   5. import the legacy lessons;
   6. Netlify.
2. **Before deploy:** decide whether to merge `dev` → `main` (you asked to be asked).
3. **Local test account:** `phase3@test.dev` exists locally only. Delete it with `delete from auth.users where email='phase3@test.dev'` if you want it gone.
