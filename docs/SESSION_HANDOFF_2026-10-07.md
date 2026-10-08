# Session handoff — 2026-10-07

Owner played today's lesson (fretboard, G, funk "The One + scratch", G Dorian) and hit three problems. All fixed and deployed.

| PR | Commit | What | Why |
|---|---|---|---|
| #14 | `31a57ec` | `scaleBox` widens to a 5-fret box when no 4-fret box plays the scale low to high without skipping a degree | G Dorian at frets 3–6 lost its 2 and 6. C major (2–5), open E minor and open A major also skipped a note |
| #15 | `103d189` | `scaleBox` drops doubled pitches in a box (keeps the B-string note) | The 3–7 box won on note count only because it held D twice (G7 = B3), and it put the 2 and 6 at fret 7. G Dorian now shows the traditional frets 2–6 shape |
| #16 | `df00651` | Apply step on a one-chord progression says "one-chord vamp: stay on {chord} for 8 bars or more…"; new `vamp` glossary entry + vault claim | Funk's Dorian one-chord vamp (Im7) is deliberate, but "play it on {Gm7}, then through {Gm7}" read as missing chords |

Deployed: Netlify (main, all three) and `generate-lesson` (for #16). Today's lesson row was left as is, since the owner was mid-lesson; the new Apply wording starts with tomorrow's lesson.

## Tests
- `tests/engine/music.test.ts`: every key × 10 scale types plays gapless; no box shows a pitch twice; G Dorian = frets 2–6.
- `tests/lesson/steps.test.ts`: one-chord Apply says "vamp", not "then through".

## Open questions
- `scaleBox` picks one position per scale. Players may want other positions (CAGED/3NPS) later. Not requested.
- Supabase CLI is v2.75.0, v2.120.0 is out.
