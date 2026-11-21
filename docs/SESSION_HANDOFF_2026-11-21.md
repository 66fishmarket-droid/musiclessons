# Session handoff — 2026-11-21

## Shipped
- **PR #23 (merged, `b941d41`; generate-lesson redeployed): Review skips songwriting skills.** The Create block already writes daily, so a songwriting item in Review repeated it. `pickReview` in `engine/planner.ts`.

## Built on `dev`, not deployed: the scale block (spec `docs/superpowers/specs/2026-11-21-scale-block-design.md`, plan `docs/superpowers/plans/2026-11-21-scale-block.md`)
Research first: vault `Research/scales/` (15 claims, start at `_index.md`). Owner chose: Warm-up becomes the scale block (option A), a drone with a real on/off button, box 1 counts as known for existing learners, new learners start at zero.
- **Warm-up = Retrieve → Map → Vary → Connect → Use** over a drone in the lesson key. It runs 3/4/5 min (25/30/40-min sessions), the extra time taken from New skill. 25-min sessions drop Vary and Connect.
- **Position ladder (14):** minor pentatonic E then D shape; the same dots as major pentatonic (G and E shape); full major E, A, C, G, D; natural minor E, D, C, A, G. Placed around CAGED shapes from semitones (`engine/scaleShapes.ts`), rendered in the lesson key (relative key when the quality differs, labels always from the day's home note).
- **Spacing:** `review_items` type `scale`; retrieve verdicts in the warm-up feed `_schedule_review`, capped at 14 days. The next position arrives once the newest reaches interval 7 (about every 4 practice days). Planner: `engine/scaleBlock.ts`.
- **Modal and blues days** warm up on the plain parent major/minor; Apply introduces the mode as one changed note.
- **Player:** board per step; Retrieve hides it until Show; Connect fades the neighbour and rings the shared notes; a big drone toggle (starts on after a tap, remembers off on the device, silent outside the warm-up). Lessons made before deploy keep the old warm-up.
- **Migration** `20261121000001_scale_block.sql`: constraint, 14-day cap, warm-up scoring, new-position insert, one-off backfill of box 1 for users with 5+ completed lessons.
- Final review (fresh reviewer) found 3 musical bugs (labels in Db/Ab/Gb minor, Connect pairs an octave apart, Use aiming at off-board notes) plus 2 UX ones; all fixed with tests.

Tests: 619/619 unit + 20/20 DB. Browser-checked locally (test user `scaletest@example.com` on local Supabase).

## To ship (needs owner OK)
1. `supabase db push` (migration + backfill)
2. `supabase functions deploy generate-lesson --no-verify-jwt --project-ref uoytcppwovhteqklezmq`
3. Merge the PR (Netlify deploys `main`)

## Open questions / later
- Retrieve rows say "Minor pentatonic, E shape" while the board names the rendered scale (e.g. "E minor pentatonic around the Em chord"); could match.
- Off-day 1-minute mental-rehearsal card, one/two-string connectors, and modes are non-goals for now (spec).
- Ladder pace (2 passes per new position) is a guess; watch whether it feels slow.
