# Session Handoff — 2026-10-01e

## What shipped (on `dev`, not merged or deployed)
**Fretboard shortcuts, the neck-map card and per-step elements.**
Spec: `docs/superpowers/specs/2026-10-01-fretboard-shortcuts-design.md`. Plan: `docs/superpowers/plans/2026-10-01-fretboard-shortcuts.md`.
Research: `Music_Lessons Vault/Research/fretboard_shortcuts/`.

- **4 new skills:**
  - B-string rule (L1)
  - Interval shapes (L2)
  - Progression grid (L2, major keys only)
  - Scales on one string (L4)
- **4 upgraded skills:**
  - Notes on 6 & 5: landmark frets
  - Octave shapes: neck map plus the B-string shift, then the note-caller drill
  - CAGED: say the root aloud
  - Pentatonic: box 1 first
- `engine/neck.ts` calculates every map from semitone arithmetic, in any key, spelled from the key's own scale:
  - unisons
  - octaves
  - intervals (R, 3, 5, b7, 8 from roots on strings 6 and 5)
  - the I-IV-V-vi grid, with a fixed shape in every key
  - one-string scale (major, or natural minor on minor-family days)
- **Per-step elements.** New-skill recipes declare what each step shows: card, chords, metronome or note caller.
  - Player shows only those, plus "More about this" on every step.
  - A running metronome stays visible.
  - Retest blocks, other block kinds and older stored lessons keep the per-block behaviour.
- `FretGrid` is extracted from `ScaleBoard` and shared by both cards.
- Fret numbers are bolder and higher-contrast (`.fret-num`) and sit below the low-E dots.
- Migration `20261001000001_fretboard_shortcuts.sql` upserts the 8 skills. It's guarded to be a no-op on a fresh `db reset`, and it never touches progress.
- New glossary entry: **4th**.
- Tests: 339 unit and 17 DB, all passing; build clean. Checked by eye on the local dev server:
  - octave shapes: steps 1–3 show only the map, steps 4–5 only the note caller and metronome;
  - progression grid in G.

## Final review (Opus)
- Found 1 Critical (the migration broke a fresh `db reset`) and 4 Important (minor-family detection, flat-key spelling, grid shape not constant, hidden running metronome).
- All fixed with failing tests first in `a527e25`.
- Deferred minors:
  - lessons stored before deploy for octave shapes lose the note caller;
  - two closing steps hide the map (intended as recall from memory — confirm);
  - "4th" double-fires inside "sharp 4th";
  - wide maps scroll sideways at phone width.

## Deploy status
- 2026-10-01: migration pushed to `uoytcppwovhteqklezmq` (5 checked skills present, 27 progress rows intact). `generate-lesson` deployed; an unauthenticated call returns 401. PR #10 is open for the Netlify step.

## Deploy order
1. `supabase db push`: the migration.
2. `supabase functions deploy generate-lesson`: the recipes live in the shared engine.
3. Merge `dev` → `main`: Netlify.

After that, the owner's next fretboard lesson drops to L1 for the B-string rule. That's intended.

## Local data note
The local test lesson for `phase3@test.dev` on 2026-10-01 was hand-edited to point at a new skill. Its `target_text` ("39 bpm") is stale. It's local data only.

## What's next
1. **Retrofit per-step elements** onto the other recipes and the warmup/apply/create/record blocks (the next chunk). Include the b3/b7 labels on the minor pentatonic board.
2. One-line JSDoc summaries for the 54 undocumented functions (30 min).
3. The Ask spec.
