# Variables Map (Make.com ↔ Prompt)

Process rule: Respond with one completeable chunk at a time. Do not jump ahead. Wait for me to say ‘next’.

## Generator — published (final*) tokens
- `finalNextDay` : int — Next day number (lastDay + 1)
- `finalNextFocus` : string — Chosen focus (suggestion → reinforce pin → rotation)
- `finalNextSubFocus` : string — Chosen subfocus (from SubfocusProgress or lastSubForFocus on reinforce)
- `finalKey` : string — Target key (pinned on reinforce; otherwise key cycle)
- `finalTier` : int (1–5) — Difficulty tier from SubfocusProgress
- `finalKeyHints` : string — Hints/capo notes from SubfocusProgress row
- `historyAndFeedbackText` : string — Last 14 lessons with brief feedback per line
- `LessonUID` : string — `YYYY-MM-DD-day-focus-key`
- `datePretty` : string — `YYYY-MM-DD`
- `generatedAtISO` : string — UTC ISO timestamp

## Feedback (yesterday) — cleaned flags for prompt
- `needReinforceOrLowConf` : bool — true if reinforce=yes OR confidence ≤3 and feedback matches LessonUID
- `yesterdayConfidence` : int — most recent matched confidence (1–5)
- `yesterdayNotes` : string — notes text
- `yesterdaySuggested` : string — suggested focus text

## Intermediate (used inside scenario only)
- `lastDay`, `lastFocus`, `lastKey`, `lastSubFocus` — from latest Lessons row
- `lastSubForFocus`, `lastKeyForFocus` — latest within same Focus from Lessons
- `NextFocus`, `NextSubFocus`, `NextKey` — pre-publish values
- `ProgressRowId` — SubfocusProgress row number to stamp `LastSeen`

## Sheets columns (Lessons)
- Date, DayNumber, FocusArea, SubFocus, Key
- Title, Concept, Exercise, WhyItMatters, JamPrompt
- ChordAscii, ChordCodes, YouTubeQuery, VideoLink
- Status (Delivered/Completed), GeneratedAt, LessonUID
- Feedback_NeedReinforce, Feedback_Confidence, Feedback_Notes, Feedback_SuggestedFocus
- Has_SR, Has_IL, Has_MP

## Sheets columns (SubfocusProgress)
- Focus, SubFocus, Tier (1–5), Score (int), LastSeen (ISO), KeyHints

## Prompt placeholders (User message)
- `{{finalNextDay}}`
- `{{finalNextFocus}}`
- `{{finalNextSubFocus}}`
- `{{finalKey}}`
- `{{finalTier}}`
- `{{finalKeyHints}}`
- `{{historyAndFeedbackText}}`
- `{{needReinforceOrLowConf}}`
- `{{yesterdayConfidence}}`
- `{{yesterdayNotes}}`
- `{{yesterdaySuggested}}`

## Key cycle (policy)
`G → D → A → E → C → F → Bb → Eb → Ab → Db → Gb → G` (pin on reinforcement)

## External Sources
- CHORD_REPO_SOURCE_URL — Static text. Default:
  https://raw.githubusercontent.com/66fishmarket-droid/musiclessons/main/spec/domain/chord_repo.json
  
## Tags legend
- `[SR]` Spaced Review
- `[IL]` Interleave
- `[MP]` Mental Practice

## Variables map — v1.1 additions (ChordCodes.status)

### New runtime variables (set in Make, after NOTFOUND aggregation)
- **NotFoundCount** → `length(NOTFOUND_AGG[])`
- **NotFoundList** → output of Text Aggregator (row separator `, `), e.g. `"Fmaj7#11, Bbm(add9)"`
- **NotFoundNote** → 

### Email field mappings
If building the email body in Make:
- Inject **NotFoundNote** directly into the HTML body below the chord list.

If using the HTML template (`spec/email/template.html`) with placeholders:
- Add a placeholder `{{NotFoundNote}}` in the template where you want the message to appear.
- Map **NotFoundNote → {{NotFoundNote}}** in the send step.

> Note: NotFoundNote is empty when `NotFoundCount = 0`, so no conditional is needed in the template.

### Google Sheets logging (MissingChords)
- **Sheet:** `MissingChords`
- **Columns:** `Date`, `ChordName`, `LessonUID`, `Source`
- **Mappings:**
- `Date = formatDate(now; "YYYY-MM-DD")`
- `ChordName = NotFoundList`   // grouped, comma-separated
- `LessonUID = LessonUID` (or `GeneratedAt` if used)
- `Source = "LessonGen"`

## Chord diagram (table-based, email-safe)

Purpose: Render per-chord diagrams with HTML tables that are safe for Outlook/Gmail.  
Where: **HTML CARD / per-chord** (Set variables) → **CHORDS HTML JOIN** (Text Aggregator).

### Inputs
- **83.baseFret** — integer. `1` = open position (nut row). `>1` shows a left badge “`{baseFret}fr`” and rows 3–7 display frets `baseFret … baseFret+4`.
- **83.voicingId** — string used as the chord card title (e.g., `D_open`, `B7_Eshape_7`).
- **97.e1..e6** — per-string play state (low→high): `"x"` muted, `0` open, otherwise blank.
- **97.f1..f6** — finger numbers for the black dots (1–4).
- **98.n1..n6** — normalized fret per string: `-1` for `"x"`, `0` for `open`, `1..5` for the relative row.

Note: `97.*` are canonical inputs; `98.*` are normalized “row index” values used by the dot logic.

### Derived/inline expressions (Make)
- Fret gutter numbers (left column):
  - Row 3: `{{ sum(parseNumber(83.baseFret); 0) }}`
  - Row 4: `{{ sum(parseNumber(83.baseFret); 1) }}`
  - Row 5: `{{ sum(parseNumber(83.baseFret); 2) }}`
  - Row 6: `{{ sum(parseNumber(83.baseFret); 3) }}`
  - Row 7: `{{ sum(parseNumber(83.baseFret); 4) }}`
- O/× markers (Row 2, ivory):  
  `{{ if(97.eK = "x"; "×"; if(97.eK = 0; "○"; "&nbsp;")) }}` where K ∈ {1..6}.
- Dot span HTML (per string, per row):  
  `{{ if(parseNumber(98.nK) = ROW; "<span style='display:inline-block;min-width:16px;height:16px;border-radius:999px;background:#000;color:#fff;line-height:16px;font-weight:700;font-size:10px;'>" + 97["f"&K] + "</span>"; "&nbsp;") }}`

### Outputs
- **card_html** — full HTML table for the single chord (scoped to **HTML CARD / per-chord**).
- **chords_html_joined** — concatenation of all `card_html` tables via **CHORDS HTML JOIN** for embedding in the email body.

### Rendering rules
- 13 columns: odd columns are fret gaps (thicker top/bottom borders on rows 3–7); even columns are strings (thin left/right borders only).
- Row 1: string names only.
- Row 2: ivory “nut/marker” row, thin top/bottom borders across all cells, shows O/× regardless of `baseFret`; shows `{baseFret}fr` badge in col 1 when `baseFret > 1`.
- Rows 3–7: playable rows with left gutter numbers and black numbered dots per `98.n*`.
