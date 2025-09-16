# Music Lessons — Platform

> Single-source-of-truth for my guitar lesson generator (prompts, schemas, Make blueprints).  
> **Process rule:** Respond with one completeable chunk at a time. Do not jump ahead. Wait for me to say ‘next’.

## What this is
- A spec-first repository to evolve the daily rhythm-guitar lesson engine.
- Keep prompts, schema, Make.com patterns, and data model versioned and searchable.

## Quick map
/spec
/prompt # system + user prompts (versioned)
/schema # JSON output schemas
/domain # catalog, key cycle, learning-science rules
/ops # Make playbook, data model, variables, blueprint, logs
/tests # fixtures for quick validation runs
/email # HTML template for delivery

## Core docs
- System prompt: `spec/prompt/lesson_system.md`
- User template: `spec/prompt/lesson_user_template.md`
- Output schema: `spec/schema/lesson_response.json`
- Subfocus catalog: `spec/domain/subfocus_catalog.md`
- Key cycle policy: `spec/domain/key_cycle.md`
- Learning science: `spec/domain/learning_science.md`
- Make playbook (Do/Don’t + fixes): `spec/ops/make_playbook.md`
- Variables map (Make ↔ Prompt): `spec/ops/variables_map.md`
- Data model (Sheets → DB): `spec/ops/data_model.md`
- Error log (bad function advice → fix): `spec/ops/error_log.md`
- Change log (high-level changes): `spec/ops/change_log.md`
- Decision log (why we chose things): `spec/ops/decision_log.md`

## Working rhythm
1. Edit specs here → mirror critical ones into the ChatGPT Project (Instructions, template).
2. Export Make scenario JSON → save to `spec/ops/make_blueprint.json`.
3. Log functional changes in `spec/ops/change_log.md`.
4. When Make disagrees with assumptions, add a one-liner to `spec/ops/error_log.md`.

## Prompt contract
The model must return **JSON only** matching `spec/schema/lesson_response.json`.  
No code fences, no extra prose.

## Tier/Score (adaptive difficulty)
- Delta: reinforce -2; conf 1–2 → -1; 3 → 0; 4 → +1; 5 → +2.
- Thresholds: Score ≥ +3 → Tier +1 (Score→0). Score ≤ -3 → Tier -1 (Score→0).
- Clamp Tier 1..5.

## Key cycle
`G → D → A → E → C → F → Bb → Eb → Ab → Db → Gb → G` (pin on reinforcement days).

## License
Private spec. You can open-source later; for now keep tokens/IDs out of commits.
