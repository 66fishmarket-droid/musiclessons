# Session Handoff — 2026-10-05

Owner played "Object writing & shuffle boogie in Ab" and hit five problems. Four are fixed on `dev` (not merged, not deployed).

## Shipped on dev
| Commit | What | Why |
|---|---|---|
| `da295d2` | `scaleBox` picks the four-fret window (one below the root, or on it) with more scale notes | Ab minor pentatonic showed frets 3–6, cutting off Cb (b3) on both E strings and Gb on B |
| `b19e3c1` | Shuffle boogie is a 5–6 riff: grid tokens `5`/`6` (root+5th / root+6th), placed on string 6 or 5 at the lower fret; card shows fret numbers; counts open with what "root-5/root-6" means | It was stored as eight down-strums on 7th chords and never explained. Both blues and rock_hard shuffle boogies changed (drafts in vault + `merge-styles.ts` regenerated). Source: Keith Wyatt (ArtistWorks), tier 4 |
| `b19e3c1` | Glossary: power chord, boogie | New terms in step text |
| `5ecdd9b` | Review: one step per item = what it is + the step that plays it (`playStep`) + chords once through. Player shows each item's own card/chords/About-this-skill via `reviewView`. Style rhythms carry their grid in `content.blocks[].rhythms` | Review steps were one-line text with no chords or card |
| `5ecdd9b` | `.prog` chord strip scrolls inside its card | 12-bar strips clipped bars 8–12 (pre-existing, every blues Apply) |
| `3112d73` | Reset wording follows the block before it | "Hum the last thing you played" after a writing block |
| `e3d37c7` | CLAUDE.md rule: show what you say, on every block path | Going-forward guard |

Tests: 530 pass, including 175 catalogue-wide review cases (every practice skill and style rhythm must show its card/chords on review).

## Deployed 2026-10-05
PR #12 merged (`21fcaeb`), `generate-lesson` redeployed, Netlify live. Today's lesson row was deleted (status planned, no logs) so the owner gets a fresh one.

## Audit fixes on dev (after the deploy, not yet merged)
`docs/rhythm-audit-2026-10-05.md` has the full list and status. In short: palm mute `M`/`m`; valse musette 3/4 and gospel ballad 12/8; swing carried and played; picked notes `l`/`c`/`n`/`h`; next-bar push. Also `ec3aa58` restored LF line endings that my Windows Python edits had flipped. 545 tests pass.
These need the same deploy as before: merge to main and redeploy `generate-lesson` (the rhythm now carries swing and push in the plan).

## Needs a deploy to reach the owner (done for the first batch, see above)
- `generate-lesson` must be redeployed: review lines, the `rhythms` field and reset wording are written server-side.
- Netlify (main) for the app: scale box, boogie card, review cards, chord strip.
- Lessons already stored keep their old text. Today's (2026-10-05) lesson is unchanged.

## Open / later
1. ~~Same class as the boogie bug~~ (fixed, see the audit doc). Was: style patterns whose `note` says something the strum grid can't show. Worst: `rock_indie_alt.jangle_arpeggio` and `quiet_verse_sparse_pick` (picked notes stored as strums), the metal chugs and `pop_punk.palm_muted_chug_verse` (palm mute not shown), `rock_classic.stab_and_space` (choke). An audit is about an hour, plus fixes per pattern.
2. LLM-chosen songs don't fit the element (Hoochie Coochie Man for a shuffle boogie; capo 3 suggestions).
3. Review of a style progression shows the chord chips only (its chords can differ from the day's, so no panel).
4. Carried over: 54 function summaries; the Ask spec.
