# Scale block with drone — design

Date: 2026-11-21. Status: draft for owner approval.
Research: `Music_Lessons Vault/Research/scales/` (start at `_index.md`, then `claim_daily_scale_block_loop.md`).

## Intent
The owner is "still not sure of the scales". The app shows one scale box a day, always the same lowest position, and never
checks whether it stuck. This turns the Warm-up into a proper daily scale block that builds scale positions across the neck
in a research-backed order and brings each one back on a spaced schedule, all over a drone in the lesson key that the
learner can switch off.

## Goals
- Warm-up becomes the scale block: **Retrieve → Map → Vary → Connect → Use**, over a drone.
- Scale positions are introduced one at a time in a fixed ladder (below) and tracked in the existing review system.
- Every position is shown on a degree-labelled board (already the `ScaleBoard` convention: 1 is the home note).
- A big, obvious drone on/off button on the block.

## Non-goals (later)
- Modes (Mixolydian, Dorian) — research says teach them as one changed note when a song needs one.
- 3-notes-per-string, the one/two-string connector stage, the off-day mental-rehearsal card.
- Changing the Review block, New skill recipes, or `fretboard.l2.pentatonic_per_shape`.

## Anti-goals (fail even if it works)
- Map grows to fill the block: fixed-order up-and-down runs retain worst. Map is capped at its slot.
- Use gets skipped: without phrases over chords the block trains a pattern, not a usable scale.
- A drone the learner can't silence, or one that keeps playing into the next block uninvited.

## Approaches considered
- **A (chosen by owner): Warm-up becomes the scale block** and grows; extra time comes from New skill; the voice hum
  folds into Map (singing degree numbers warms the voice).
- B: a separate Scales block after Warm-up, taking time from Apply/New skill. Rejected: one more block per session, and it
  would duplicate the Warm-up's existing scale step.
- (Not offered) scale positions as fretboard-track skills: they'd only appear on fretboard days, but retention needs daily
  contact and spaced review independent of the track rotation.

## Timing (my call)
| Session | Warm-up | New skill | Block steps |
|---|---|---|---|
| 25 min | 2 → 3 | 7 → 6 | Retrieve, Map, Use (research's 3-minute variant) |
| 30 min | 3 → 4 | 8.5 → 7.5 | all five |
| 40 min | 3 → 5 | 11 → 9 | all five, longer Use |

Day one (no known positions): Retrieve is skipped and its time goes to Map.

## The position ladder (my call, from `claim_layering_order_accompanist.md`)
A position is a scale type wrapped around one CAGED chord shape. Ref format `scale:<type>:<shape>`.

| # | Ref | Why here |
|---|---|---|
| 1 | `minor_pent:E` | Box 1, wraps the minor barre shape they know |
| 2 | `minor_pent:D` | Its upper neighbour; linked by the shared edge notes |
| 3 | `major_pent:G` | Same dots as #1, new home note (relative major) |
| 4 | `major_pent:C` | Same dots as #2 |
| 5 | `major:E` | Full major grown from the E-shape chord: chord → triad → add 2, 6 → add 4, 7 |
| 6 | `major:A` | Same, from the A-shape chord |
| 7–9 | `major:C`, `major:G`, `major:D` | Remaining positions, each learned against its already-known neighbour |
| 10–14 | `minor:E`, `minor:D`, `minor:C`, `minor:A`, `minor:G` | Natural minor wrapped around each CAGED *minor* chord shape (same convention as `minor_pent:E`). Learner-facing link: these are the relative major's dots with home on the 6th |

Shape geometry (which frets each shape spans for a given tonic) is computed in code from semitones (owner's chord-engine
direction), not stored shapes. A new pure engine function places a scale around a CAGED shape for any tonic; existing
`scalePositions` / `scaleBox` in `engine/music.ts` and `FretGrid` do the rest.

**Rendering in today's key.** Every position renders in today's lesson key so the drone and the board agree. If the ref's
quality differs from today's (a minor ref on a major day), use the relative key's shape, and still label degrees from
today's home note. Example: `minor_pent:E` on a C-major day is the A-minor pentatonic E-shape box at fret 5, shown as
C major pentatonic with 1 on C. This is the "one family, shared shapes" claim made visible.

**Days that aren't plain major or minor (my call).** Styles can set mixolydian, dorian, harmonic minor, phrygian,
aeolian, blues or minor blues as today's scale. The Warm-up uses the **parent** instead: major for major-family scales
(mixolydian, lydian, major pentatonic, major blues), natural minor for minor-family ones (dorian, phrygian, aeolian,
harmonic/melodic minor, minor pentatonic, blues), split by the existing `MINOR_FAMILY_SCALE` test. The drone stays on today's
tonic, so board and drone agree. Modes stay a non-goal. Apply and Create keep drawing `plan.music.scale` as today; the
Apply link step's wording changes from "the warm-up shape" to name the scale it shows, since the Warm-up position now moves.

**Starting point (owner, 2026-11-21).** The app has other users in mind, so the rule is data-driven, not owner-specific:
a learner who has completed 5+ lessons has seen the old Warm-up's lowest box many times, so `scale:minor_pent:E` is
seeded as known (`interval_days 1`, due the day of their first new lesson; a miss on that Retrieve just puts it back in
the queue). This is a one-off backfill in the migration: once the old Warm-up is gone nobody new
sees box 1 that way, so no ongoing seeding is needed. New learners start at zero: day one is a Map of
box 1 with no Retrieve.

**Connect's neighbour (my call).** Connect uses a *known* ladder neighbour of the same type (either side). If none is
known (the first days, or Map is the newest ref and its only known neighbour isn't introduced), Connect is skipped and its
time goes to Use. Connect never previews an unintroduced position.

**When a new position is introduced.** The next ladder ref is introduced (as today's Map position) when the most recently
introduced ref has `interval_days >= 7` (passed at two reviews: `_schedule_review` goes 1 → 3 → 7). Pace: about one new position every 4 practice days, all 14 in roughly two months of daily practice (my call). Otherwise Map uses the known ref that is most overdue, or
failed last time.

## Spacing — reuse `review_items`
- New `item_type = 'scale'` (migration widens the check constraint). Ref as above.
- A ref enters `review_items` (interval 1, due tomorrow) when the lesson that introduced it is completed — same pattern
  as `style` / `theory` in `complete_lesson`.
- Retrieve results schedule via the existing `_schedule_review` ladder (1, 3, 7, 14…), **capped at 14 days for scales**
  (mental-practice effect halves in ~2 weeks, `claim_mental_rehearsal_of_positions.md`). A miss resets to 1.
- `complete_lesson` scores `scale:` refs logged from the `warmup` block (today it only scores review/new_skill).
- Scale items never appear in the Review block (`pickReview` excludes `item_type = 'scale'`); Warm-up owns them.

## Planner
`planLesson` fills `warmup.items`:
- **Retrieve:** up to 2 known refs, due ones first, then random among known (seeded by date, keeping the planner pure).
  Never 1-2-3 order. After a practice gap (no lesson in 7+ days), oldest-first.
- **Map:** one ref (new per the rule above, or weakest known).
- Connect uses Map's ladder neighbour (the adjacent CAGED shape of the same type); Use needs no ref.

## The block, step by step (engine-written text in `lesson/steps.ts`, `FIXED_SHOW` in `src/lib/lesson.ts`)
Every step names exactly what, where and when (project rule). Drafts — the builder finalises wording:
1. **Retrieve.** "Key of G, E-shape position: play every 3rd, then every root." Board hidden until the learner taps
   *Show*; then a *Got it / Missed* pair records the result (same buttons as Review items). Two prompts, rotating the
   target degree (1, 3, 5, the 2/6 or 4/7 once full scales are in).
2. **Map.** Today's position grown from its chord: play the chord, then its triad, then the added notes, slowly,
   singing each note's number. On a new pentatonic box: the box root to root.
3. **Vary.** One variation, rotating by date: start on the 3rd, descend, groups of three, triplets.
4. **Connect.** Map's position and its neighbour on one board, shared seam notes marked; slide across the seam and back.
5. **Use.** 3–5 note phrases over today's chord progression, landing on each new chord's 3rd. Chords on screen.

## Drone (my calls)
- A large toggle on the Warm-up block itself ("Drone G · on"), not just the chip in the metronome card (which stays).
- Starts **on** when the Warm-up opens; if the learner turns it off, that choice is remembered on the device
  (`localStorage`, wrapped in try/catch) and the next Warm-up starts off. Turning it back on clears the preference.
- The drone stops when the Warm-up ends unless the learner turned it on in a later block themselves.
- Reuses `src/audio/drone.ts` (root + 5th + octave, triangle, soft fade) and `useDrone`. No new audio code.

## Constraints and project rules
- Engine stays pure and deterministic (same state → same plan); randomness is seeded from the date.
- New music terms in step text (drone, position, seam, sequence…) get glossary entries in the same commit
  (`engine/glossary.ts`, check with `node scripts/render-glossary.ts`).
- "Show what you say": every step that names a position puts that board on screen; the catalogue guard in
  `tests/lesson/steps.test.ts` must cover the new warm-up.
- Deploy: migration + `generate-lesson` redeploy + Netlify must ship together; ask the owner before deploy/merge.

## Left to the builder
Exact step wording (within the rules above), the board layout for Connect, the shape-placement algorithm, the Vary
rotation list, test structure, and how the Retrieve *Show* control looks (follow the existing player styling).
