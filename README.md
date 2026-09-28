# Guitar Coach

Daily guitar practice web app (successor to the Make.com email lessons in `legacy/make/`).

- Spec: `docs/superpowers/specs/2026-09-28-guitar-coach-design.md`
- Plans: `docs/superpowers/plans/`
- Engine (pure TS, shared with edge functions): `supabase/functions/_shared/engine/`

## Setup
```bash
npm install
git config core.hooksPath .githooks   # background Obsidian code-graph sync after each commit
supabase start                        # needs Docker Desktop running
npm test && npm run test:db
```
