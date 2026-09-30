# Session Handoff — 2026-09-30b

**The app is live at https://guitar-coach-66.netlify.app.** Matt signed in on his Android phone, a lesson was generated, and the app reopens straight to the lesson without asking him to sign in again. Earlier in the day, `SESSION_HANDOFF_2026-09-30.md` covered the phone-test fixes: the scale fretboard, the picking pattern following the chords, the note caller, and prompt rules 17–18.

## What we did this session
- **Updates wait for the user:** the PWA now uses `registerType: 'prompt'` (`vite.config.ts`, `injectRegister: false`). `src/components/UpdateBanner.tsx` shows "A new version is ready · Later / Reload"; it uses `useRegisterSW` from `virtual:pwa-register/react`, which needs `vite-plugin-pwa/react` in the tsconfig `types`. A reload resumes the same block, because the session is saved in localStorage.
- **Hosted Supabase:** project `musiclessons`, ref `uoytcppwovhteqklezmq`, London (eu-west-2), org `iuahllhfzxzxxzveykak`.
  - `4n4l-engine` is **paused** to stay within the free tier.
  - `supabase db push --include-seed` loaded the schema and the 74 skills.
  - Migration `20260930000001_revoke_anon_execute.sql` means signed-out callers (anon) can't run any `public` function; only signed-in users can. It is applied both locally and hosted.
  - Every table has row-level security, and each user can reach only their own rows; `skills` is read-only. Supabase's security advisor reports nothing.
  - The DB password is `SUPABASE_DB_PASSWORD` in `.env.local`. The service-role key is in `.env.hosted`. Both files are gitignored.
- **Edge function:** `generate-lesson` is deployed with `--no-verify-jwt`. Its secrets came from `supabase/functions/.env` (the LLM_* keys). A call without a sign-in returns 401.
- **Auth, set up by hand in the dashboard:**
  - user `66fishmarket@gmail.com` was added, then sign-ups were turned off;
  - Gmail sends the emails (smtp.gmail.com:465, using an App Password). Supabase only lets you edit email templates once you use your own mail server; the magic-link template now includes `{{ .Token }}`;
  - Site URL and Redirect URL are both `https://guitar-coach-66.netlify.app`.
- **Legacy import:** `scripts/import-legacy.ts` read `data/legacy/*.csv` (the Make-era Sheets export, ending 2026-02-23) and imported 115 lessons, 26 progress rows and 8 reviews into the hosted DB. None of the local test lessons went in.
- **Netlify:** site `guitar-coach-66` (id `a7d43302-350e-4e4c-8edc-d71264ab3026`).
  - `netlify.toml`: `npm run build` → `dist`, Node 24.
  - Env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
  - Matt linked the GitHub repo, so **a merge to `main` redeploys automatically** (about 40 s).
- **Sign-in fix (PR #6):** hosted Supabase sends **8-digit** codes. `SignIn.tsx` now accepts `[0-9 ]{6,12}` and strips spaces before verifying.
- PRs #4, #5 and #6 are merged; `main` is at `ace2866`. There are 233 unit tests and 15 DB tests, and the typecheck and build are clean.

## What's next
1. **(2 min)** On the phone, play one block and check that the screen stays awake and recording works. These are the checks that need HTTPS; the local test couldn't cover them.
2. **(5 min)** Move the Gmail App Password out of `supabase/functions/.env` into its own file, e.g. `.env.smtp`, so a future `supabase secrets set --env-file` can't upload it.
3. **Tidy the local test data** if it gets confusing: the `phase3@test.dev` lesson for 2026-09-29 has a hand-edited `plan.skill_id`.
4. **Phase 4:** the `ask` edge function (the Ask button per block, which answers "what does four-bar melody mean?"), Theory Explorer, Progress, Asked, and `vault-sync-asked`.
5. Optional text polish: "semitones" wasn't explained, and "before the next beat" should say once per bar.

## Design decisions already made
- The PWA updates only when the user agrees (`'prompt'`); it never reloads by itself mid-practice.
- Production deploys come from `main` only, through the Netlify GitHub integration. `dev` has no deploy previews.
- Sign-ins don't expire (free-plan default). The app signs out only when the server rejects the sign-in (`App.tsx`, `ApiError` 401).
- Email goes through Matt's Gmail over SMTP, not Supabase's built-in mail and not Resend.
- The anon role gets no function execute. **Any new `public` function must be granted to `authenticated` only**; the migration's default-privileges line handles new functions.
- Only `data/legacy/*.csv` is imported. App-era lessons never are.

## Known issues / gotchas
- **Hosted email codes are 8 digits and local codes are 6.** The input accepts both. Don't narrow `pattern` back to 6.
- **Never deploy by uploading the working folder.** The Netlify MCP `deploy-site` command uploads the whole directory, including the untracked `.env.local`, `.env.hosted` and `supabase/functions/.env`. Manual deploys must come from a clean `git clone` of `main`. Normally, just merge to `main`.
- **Netlify MCP `manage-env-vars` claimed success the first time without saving anything.** Always read the vars back with `getAllEnvVars`, and check that the built JS contains `uoytcppwovhteqklezmq.supabase.co`.
- **`supabase functions/.env` now holds the Gmail App Password as well as the LLM keys.** Never `cat` it (see What's next 2).
- The Supabase CLI is v2.75 and v2.118 is available. It works; update when convenient (`scoop update supabase`).
- The built-in email sender's rate limit no longer applies, because Gmail sends. Gmail allows about 500 emails a day, which is plenty.
