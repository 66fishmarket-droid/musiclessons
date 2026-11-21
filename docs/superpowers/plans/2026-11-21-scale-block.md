# Scale Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Warm-up into a daily scale block (Retrieve → Map → Vary → Connect → Use) over a drone, with scale positions introduced along a fixed ladder and spaced through `review_items`.

**Architecture:** A new pure engine module computes CAGED scale positions from semitones and plans the day's scale block from `review_items` (type `scale`). The plan carries a `scale_block` with one entry per step; step text, step elements and the Player's board all read that one structure. The DB scores Warm-up retrieve results through the existing `_schedule_review`, capped at 14 days for scales.

**Tech Stack:** TypeScript, `tonal`, Vitest, React (Vite PWA), Supabase Postgres (plpgsql migrations), Deno edge function `generate-lesson`.

**Spec:** `docs/superpowers/specs/2026-11-21-scale-block-design.md`. Research: `Music_Lessons Vault/Research/scales/`.

## Global Constraints
- Engine stays pure and deterministic: same `PlannerState` → same plan. Randomness is seeded from `state.today`.
- Every step says exactly what, where and when ("the note G", which string/fret, which chord shape at which fret). No bare topic names.
- "Show what you say": each step that names a position puts that board on screen.
- New music terms in engine-written text get a `glossary.ts` entry in the same commit, after the terms they lean on; check with `node scripts/render-glossary.ts`. (`drone`, `position`, `relative` already exist; `CAGED` and `box` likely don't.)
- Every new function gets a one-line JSDoc saying what it does and why.
- Fret numbers on boards use `.fret-num` (already done inside `FretGrid`).
- Work on `dev`. Ask the owner before merging to `main` or deploying. Migration + `generate-lesson` + Netlify ship together.
- Commit messages say why. End each with the attribution lines from the session.

## Review Focus
1. **Lessons stored before deploy** have no `scale_block`: the Player must render the old Warm-up (single `ScaleBoard`, old steps) without crashing. Test in Task 5.
2. **Keys high on the neck** (e.g. E, F#, G#): a shape whose window would pass fret 15, or start below fret 0, drops an octave or rises one so every board fits frets 0–15. Test in Task 1 across all 12 tonics × 5 shapes × 4 types.
3. **Modal and blues days** (dorian, mixolydian, minor blues, harmonic minor): the Warm-up uses the parent major/minor, and the board and drone agree. Test in Task 2 (planner) and Task 4 (step text names the parent scale, not "dorian").
4. **One known position only:** Retrieve must still happen (it retrieves the Map position cold), never an empty Retrieve step. Test in Task 2.
5. **Drone off preference with storage blocked:** a `localStorage` throw must not break the Player; the drone just starts on. Test in Task 5.

---

### Task 1: CAGED scale positions (engine)

**Files:**
- Create: `supabase/functions/_shared/engine/scaleShapes.ts`
- Modify: `supabase/functions/_shared/engine/music.ts` (export the `box`/`gapless` helpers from inside `scaleBox` so both use them; `scaleBox` behaviour unchanged)
- Test: `tests/engine/scaleShapes.test.ts`

**Interfaces:**
- Produces:
  - `type Shape = 'C' | 'A' | 'G' | 'E' | 'D'`
  - `type ScaleType = 'minor_pent' | 'major_pent' | 'major' | 'minor'`
  - `const LADDER: string[]` = `['minor_pent:E','minor_pent:D','major_pent:G','major_pent:E','major:E','major:A','major:C','major:G','major:D','minor:E','minor:D','minor:C','minor:A','minor:G']` (bare ids; DB/plan refs are `scale:<id>`)
  - `parseRef(id: string): { type: ScaleType; shape: Shape }`
  - `neighbours(id: string): string[]` — the two ids of the same type whose shapes are adjacent in the cycle C → A → G → E → D → C (only those that exist in `LADDER`)
  - `interface PlacedShape { tonic: string; scaleName: string; chord: string; rootString: number; rootFret: number; from: number; to: number; notes: FretNote[] }`
  - `placeShape(tonic: string, type: ScaleType, shape: Shape): PlacedShape`
  - `renderRef(id: string, dayTonic: string, dayParent: 'major' | 'minor'): PlacedShape` — relative-key rule: a minor-type id on a major day renders in the relative minor of `dayTonic`, a major-type id on a minor day in the relative major. Board labels are computed by the caller with `degreeLabel(dayTonic, note)`.
  - `dayParent(scaleName: string): 'major' | 'minor'` — `MINOR_FAMILY_SCALE.test(scaleName) ? 'minor' : 'major'` (import from `render.ts`).

Placement algorithm (not determined by the tests alone): each shape has a root string and a chord span relative to the root fret, from the open chord it's named after.

| Shape | Root string (0 = low E) | Chord span (frets from root fret) |
|---|---|---|
| E | 0 | 0..+2 |
| A | 1 | 0..+2 |
| D | 2 | 0..+3 |
| G | 0 | −3..0 |
| C | 1 | −3..0 |

Minor shapes use the same table (the minor barre shapes share root strings and spans). Root fret = lowest fret of the tonic on the root string such that `rootFret + spanLow >= 0`; if the resulting window ends above fret 15, use the octave below when that is still ≥ 0. Window candidates: start at `lo − 1` or `lo` (lo/hi = chord span in absolute frets), span 3 then 4, keeping only boxes that contain the whole chord span and are gapless (the same test `scaleBox` uses); pick the one with more notes. Scale names for tonal: `minor_pent` → `'minor pentatonic'`, `major_pent` → `'major pentatonic'`, `major` → `'major'`, `minor` → `'minor'`. Positions from `scalePositions(tonic, scaleName, 17)`.

- [ ] **Step 1: Write the failing tests** in `tests/engine/scaleShapes.test.ts`:
```ts
it('places A minor pentatonic box 1 around the E-shape Am at fret 5', () => {
  const p = placeShape('A', 'minor_pent', 'E');
  expect(p).toMatchObject({ chord: 'Am', rootString: 0, rootFret: 5, from: 5, to: 8 });
  for (let s = 0; s < 6; s++) expect(p.notes.filter(n => n.string === s)).toHaveLength(2);
});
it('places G major around the E-shape G at fret 3, reaching back to F# at fret 2', () => {
  const p = placeShape('G', 'major', 'E');
  expect(p).toMatchObject({ chord: 'G', rootFret: 3, from: 2 });
  expect(p.notes).toContainEqual(expect.objectContaining({ string: 0, fret: 2, note: 'F#' }));
});
it('renders a minor ref on a major day in the relative minor', () => {
  expect(renderRef('minor_pent:E', 'C', 'major')).toMatchObject({ tonic: 'A', scaleName: 'minor pentatonic', from: 5 });
  expect(renderRef('major:E', 'G', 'major')).toMatchObject({ tonic: 'G', chord: 'G', rootFret: 3 });
});
it('neighbours follow C-A-G-E-D', () => {
  expect(neighbours('minor_pent:E').sort()).toEqual(['minor_pent:D']); // minor_pent:G is not on the ladder
  expect(neighbours('major:C').sort()).toEqual(['major:A', 'major:D']);
});
it('every ladder id in every tonic fits frets 0-15, holds every degree of its scale, and is gapless', () => {
  for (const t of ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']) for (const id of LADDER) for (const parent of ['major','minor'] as const) {
    const p = renderRef(id, t, parent);
    expect(p.from).toBeGreaterThanOrEqual(0); expect(p.to).toBeLessThanOrEqual(15);
    expect(new Set(p.notes.map(n => n.degree)).size).toBe(id.includes('pent') ? 5 : 7);
  }
});
```
- [ ] **Step 2: Run** `npx vitest run tests/engine/scaleShapes.test.ts` — expect FAIL (module not found).
- [ ] **Step 3: Implement** `scaleShapes.ts` per the interfaces and table above; lift `box`/`gapless` out of `scaleBox` in `music.ts` as exported helpers.
- [ ] **Step 4: Run** `npx vitest run tests/engine` — expect all PASS (including the existing `music.test.ts`, proving `scaleBox` is unchanged).
- [ ] **Step 5: Commit** (`scaleShapes.ts`, `music.ts`, test) — "Scale positions placed around CAGED shapes from semitones, so the warm-up can walk the whole neck".

---

### Task 2: Plan the scale block (engine)

**Files:**
- Create: `supabase/functions/_shared/engine/scaleBlock.ts`
- Modify: `supabase/functions/_shared/engine/types.ts` (`ReviewItem.item_type` adds `'scale'`; new types below; `LessonPlan.scale_block: ScaleBlock | null`)
- Modify: `supabase/functions/_shared/engine/templates.ts:8-10` (Warm-up/New skill minutes)
- Modify: `supabase/functions/_shared/engine/planner.ts` (`pickReview` excludes `item_type === 'scale'`; `planLesson` sets `scale_block` and Warm-up items)
- Test: `tests/engine/scaleBlock.test.ts`, `tests/engine/templates.test.ts`, `tests/engine/planner.test.ts`

**Interfaces:**
- Consumes: `LADDER`, `neighbours`, `parseRef` (Task 1).
- Produces (in `types.ts`):
  - `type ScaleStepKind = 'retrieve' | 'map' | 'vary' | 'connect' | 'use'`
  - `type VariationId = 'from_3' | 'descend' | 'threes' | 'triplets'`
  - `interface ScaleStep { kind: ScaleStepKind; ref: string | null; to?: string; degree?: string; variation?: VariationId }` — `ref`/`to` are bare ladder ids; `degree` is the retrieve target ('3', '5', '2'…); `to` is Connect's neighbour.
  - `interface ScaleBlock { map: string; map_is_new: boolean; retrieve: string[]; steps: ScaleStep[] }`
- Produces (in `scaleBlock.ts`): `planScaleBlock(state: PlannerState, minutes: SessionMinutes): ScaleBlock`

Rules (from the spec):
- Known = `reviewItems` with `item_type === 'scale'`. Newest = the known id with the highest `LADDER` index.
- **Map:** no known → `LADDER[0]`, new. Newest has `interval_days >= 7` and a next ladder id exists → that id, new. Otherwise the weakest known: `last_result === false` first, then oldest `next_due`, then ladder order.
- **Retrieve:** up to 2 known ids, excluding Map; ones due (`next_due <= today`) first by `next_due`, the rest in seeded-random order (hash of `today + id`). If the gap since `recentLessons[0].date` is ≥ 7 days (or there's no recent lesson but there are known items), order is oldest last-seen first (`next_due − interval_days`). If Map is known and nothing else is, retrieve Map itself. Map new and nothing known → no Retrieve.
- **Retrieve degree:** seeded pick from `['3','5','1']` for pentatonic ids, `['3','5','1','2','6','4','7']` for full ids; degree labels for minor types use `b3`/`b6`/`b7` (use `degreeLabel` on the parsed scale).
- **Vary:** `['from_3','descend','threes','triplets'][dayIndex % 4]`, dayIndex = whole days since 1970-01-01.
- **Connect:** first known id in `neighbours(map)`; none → no Connect.
- **Steps by session length:** 25 min: retrieve…, map, use. 30/40: retrieve…, map, vary, connect (if any), use.
- `templates.ts`: 25 → warmup 3, new_skill 6; 30 → warmup 4, new_skill 7.5; 40 → warmup 5, new_skill 9.
- `planLesson`: `scale_block = planScaleBlock(state, minutes)`; Warm-up block `items = scale_block.retrieve.map(id => ({ ref: \`scale:${id}\`, target: null }))`.

- [ ] **Step 1: Write the failing tests** (`tests/engine/scaleBlock.test.ts`, using the `state()` helper pattern from `tests/engine/planner.test.ts`; `scale(id, interval, next_due, last_result)` builds a `ReviewItem`):
```ts
it('a new learner maps box 1 with no retrieve or connect', () => {
  const b = planScaleBlock(state(), 30);
  expect(b).toMatchObject({ map: 'minor_pent:E', map_is_new: true, retrieve: [] });
  expect(b.steps.map(s => s.kind)).toEqual(['map', 'vary', 'use']);
  expect(planScaleBlock(state(), 25).steps.map(s => s.kind)).toEqual(['map', 'use']);
});
it('introduces the next position once the newest has interval 7, connecting to its known neighbour', () => {
  const b = planScaleBlock(state({ reviewItems: [scale('minor_pent:E', 7, '2026-10-17', true)] }), 30);
  expect(b).toMatchObject({ map: 'minor_pent:D', map_is_new: true, retrieve: ['minor_pent:E'] });
  expect(b.steps.find(s => s.kind === 'connect')).toMatchObject({ ref: 'minor_pent:D', to: 'minor_pent:E' });
});
it('holds back a new position while the newest is under interval 7, and retrieves the map position cold when it is the only one', () => {
  const b = planScaleBlock(state({ reviewItems: [scale('minor_pent:E', 3, '2026-10-10', true)] }), 30);
  expect(b).toMatchObject({ map: 'minor_pent:E', map_is_new: false, retrieve: ['minor_pent:E'] });
});
it('retrieves due items first, at most two, never the map position when others exist, same plan for the same day', () => { /* 4 known, 1 due; assert retrieve[0] is the due one, length 2, map not in it; planScaleBlock twice → toEqual */ });
it('after a 7-day gap retrieves the longest-unseen positions first', () => { /* recentLessons[0] 8 days ago; assert order by next_due - interval_days */ });
```
Add to `tests/engine/planner.test.ts`: due `scale` items never appear in `plan.review`; `plan.blocks[0]` is warmup with items equal to `scale_block.retrieve` prefixed `scale:`. Update `tests/engine/templates.test.ts` to the new minutes (warmup 3/4/5, totals unchanged at 25/30/40).
- [ ] **Step 2: Run** `npx vitest run tests/engine` — expect the new tests FAIL.
- [ ] **Step 3: Implement** types, `planScaleBlock`, template minutes and the `planLesson`/`pickReview` changes.
- [ ] **Step 4: Run** `npm test` — expect PASS. Existing fixtures that build a `LessonPlan` by hand need `scale_block: null` (or a fixture value); fix them in this task.
- [ ] **Step 5: Commit** — "Planner picks the day's scale positions from the review queue so they come back spaced, not one box forever".

---

### Task 3: Score scale retrieves in the database

**Files:**
- Create: `supabase/migrations/20261121000001_scale_block.sql`
- Test: `tests/db/complete_lesson.test.ts` (add cases; run with `npm run test:db` against local Supabase on port 55322)

**Interfaces:**
- Consumes: plan JSON fields `scale_block.map`, `scale_block.map_is_new` (Task 2); warmup logs with `item_ref = 'scale:<id>'`.

Migration contents:
1. `review_items.item_type` check constraint → `('skill','theory','style','scale')` (drop and re-add the constraint by its generated name; look it up with `\d public.review_items` locally).
2. `create or replace function public._schedule_review(...)`: same as `20260928000002_complete_lesson.sql`, but when `p_type = 'scale'` the next interval is `least(nxt, 14)`.
3. `create or replace function public.complete_lesson(...)`: copy the current body, and
   - in the log loop, `elsif v_log->>'block_kind' = 'warmup' and v_type = 'scale' then perform public._schedule_review(...)`;
   - after the style insert: if `(v_lesson.plan->'scale_block'->>'map_is_new')::boolean` then insert `('scale', plan->'scale_block'->>'map', 1, lesson_date + 1)` `on conflict do nothing`.
   - Keep `security invoker`, `set search_path = ''`, and re-apply the grants/revokes from `20260930000001_revoke_anon_execute.sql` for any function you recreate.
4. Backfill (one-off): for every user with ≥ 5 `completed` lessons, insert `('scale', 'minor_pent:E', 1, current_date)` `on conflict do nothing`.

- [ ] **Step 1: Write failing DB tests:**
```ts
it('scores a warm-up scale retrieve and caps scale intervals at 14 days', async () => {
  // setup: review_items (A, 'scale', 'minor_pent:E', 14, '2026-10-01'); lesson with plan {scale_block:{map:'minor_pent:D', map_is_new:false}}
  // complete_lesson with log {block_index:0, block_kind:'warmup', item_ref:'scale:minor_pent:E', passed:true}
  // expect interval_days 14, next_due '2026-10-15'
});
it('a miss on a scale retrieve resets it to 1 day', async () => { /* interval 7 → passed false → 1 */ });
it('a new map position enters the queue due tomorrow', async () => {
  // plan {scale_block:{map:'minor_pent:D', map_is_new:true}} → row ('scale','minor_pent:D', 1, '2026-10-02')
});
```
- [ ] **Step 2: Run** `supabase start` (if not running) then `npm run test:db` — expect the new tests FAIL.
- [ ] **Step 3: Write the migration;** apply locally with `supabase db reset`.
- [ ] **Step 4: Run** `npm run test:db` — expect PASS. Check the backfill by hand: `psql postgresql://postgres:postgres@127.0.0.1:55322/postgres -c "select count(*) from review_items where item_type='scale'"` after seeding a user with 5 completed lessons, or accept the reset seed result.
- [ ] **Step 5: Commit** — "Warm-up scale results feed the review queue, capped at 14 days because mental-practice gains halve in two weeks".

---

### Task 4: Step text, thread and glossary

**Files:**
- Modify: `supabase/functions/_shared/lesson/steps.ts:117-121` (warmup case) and `:153-155` (Apply link wording)
- Modify: `supabase/functions/_shared/lesson/thread.ts:50-52, 86` (warm-up intro and path line)
- Modify: `supabase/functions/_shared/engine/glossary.ts` (new terms as needed)
- Test: `tests/lesson/steps.test.ts`, `tests/lesson/thread.test.ts`, `tests/engine/glossary.test.ts`

**Interfaces:**
- Consumes: `plan.scale_block` (Task 2), `renderRef`, `dayParent`, `parseRef` (Task 1).
- Produces: warmup `instructions` with exactly one string per `scale_block.steps` entry, in the same order (Task 5 relies on this 1:1 mapping).

Text rules (wording is the builder's within these):
- When `plan.scale_block` is null, keep today's warm-up text (old plans).
- Every step names the position playably: scale name as the learner hears it (parent scale for modal days, e.g. "G major" not "G mixolydian"), the chord shape and its fret ("the E-shape Am chord at fret 5"), and on relative-key renders one clause saying it's today's key's notes ("same dots as C major pentatonic, so 1 is the note C").
- Retrieve: "Without looking: in the <position>, play every <degree> on every string, then every 1. Tap Show to check." Map: grow it from the chord (chord → triad → added notes) singing degree numbers; on a new pentatonic box, root to root. Vary: one line per `VariationId`. Connect: slide across the notes the two positions share, naming both shapes. Use: 3–5 note phrases over `{chords}`, landing on each new chord's 3rd.
- Drop the hum line (singing the numbers warms the voice). Mention the drone once, in the first step: "The drone plays the note <tonic> underneath; switch it off any time."
- Apply link step: replace "from the warm-up shape" with "from the scale shown".
- Thread warm-up intro and path line name today's Map position, not "Today's scale: …" alone.

- [ ] **Step 1: Write failing tests:** in `tests/lesson/steps.test.ts`, the warmup instruction count equals `plan.scale_block.steps.length` for every skill × key in the existing catalogue loop; no warmup step contains "dorian", "mixolydian" or "blues" when the style scale is modal; no step contains the bare string "warm-up shape"; a plan with `scale_block: null` still yields the old three warm-up steps. In `thread.test.ts` update the warm-up intro expectations.
- [ ] **Step 2: Run** `npx vitest run tests/lesson` — expect FAIL.
- [ ] **Step 3: Implement;** add glossary entries for any new term the step text matches; run `node scripts/render-glossary.ts`.
- [ ] **Step 4: Run** `npm test` — expect PASS (the glossary order test included).
- [ ] **Step 5: Commit** — "Warm-up steps walk retrieve, map, vary, connect, use, naming each position by chord shape and fret".

---

### Task 5: Player — boards, Retrieve reveal, drone toggle

**Files:**
- Modify: `src/lib/lesson.ts` (`stepElements` for warmup from `scale_block`; `refLabel` for `scale:` refs)
- Modify: `src/components/ScaleBoard.tsx` (accept a placed shape)
- Modify: `src/screens/Player.tsx:110-111, 174` (warm-up board per step, drone toggle)
- Create: `src/lib/dronePref.ts`
- Test: `tests/app/blockText.test.ts` (or a new `tests/app/scaleBlock.test.ts`), `tests/app/helpers.test.ts`

**Interfaces:**
- Consumes: `ScaleBlock`, `ScaleStep` (Task 2), `renderRef`, `dayParent` (Task 1), 1:1 steps (Task 4).
- Produces:
  - `warmupShow(block: ScaleBlock): StepElement[][]` — retrieve/map/vary/connect → `['scale','metronome']`, use → `['scale','chords','metronome']`. `stepElements` uses it when `kind === 'warmup'` and the plan has a `scale_block` (add a `plan` or `scaleBlock` parameter).
  - `refLabel('scale:minor_pent:E')` → `'Minor pentatonic, E shape'`.
  - `ScaleBoard` gains `placed?: PlacedShape` and `labelTonic?: string`; when `placed` is given it draws `placed.from..to` and `placed.notes`, labelling with `degreeLabel(labelTonic, note)`; optional `second?: PlacedShape` draws Connect's neighbour on the same grid (dimmed), with shared seam notes marked.
  - `readDroneOff(): boolean`, `writeDroneOff(off: boolean): void` in `dronePref.ts`, both wrapped in try/catch (storage blocked → `false` / no-op). Key: `'drone-off'`.

Player behaviour:
- Warm-up with `scale_block`: the board for step `step` comes from `scale_block.steps[step]` rendered with `renderRef(ref, tonicOf(plan.key), dayParent(plan.music.scale.name))`; Connect passes `second`. Without `scale_block`: today's `<ScaleBoard scale={plan.music.scale} />`.
- Retrieve steps: board hidden behind a "Show" button until tapped (reset per step). The existing review-items list UI (`slots.length > 1`) or verdict pair already logs `scale:` refs from `warmup.items`; keep it, labels via `refLabel`.
- Drone: a large toggle at the top of the Warm-up (`btn-primary`-sized, `aria-pressed`, text "Drone <tonic> · on/off"). On entering the Warm-up, drone = `!readDroneOff()`. Turning it off → `writeDroneOff(true)`; on → `writeDroneOff(false)`. When the block index leaves the Warm-up, the drone turns off unless the learner turned it on in that later block. The metronome-card chip stays and drives the same state.

- [ ] **Step 1: Write failing tests:** `warmupShow` returns one entry per step with `chords` only on `use`; `stepElements(…, 'warmup', …)` with a `scale_block` plan returns those; with `scale_block: null` it returns the old `FIXED_SHOW.warmup`; `refLabel('scale:major:A')` → `'Major, A shape'`; `readDroneOff()` returns `false` and `writeDroneOff(true)` does not throw when `localStorage.getItem`/`setItem` throw (stub with `vi.spyOn(Storage.prototype, …)`).
- [ ] **Step 2: Run** `npx vitest run tests/app` — expect FAIL.
- [ ] **Step 3: Implement** the lib functions, `ScaleBoard` props and Player changes.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit -p .` — expect PASS and no type errors. Then `npm run dev`, generate a lesson locally, and check in the browser: Warm-up starts with the drone on, the big toggle silences it, a reload keeps it off, Retrieve hides the board until Show, Connect draws two positions, and the drone stops on entering New skill.
- [ ] **Step 5: Commit** — "Warm-up player shows each step's position, hides it until the learner has tried Retrieve, and gives the drone a real on/off button".

---

### Task 6: Ship

- [ ] **Step 1:** `npm test`, `npm run test:db`, `npx tsc --noEmit -p .`, `npm run build` — all pass.
- [ ] **Step 2:** Push `dev`, open a PR to `main` listing the migration, function redeploy and app change.
- [ ] **Step 3: Ask the owner** before: `supabase db push` (migration incl. backfill), `supabase functions deploy generate-lesson --no-verify-jwt --project-ref uoytcppwovhteqklezmq`, and merging (Netlify auto-deploys `main`). Order: migration → function → merge.
- [ ] **Step 4:** Write `docs/SESSION_HANDOFF_2026-11-21.md` and run `npm run vault:sync`.
