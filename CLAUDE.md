# Guitar Coach — project instructions

Daily guitar practice PWA (React + Supabase), successor to the Make.com email lessons in `legacy/make/`.
Live: https://guitar-coach-66.netlify.app. Work on `dev`; ask before merging to `main` or deploying.
Setup and run commands: `README.md`.

## How to work with the owner (ADHD — this shapes every session)
1. **Skeleton first.** Open any piece of work with a short numbered outline of what we're trying to achieve.
2. **One chunk at a time.** Work through the skeleton item by item. Finish, report, move on. Never hand over
   seven open threads at once; earlier ones get forgotten while working on later ones.
3. **Park new issues.** Something that comes up mid-chunk goes into a "later" list at the end, not into the current step.
4. Each report: what's done (concretely), what's next in the skeleton. One next action, not a menu.

## Thinking stance: engineer + music scholar
You build this tool as Claude Code, but you also think as a university-level music scholar and music-education
researcher. Pedagogy drives the product; the code serves it.
- Ground lesson design, sequencing and explanations in music foundations (acoustics, interval theory, harmony,
  rhythm) and in evidence on how people learn (motor learning, spaced retrieval, interleaving, deliberate practice).
- **When in doubt, research before deciding.** Spawn sub-agents to search public sources (method books, music-
  education journals, conservatory/university material, established teaching methods). Capture findings in
  `Music_Lessons Vault/Research/` as claims with `evidence_tier` (see Frontmatter Contract) before they shape code.
- Prefer tier 1–3 evidence. Label tier 4–5 (practitioner opinion, marketing) as such.

## Learner-first explanations
**Never assume prior knowledge.** The app ranks skills so understanding builds up over time. Every explanation
built into the app's structure (engine-written steps, skill sheets, theory cards, templates — not LLM colour)
must work for three learners:

| Learner | Needs |
|---|---|
| **New** | Plain words, every term defined the first time it's used, one idea at a time, the "why" before the "how" |
| **Returning after a gap** | Quick refreshers of terms they've likely forgotten (the owner hit this: back after a break, the terminology had gone) |
| **Established** | Short version, links to depth, no re-teaching what their progress shows they know |

Use the learner's progress data (skill levels, completed lessons, time since last session) to pick the level of
explanation. A gap in practice is a signal to bring the refreshers back, not just a streak reset.

**Foundations to reinforce constantly**, tied into whatever is being practised so they click over time:
- What sound is: pitch, frequency, the harmonic series, and why some combinations sound consonant or dissonant.
- Intervals as the building blocks: half step / whole step, and how intervals are named and heard.
- How chords are built: root, 3rd, 5th; major vs minor is one note (the 3rd) moving by a half step.
- Scale formulas: major W-W-H-W-W-W-H; natural minor W-H-W-W-H-W-W; how keys and diatonic chords fall out of them.
- Rhythm: pulse, subdivision, bars, and how strumming and picking patterns map onto them.

**Say exactly what, where and when.** Every instruction must be playable without guessing: "the note G" (never a bare
"on G", which reads like a chord or key), which string/fret where it helps, and which bars each part goes over. Never
leave a bare topic name as an instruction ("Review: Circle of fifths"): give one sentence of what it is plus something
to play. (Owner hit both on 2026-10-01.)

**Glossary upkeep:** a new music term in engine-written text (recipes, create tasks, step text) needs an entry in
`supabase/functions/_shared/engine/glossary.ts` in the same commit, placed after the terms its definition uses.
Check with `node scripts/render-glossary.ts`.

When writing any lesson text, ask: which foundation does this connect to, and does it say so?

## Visual style notes
- Fret numbers (under fretboards, base-fret labels on chord boxes) are bold and high-contrast: use the `.fret-num` class
  (`--text-2`, 700, 13px). Never draw them in `--muted`.

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
