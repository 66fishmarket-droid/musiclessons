# Session Handoff — 2026-10-01d

## What shipped (on `dev`, not merged)
**Glossary: beginner explanations in "More about this".**
Spec: `docs/superpowers/specs/2026-10-01-glossary-design.md`. Plan: `docs/superpowers/plans/2026-10-01-glossary.md`.

- `supabase/functions/_shared/engine/glossary.ts` holds 133 researched terms, ordered foundations-first:
  - the guitar itself, sound and pitch, steps and intervals;
  - scales and every mode, chords, harmony (including the 12-bar blues forms), rhythm, technique, and song sections.
- A test enforces that every definition only uses terms defined above it.
- `termsIn(texts)` matches the longest phrase first, skips `{Chord}` chips and removes duplicates.
- `blockTerms(content, i)` lives in `src/lib/lesson.ts`. Player shows a **"Words in this block"** list inside the collapsed "More about this" panel. It also shows on blocks that have no AI paragraph, and on lessons stored before engine-written steps.
- Each term's research note is in the vault at `Research/glossary/<id>.md`, with sources and evidence tier.
- `node scripts/render-glossary.ts` writes `docs/glossary-review.md`. The owner approved its wording.
- New rule in `CLAUDE.md`: a new term in engine text needs a glossary entry in the same commit.
- Tests: 318 pass; typecheck clean. Checked by eye on the local dev server against the 2026-10-01 test lesson.
- No change to the lesson format, so **only Netlify needs a deploy** (merge `dev` → `main`). No edge-function deploy is needed.

## Final review
The Opus reviewer found 0 Critical and 1 Important issue. All fixed in `f07d304`:
- added a "Mute / muted" entry;
- stopped "a chord borrowed for one bar" from showing the borrowed-chord definition;
- reworded five entries that were slightly inaccurate: augmented, secondary dominant, blue note, double-stop and card.

Deferred minors:
- an apostrophe next to a term blocks the match ("root's");
- "b7" can match the chord name B7 in AI text;
- "Pick one of your songs" shows the plectrum definition;
- the panel markup could use `<dl>`/`<dfn>` for screen readers;
- the spacing between entries is tight.

## Also done
- **Fretboard shortcut research** is in `Music_Lessons Vault/Research/fretboard_shortcuts/`: 11 notes plus a hub, `_Fretboard Shortcuts.md`, ranked. The top three are the B-string rule, octave shapes, and natural notes on strings 6 and 5 from landmark frets.
- Warning from that research: a widely read teaching site gets its interval shapes wrong. The app must calculate interval positions, never copy them.

## Gotcha
A stale PWA service worker on `127.0.0.1:5173` kept serving an old production build over the dev server. If dev changes don't show, unregister the service worker and clear its caches in DevTools.

## What's next
1. **(5 min) Decide on the merge:** `dev` → `main` deploys the glossary to the live app (Netlify auto-deploys).
2. **(30 min to design) Fretboard shortcuts as lessons:** brainstorm how the ranked shortcuts become fretboard-track steps, each paired with its "why".
3. (30 min) One-line JSDoc summaries for the 54 undocumented functions.
4. The phone check and the Ask spec, both carried over from 2026-10-01b.
