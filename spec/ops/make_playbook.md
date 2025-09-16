# Make.com Playbook — Guitar Lesson Generator

## Canonical patterns
- **Search rows → Text aggregator:** only ONE aggregator per source module. Duplicate the search if you need two formats.
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

## Module naming (house style)
CTX LAST → HIST L14 → CTX AGG → SF PICK → SF SELECT → FOCUS LAST SUB → SF FINAL → KEY FINAL → FINAL VARS → TIMESTAMPS+UID → FORM LINK → GPT LESSON → JSON PARSE → EMAIL SEND → LESSONS ADD → PROGRESS STAMP

## Validation checklist (before running)
- [ ] `needsReinforceOrLowConf` computed once from UID-matched feedback.
- [ ] `NextFocus` obeys suggestion → reinforcement pin → rotation.
- [ ] `NextSubFocus` uses `SubfocusProgress` or lastSubForFocus (on reinforcement).
- [ ] `NextKey` pinned on reinforcement; rotated otherwise.
- [ ] `historyAndFeedbackText` from last 14 Lessons rows.
- [ ] JSON parser succeeds (no BOM; correct schema).
- [ ] After email: Lessons row added; `SubfocusProgress.LastSeen` updated via ProgressRowId.

## FAQ
**Q:** How do I build a prefilled Google Form link?  
**A:** `formPrefill = [FORM_BASE]?usp=pp_url&[entry.2057838612]=encodeURL(LessonUID)`

**Q:** How do I make YouTube search when API quota is hit?  
**A:** `videoUrl = https://www.youtube.com/results?search_query=` `[encodeURL(YouTubeSearchQuery)]`

**Q:** How do I ensure two distinct history blocks?  
**A:** Duplicate the Search rows module; each feeds its own Text aggregator.
