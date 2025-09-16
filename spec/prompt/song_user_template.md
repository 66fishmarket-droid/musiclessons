# User Prompt — Song Picks (Ultimate Guitar) v1.0

Process rule: Respond with one completeable chunk at a time. Do not jump ahead. Wait for me to say ‘next’.

Goal: Return **three** song search targets that reinforce today’s lesson focus/subfocus **in the TargetKey when possible**. Output JSON only.

INPUTS
- Focus: {{finalNextFocus}}
- SubFocus: {{finalNextSubFocus}}
- TargetKey: {{finalKey}}
- Tier: {{finalTier}}
- Notes: "{{yesterdayNotes}}"

CONSTRAINTS
- Prefer songs originally in **TargetKey**. If not available, pick closely related keys (by fifths); mention their original key in the `note`.
- Bias toward rhythm-guitar friendly arrangements (clear comping, common progressions).
- Avoid duplicate artists across the three picks.

OUTPUT (JSON only)
{
  "songs": [
    { "title": "...", "artist": "...", "reason": "1–2 lines on why it matches today", "originalKey": "C", "query": "site:ultimate-guitar.com <title> <artist> chords", "note": "if not in TargetKey, say e.g., 'original in D; capo 2 to play C shapes'" },
    { "title": "...", "artist": "...", "reason": "...", "originalKey": "G", "query": "site:ultimate-guitar.com <title> <artist> chords", "note": "..." },
    { "title": "...", "artist": "...", "reason": "...", "originalKey": "A", "query": "site:ultimate-guitar.com <title> <artist> chords", "note": "..." }
  ]
}
