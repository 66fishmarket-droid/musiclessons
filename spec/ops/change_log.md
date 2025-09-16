# Change Log

Process rule: Respond with one completeable chunk at a time. Do not jump ahead. Wait for me to say ‘next’.

Use this file for high-level, human-readable entries whenever you change prompts, schema, Make flows, or data model.

## 2025-09-16 — v1.4
- System prompt: added Tier scaling section; clarified [SR]/[IL]/[MP]; barre notation in ChordAscii.
- User template: pinned JSON schema; added DIFFICULTY SCALING & booster rules; clarified displacement sequence wording.
- Make playbook: documented missing Make functions (`concat`, `isempty`, top-level `or`) and fixes; added selection logic summary.
- Data model: formalised Lessons / SubfocusProgress / Feedback columns and UID policy.
- Key cycle policy: pinned G→D→A→E→C→F→Bb→Eb→Ab→Db→Gb; reinforcement pin rules.
- Learning science: durations per Tier; success metrics per step.
- Ingestor: Score→Tier thresholds (±3) and deltas {reinforce:-2, 1–2:-1, 3:0, 4:+1, 5:+2}.

## Template for future entries
- Date — version tag (if applicable)
- What changed:
  - Prompts:
  - Schema:
  - Make:
  - Data model:
  - Other:
