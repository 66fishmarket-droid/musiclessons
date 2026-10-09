# Session handoff — 2026-10-09

## Shipped
- **PR #18: easiest chord shape first.**
  - Extended chords start on the lower E- or A-shape barre.
  - "Use this shape" saves a pick for each chord.
  - Details: `SESSION_HANDOFF_2026-10-08.md`.
- **PR #19:**
  - **Play button on chord-card skills.** All 19 fills and songwriting skills now play the progression. The pull-off skill (`fills.l1.open_chord_pulloffs`) plays grid `D---D---D---q-o-`: strums, then a pull-off on beat 4. Grid tokens `q`/`o` and roles `pull`/`pull_open` come from `pullOff()` in `engine/patterns.ts`.
  - **Pull-off step names the finger.** New slot `{pull_off}` in `engine/render.ts`, e.g. A7: "pick string 2 (fret 2), then flick your ring finger (3) off it sideways so the open B string rings". On a barre shape it pulls off to the barre fret. A flat barre with nothing to pull off points the learner to "Other shapes".
  - **Boogie riff keeps the open 0-2-4 shape.** `riffRoot` uses an open string 6, 5 or 4 when the root is E, A or D. Before, D in the key of A slid up to fret 5 on string 5. Other roots still take the lower fret on string 6 or 5.
- `generate-lesson` has been redeployed. The live Netlify bundle is `index-CdiZxYUy.js`. Tests: 578/578.

## Notes
- Step text is stored with the lesson when it's generated, so today's lesson keeps the old pull-off and riff wording. The cards and play buttons are drawn by the app, so they're already fixed.

## Later
- Other fills skills (bass walks, slides, the G run, double stops) still play only plain strums.
- The "root on string N" in step text doesn't follow a shape the learner has picked.
- Some chords-db shapes for plain chords put a non-root note in the bass (e.g. Ab7's first shape).
- On style days, the Apply bridge could also link to a rhythm new skill.
- Deferred minors from 2026-10-08 are still open.
