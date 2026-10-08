# Session handoff — 2026-10-08

## Shipped
- **PR #17: lesson through-line.**
  - Each step block has an always-visible intro (what and why) and a bridge (the link, or "Change of focus: …").
  - Today shows "Today's path" (up to 5 lines).
  - Apply plays the style's scale on the home chord when the scale came from the style.
  - No-style I–IV–V–I days explain the chords with the circle of fifths.
  - Spec: `docs/superpowers/specs/2026-10-07-lesson-through-line-design.md`
  - Plan: `docs/superpowers/plans/2026-10-07-lesson-through-line.md`
- `generate-lesson` redeployed (PROMPT_VERSION `gc-2026-10-07`). Netlify bundle `index-Yhv_YwUZ.js` is live.
- Tests 561/561, tsc clean.

## Not verified
- No on-screen check (Docker was down, and today's stored lesson predates the change). The first lesson generated from now on carries the new fields. Older lessons render as before, because every new field is optional.

## Deferred minors
- Slash style names read awkwardly in sentences ("Pop / singer-songwriter pop players").
- Mode names are lowercase ("G dorian").
- The review block's intro and bridge repeat each other.
- `scaleInApply` is effectively always true on style days.
- Data: gypsy_jazz pairs Am6 (F#) with A harmonic minor (F).

## Next
- Easiest chord shape first: `chordVoicings` (engine/music.ts) takes chords-db order; ChordPanel shows `[0]`.
- `npm run vault:sync` once local Supabase is running (it failed with ECONNREFUSED this session).
