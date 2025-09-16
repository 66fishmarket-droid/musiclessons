# Error Log (Make.com)

Process rule: Respond with one completeable chunk at a time. Do not jump ahead. Wait for me to say ‘next’.

Use this file to capture every time a function/feature I assumed existed in Make did not, plus the fix you applied.

## Template
- Date:
- Area/Module:
- Bad advice / wrong function:
- Correct Make approach:
- Example expression or mapping:
- Screenshot: (path or link)
- Fix status: (fixed / needs follow-up)

## Entries
- Date: 2025-09-16
  Area/Module: Sheets filter for blanks
  Bad advice: `isempty` operator
  Correct approach: Sort **Ascending** on the column; blanks float first; set **Max rows = 1**.
  Example: Order by `LastSeen` Asc, Max 1
  Fix status: fixed

- Date: 2025-09-16
  Area/Module: Building URLs
  Bad advice: `concat()`
  Correct approach: adjacency + `encodeURL()`
  Example: `https://www.youtube.com/results?search_query=` `[encodeURL(lessonJSON.YouTubeSearchQuery)]`
  Fix status: fixed

- Date: 2025-09-16
  Area/Module: Boolean OR
  Bad advice: top-level `or(a;b)`
  Correct approach: nested `if`
  Example: `if(needReinforce=true; true; if(confidence<=3; true; false))`
  Fix status: fixed

- Date: 2025-09-16
  Area/Module: JSON parsing
  Bad advice: (implicit) accept BOM
  Correct approach: strip BOM before parse
  Example: `replace(jsonBlob; char(65279); "")`
  Fix status: fixed

- Date: 2025-09-16
  Area/Module: Aggregating two formats from one search
  Bad advice: reuse one Text Aggregator twice
  Correct approach: duplicate the **Search rows** module; each feeds its own Text Aggregator
  Fix status: fixed
