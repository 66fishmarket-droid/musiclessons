# Fixture — Tier 4 normal day (not reinforcing)

## Inputs (map into User prompt placeholders)
historyAndFeedbackText:
- 2025-09-15 • Focus: Extensions • Sub: Seventh chords (maj7/min7/dom7) • Key: D • [SR][IL][MP] • conf=4
- 2025-09-14 • Focus: Groove • Sub: 16ths with muting • Key: G • [SR][MP] • conf=4
- 2025-09-13 • Focus: Theory • Sub: Voice Leading • Key: C • [SR][IL][MP] • conf=5

needReinforceOrLowConf: false
yesterdayConfidence: 4
yesterdayNotes: ""
yesterdaySuggested: ""

finalNextDay: 23
finalNextFocus: Extensions
finalNextSubFocus: 6ths & 9ths (shell voicings)
finalKey: A
finalTier: 4
finalKeyHints: ""

## Expected characteristics (manual check)
- 5–7 steps total:
  - Step 1 is **[SR]** (pulls a recent weak/conf≤3 item if present; if none, a brief review of prior Extensions content is acceptable).
  - At least one step adds **exactly one** new layer suitable for Tier 4 (e.g., introduce 9ths to shell voicings OR a light rhythmic push like 16ths with muted upstrokes) — but **not both**.
  - One short **[IL]** contrast from a different focus (e.g., Groove micro-drill).
  - Final step is **[MP]**.
- **Tempo:** 80–96 bpm guidance appears where appropriate.
- **Keys:** may include up to **one** additional related key by fifths (e.g., A→E) in a single step; otherwise remain in TargetKey.
- **Voicings:** triads + 7ths/9ths shell voicings across 2–3 positions; explicit nearest-note moves.
- **Instructions:** Every step includes Count/Tempo, Pattern (D/U), Bars, Repeat, Goal, and concrete string/fret positions.
- **Chord shapes:** 2–5 shapes; ChordAscii includes any barres correctly (e.g., `x57755` for Amaj, E-shape at 5th).
- **YouTubeSearchQuery:** mentions “shell voicings 6ths 9ths A major rhythm guitar” (or close).
