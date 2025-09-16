# Key Cycle & Transposition Policy

Process rule: Respond with one completeable chunk at a time. Do not jump ahead. Wait for me to say ‘next’.

## 1) Primary key cycle (fifths-based)
Use this order for normal rotation days:
`G → D → A → E → C → F → Bb → Eb → Ab → Db → Gb → G`  
- Enharmonics: prefer flats on the flat side (Bb, Eb, Ab, Db, Gb).  
- Start point is the most recent `lastKey`.

## 2) Reinforcement days (pinning)
If `needReinforce=true`, **pin**:
- **Focus + SubFocus + Key** to the last lesson’s values.  
- Prefer `lastKeyForFocus` (latest key used within that Focus). If blank, use `lastKey`.

Micro-variation allowed only (small tempo bump, 1 extra bar, tiny voice-leading cue).

## 3) KeyHints policy (open-friendly)
If `KeyHints` present (e.g., “open-friendly: C,G,D,A,E”):
- Prefer those keys when offering alternates or [IL] contrasts.
- If TargetKey is not open-friendly, provide a **capo suggestion** to achieve open shapes while **keeping the concert key**.

Examples:
- TargetKey = **E♭** → `capo 1` and play **D** shapes, or use compact triads.
- TargetKey = **F** → `capo 5` and play **C** shapes (if open vibe desired).

## 4) Spaced Review key rule
[SR] step uses the **original key** of the reviewed item.  
- If it equals today’s TargetKey, leave it.  
- Otherwise include a one-line note: “(Stay in original key for SR; rest of lesson in TargetKey).”

## 5) Transposition guidance
When transposing between adjacent fifths, give a quick anchor:
- 6th-string roots: +2 frets for up a whole tone (e.g., G→A), –2 for down (A→G).
- 5th-string roots: same rule; call out the new fret and shape.
- For triads, specify **string set + fret** (e.g., “triad 1–3 strings @ 7th → @ 9th”).

## 6) CAGED+key interaction
- Name shapes by **concert key + CAGED form**: e.g., “G major (E-shape) at 3rd fret”.
- For barre indication in ASCII: repeat the fret digit across affected strings (e.g., A-shape C major at 3rd fret → `x35553`).

## 7) Exceptions (teacher discretion)
- If a singer’s key is fixed, allow staying in that key for multiple cycles.
- For Tier ≥4, you may include **one** additional related key (by fifths) in a single step—do not add more than one new key in the same lesson.
