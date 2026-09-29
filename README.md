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

## LLM setup (Phase 2)
`supabase/functions/.env` (gitignored, never commit it):
```
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=sk-or-...
LLM_MODEL=<default model id>
LLM_FALLBACK_MODEL=<fallback model id>
```
Run locally: `supabase functions serve`, then `TOKEN=$(npm run -s dev:session -- --email you@example.com)` and
`curl -X POST http://127.0.0.1:55321/functions/v1/generate-lesson -H "Authorization: Bearer $TOKEN" -d '{"date":"YYYY-MM-DD"}'`.
Compare models: `npm run compare:models -- --models a,b` (paid, a few cents).

## App (Phase 3)
```bash
supabase start && supabase functions serve   # functions serve reads supabase/functions/.env
npm run dev                                  # http://127.0.0.1:5173 (needs VITE_* in .env.local, see .env.example)
```
Sign-in emails locally land in Inbucket: http://127.0.0.1:55324
