# Guitar Coach — project instructions

Daily guitar practice PWA (React + Supabase), successor to the Make.com email lessons in `legacy/make/`.
Live: https://guitar-coach-66.netlify.app. Work on `dev`; ask before merging to `main` or deploying.
Setup and run commands: `README.md`.

## Where the truth lives
| What | Where |
|---|---|
| Code | `src/` (UI), `supabase/functions/_shared/engine/` (pure TS lesson engine), `supabase/functions/` (edge), `scripts/` |
| Design decisions (why) | `docs/superpowers/specs/`, plans in `docs/superpowers/plans/` |
| Session history | `docs/SESSION_HANDOFF_*.md` (newest = where we are) |
| Research + long-term memory | `Music_Lessons Vault/` (Obsidian, gitignored) |
| What the app serves | Supabase. The vault never feeds the app directly. |

## Start of session — read in this order
1. Newest `docs/SESSION_HANDOFF_*.md`.
2. `Music_Lessons Vault/Development/Timeline.md` for what changed recently.
3. The spec in `docs/superpowers/specs/` for the area being touched.
4. For pedagogy/curriculum work: `Music_Lessons Vault/Pedagogy/_notes/` and `Research/` claims.

## Code graph — check before writing a function
`Music_Lessons Vault/Codebase/` has one note per function: summary (JSDoc), `parent` file, `calls` (children),
`called_by` (parents), `tested_by`, `duplicate_count`, `dead_candidate`, `created`, `last_changed` and a
`## History` of every commit that touched it. `_meta/Code Map.base` has views: Recently changed, Dead candidates,
Duplicates, Missing summaries.

Before adding a function:
1. Search the graph for an existing one that does the job: `grep -ril "<concept>" "Music_Lessons Vault/Codebase"`.
   Reuse or extend it rather than writing a near-copy.
2. After adding it, make sure something calls it. A new `dead_candidate: true` means a dead end.

Every function gets a one-line JSDoc saying what it does and why it exists. That line becomes its vault summary.
Commit messages say why, not just what. They become each function's change history.

## Vault rules
- Sync is deterministic: `npm run vault:sync` (code, styles, dev timeline + docs, curriculum). The code graph also
  refreshes in the background after every commit via `.githooks/` (`git config core.hooksPath .githooks`).
- Generated notes (`generated: true`) get overwritten. Hand-written notes go in a `_notes/` folder.
- Frontmatter keys: `Music_Lessons Vault/_meta/Frontmatter Contract.md`.

## End of session
1. Write `docs/SESSION_HANDOFF_YYYY-MM-DD.md` (what changed, why, open questions).
2. Run `npm run vault:sync` so the handoff, specs and timeline land in the vault.
