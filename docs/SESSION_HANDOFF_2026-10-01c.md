# Session Handoff — 2026-10-01c

## What we did this session
- **Vault catch-up.** The last full vault sync was on 2026-09-29. Running `npm run vault:sync` pulled in the 7 missing handoffs and the latest timeline.
- **Specs and plans now reach the vault.** `vault-sync-dev.ts` copies every non-handoff `.md` under `docs/` into `Development/Docs/`, keeping the folder layout.
- **Per-function change history** (`f537f46`).
  - Each function note now has `created`, `last_changed`, `change_count` and a `## History` list of commits. They come from `git log -L` over the function's line range.
  - The Code Map base has a new "Recently changed" view.
  - A full code sync takes about 15 s and runs in the background after every commit.
- **Dead-code detection fixed** (`c1d755b`). All 18 `dead_candidate` flags were false positives:
  - React components used as `<Component />` weren't counted as calls.
  - `src/main.tsx` wasn't treated as an entry file.
  - Calls made at module level (e.g. `transform.entry` inside `SUBFOCUS_MAP`) weren't counted.
  - All three now count, and there are 0 dead candidates.
- **New project `CLAUDE.md`** covering:
  - the owner's working style (skeleton first, one chunk at a time, park new issues);
  - a music-scholar research stance (send sub-agents to public sources and record findings in `Research/`);
  - learner-first explanations at three levels (new, returning after a gap, established), chosen from progress data;
  - the foundations to keep reinforcing;
  - where the truth lives, and the code-graph and vault rules.
- Tests: 44 script tests pass; typecheck clean.

## What's next
1. **(30 min to design + an afternoon to build) Refreshers for returning learners.** Explanation depth should follow progress and time away. This came from the owner forgetting terminology after a break. Brainstorm the design before building.
2. **(30 min) Add one-line JSDoc to the 54 functions that have no summary.** Use the "Missing summaries" view in `Codebase/_meta/Code Map.base`.
3. Still open from 2026-10-01b: the phone check, then the Ask spec.

## Open questions
- None blocking.
