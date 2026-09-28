# Decision Log

Process rule: Respond with one completeable chunk at a time. Do not jump ahead. Wait for me to say ‘next’.

Document important decisions, alternatives considered, and rationale. Keep entries short and dated.

---

## 2025-09-16 — Selection algorithm source of truth
**Decision:** Drive SubFocus rotation from `SubfocusProgress` sorted by `LastSeen` Asc (blanks first), not from a hardcoded ladder.
**Why:** Deterministic selection, easy reinforcement, simple to visualise/edit.
**Alternatives:** Nested IF ladders; separate “blank vs oldest” routes.
**Trade-offs:** Requires seeding the table; but reduces Make complexity.

## 2025-09-16 — Reinforcement pin policy
**Decision:** When `needReinforceOrLowConf=true`, pin **Focus + SubFocus + Key** to the most recent within that focus.
**Why:** Keeps practice on the exact skill; avoids accidental drift.
**Alternatives:** Pin focus only; allow key rotation during reinforcement.
**Trade-offs:** Slight repetition; mitigated by micro-variations.

## 2025-09-16 — Score→Tier thresholds
**Decision:** Tier changes when `Score ≥ +3` (up) or `≤ -3` (down); deltas {reinforce:-2, conf1–2:-1, 3:0, 4:+1, 5:+2}.
**Why:** Two strong days can bump (5+5), three “good” days also bump (4+4+4); quick recovery from weak days.
**Alternatives:** ≥4/≤-4 thresholds; weighted deltas.
**Trade-offs:** Slightly responsive; can tighten later if needed.

## 2025-09-16 — YouTube quota avoidance
**Decision:** Link to search results URL (`/results?search_query=` + encode) instead of API lookups.
**Why:** Avoid quota errors and module failures; still gets the learner to a video quickly.
**Alternatives:** Paid SERP APIs; caching picks.
**Trade-offs:** Less curated; acceptable given email guidance.

## 2025-09-16 — JSON-only lesson output
**Decision:** Force JSON only (no code fences) and pin schema.
**Why:** Reliable parsing in Make; prevents formatting drift.
**Alternatives:** Free-form text + regex.
**Trade-offs:** Harder to eyeball in raw chat; mitigated by email render.

## 2025-09-16 — Multi-tenant future (Supabase)
**Decision:** Plan a DB-backed, per-user schema (users, lessons, feedback, user_subfocus_progress).
**Why:** Scale without cloning Sheets/Make scenarios.
**Alternatives:** Airtable; multiple Sheets per user.
**Trade-offs:** Adds setup; better long-term cost & security.

## Template for future entries
- Date — Topic
- Decision:
- Why:
- Alternatives:
- Trade-offs:
