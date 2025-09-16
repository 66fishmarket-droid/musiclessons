# User Prompt — Daily Lesson JSON (v1.4)

Process rule: Respond with one completeable chunk at a time. Do not jump ahead. Wait for me to say ‘next’.

CONTEXT (last ~14 days; newest first — includes brief feedback on each line)
{{historyAndFeedbackText}}

YESTERDAY’S FEEDBACK (UID-matched)
needReinforce={{needReinforceOrLowConf}}, confidence={{yesterdayConfidence}}, notes="{{yesterdayNotes}}", suggestedFocus="{{yesterdaySuggested}}"

TARGETS (for today)
NextDay = {{finalNextDay}}
NextFocus = {{finalNextFocus}}
NextSubFocus = {{finalNextSubFocus}}
TargetKey = {{finalKey}}
Tier = {{finalTier}}
KeyHints = "{{finalKeyHints}}"

BOOSTER RULES (always include)
- Step 1 must be **[SR] Spaced Review**: target the most recent item (≈14 days) where reinforce=true OR confidence ≤ 3. Use the item’s original key; if that equals today’s TargetKey, leave it; otherwise add a one-line note that SR stays in the original key.
- Include one **[IL] Interleave** step later: a short contrast from a different recent focus.
- Finish with **[MP] Mental Practice**: 60–90s visualisation (no playing).

DIFFICULTY SCALING (Tier 1–5)
- Scale specificity/challenge to **Tier** while keeping the whole session ≤ 30 min.
- If needReinforce=true: **keep the same Focus + SubFocus + Key** and apply **micro-variations only** (e.g., +6–10 bpm if clean, +1 bar, or one tiny voice-leading cue). Spend 80–90% on the exact prior idea.

CONSTRAINTS & FORMAT
- 5–7 steps total; concise, fully playable from text.
- Each step must specify **Count/Tempo**, **Pattern (D/U)**, **Bars**, **Repeat**, **Goal**, and concrete **positions/strings/frets** where relevant.
- For strumming/displacement, give the **exact shift sequence**: base groove → start on “& of 1” → “2” → “& of 2” …
- Prioritise rhythm-guitar usefulness (time feel, voice-leading, playable voicings).
- Respect **KeyHints** (e.g., suggest capo for open-friendly keys while keeping concert key).

CHORD SHAPES
- Include **2–5** shapes actually used in the Exercise as:
  - **ChordAscii**: one line per chord, low→high strings (E A D G B E), digits or “x”.  
    **Barres:** repeat the barred fret digit across strings (e.g., A-shape C major at 3rd fret → `x35553`).
  - **ChordCodes**: objects with `name`, `caged`, `fingering` (six chars, low→high), `position`, `usedInStep`.

YOUTUBE
- Return a single **YouTubeSearchQuery** string that’s likely to surface a good visual overview for today’s exact topic (include Focus/SubFocus/Key when helpful). **Query text only** — no URLs.

OUTPUT (JSON only; no code fences, no commentary)
{
  "Title": "...",
  "Concept": "...",
  "Exercise": ["...", "...", "..."],
  "WhyItMatters": "...",
  "JamPrompt": "...",
  "SubFocusExplainer": "...",
  "YouTubeSearchQuery": "...",
  "ChordAscii": "...",
  "ChordCodes": [
    { "name":"...", "caged":"...", "fingering":"......", "position":"...", "usedInStep": 2 }
  ]
}
