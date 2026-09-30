# Session Handoff — 2026-09-30

This session was a phone check of the Phase 3 app over the home network, plus fixes for what the check found. All the work is on local `dev` and **not pushed yet** (4 commits ahead of `origin/dev`). `main` is unchanged.

## What we did this session
- **Phone check on the home network.** The app was served at http://192.168.1.87:5173.
  - `VITE_SUPABASE_URL` has to be overridden to the PC's network address, or the phone looks for Supabase on itself.
  - `supabase functions serve` has to be running, or the lesson fails to load with HTTP 503.
- **Scale fretboard** (`4111e6e`):
  - `src/components/ScaleBoard.tsx` shows today's scale on the Warm-up block. Each dot is numbered with its scale degree, and roots are marigold.
  - The position comes from `scaleBox()` in `engine/music.ts`: four frets, starting one fret below the lowest root on the E or A string.
- **Picking pattern walks the progression** (`4111e6e`):
  - `PickingPattern` plays one bar per chord.
  - `nextBarChord()` in `engine/patterns.ts` picks each bar's chord: the one after the last bar's, or the chord you tapped.
  - `ChordPanel` no longer tracks the current chord itself. `Player` holds it (`chordIdx`), so the panel and the pattern stay in step.
- **Plainer lesson text:**
  - prompt `gc-2026-09-29`: rule 17 says to explain every term in the same sentence and to write progressions as chord names, never Roman numerals. Rule 10 makes the Create block's steps a recipe with a worked example.
  - prompt `gc-2026-09-30`: rule 18 lists every tool the app has and forbids promising anything else.
- **Note caller** (`1f6d324`, `091f34c`):
  - `src/components/NoteCaller.tsx` plus `src/lib/noteCaller.ts`.
  - It shows a note and says it aloud (using the phone's built-in voice) on the metronome's first beat of every bar.
  - Start and Stop also control the metronome. You can choose Naturals or All 12 notes.
  - It appears on New skill and Cold retest blocks for `fretboard.l1.notes_e_a` and `fretboard.l1.octave_shapes`, never on Apply.
- `Demo imagery/` is now in `.gitignore` (`0e14ea2`).
- Tests: 233 unit tests pass and the typecheck is clean. Matt confirmed the fretboard and the note caller on the phone.

## What's next
1. **(2 min)** `git push origin dev`.
2. **Task 15, deploy.** The plan is `docs/superpowers/plans/2026-09-29-phase3-practice-app.md`, and the steps are listed in `SESSION_HANDOFF_2026-09-29b.md`. **Ask before every step.**
   - Before deploying, decide whether the PWA uses `registerType: 'autoUpdate'` or `'prompt'`. The recommendation is `'prompt'`, so a new deploy can't cut into a practice session.
3. **After the deploy, re-check on the phone over HTTPS.** This test couldn't cover these, because they need HTTPS: the screen staying awake (the phone locked during practice), mic recording, install to home screen, and offline use.
4. **Optional text polish:** the notes lesson said "semitones" without explaining it, and "before the next beat" when the caller changes note once per bar.
5. **Phase 4:** the Ask button. It answers "what does four-bar melody mean?"-type questions for a specific block.

## Design decisions already made
- The scale fretboard shows **one** position, on Warm-up only. It doesn't play the scale when tapped.
- Each picking pattern is one bar long. Pressing Play walks the progression from the chord currently shown, one chord per bar.
- The "About this skill" sheet still shows the pattern on a single chord.
- The Create block format is unchanged: its `instructions` hold the recipe, and `create_prompt` stays one sentence.
- The note caller's timing comes from the metronome's first beat of each bar (`metro.beat === 0`), not from its own timer.
- The app never listens to check whether you found the note. You still judge pass/fail yourself.
- The AI may only name tools on the rule-18 list. **If a new tool is added, add it to rule 18.**

## Known issues / gotchas
- **Keeping the screen awake needs HTTPS.** `useWakeLock` is correct, but `navigator.wakeLock` doesn't exist on plain `http://<LAN IP>`. Don't "fix" it with a hidden looping video until the HTTPS test has been done.
- **Serving to the phone from the PC:** run `VITE_SUPABASE_URL=http://192.168.1.87:55321 npx vite --host 0.0.0.0`. Old `vite`/`vite preview` processes can hold port 5173; find them with `Get-NetTCPConnection -LocalPort 5173` and stop them.
- **Sign in on the phone with the 6-digit code.** The link in the email points at localhost and won't open on the phone.
- **Test data changed by hand:** the `phase3@test.dev` lesson for 2026-09-29 has `plan.skill_id` set to `fretboard.l1.notes_e_a`, but its text is about palm muting. It was only for testing, so delete it if it causes confusion. The 2026-09-30 lesson was regenerated normally with prompt `gc-2026-09-30`.
- **Speech timing:** the phone's voice starts slightly after the click, and there's nothing to fix there.
