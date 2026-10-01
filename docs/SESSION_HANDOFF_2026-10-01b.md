# Session Handoff — 2026-10-01b

`SESSION_HANDOFF_2026-10-01.md` has the full build notes, design decisions and gotchas. This file records the ship.

## What we did this session
- Matt skimmed `docs/recipe-review-2026-10-01.md` (all 61 recipes rendered in G major) and approved it as is.
- **Merged** `dev` → `main` as PR #8 (merge commit `f0416c0`). Netlify auto-deployed it within about 40 s, and the live bundle now contains "More about this".
- **Deployed** `generate-lesson` (prompt `gc-2026-10-01`) to Supabase project `uoytcppwovhteqklezmq`. A call without a sign-in returns 401, as expected.
- The hosted DB had no lesson for 2026-10-01 at deploy time. Matt's next open writes a fresh lesson through the new pipeline: engine steps, colour from the LLM, recipe cards.
- Tests at merge: 301 unit and 15 DB, all passing; typecheck and build clean.

## What's next
1. **(5 min) Phone check:**
   1. Open the app and tap **Reload** on the update banner.
   2. Play today's lesson and, on every block, check that the steps match the card.
   3. Open "More about this" and check the "Listen for" line.
2. **After a few days:** look for colour rejections with `select lesson_date, llm_model, content->'generation' from lessons where source='app' order by lesson_date desc`. `llm_model = 'fallback'` or `unmet skill named:` errors mean the skill-name check is too strict.
3. **Small cleanups:** move the Gmail App Password out of `supabase/functions/.env`, and tidy the local test data.
4. **Next spec:** the Ask button with library tools (skill and recipe lookup, progress, recent lessons). After that, a tab card for fills.

## Design decisions already made
All of them are listed in `SESSION_HANDOFF_2026-10-01.md`. Two matter most:
- The app and `generate-lesson` ship together whenever the lesson contract changes.
- Recipes are code; change them in `engine/recipes.ts`, then re-render with `node scripts/render-recipes.ts G`.

## Known issues / gotchas
- Open items to watch in real use, from the 2026-10-01 handoff:
  - **anticipations:** the card's audio changes chord at the bar line while the text says change early.
  - **voice_leading_inversions:** the triads card shows only the first chord's shapes.
  - **triads_lower_sets:** has no step where you play a sus or dim shape.
  - **modulation:** no target-key slot.
- Lessons stored before today keep their old text (`tips`/`explanation`), and they still display fine.
