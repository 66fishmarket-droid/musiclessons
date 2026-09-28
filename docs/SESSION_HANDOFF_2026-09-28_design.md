# Session handoff — 2026-09-28 (design session)

## What changed
- **Reviewed the dormant Make.com system.** Its last activity was 2026-02-21. It had about 129 lessons, shifted columns in the sheet, and lessons that repeated. The review is in `spec/ops/scenario_overview.md`.
- **Research:** a new Obsidian vault, `Music_Lessons Vault/` (gitignored), now holds 78 notes of pedagogy research and 20 style profiles (24 styles in 5 JSON drafts).
- **Spec approved:** `docs/superpowers/specs/2026-09-28-guitar-coach-design.md`.
  - React PWA + Supabase, with an LLM through OpenRouter (Kimi or Qwen).
  - 6 tracks plus a theory ladder.
  - Style elements mixed into lessons each day.
  - An "Ask about this" button in v1.
  - A code → vault graph like Bill's.
- **Phase 1 plan written:** `docs/superpowers/plans/2026-09-28-phase1-foundation.md`, 13 tasks.

## Why
Moving off Make removes the workarounds it forced and the sheet-integrity bugs. The research drives how each lesson is put together: one new concept per session, a measured target on every block, spaced review, and singing alongside playing.

## Open questions
- Default LLM: decided by a Kimi vs Qwen side-by-side test in Phase 2.
- OpenRouter account setup is deferred to Phase 2.
- Inferred style patterns stay unverified until someone checks them by ear.

## Next
Execute the Phase 1 plan with executing-plans (native), starting at Task 1.
