# Session Handoff — 2026-10-01f

## Shipped (PR #11, merge `52dec97`; generate-lesson redeployed; live on Netlify)
- **Per-step elements everywhere.**
  - All 65 recipes and 5 create tasks list what each step shows.
  - Warm-up, apply and record have fixed lists (`FIXED_SHOW` in `src/lib/lesson.ts`). Retest is shifted by one for its "Cold retest" line. Review and reset stay whole-block.
  - New elements: `scale` (warm-up/create scale board) and `recorder`.
  - A running metronome *or* drone keeps its card visible; the drone switch lives on the metronome card.
- **Minor days:** interval shapes add a b3 dot. Scale boards label dots 1, b3, 4, 5, b7 (`degreeLabel` in `engine/music.ts`).
- **Theory review tasks** (`engine/theory.ts`). Each of the 13 theory topics gets a sentence plus something to play in the day's key, rendered against the major scale. This replaces the bare `Review: <topic>.` the owner hit for circle of fifths.
- **Create wording.** Tasks say "the note G" and which bars each line goes over. The owner was confused by "sing them on G and D". A test makes sure every `{degrees:…}` in create text follows "note(s)".
- **Review page:** `docs/steps-review.md` (`node scripts/render-steps.ts`).
- **Guard test:** the fixed blocks' real step counts must match their per-step lists (mutation-checked).
- Tests: 349 pass.

## Why theory items show up in review
Finishing a lesson queues its `theory_topic_id` for review (`complete_lesson` SQL). That's the topic of that lesson's "Why it works" card. So a topic can come up for review after appearing only in that card.

## Open
- The owner hasn't skimmed `docs/steps-review.md` yet. The per-step assignments are judgement calls.
- Parked: "Arrange your own song" says "record with the app's recorder", but skill blocks have no recorder.
- The local test lesson for `phase3@test.dev` (2026-10-01) has hand-edited plan/content.

## Next
1. The 54 function summaries (30 min).
2. The Ask spec.
