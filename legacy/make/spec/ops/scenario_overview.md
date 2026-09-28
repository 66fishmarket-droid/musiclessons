# Make.com Scenario Overview

Reverse-engineered from `make blueprints/` on 2026-04-20. Covers both scenarios: **Daily Lesson Generator** (main pipeline) and **Feedback Ingestor** (tier/score updater). Zone: `eu2.make.com`.

Module IDs `[N]` reference the numeric `id` in the blueprint JSON so you can locate each step in the Make UI.

---

## Shared data surface

One Google Sheet drives everything: `1GoXKmCQQCmX67qF9_aKae-g1kqFVbmTL70xwNyzbf34` with tabs:

| Tab | Role |
|---|---|
| `Lessons` | Daily lesson log. 44 cols (A..BZ header range). Status col `O` = Delivered / Completed / Skipped. UID in col `AS` (index 44). |
| `Feedback` | Google Form submissions. Joined to Lessons by LessonUID (col G). |
| `SubFocusProgress` | Per-(Focus, SubFocus) tier + score + hints + last-delivered date. |
| `MissingChords` | Write-only log when GPT references a chord voicing missing from the repo. |

External systems:

- **OpenAI** — `gpt-4.1` for the lesson, `gpt-4o` for song picks. Both use `response_format: json_object`.
- **GitHub raw** — `https://raw.githubusercontent.com/66fishmarket-droid/musiclessons/main/spec/domain/chord_repo.json` fetched each run as the authoritative voicing library.
- **Google Form** — feedback form, prefilled with LessonUID via query param `entry.2057838612`.
- **Email** — HTML mail to `plaasboy@gmail.com`.
- **YouTube / Ultimate Guitar** — no APIs. The scenario only constructs search URLs and links them from the email.

---

## Scenario 1 — Guitar - Daily Lesson Generator

### Top-level shape

```
[135] LESSON LAST (latest row in Lessons, orderBy A desc, limit 1)
   └─[136] Router
        ├─ Route 1: full lesson pipeline (~60 modules)
        └─ Route 2: [137] LESSON REMINDER email ("DO YOUR LESSON")
```

Both router routes have `filter: null` in the exported JSON. In practice Route 2 is the nag for when the prior day wasn't completed — the branching condition presumably lives in the Make UI filter editor and wasn't serialised. Worth sanity-checking in Make since a missing filter would fire the reminder on every run.

### Route 1 — lesson generation pipeline

The pipeline runs left-to-right in these logical stages. Each stage is a cluster of `util:SetVariables`, with sheet/HTTP/GPT calls at the boundaries.

#### 1. Context aggregation — what happened yesterday

| ID | Name | Output |
|---|---|---|
| [2] | `CTX LAST` | Latest row from Lessons where status ∈ {Delivered, Completed} |
| [3] | `CTX AGG / Last Vars` | `lastDay`, `lastFocus` (default "CAGED"), `lastKey` (default "G"), `LastSubFocus`, `LastLessonUID` |
| [5] | `CTX AGG / Pull Feedback` | Latest Feedback row (sorted by col A desc, limit 1) |
| [6] | `CTX AGG / Feedback Vars` | `fbcompleted`, `fbneedReinforce`, `fbconfidence` (number), `fbnotes`, `fbsuggestedFocus`, `LastFeedbackLessonUID` |
| [72] | `Apply Feedback` | `feedbackApplies = (last lesson UID == last feedback UID)` — prevents stale feedback leaking forward |
| [7] | `Repeat Hold` | Gated derivatives: `suggestedFocus`, `needsReinforceOrLowConf` (reinforce OR conf<3), `notes` |
| [73] | `Normalize` | `hasSuggestion`, `lastFocus_UC` |

#### 2. Focus rotation — pick today's Focus

| ID | Logic |
|---|---|
| [21] `FOCUS ROTATE / Compute` | Static cycle: `CAGED → Theory → Extensions → Groove → Progressions → Ear → Creative → CAGED` |
| [17] `FOCUS ROTATE / Apply` | Precedence: (1) explicit `suggestedFocus` from feedback wins, (2) else `needsReinforceOrLowConf` pins to `lastFocus`, (3) else rotate |

#### 3. SubFocus selection — pick today's SubFocus within Focus

This is the most intricate stage; it maintains per-focus rotation state.

| ID | Role |
|---|---|
| [78] `SF PICK / Catalog Fetch` | Pulls the most recent Lesson row where `Focus = NextFocus` (so we know the last sub inside that focus) |
| [79] `FOCUS LAST SUB / Load` | `lastSubForFocus`, `lastKeyForFocus` from that row |
| [18] `FOCUS LAST SUB / Name` | `lastSubFocus` from [2] for global fallback |
| [56] `SF FINAL / Sanitize Names` | Upper-case `lastSub`, lower-case `normNextFocus` |
| [57] `SF PICK / Candidate` | Seven parallel rotation tables — one per focus — encoded as nested `if()` chains. E.g. Theory cycles `Circle of Fifths → Intervals → Functional Harmony → Cadences → Voice Leading → (wrap)`; Groove cycles `Strum basics → Accent patterns → 16ths with muting → Shuffle/swing feel → Metronome subdivisions → (wrap)`; similarly for CAGED, Extensions, Progressions, Ear, Creative. |
| [60] `SF PICK / Progress Scan` | Reads `SubFocusProgress` for the focus (orderBy E asc, limit 1) — returns the sub with the stalest `LastDelivered` date |
| [65] `SF SELECT / Tier→Level` | Pulls `selSub`, `selTier`, `selRow`, `selHints` from the progress row |
| [26] `SF FINAL / Select` | If reinforce → keep `lastSubFocus`; else use the candidate from [57] |
| [67] `SF FINAL / Lock` | Final `NextSubFocus`, `Tier`, `ProgressRowID`, `KeyHints` — reinforce-aware |

Note the candidate selection and the progress-scan both influence the final sub: [57] is a deterministic rotation, [60] is a staleness-based pick, and [67] chooses the progress-scan's `selSub` as authoritative. [57]'s values ultimately feed nothing in [67] — they appear to be legacy from an earlier iteration. Worth pruning if you touch this stage.

#### 4. Key selection — [19] `KEY FINAL`

Static circle-of-fifths cycle: `G → D → A → E → C → F → Bb → Eb → Ab → Db → Gb → G`. If `needsReinforceOrLowConf`, pin to `lastKeyForFocus` (fallback `lastKey`).

#### 5. History compilation

| ID | Role |
|---|---|
| [27] `HIST L14 / Fetch` | Last 14 Delivered/Completed lessons |
| [28] `HIST L14 / Aggregate` | `TextAggregator` — joins into one blob |
| [29] `HIST L14 / History+FB Text` | Adds feedback block on top, stored as `historyAndFeedbackText` (used by both GPT calls) |

#### 6. Final variable bundle

| ID | Output |
|---|---|
| [30] `FINAL VARS / NextDay` | `nextDay = lastDay + 1` |
| [77] `SF FINAL / Display Names` | Public-facing names: `FinalNextDay`, `FinalNextFocus`, `FinalNextSubFocus`, `FinalTier`, `FinalKey`, `FinalKeyHints`, `FinalContextText` — these are what the prompt references |

#### 7. Chord repo fetch — [80]

`http:ActionGetFile` GETs `chord_repo.json` from this GitHub repo. The JSON is passed verbatim to the lesson prompt as the **only** source of truth for voicings. GPT is instructed to emit `status: NOT_FOUND` if no match exists rather than inventing a shape.

#### 8. GPT LESSON — [31]

- Model: `gpt-4.1`, `temperature: 0.5`, `max_tokens: 3000`, `response_format: json_object`.
- System prompt (~6k chars) enforces:
  - Return keys exactly: `Title, Concept, Exercise, WhyItMatters, JamPrompt, SubFocusExplainer, YouTubeSearchQuery, ChordAscii, ChordCodes`.
  - ChordCodes must resolve against `ChordRepoData` first. `eadgbe` array order is low→high `[E,A,D,G,B,e]`.
  - Exercise items use template `[tag] headline - Goal:… | tempo - bars | Accent:… Repeat: xN` plus an optional `[STRUM]` block with `COUNT / PATTERN / ACCENTED / UNIT / FEEL`.
  - Nine strum-pattern families A–I (Rock, Shuffle, Reggae, Funk, 6/8, Latin, Country, Punk…) with intent-keyword detection, token-count rules (8 / 16 / 6 / 12), and a 5-lesson cooldown on exact patterns.
  - Accent notation uses `**...**`; `-` = held/silent.
- User prompt (~4.5k chars) injects history, yesterday's feedback, and the TARGETS block plus:
  - Booster rules: `[SR]` first (spaced review ≤14 days), `[IL]` mid-way (interleave), `[MP]` last (mental practice).
  - Per-tier difficulty ladder (1 Foundations → 5 Musicality & form).
  - Reinforcement rule: keep same Focus/SubFocus/Key, 80–90% on prior idea, ≤+10 BPM.

#### 9. JSON parse and chord processing

| ID | Role |
|---|---|
| [36] `JSON PARSE / Clean` | Pre-clean before parse |
| [32] `JSON PARSE / Shape→schema` | `json:ParseJSON` into the schema |
| [90] `CHORD FIELDS / Prep` | Flatten ChordCodes for iteration |
| [83] `CHORDS ITER` | `BasicFeeder` over ChordCodes array |
| [84] `CHORDS ROUTER` | |
| ↳ Route 1 (NOT_FOUND) | [85] aggregate → [86] text join → [87] write to `MissingChords` sheet |
| ↳ Route 2 (FOUND) | [97]–[101] extract scalars/numbers/y-positions/dot-strings, [93] `SVG BUILD / per-chord`, [103] `HTML CARD / per-chord` |
| [95] `CHORDS HTML JOIN` | `TextAggregator` concatenates all chord cards |
| [96] `CHORDS HTML` | Final HTML string referenced as `{{95.text}}` in the email |

Both router routes again show `filter: null` in the JSON — the FOUND/NOT_FOUND branch decision relies on a filter set in the Make UI that wasn't serialised.

#### 10. Exercise step rendering

Per-step parsing is a chain of regex modules converting free-text exercise lines into structured HTML:

| ID | Role |
|---|---|
| [105] `EXERCISE Iter` | Feeder over `Exercise[]` |
| [125] `HEAD LINE` / [110] `EX LINE` / [129] `STRUM LINE` | Regex parsers |
| [113] `HUMAN VARS` | Human-readable line fragments |
| [115]–[119] | Strum sub-parsers (COUNT, PATTERN, UNIT, FEEL, ACCENTED) |
| [120] `STRUM VARS`, [124] `STRUM VARS PATTERNS` | Canonicalise tokens |
| [130]–[134] `PATTERN TDS`, `NORMALISE`, `NORMALISE 2`, `PAD16`, `TDS BUILDERS` | Token grid → HTML table cells; pad 8th-grid patterns to 16 slots so they render consistently |
| [122] `STEP HTML` | Per-step HTML |
| [123] `STEPS AGG` | `TextAggregator` → `{{123.text}}` in email |

#### 11. YouTube + Ultimate Guitar

| ID | Role |
|---|---|
| [34] `MEDIA YT URL` | `queryEncoded = encodeURL(YouTubeSearchQuery)` |
| [35] `MEDIA YT SEARCH` | `videoURL = https://www.youtube.com/results?search_query={queryEncoded}` — search page, not a direct video |
| [47] `UG SEARCH URL / Build` | **Second GPT call** (`gpt-4o`, temp 0.3, max_tokens 450) returning 3 songs in `{title, artist, originalKey, suggestedKey, capo, why, ugSearchQuery}`. Prompt biases toward mainstream songs likely indexed by Ultimate Guitar and respects confidence tier. |
| [48] `UG PARSE` | JSON parse |
| [49] `UG NBEST / Vars` | Encode 3 search queries |
| [50] `UG URL / Build` | `ug1URL..ug3URL = https://www.ultimate-guitar.com/search.php?search_type=title&value={q}` |

#### 12. Final assembly and delivery

| ID | Role |
|---|---|
| [58] `TIMESTAMPS+UID / Dates` | `Datepretty = YYYY-MM-DD` in `Europe/London` |
| [69] `TIMESTAMPS+UID / UID` | `LessonUID = {Datepretty}-{FinalNextDay}-{FinalNextFocus}-{FinalKey}` |
| [70] `FORM LINK / Base` | Hardcoded Google Form URL + `entry.2057838612` |
| [71] `FORM LINK / Prefill` | `formPreFill = {base}?usp=pp_url&{entryUID}={encodeURL(LessonUID)}` |
| [39] `EMAIL SEND` | HTML to `plaasboy@gmail.com`. Subject: `DGL: Day {N} - {Title} {Focus} in {Key}`. Body renders Concept, WhyItMatters, JamPrompt, SubFocusExplainer, ChordAscii `<pre>`, exercise steps, chord cards, YouTube link, 3 UG song links, feedback button. |
| [51] `FINAL VARS / Email Summary` | `exMultiline`, `exAll` (joined exercise text) |
| [52] `FINAL VARS / Runtime Meta` | `Has_SR`, `Has_IL`, `Has_MP` (boolean detectors), `YTQuery`, `YTLinkType=SearchURL`, `Model=gpt-4o` *(hardcoded; prompt [31] actually uses gpt-4.1 — this is a logging bug)*, `PromptVersion=v1.0`, `GeneratedAt=now` |
| [53] `LESSONS ADD` | Add row to `Lessons`. Writes 44 columns including status `Delivered`, all narrative fields, 3 song rows, SR/IL/MP flags, meta columns, and `LessonUID` into col 44. Model stamp field `41` is hardcoded `"gpt4.o"` — same logging issue. |
| [68] `PROGRESS STAMP` | Update `SubFocusProgress` col 4 (LastDelivered) to today for `ProgressRowID` |

### Route 2 — reminder

[137] sends the `DO YOUR LESSON` nag. Nothing writes state; relies on [136]'s filter to only fire when yesterday's row is `Delivered` (not `Completed`). As noted, the filter is not in the JSON export — verify in the UI.

---

## Scenario 2 — Guitar - Feedback Ingestor

Lightweight pipeline triggered (likely on a schedule) to pull the newest feedback and update tier/score.

```
[5] LESSON SEARCH (latest Delivered in Lessons, col O)
 └─[8]  CONTEXT SET         targetRow, targetUID (col 44), targetFocus (col 2), targetSub (col 3)
 └─[1]  FEEDBACK SEARCH     Feedback where G = targetUID, limit 1
 └─[9]  FEEDBACK CHECK      hasFeedback
 └─[2]  FEEDBACK PARSE      fbCompleted, fbNeedReinforce, fbConfidence, fbNotes, fbSuggested, datepretty, fbRow
 └─[3]  STATUS SET          newStatus = Completed | Skipped
 └─[18] ROUTER MAIN
      ├─ Route 1 (feedback present)
      │   [6]  LESSON UPDATE    cols 14 status, 15 reinforce, 16 confidence, 17 notes, 40 suggested
      │   [10] PROGRESS SEARCH  SubFocusProgress where A=targetFocus, B=targetSub
      │   [11] PROGRESS VARS    curTier, curScore, delta
      │        delta rules: reinforce→-2 ; conf≤2→-1 ; conf=3→0 ; conf=4→+1 ; conf=5→+2
      │   [12] SCORE CALC       newScore = curScore + delta
      │   [13] TIER DELTA       tierBump = +1 if newScore≥3, -1 if newScore≤-3, else 0
      │   [14] NEW TIER RAW     curTier + tierBump
      │   [15] FINAL VARS       newTier clamped 1..5, resetScore=0 on bump else newScore, nowISO
      │   [16] PROGRESS UPDATE  cols 2 tier, 3 score, 4 updated
      │   [7]  FEEDBACK MARK PROCESSED  cols 0 date, 7 "Yes", 8 timestamp
      └─ Route 2: placeholder (no-op — stub for future "no feedback" branch)
```

This matches the tier/score policy in your README exactly: **±2 for reinforce/strong-confidence, ±1 for single step, score reset on tier bump, tier clamped 1–5.**

Route 2 has no filter either, but it's harmless because its only module is `placeholder:Placeholder`.

---

## Cross-scenario contracts

The two scenarios communicate exclusively through sheet state:

1. **Daily Generator writes** a new `Lessons` row (status=Delivered) + `LessonUID`.
2. **User submits the Google Form** (prefilled with LessonUID), which appends a `Feedback` row.
3. **Feedback Ingestor reads** newest Delivered lesson → finds matching Feedback by UID → updates `Lessons` status and `SubFocusProgress` tier/score.
4. **Next Daily Generator run** joins last Lesson to last Feedback by UID ([72] `Apply Feedback`) and only applies feedback if UIDs match — preventing stale feedback from compounding.

`LessonUID` is the join key everywhere: `{YYYY-MM-DD}-{dayN}-{Focus}-{Key}`.

---

## Things I noticed that may be worth a closer look

1. **Router filters aren't in the JSON export.** Both `[136]` and `[84]` routers have `filter: null` for every route in the blueprint. Make sometimes stores route filters outside the blueprint export. Since the branches clearly depend on state (Delivered-vs-Completed for the reminder; FOUND-vs-NOT_FOUND for chord handling), confirm the filters are set in the UI — otherwise both routes fire every time.
2. **[57] `SF PICK / Candidate` is dead code.** It computes seven focus-specific rotations, but [67] `SF FINAL / Lock` only uses `selSub` from [65] (which came from [60] `PROGRESS SEARCH`). Deleting [57] wouldn't change output. Confirms `spec/ops/error_log.md` territory.
3. **Model/version stamping is stale.** [52] hard-codes `Model: gpt-4o` and [53] writes `"gpt4.o"` into `Lessons` col 41, but the actual lesson model in [31] is `gpt-4.1`. Logs are misleading.
4. **Secrets exposure.** Two items worth checking if you ever make this repo public: the recipient email (`plaasboy@gmail.com`), the spreadsheet ID, and the Google Form ID + `entry.2057838612` are all embedded as literals in the blueprint JSON.
5. **YouTube "video" is actually a search URL.** The email links to `youtube.com/results?search_query=…` rather than a specific video. Fine, but the column stored as `videoURL` and `YTLinkType: SearchURL` in Meta implies this was an intentional compromise — worth noting in `decision_log.md` if it isn't already.
6. **Chord repo is fetched live from GitHub on every run.** If this repo becomes private or the `main` branch is renamed, lessons silently lose their voicings source. Consider committing a fallback / caching layer, or switching to Make's built-in data store.
