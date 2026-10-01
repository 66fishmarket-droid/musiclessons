# Glossary: beginner explanations in "More about this"

Status: approved in chat 2026-10-01, awaiting spec review.

## Problem
A returning learner (the owner, after a break) had forgotten terminology, and a new learner never knew it.
Engine-written text explains some terms inline (palm muting, CAGED) and uses others bare ("diatonic",
"chord tone", "inversions", "sus"). No glossary or definition mechanism exists. The LLM prompt asks for
in-sentence definitions but only covers LLM colour and isn't enforced.

## Goal
Every block's "More about this" panel can show a beginner-friendly definition of each music term the block
uses, plus a line connecting it to the foundations (intervals, half/whole steps, the 3rd that makes a chord
major or minor, scale formulas, consonance). It's pulled by the learner, not pushed: the panel stays
collapsed, so the people who need it open it and others ignore it.

Success: a learner with no prior knowledge can open the panel on any block and understand every term in
that block's text without leaving the app.

## Non-goals
- Tap-to-define on individual words in steps.
- Adapting explanation depth automatically to progress or time away.
- Using the glossary in SkillSheet ("About this skill"). That's a later cheap reuse.
- Any LLM involvement in definitions.

## What the learner sees
Inside the existing `<details>` "More about this" in `src/screens/Player.tsx`, below the LLM `more`
paragraph(s):

> **Words in this block**
> **Triad** — three notes played together: a root, the note a 3rd above it, and the note a 5th above that.
> *Why it works:* …

- Only terms found in this block's own text, in order of first appearance.
- Each term: `plain` (1–2 sentences, assumes nothing) and `why` (one foundation line).
- The panel renders when there is LLM `more` text **or** at least one matched term, and stays collapsed by default.

## Data: `supabase/functions/_shared/engine/glossary.ts`
```ts
export interface GlossaryEntry {
  id: string;          // snake_case
  term: string;        // display name
  match: string[];     // lower-case words/phrases that trigger it, e.g. ['triad', 'triads']
  plain: string;       // definition for a total beginner
  why: string;         // link to the foundations
  sources: string[];   // where it was checked; never shown in the app
}
export const GLOSSARY: GlossaryEntry[];  // ordered foundations-first
export function termsIn(texts: string[]): GlossaryEntry[];
```
It lives in the engine because the app already imports it. That way it ships in the bundle, works offline,
and works on lessons stored before this change. The lesson contract doesn't change and the edge function
isn't redeployed.

## Matching rules (`termsIn`)
- Case-insensitive, whole-word.
- Longest phrase first: a span matched by "minor pentatonic" is consumed and doesn't also match "minor".
- `{Chord}` tokens (ChordText chips) are stripped before matching.
- De-duplicated, ordered by first appearance across the texts in the order given.
- Player input order: instructions, target_text, listen_for, create_prompt (create block only), LLM `more`.

## Term selection and research
1. A one-off scan of engine-written text (all 61 recipes rendered, `create.ts`, the warmup/apply/record/reset
   text in `lesson/steps.ts`, skill names and descriptions in `supabase/seed/curriculum.ts`) yields candidate terms.
2. Candidates are split into must-define and everyday words. Expect 40–60 terms. **The owner reviews the term
   list before any definitions are written.**
3. Research sub-agents check each term against open sources (Open Music Theory, musictheory.net,
   university course notes, acoustics references for `why`). Findings go in
   `Music_Lessons Vault/Research/glossary/` as research notes per the Frontmatter Contract, with `evidence_tier`.
4. Definitions are written foundations-first: half step comes before minor, interval before triad.

## Review
`scripts/render-glossary.ts` writes `docs/glossary-review.md` in two parts:
1. Every entry in order: term, plain, why, match words.
2. Every recipe (rendered in G) with the terms found in its blocks, so recipes with no terms, or jargon
   with no entry, stand out.

The owner approves the review page before shipping.

## Tests
1. `termsIn` unit tests: whole-word and case-insensitive, longest-phrase-first, `{Chord}` skipped,
   de-duplication, order of first appearance.
2. **Build-up test:** for each entry at index i, `termsIn([plain, why])` returns only entries with index < i
   (or the entry itself). This guarantees no chain of unexplained jargon and enforces foundations-first ordering.
3. Integrity: unique ids; every `match` word is lower-case and non-empty; no match word belongs to two entries.
4. Player test: a block whose step mentions "triad" renders "Words in this block" with the Triad entry
   inside a collapsed `<details>`, and a block with no LLM `more` and no terms renders no panel.

## Upkeep
New rule in project `CLAUDE.md`: a new music term in engine-written text needs a glossary entry in the same
commit. Re-run `scripts/render-glossary.ts` to spot gaps.

## Files touched
- New: `supabase/functions/_shared/engine/glossary.ts`, `scripts/render-glossary.ts`,
  `docs/glossary-review.md`, `tests/engine/glossary.test.ts`.
- Changed: `src/screens/Player.tsx` (panel), an app test for Player, `CLAUDE.md` (upkeep rule).
- Vault: `Research/glossary/*.md` (gitignored).
