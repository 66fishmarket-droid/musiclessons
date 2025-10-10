# Make.com Playbook — Guitar Lesson Generator

## Canonical patterns
- **Search rows → Text aggregator:** only ONE aggregator per source module. Duplicate the search if you need two formats.

- For all expression syntax, supported operators, and function names, see [`make_functions_reference.md`](make_functions_reference.md).
- **Pick oldest/blank:** Sort Asc by the column (e.g., LastSeen); blanks come first; then set Max rows = 1.
- **Reinforcement pin:** Compute `needsReinforceOrLowConf` ONCE from UID-matched feedback; reuse that token everywhere.
- **Cross-module variables:** You cannot reference a variable created in the **same** Set-vars module. Chain small Set-vars modules.
- **Dates:** Store/compare as `YYYY-MM-DD`. Avoid locale formats.
- **Final tokens:** After logic, publish `finalNextDay`, `finalNextFocus`, `finalNextSubFocus`, `finalKey`, `finalTier`, `finalKeyHints`; map only these downstream.

## Functions & operators that **don’t exist** (and what to do instead)
- `concat()` → **Just place text + tokens next to each other.**  
  Example: `https://www.youtube.com/results?search_query=` `[encodeURL(query)]`
- `or(a;b)` at top level → **Nest with `if`**: `if(a; true; if(b; true; false))`
- `isempty()` in Sheets filters → **Sort Asc** on the column; blanks float first.
- `lessOrEqual()` → use `<=` inside `if(...)`
- `empty()` → use `ifempty(value; default)` or `length(trim(value)) = 0`
- Multiple aggregators from one source → **Duplicate the Search rows** module.

## Common fixes we used
- **BOM in JSON** → `replace(json; char(65279); "")` before parsing.
- **Quotes lost when pasting** → retype straight double quotes `"` in the expression editor.
- **Router not merging** → prefer a single Set-vars with nested `if(...)` rather than 3 routes.
- **Boolean math** → build booleans with `if(...)` returning `true/false`, then reuse the token later.

## Selection logic (summary)
- **NextFocus**: prefer `suggestedFocus` → else if `needsReinforceOrLowConf` then `lastFocus` → else rotate (CAGED→Theory→Extensions→Groove→Progressions→Ear→Creative→CAGED).
- **NextSubFocus**:
  - Reinforce: use **lastSubForFocus** (latest subfocus within this focus) else fallback to table pick.
  - Normal: pick from `SubfocusProgress` with `Focus = NextFocus`, `Order: LastSeen Asc`, `Max 1`.
- **NextKey**:
  - Reinforce: pin to `lastKeyForFocus` (or `lastKey` if blank).
  - Normal: follow the key cycle `G→D→A→E→C→F→Bb→Eb→Ab→Db→Gb→G`.

## Tier & Score rules
- **Delta per feedback:** reinforce: –2; confidence: 1–2 → –1; 3 → 0; 4 → +1; 5 → +2.
- **Thresholds:** Score ≥ +3 → Tier +1 (then Score = 0). Score ≤ –3 → Tier –1 (then Score = 0).
- **Clamp:** Tier between 1 and 5.

## Module Naming (final)

Each line: **Canonical Name** — purpose — key outputs (vars).

1. **CTX LAST** — Pull last lesson context — LastLesson, LastKey, LastSubfocus, LastTier
2. **CTX AGG / Last Vars** — Normalize last* fields — Last* vars
3. **CTX AGG / Pull Feedback** — Read latest feedback row — feedback raw
4. **CTX AGG / Feedback Vars** — Map to fb* + flags — fbcompleted, fbneedreinforce, fbconfidence, fbnotes, fbsuggestedfocus, lastfeedbacklessonUID
5. **CTX AGG / Apply Feedback** — Apply overrides (repeat/reinforce) — AppliedState
6. **CTX AGG / Repeat Hold** — Freeze SF/Key if repeating — RepeatHold
7. **CTX AGG / Normalize** — Fill defaults and clean — NormState
8. **FOCUS ROTATE / Compute** — Compute next high-level focus — Focus.Next
9. **FOCUS ROTATE / Apply** — Persist next focus — NextFocus
10. **SF PICK / Catalog Fetch** — Read SubFocus catalog for NextFocus — SFCatalog
11. **FOCUS LAST SUB / Load** — Load last-subfocus metadata — LastSubForFocus, etc.
12. **FOCUS LAST SUB / Name** — Resolve display name — SF.LastName
13. **SF FINAL / Sanitize Names** — norm/trim names — normNextFocus, lastSub
14. **SF PICK / Candidate** — Candidate subfocus via rotation — SF.Candidate
15. **SF FINAL / Select** — Accept/lock candidate — SF.FinalId, SF.FinalName
16. **KEY FINAL** — Compute next key (cycle rules) — FinalKey, KeyReason
17. **HIST L14 / Fetch** — Pull rows for last 14 days — HistoryRows
18. **HIST L14 / Aggregate** — Aggregate seen counts — FocusSeenCounts, KeySeenCounts
19. **HIST L14 / History+FB Text** — Safe concat — historyAndFeedbackText
20. **FINAL VARS / NextDay** — Day index helper — FinalNextDay
21. **SF PICK / Progress Scan** — From SubFocusProgress (A=NextFocus), sort LastSeen asc — SF.Candidate{Id,Name,Level}
22. **SF SELECT / Tier→Level** — Tier via weighted fb* → Level — Tier, Level.Final
23. **SF SELECT / Fallback (unused)** — Set DefaultSub (not used)
24. **SF FINAL / Lock** — Lock final subfocus — SF.Final
25. **SF FINAL / Display Names** — Compose names — FocusName, SFDisplay
26. **GPT LESSON (JSON-only)** — GPT returns lesson JSON only — Lesson.RawJSON
27. **JSON PARSE / Clean** — Scrub/validate JSON block — Lesson.JSON.Clean
28. **JSON PARSE / Shape→schema** — Conform to spec/schema/lesson_response.json — Lesson.JSON
29. **CHORDS ITER** — Iterate `ChordCodes[]` — name, caged, fingering, position, usedInStep, status
30. **CHORDS ROUTER** — Side path for `status="NOT_FOUND"` — split for logging; main path continues
31. **NOTFOUND_AGG** — De-dupe missing chords — NotFound unique names
32. **NOTFOUND_LIST_TXT** — Comma-separated list — NotFoundList
33. **NOTFOUND_VARS** — Count + email note — NotFoundCount, NotFoundNote
34. **MISSINGCHORDS ADD** — Append grouped missing chords row — MissingChordsRowId
35. **MEDIA YT URL** — Build YouTube search URL — YouTubeSearchURL
36. **MEDIA YT SEARCH (query-only)** — Maintain/query text only — YouTubeTopN? (optional)
37. **LESSON LINES** — Split exercise into lines — ExerciseLines[]
38. **UG SEARCH URL / Build** — Build UG search helpers — UGBase, UGSong, UGArtist, UGSongArtist
39. **UG PARSE** — Parse any UG JSON (if present) — UG.Results[]
40. **UG NBEST / Vars** — Choose/present N best or tidy — UG.Top[]
41. **UG URL / Build** — Final UG link(s) — UG.URL
42. **TIMESTAMPS+UID / Dates** — Date formats — DatePretty, DateISO
43. **TIMESTAMPS+UID / UID** — Deterministic ID — LessonUID
44. **FORM LINK / Base** — Base form URL + entry ids — FormBase, EntryUID
45. **FORM LINK / Prefill** — Append UID param — FormURL.Prefill
46. **EMAIL SEND** — Send lesson email — EmailStatus
47. **FINAL VARS / Email Summary** — Summaries + blank sheet cols — EmailSummary, SheetBlankCols
48. **FINAL VARS / Runtime Meta** — Runtime/meta flags — Has_SR, Has_IL, Has_MP, YTQuery, YTLinkType, Model, PromptVersion, GeneratedAt
49. **LESSONS ADD** — Append lesson row — LessonsRowId
50. **PROGRESS STAMP** — Update SubFocusProgress.LastSeen (YYYY-MM-DD) — ProgressRowId


## Validation checklist (before running)
- [ ] `needsReinforceOrLowConf` computed once from UID-matched feedback.
- [ ] `NextFocus` obeys suggestion → reinforcement pin → rotation.
- [ ] `NextSubFocus` uses `SubfocusProgress` or lastSubForFocus (on reinforcement).
- [ ] `NextKey` pinned on reinforcement; rotated otherwise.
- [ ] `historyAndFeedbackText` from last 14 Lessons rows.
- [ ] JSON parser succeeds (no BOM; correct schema).
- [ ] `ChordCodes[].status` is present; side path filter uses `status="NOT_FOUND"`; `NotFoundList` populated; `NotFoundNote` empty when `NotFoundCount = 0`.
- [ ] After email: Lessons row added; `SubfocusProgress.LastSeen` updated via ProgressRowId.


### CHORD REPO FETCH (HTTP → Get)
Purpose: Retrieve `spec/domain/chord_repo.json` as text for use in the system prompt.
Placement in flow: after FORM LINK, before GPT LESSON.
Module settings:
- Method: GET
- URL: `{{CHORD_REPO_SOURCE_URL}}`
- Headers (only if the repo is private):
 Authorization: token {{GITHUB_PAT_READ}}
  Accept: application/vnd.github.v3.raw
Outputs:
- Response body → **CHORD_REPO_JSON**

+## Chord Diagram Rendering (email-safe tables)
+
+**Modules (after `FINAL VARS`, before `EMAIL SEND`):**
+1) **HTML CARD / per-chord** *(Set multiple variables)*  
+   - **Inputs:** `83.baseFret`, `83.voicingId`, `97.e1..e6`, `97.f1..f6`, `98.n1..n6`.  
+   - **Sets:** `card_html` = the full table HTML (see `variables_map.md` for expressions).  
+   - **Notes:** Use `sum(parseNumber(83.baseFret); k)` for left gutter numbers (k ∈ 0..4).  
+     Do **not** use `+` for math; in Make this risks string concatenation.
+2) **CHORDS HTML JOIN** *(Text Aggregator)*  
+   - **Source:** the set of `card_html` values (one per chord).  
+   - **Output:** `chords_html_joined` (no separator or use `<br>` if desired).  
+   - **In email template:** inject `{{chords_html_joined}}` where the chord shapes belong.
+
+**Design rules:**  
+- 13 columns (6 strings at even indices, 7 gaps at odd indices).  
+- Row 1: labels only. Row 2: ivory, thin full-row borders, shows O/× from `97.e*` and `{baseFret}fr` badge when `>1`.  
+- Rows 3–7: fret gaps get `2px` top/bottom borders; string columns have only thin left/right borders; dots show using `98.n*` = 1..5.


## FAQ
**Q:** How do I build a prefilled Google Form link?  
**A:** `formPrefill = [FORM_BASE]?usp=pp_url&[entry.2057838612]=encodeURL(LessonUID)`

**Q:** How do I make YouTube search when API quota is hit?  
**A:** `videoUrl = https://www.youtube.com/results?search_query=` `[encodeURL(YouTubeSearchQuery)]`

**Q:** How do I ensure two distinct history blocks?  
**A:** Duplicate the Search rows module; each feeds its own Text aggregator.



### CTX AGG (append chord repo)
- Append this literal block at the **end of the system message** you already assemble:
