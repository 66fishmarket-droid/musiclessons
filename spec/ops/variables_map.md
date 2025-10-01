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

