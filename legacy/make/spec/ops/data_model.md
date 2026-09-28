# Data Model (Sheets-first → DB-ready)

Process rule: Respond with one completeable chunk at a time. Do not jump ahead. Wait for me to say ‘next’.

This doc defines the current Google Sheets layout and the future DB equivalents. Primary keys, indexes, and how rows relate are spelled out so we can migrate later without guessing.

---

## 1) Lessons (Sheet: `Lessons`)
**Purpose:** immutable log of generated lessons + inline feedback snapshot.

| Column                    | Type        | Notes |
|--------------------------|-------------|------|
| Date                     | `YYYY-MM-DD` text | display date; also stored as ISO in GeneratedAt |
| DayNumber                | int         | 1..∞; used for ordering |
| FocusArea                | text        | e.g., CAGED, Theory, Extensions… |
| SubFocus                 | text        | from SubfocusProgress pick or reinforcement pin |
| Key                      | text        | concert key (e.g., C, G, Bb, F# → prefer flats on flat side) |
| Title                    | text        | from model |
| Concept                  | text        | from model |
| Exercise                 | long text   | model JSON array joined by newlines (for email preview/log) |
| WhyItMatters             | long text   | from model |
| JamPrompt                | text        | from model |
| ChordAscii               | monospace text | ASCII shapes (2–5) |
| ChordCodes               | JSON text   | array of code objects (name, caged, fingering, position, usedInStep) |
| YouTubeQuery             | text        | `lessonJSON.YouTubeSearchQuery` |
| VideoLink                | text (URL)  | YouTube search URL fallback |
| Has_SR                   | bool/text   | true/false (or Yes/No) — detected from Exercise |
| Has_IL                   | bool/text   | true/false |
| Has_MP                   | bool/text   | true/false |
| Status                   | enum text   | Delivered / Completed / Skipped |
| GeneratedAt              | ISO datetime | `YYYY-MM-DDTHH:mm:ssZ` |
| LessonUID                | text        | `Date`-`DayNumber`-`FocusArea`-`Key` (no spaces) |
| Feedback_NeedReinforce   | bool/text   | from ingestor |
| Feedback_Confidence      | int         | 1..5 |
| Feedback_Notes           | long text   | freeform |
| Feedback_SuggestedFocus  | text        | optional |
| Feedback_LessonUID       | text        | (optional mirror) |
| Feedback_ProcessedAt     | ISO datetime | (optional; if you keep it here) |

**Indexes (manual habits):**
- Sort views by `GeneratedAt` Desc or `DayNumber` Desc.
- Ensure `LessonUID` unique per Date+DayNumber.

**Generator reads:** last row for context, history list (last 14).  
**Ingestor writes:** feedback fields, maybe Status → Completed.

---

## 2) SubfocusProgress (Sheet: `SubfocusProgress`)
**Purpose:** per-Focus/SubFocus progress state and hints (drives rotation & difficulty).

| Column    | Type         | Notes |
|-----------|--------------|------|
| Focus     | text         | must match `Lessons.FocusArea` values |
| SubFocus  | text         | canonical names from catalog |
| Tier      | int (1..5)   | difficulty tier |
| Score     | int          | accumulator for tier bumps/drops |
| LastSeen  | ISO datetime | stamped when a lesson for this subfocus is delivered |
| KeyHints  | text         | e.g., "open-friendly: C,G,D,A,E" |

**Selection rule (generator):**
- Search where `Focus = NextFocus`, order by `LastSeen` **Ascending**, **Max 1**.  
  (Blanks surface first; otherwise pick the oldest.)

**Reinforcement pin:**
- If reinforcing, use the most recent SubFocus **within this Focus** (from Lessons) for `NextSubFocus`; keep key pinned.

**Ingestor rule (Tier/Score):**
- Delta per feedback: reinforce = –2; conf 1–2 = –1; 3 = 0; 4 = +1; 5 = +2.
- Thresholds: Score ≥ +3 → Tier +1 (Score → 0); Score ≤ –3 → Tier –1 (Score → 0).
- Clamp: Tier 1..5.

---

## 3) Feedback (Sheet: `Feedback`) — if you keep a separate tab
**Purpose:** raw form responses; matched to lessons by `LessonUID`.

| Column                                | Type        | Notes |
|---------------------------------------|-------------|------|
| Timestamp                             | datetime    | from Google Forms |
| LessonUID                             | text        | prefilled in email link |
| Did you complete today’s lesson?      | Yes/No      | becomes `fbCompleted` |
| Do you want more time tomorrow?       | Yes/No      | becomes `fbNeedReinforce` |
| How confident do you feel now? (1–5)  | int         | becomes `fbConfidence` |
| Any notes or specifics to work on?    | long text   | `fbNotes` |
| Suggest tomorrow’s focus (optional)   | text        | `fbSuggested` |
| Processed                             | Yes/No      | set by ingestor |
| ProcessedAt                           | ISO datetime| set by ingestor |

**Ingestor:**
- Find by `LessonUID` (and `Processed != Yes`), newest first, max 1.
- Update matching `Lessons` row’s feedback fields.
- Update `SubfocusProgress` Tier/Score.
- Mark Feedback row: `Processed = Yes`, `ProcessedAt = now`.

---

## 4) Keys & IDs (conventions)
- **Keys:** use `C, G, D, A, E, F, Bb, Eb, Ab, Db, Gb` (prefer flats on flat side).
- **LessonUID:** `YYYY-MM-DD-<DayNumber>-<Focus>-<Key>` (no spaces); unique per lesson.
- **Date formats:** human-readable `Date` as `YYYY-MM-DD`; machine `GeneratedAt` as ISO UTC.

---

## 5) Migration notes (DB-ready)
When moving to Supabase/Postgres:
- `Lessons` → `public.lessons` (add `user_id uuid` FK, indexes on `(user_id, day_number desc)`).
- `SubfocusProgress` → `public.user_subfocus_progress` (`user_id`, unique `(user_id, focus, subfocus)`).
- `Feedback` → `public.feedback` (`user_id`, index `(user_id, lesson_uid)`).
- Enable **RLS** per table so each user only sees their own rows.
- Keep the same Tier/Score logic in the ingestor (serverless function or Make HTTP calls).

---

## 6) Data flow (high level)
1. **Generator**: reads latest Lessons → builds `historyAndFeedbackText` → picks subfocus via `SubfocusProgress` → computes Final* tokens → calls GPT → emails → logs new Lessons row → stamps `SubfocusProgress.LastSeen`.
2. **Ingestor**: finds latest Delivered lesson → matches Feedback by `LessonUID` → updates Lessons feedback fields → applies Tier/Score rule to `SubfocusProgress` → marks Feedback processed.

