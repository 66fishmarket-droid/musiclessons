# Fretboard shortcuts, neck-map card and per-step elements

Status: approved in chat 2026-10-01, awaiting spec review.
Research: `Music_Lessons Vault/Research/fretboard_shortcuts/_Fretboard Shortcuts.md` (ranked; 11 claim notes).

## Goal
Get learners semi-proficient at moving around the neck fast, using the shortcuts teachers use, **without losing the
underlying structure**. Every shortcut is taught together with its "why", every dot is labelled with a degree or a note
name, and every shape is said aloud. This guards against "box prison", the research's main warning.

Also: **each step shows only the elements it needs.** Today the extras (diagram card, chord panel, metronome) are
chosen per block, so step 1 of a warmup ("hum or lip-trill") shows a scale board and a metronome it doesn't use.

## Non-goals
- Retrofitting per-step elements onto the other recipes and the warmup/apply/create/record blocks. That's the **next
  chunk**, with its own review.
- 3-notes-per-string (low value for a rhythm-first learner) and thumb-first fingerpicking (belongs to the fingerstyle track).
- Any change to the lesson content contract.

## Curriculum changes (fretboard track)
| Level | Skill id | Status | Card | Map kind |
|---|---|---|---|---|
| L1 | `fretboard.l1.notes_e_a` | upgrade | note_caller | — |
| L1 | `fretboard.l1.b_string_rule` | **new** | neck_map | `unisons` |
| L1 | `fretboard.l1.octave_shapes` | upgrade | neck_map (was note_caller) | `octaves` |
| L2 | `fretboard.l2.interval_shapes` | **new** | neck_map | `intervals` |
| L2 | `fretboard.l2.caged_linked` | upgrade | scale | — |
| L2 | `fretboard.l2.pentatonic_per_shape` | upgrade | scale | — |
| L2 | `fretboard.l2.progression_grid` | **new**, `majorKeyOnly` | neck_map | `grid` |
| L4 | `fretboard.l4.one_string_scale` | **new** | neck_map | `one_string` |

What each one teaches (examples in G; every map is calculated for the lesson's key):
- **B-string rule:** fret 5 on a string matches the next string up played open, except G→B, where it's fret 4.
  Say "five, five, five, four, five".
  *Why:* the guitar is tuned in 4ths (5 half steps) except one major 3rd (4 half steps), so chord shapes fit the hand.
- **Notes on strings 6 & 5 (upgrade):** the dot frets 3-5-7-9-12 as anchors; only E-F and B-C have no fret between them.
- **Octave shapes (upgrade):** skip one string and go up 2 frets; skip two strings and go back 3. Add 1 fret when the
  shape crosses G→B. *Why:* an octave is 12 half steps, and the same octave positions are what CAGED shapes are built around.
- **Interval shapes:** from a root on string 6 or 5, the 3rd is the next string, 1 fret back; the 5th is the next string,
  2 frets up; the b7 is two strings up, same fret (+1 across G→B). Say "root, third, fifth".
  *Why:* these are the building blocks of triads (L3).
- **CAGED / pentatonic (upgrade):** box 1 first; say the root out loud in every shape.
- **Progression grid:** I-IV-V-vi as root notes first, then as barre chords if known, saying "one, four, five, six".
  *Why:* Roman numerals in action; the same shape works in every key.
- **Scales on one string:** climb the key's scale up a single string by counting whole and half steps (major W-W-H-W-W-W-H,
  natural minor W-H-W-W-H-W-W). *Why:* the scale formula made physical; it's the cure for box-only thinking.

Wording for the upgraded skills' `name`/`description` changes in `supabase/seed/curriculum.ts`. Ids don't change.

## Engine: `supabase/functions/_shared/engine/neck.ts`
```ts
export type MapKind = 'unisons' | 'octaves' | 'intervals' | 'grid' | 'one_string';
export interface NeckDot { string: number; fret: number; label: string; root?: boolean; flag?: boolean }
export interface NeckMap { from: number; to: number; dots: NeckDot[]; links: [NeckDot, NeckDot][]; caption: string }
export function neckMap(kind: MapKind, key: string): NeckMap;
```
- Strings are 0 = low E … 5 = high E, matching `FretNote` in `music.ts`. Tuning in semitones: E A D G B E.
- Every position comes from semitone arithmetic over that tuning. Nothing is hand-entered.
- `flag` marks positions that are shifted by the G→B major 3rd.
- `links` join related dots: unison pairs, octave pairs, root to interval.
- `caption` is one plain sentence under the map. It must only use glossary-defined terms.
- Minor keys: `one_string` uses natural minor. `grid` is major-only, via `majorKeyOnly`.
- `SkillRecipe` gains `card: 'neck_map'` and `map?: MapKind`.

## Per-step elements
```ts
export type StepElement = 'card' | 'chords' | 'metronome' | 'note_caller';
// SkillRecipe gains: show?: StepElement[][]  — one entry per step, same length as steps
```
- `'card'` is the recipe's card (neck map, scale, triads, pattern, rhythm or note caller). `'chords'` is the chord panel.
  `'metronome'` is the tempo card. `'note_caller'` adds the note-calling drill to a recipe whose card is something else
  (octave shapes: learn on the neck map, then drill with the caller). It's only valid when `card !== 'note_caller'`.
- In a **new_skill** block whose recipe has `show`, Player renders only the current step's elements. A step with `[]`
  shows only its text.
- "More about this" and "About this skill" stay on every step.
- Every other block kind, and any recipe without `show`, keeps today's per-block behaviour. Retest blocks are excluded
  because they prepend a line, which shifts the step indexes.
- Computed client-side from the recipe and the step index, so no stored-lesson change.
- All 4 new and 4 upgraded skills declare `show`.

## App
- Extract the fretboard drawing from `src/components/ScaleBoard.tsx` into `src/components/FretGrid.tsx`: strings, frets,
  fret numbers and dots with labels. `ScaleBoard` renders through it, with unchanged output.
- New `src/components/NeckMap.tsx` draws `neckMap(recipe.map, plan.key)` with `FretGrid`, plus links, flags and the caption.
  It has an aria-label listing every dot, like ScaleBoard does.
- `src/screens/Player.tsx`: `card === 'neck_map'` renders NeckMap, and per-step gating applies as described above.

## Database
- New migration `supabase/migrations/<ts>_fretboard_shortcuts.sql` upserts the 4 new skills and the 4 updated
  names/descriptions (`insert … on conflict (id) do update`). It never touches `skill_progress`.
- Regenerate `supabase/seed.sql` with `npm run seed:sql`.

## Glossary
New engine-text terms get entries per the upkeep rule. Expected candidates: "landmark" (if used as a term), "unison"
(exists). Run `node scripts/render-glossary.ts` and check that every new recipe lists terms.

## Testing
1. `neckMap`, across keys G, C, E, Bb and A minor:
   - the unison pairs are 5 frets apart except G→B (4), and only that pair is flagged;
   - every octave link is 12 half steps;
   - the 3rd, 5th and b7 dots are 4, 7 and 10 half steps from their root;
   - the grid roots spell I, IV, V and vi of the key;
   - the gaps between neighbouring `one_string` dots match the key's scale formula;
   - all frets are within 0–15.
2. Recipes: every `neck_map` recipe has a valid `map`; every `show` has the same length as `steps` and holds only known
   elements; `'note_caller'` never appears when the card is already `note_caller`; any step whose text has the `{start_bpm}` ladder includes `'metronome'`.
3. Curriculum: every new skill has a recipe, its level and track are as in the table, and `majorKeyOnly` is set on the grid.
4. A pure helper `stepElements(recipe, kind, step)` in `src/lib/lesson.ts`, tested: the new_skill block with `show`
   returns that step's list; any other kind, or no `show`, returns null (meaning per-block behaviour).
5. DB test (`npm run test:db`): after the migration, the 4 skills exist and existing `skill_progress` rows are unchanged.
6. A check by eye on the dev server: a new skill's step with `[]` shows text only, and the map appears only on steps that list `'card'`.

## Deploy
All three: the DB migration (hosted), `generate-lesson` (the recipes live in the shared engine), and Netlify (merge to
`main`). The owner's next fretboard lesson drops to L1 for the B-string rule. That's intended.
