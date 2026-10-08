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

## On dev, not deployed: easiest chord shape first (8955468)
- `chordVoicings`: extended chords (anything but major, minor, 7) lead with the lower E- or A-shape barre, the open E/A chord of
  that type slid up with a barre. Dmaj7 → x-5-7-6-7-5. Am7/Em7 keep their open shapes (they already are the E/A shape).
- "Use this shape" in Other shapes saves a per-chord pick in localStorage (`shape:<chord>`); `shapeFor` reads it at every draw site.
- Costs: Cmaj7 now starts on a barre; the step text's "root on string N" follows the engine's shape, not a picked one.
- Verified in the local app (picked G shape 2 → panel redrew). Tests 573/573. Needs merge + `generate-lesson` redeploy.

## Later
- Some chords-db shapes for plain chords put a non-root in the bass (e.g. Ab7's first shape).
- The `steps.test.ts` sweep takes ~3s; timeout raised to 20s.
