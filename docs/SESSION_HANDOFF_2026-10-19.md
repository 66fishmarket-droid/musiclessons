# Session handoff — 2026-10-19

## Shipped (all merged to main; generate-lesson redeployed; Netlify bundle `index-ganLoW_3.js`)
- **PR #20: hammer-on step says exactly what to do.** `fills.l1.sus_add_hammers` said "hammer a free finger onto the next fret up": no string, and B7 has no free finger. The hammer-on is now the pull-off reversed (lift the chord's own finger, strum the open string, hammer it back). New slots `{hammer_on}` / `{hammer_each}` in `engine/render.ts`; e.g. E7 index (1) string 3 fret 1 · A7 ring (3) string 2 fret 2 · B7 little (4) string 1 fret 2.
- **PR #20: Chord / Lifted flip.** Recipes with `lift: true` (sus_add_hammers, open_chord_pulloffs) get a toggle on the chord panel; `liftedShape()` in `engine/patterns.ts`.
- **PR #21: step text follows the Other-shapes pick.** `withPickedShapes()` (`src/lib/chordLabels.ts`) re-renders the engine steps in the browser with the learner's picked shapes first, so finger/string/fret text matches the card. No pick = stored text untouched.
- **PR #22: boom-chuck ≠ boom-chick.** Both were `B---D---B---D---`. Bluegrass boom-chuck, its upstroke variant and the waltz now choke (`x`) an eighth after each strum; folk/country boom-chick rings. Edited at source: vault `Research/styles/style_profiles.country_roots.draft.json`, then `node scripts/merge-styles.ts`. Evidence tier 4 (practitioner consensus).

Tests: 598/598 (DB tests need Docker / `supabase start`).

## Open questions
- Lessons generated before today keep the old hammer-on wording (stored at generation).
- The choke is only spoken in counts as "mute (slap or choke)"; a dedicated "choke" glossary entry may help.
- `docs/glossary-review.md` has an uncommitted 1-line change that predates this session.
