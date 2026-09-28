### Chord card HTML
- Per-chord HTML example lives in Make: module “HTML CARD / per-chord”.  
- Aggregation is done in “CHORDS HTML JOIN” → variable **chords_html_joined** for the email body.
- Per-chord HTML snippet (copy/paste ready): `spec/ops/snippets/chord_card_table.html`
- Generated in Make: module “HTML CARD / per-chord”; aggregated via “CHORDS HTML JOIN” → `chords_html_joined`

### Feedback Ingestor (Make.com scenario)
- Blueprint file: `/spec/ops/blueprints/Guitar - Feedback Ingestor.blueprint.json`
- Live scenario name in Make: **GUITAR — FEEDBACK INGESTOR**
- Canonical module sequence: `LESSON SEARCH → CONTEXT SET → FEEDBACK SEARCH → FEEDBACK CHECK → FEEDBACK PARSE → STATUS SET → ROUTER MAIN → LESSON UPDATE → PROGRESS SEARCH → PROGRESS VARS SET → SCORE CALC → TIER DELTA → NEW TIER RAW → FINAL VARS SET → PROGRESS UPDATE → FEEDBACK MARK PROCESSED → EXIT NO-OP`
- Mirrors documentation in:
  - `spec/ops/make_playbook.md` (Feedback Ingestor section)
  - `spec/ops/variables_map.md` (Feedback Ingestor variables)
  - `spec/ops/change_log.md` (v1.5 entry)
- Purpose: Ingests user feedback, updates lesson Status to “Completed”, adjusts SubFocusProgress Tier and Score, and marks feedback rows as processed.
- Branching: router “HAS FEEDBACK COMPLETED” continues main flow; “NO FEEDBACK SKIPPED” exits silently.
- Naming convention: ALL-CAPS modules consistent with Guitar Lesson Generator main flow.
