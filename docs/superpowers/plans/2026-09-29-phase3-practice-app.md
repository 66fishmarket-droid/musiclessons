# Phase 3 — Practice App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mobile-first React PWA in the approved "Diwali hybrid" design. The user signs in and opens the app, gets today's lesson from `generate-lesson`, and works through it block by block with a metronome, drone, chord diagrams, recorder and pass/fail logging. Finishing calls `complete_lesson()`, and a failed call is kept on the phone until it succeeds. The app then deploys to Netlify against a hosted Supabase project.

**Architecture:**
- **App:** a Vite + React app lives in `src/` at the repo root, with plain CSS and no router (the app's own state picks the screen).
- **Logic:**
  - Anything that can be tested without a browser is a pure module in `src/lib/` or `src/audio/`, tested with Vitest in `tests/app/`.
  - React components in `src/components/` and screens in `src/screens/` stay thin.
- **Shared engine and lesson code:** imported by relative path from `supabase/functions/_shared/` (types, `chordVoicings`, `noteAt`). There is one copy of the music logic.
- **Paint bursts:** static SVGs generated once by a deterministic script.

**Tech Stack:**
- **Existing:** Node 24, TypeScript 5.9, Vitest 3.2, `tonal`, `@tombatossals/chords-db`, `@supabase/supabase-js` 2.117.
- **New:**
  - `react` / `react-dom` 19.3;
  - `vite` ^7.3 (**not 8**: Vitest 3.2 pins Vite 7, and `vite@7.3.6` is already installed);
  - `@vitejs/plugin-react` ^5.2;
  - `vite-plugin-pwa` ^1.3.
- **Browser APIs:** Web Audio, MediaRecorder, Screen Wake Lock, `<dialog>`.

**Specs:**
- `docs/superpowers/specs/2026-09-29-today-ui-design.md` (the UI; **read it first**)
- `docs/superpowers/specs/2026-09-28-guitar-coach-design.md` §8 (screens), §11 (error handling), §12 (Phase 3)

**Verified before writing (2026-09-29):**
- **`chordVoicings`:**
  - `chordVoicings('H7')` **throws** `Unknown chord`.
  - `chordVoicings('Cadd9', 6)` returns 4 shapes.
  - Frets are absolute: Bb barre = `[6,8,8,7,6,6]`.
- **`chords-db`:** `guitar.json` is 236 KB, so a static import in the client is fine.
- **Package peers:**
  - `vite-plugin-pwa@1.3.0` accepts vite ^3–^8.
  - `@vitejs/plugin-react@5.2.0` accepts vite ^4–^8.
  - `@vitejs/plugin-react@6` needs vite 8, so it is not used.
- **Today's real lesson** (2026-09-28, local DB) has blocks `warmup, new_skill, reset, apply, create, record`, and the new-skill target is `{metric:'bpm', start:39, target:60}`.
- **Existing helpers:**
  - `complete_lesson(p_lesson_id, p_logs, p_confidence, p_want_more_time, p_notes)` is idempotent: a second call on a completed lesson is a no-op.
  - Scripts use `isMain(import.meta.url)` from `scripts/vault/lib.ts`.

**Spec deviations (deliberate, agreed in the UI spec §6):**
- No Ask button, which comes in Phase 4.
- No 10-minute short day.
- Week dots show the days practised this week against 7 days; there is no weekly target setting.

**Deliberately not done:** revoking execute on `_score_skill` / `_schedule_review` (Phase 1 deferred minor).
- `complete_lesson` is `security invoker`, so the signed-in user **needs** execute on them.
- RLS already limits their writes to the caller's own rows.
- For a single-user app, the only remaining risk is the user gaming their own scores.

## Global Constraints

- **Branch:** work on `dev` and commit after every task. **Never push, merge to `main` or deploy without asking the user.** Task 15 has explicit ask-gates.
- **Imports and syntax:**
  - Relative imports use explicit extensions (`.ts`, `.tsx`). JSON imports use `with { type: 'json' }`.
  - No `enum`, `namespace` or parameter properties (`erasableSyntaxOnly`).
- **Every exported function** has a one-line JSDoc summary; the vault code graph reads it.
- **Pure modules stay pure.** `src/lib/*.ts` and `src/audio/metronome.ts` take storage, `fetch` and the DB client as parameters where they need them, so tests pass fakes. Only these touch globals:
  - `src/lib/supabase.ts` (reads `import.meta.env`);
  - components and screens;
  - `src/audio/clock.ts`, `drone.ts` and `useMetronome.ts`.
- **localStorage keys** (these exact names):
  - `gc.session.<lessonId>` holds the practice session;
  - `gc.lesson` holds `{date, lesson}`, the offline copy of today's lesson;
  - `gc.pending` holds queued completions.
- **Colours** come only from the CSS tokens in the UI spec §3; there are no other hex values in components. Per-block colour is passed as `--c` / `--c-dim` custom properties.
- **Sizes (UI spec §2):**
  - body ≥ 16 px;
  - touch targets ≥ 44 px, and ≥ 56 px for the main controls;
  - tempo number 76 px;
  - timer 30 px.
- **The generate-lesson timeout is 120 000 ms.** The client sends the device's **local** date.
- **Nothing is uploaded from the recorder.** Takes live only as in-memory object URLs.
- **Local Supabase** runs on ports 553xx (API `http://127.0.0.1:55321`, Studio `55323`, Inbucket mail `55324`). The Vite dev server runs on `http://127.0.0.1:5173` with `strictPort`.
- **Never print or `cat`** `.env.local` or `supabase/functions/.env`. Append to them with `>>` only.
- **Copy never uses he/she for the learner.** Use "you".

## Review Focus

1. **The phone locks, reloads or is killed mid-session.** Reopening must land on the same block with every earlier verdict kept. *(Task 3: save → load round-trip; Task 9 persists on every change.)*
2. **Finishing while offline, or `complete_lesson` failing.** The completion is queued on the phone, retried on the next open before anything else, and never scored twice: the server call is idempotent, and a newer completion for the same lesson replaces an older one in the queue. A lesson that no longer exists (`P0002`) is dropped, not retried forever. *(Task 3, Task 7)*
3. **`generate-lesson` is slow (22–100 s), times out or the phone is offline.** The fetch waits up to 120 s. On a network failure it serves today's cached copy; yesterday's copy is never served. A 401 always signs out, even when a cached copy exists. *(Task 7)*
4. **A foot pedal or keyboard fires while typing.** Space and the arrow or PageUp/PageDown keys must do nothing while focus is in an input or textarea (the "Fix tomorrow" field). *(Task 2)*
5. **Unusual chords:**
   - A braced chord outside the plan's voicings (from curriculum text), a name `chords-db` doesn't know (throws), or a shape high up the neck.
   - The voicing sheet shows "No diagram for X" instead of crashing.
   - High shapes get a base-fret label instead of running off the diagram.
   - *(Task 4)*

---

## File Structure

| File | Responsibility |
|---|---|
| `index.html` | App shell, Google Fonts links, `#root` |
| `vite.config.ts` | Vite + React (+ PWA from Task 13); dev server on 127.0.0.1:5173 |
| `src/main.tsx` | Mounts `<App/>` and imports `theme.css` |
| `src/theme.css` | Tokens and every class the components use |
| `src/App.tsx` | Auth gate, flushes pending completions, fetches today's lesson, chooses the screen |
| `src/lib/supabase.ts` | Supabase client from `VITE_` env |
| `src/lib/dates.ts` | `localDate`, `weekDays`, `clock` |
| `src/lib/text.ts` | `splitChords`, `chordsIn` |
| `src/lib/ug.ts` | `ugSearchUrl` |
| `src/lib/ladder.ts` | `tempoLadder` |
| `src/lib/keys.ts` | `keyAction` (pedal and keyboard shortcuts) |
| `src/lib/lesson.ts` | `TodayLesson`, `BLOCK_META`, `bpmTarget`, `startBpm`, `tonicOf`, `refLabel` |
| `src/lib/session.ts` | Practice session model and persistence |
| `src/lib/pending.ts` | Offline completion queue |
| `src/lib/api.ts` | `fetchToday`, `completeLesson`, `completedDays`, `ApiError` |
| `src/lib/chordLabels.ts` | `dotLabels`, `rootStrings`, `baseFret`, `shapesFor` |
| `src/lib/wakeLock.ts` | `useWakeLock` |
| `src/audio/clock.ts` | Shared `AudioContext`, `blip` |
| `src/audio/metronome.ts` | `scheduleBeats` (pure), `createMetronome` |
| `src/audio/drone.ts` | `startDrone` |
| `src/audio/useMetronome.ts` | `useMetronome`, `useDrone` hooks |
| `src/components/*.tsx` | `Burst`, `Rail`, `ChordDiagram` (+`ModeToggle`), `ChordText`, `VoicingSheet`, `ChordPanel`, `Metronome`, `Recorder` |
| `src/screens/*.tsx` | `SignIn`, `Today`, `Player`, `Done` |
| `supabase/functions/_shared/engine/patterns.ts` | Role-based picking patterns (thumb = root/alt bass, fingers = top chord tones), resolved by semitones in any tuning |
| `supabase/functions/_shared/engine/skillGuides.ts` | "About this skill" explainers (fingerstyle first) |
| `src/lib/skillInfo.ts` | Skill + guide + patterns lookup |
| `src/components/PickingPattern.tsx`, `SkillSheet.tsx` | Animated, audible picking pattern; About-this-skill sheet |
| `scripts/gen-bursts.ts` | Deterministic powder-burst SVG generator → `public/bursts/*.svg` |
| `public/icon.svg` | PWA icon |
| `supabase/templates/magic_link.html` | Sign-in email with the link **and** a 6-digit code (needed for an installed iOS PWA) |
| `netlify.toml` | Build settings |
| `tests/app/*.test.ts` | Unit tests for every pure module |

---

### Task 1: Scaffold the app (Vite + React + theme)

**Files:**
- Modify: `package.json`, `tsconfig.json`, `supabase/config.toml`, `.env.local` (append only), `README.md`
- Create: `index.html`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx` (placeholder), `src/theme.css`, `src/lib/supabase.ts`, `.env.example`

**Interfaces:**
- Produces:
  - `db: SupabaseClient`, `SUPABASE_URL: string` and `ANON_KEY: string` from `src/lib/supabase.ts`;
  - every CSS class listed in `src/theme.css` (later tasks use these names only).

- [ ] **Step 1: Install dependencies**

```bash
npm install react@19.3.0 react-dom@19.3.0
npm install -D vite@^7.3.6 @vitejs/plugin-react@^5.2.0 @types/react@^19 @types/react-dom@^19
```
Expected: `npm ls vite` shows a single `vite@7.x`, deduped under vitest.

- [ ] **Step 2: Add scripts to `package.json`**

Add these entries to `"scripts"`. Keep every existing one.

```json
"dev": "vite",
"build": "tsc --noEmit && vite build",
"preview": "vite preview --host 127.0.0.1 --port 5173",
"bursts": "node scripts/gen-bursts.ts"
```

- [ ] **Step 3: Update `tsconfig.json`**

Replace the file with:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["node", "vite/client"]
  },
  "include": ["scripts", "supabase/functions/_shared", "supabase/seed", "tests", "src", "vite.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  plugins: [react()],
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#140B1F">
  <title>Guitar Coach</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 6: Create `src/theme.css`**

```css
:root {
  --bg: #140B1F; --surface: #1F1430; --surface-2: #2A1D3F; --line: #3A2B52; --line-soft: #2E2244;
  --text: #FBF4EA; --text-2: #DCD0E6; --muted: #C4B6D4; --muted-dim: #2E2244;
  --gold: #FFB627; --gold-dim: #5A4220; --on-gold: #1A0F05;
  --pink: #FF3D8B; --pink-dim: #5A1F42;
  --teal: #14C9B8; --teal-dim: #174A4F;
  --violet: #9D7BFF; --violet-dim: #3E3366;
  --saffron: #FF7A1A; --saffron-dim: #5A3020;
  --blue: #4D8DFF; --blue-dim: #1C2F5E;
  --c: var(--gold); --c-dim: var(--gold-dim);
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--text); }
body { font: 400 16px/1.45 'IBM Plex Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
p { margin: 0; }
a { color: var(--gold); }
button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; }
button:disabled { opacity: 0.4; cursor: default; }
:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }

.screen { position: relative; overflow: hidden; min-height: 100dvh; max-width: 480px; margin: 0 auto;
  padding: 20px 20px calc(24px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 16px; }
.screen > :not(.burst) { position: relative; }
.burst { position: absolute; pointer-events: none; user-select: none; }
.burst-hero { top: -40px; right: -140px; width: 480px; }
.burst-corner { top: -60px; right: -80px; width: 260px; opacity: 0.7; }
.burst-done { top: -50px; left: -55px; width: 500px; }

.title { margin: 0; font: 800 38px/1.04 'Bricolage Grotesque', sans-serif; letter-spacing: -0.015em; }
.title-sm { font-size: 30px; line-height: 1.1; }
.label { margin: 0; font-size: 14px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.muted { color: var(--muted); }
.text-2 { color: var(--text-2); }
.c-text { color: var(--c); font-weight: 600; }
.gold-text { color: var(--gold); font-weight: 600; }
.mono { font-family: 'IBM Plex Mono', monospace; }
.spacer { flex: 1; }
.stack-sm { display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; align-items: center; gap: 12px; justify-content: space-between; }
.center { display: flex; flex-direction: column; align-items: center; }

.pill { align-self: flex-start; padding: 4px 10px; border-radius: 999px; font-size: 13px; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--bg); background: var(--pink); }
.dots { display: flex; gap: 6px; align-items: center; }
.dot { width: 12px; height: 12px; border-radius: 6px; background: var(--surface-2); }
.dot.on { background: var(--gold); }
.dot.today { box-shadow: inset 0 0 0 2px var(--text); }

.list { display: flex; flex-direction: column; border-top: 1px solid var(--line-soft); }
.list-row { display: flex; align-items: center; gap: 12px; padding: 11px 2px; border-bottom: 1px solid var(--line-soft); }
.swatch { width: 10px; height: 10px; border-radius: 5px; flex-shrink: 0; }
.card { background: var(--surface); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
details.card summary { cursor: pointer; font-weight: 600; min-height: 44px; display: flex; align-items: center; }
.song { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 14px;
  background: var(--surface); border-radius: 14px; text-decoration: none; color: var(--text); min-height: 56px; }

.btn-primary { width: 100%; height: 64px; border-radius: 18px; background: var(--gold); color: var(--on-gold);
  font: 800 22px 'Bricolage Grotesque', sans-serif; }
.btn-ghost { min-height: 44px; padding: 0 14px; border: 1px solid var(--line); border-radius: 12px; font-weight: 600; }
.btn-ghost[aria-pressed="true"] { background: var(--text); color: var(--bg); border-color: var(--text); }
.round { width: 44px; height: 44px; border-radius: 22px; background: var(--surface-2); display: inline-flex;
  align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
.round.lg { width: 56px; height: 56px; border-radius: 28px; }
.chip { display: inline-flex; align-items: center; min-height: 32px; margin: 0 2px; padding: 0 9px; border-radius: 8px;
  background: var(--surface-2); color: var(--gold); font: 800 0.95em 'Bricolage Grotesque', sans-serif; vertical-align: middle; }

.rail { display: flex; gap: 4px; height: 7px; width: 78%; }
.rail span { border-radius: 4px; min-width: 6px; }
.status { display: flex; justify-content: space-between; align-items: baseline; }
.timer { font: 500 30px 'IBM Plex Mono', monospace; }
.timer.over { color: var(--gold); }
.step { flex-direction: row; align-items: center; gap: 8px; padding: 14px 8px 14px 16px; }
.step-text { flex: 1; display: flex; flex-direction: column; gap: 4px; font-size: 18px; line-height: 1.4; }
.step-text small { font-size: 12px; }

.metro .bpm { font: 500 76px/1 'IBM Plex Mono', monospace; letter-spacing: -0.03em; }
.ladder { display: flex; gap: 8px; }
.ladder button { flex: 1; height: 44px; border-radius: 12px; border: 1px solid var(--line); font-family: 'IBM Plex Mono', monospace; }
.ladder button[aria-pressed="true"] { background: var(--c); border-color: var(--c); color: var(--bg); }
.beats { display: flex; gap: 8px; }
.beats span { width: 30px; height: 30px; border-radius: 15px; background: var(--line-soft); }
.beats span.on { background: var(--c); }
.btn-play { width: 100%; height: 52px; border-radius: 14px; background: var(--line-soft); font-size: 18px; font-weight: 600; }
.btn-play[aria-pressed="true"] { background: var(--text); color: var(--bg); }

.verdict { display: flex; gap: 10px; }
.verdict button { flex: 1; height: 64px; border-radius: 16px; border: 2px solid var(--line); font-size: 18px; font-weight: 600; }
.verdict button[aria-pressed="true"] { border-color: var(--text); background: var(--line-soft); }
.verdict .pass { flex: 1.4; border-color: var(--gold); color: var(--gold); font-weight: 700; }
.verdict .pass[aria-pressed="true"], .verdict .pass:active { background: var(--gold); color: var(--on-gold); }

.panel { flex-direction: row; gap: 12px; }
.panel-chord { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.panel-side { flex: 1; display: flex; flex-direction: column; gap: 10px; }
.next { display: flex; flex-direction: column; padding: 10px 12px; background: var(--surface-2); border-radius: 12px; }
.chord-name { margin: 0; font: 800 44px/1 'Bricolage Grotesque', sans-serif; }
.toggle { display: flex; gap: 4px; padding: 3px; background: var(--surface-2); border-radius: 10px; }
.toggle button { flex: 1; min-height: 36px; border-radius: 8px; font-size: 13px; font-weight: 600; }
.toggle button[aria-pressed="true"] { background: var(--text); color: var(--bg); }
.prog { display: flex; gap: 6px; }
.prog button { flex: 1; height: 52px; border-radius: 12px; border: 2px solid var(--line); font: 800 22px 'Bricolage Grotesque', sans-serif; }
.prog button[aria-pressed="true"] { background: var(--c); border-color: var(--c); color: var(--bg); }

.cd-nut { fill: var(--text); }
.cd-fret { stroke: var(--line); stroke-width: 1.5; }
.cd-string { stroke: var(--muted); stroke-width: 1.5; opacity: 0.7; }
.cd-dot { fill: var(--text); }
.cd-dot.cd-root { fill: var(--gold); }
.cd-barre { fill: var(--text); opacity: 0.3; }
.cd-label { fill: var(--bg); font: 700 12px 'IBM Plex Sans', sans-serif; text-anchor: middle; dominant-baseline: central; }
.cd-label.cd-root { fill: var(--on-gold); }
.cd-open { fill: none; stroke: var(--muted); stroke-width: 2; }
.cd-open.cd-root { stroke: var(--gold); stroke-width: 3; }
.cd-mute { fill: var(--muted); font: 700 14px sans-serif; text-anchor: middle; dominant-baseline: central; }
.cd-base { fill: var(--muted); font: 600 11px 'IBM Plex Sans', sans-serif; text-anchor: middle; dominant-baseline: central; }

.sheet { background: var(--surface); color: var(--text); border: 0; border-radius: 20px; padding: 20px; width: min(92vw, 420px); }
.sheet[open] { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.sheet::backdrop { background: rgb(10 5 16 / 0.7); }
.sheet-head { width: 100%; display: flex; justify-content: space-between; align-items: center; }

.stats { display: flex; gap: 8px; }
.stat { flex: 1; padding: 12px; background: var(--surface); border-radius: 14px; display: flex; flex-direction: column; }
.stat b { font: 500 30px 'IBM Plex Mono', monospace; }
.stat small { font-size: 12px; color: var(--muted); }
.rating { display: flex; gap: 6px; }
.rating button { width: 44px; height: 44px; border-radius: 22px; background: var(--surface-2); font-weight: 700; }
.rating button[aria-pressed="true"] { background: var(--saffron); color: var(--on-gold); }
input[type="text"], input[type="email"], input[inputmode="numeric"] { width: 100%; height: 48px; padding: 0 12px;
  border: 1px solid var(--line); border-radius: 10px; background: var(--bg); color: var(--text); font: inherit; }
label.check { display: flex; gap: 10px; align-items: center; min-height: 44px; }
label.check input { width: 22px; height: 22px; accent-color: var(--gold); }
audio { width: 100%; }
```

- [ ] **Step 7: Create `src/lib/supabase.ts`, `src/App.tsx` (placeholder) and `src/main.tsx`**

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
/** The browser's Supabase client; the session persists in localStorage. */
export const db = createClient(SUPABASE_URL, ANON_KEY);
```

```tsx
// src/App.tsx (placeholder; replaced in Task 7)
/** Root component. */
export function App() {
  return <main className="screen"><h1 className="title">Guitar Coach</h1></main>;
}
```

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './theme.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
```

- [ ] **Step 8: Env files**

Create `.env.example`:

```
VITE_SUPABASE_URL=http://127.0.0.1:55321
VITE_SUPABASE_ANON_KEY=<anon key from `supabase status`>
```

Append the local values to `.env.local` without printing the file. Run each line on its own:

```bash
echo "VITE_SUPABASE_URL=http://127.0.0.1:55321" >> .env.local
echo "VITE_SUPABASE_ANON_KEY=$(supabase status -o env | grep '^ANON_KEY=' | cut -d= -f2- | tr -d '\"')" >> .env.local
grep -c '^VITE_' .env.local
```
Expected: `2`.

- [ ] **Step 9: Point local auth at the dev server**

In `supabase/config.toml` under `[auth]`, set:

```toml
site_url = "http://127.0.0.1:5173"
additional_redirect_urls = ["http://127.0.0.1:5173"]
```
Then run `supabase stop && supabase start`. Expected: the stack starts on ports 553xx.

- [ ] **Step 10: Verify**

```bash
npm run typecheck && npm test && npm run build
```
Expected: the typecheck is clean, all existing unit tests pass (157), and `vite build` writes `dist/`.

Then run `npm run dev`, open http://127.0.0.1:5173 and check that "Guitar Coach" appears in Bricolage Grotesque on the dark plum background.

- [ ] **Step 11: README and commit**

Add to `README.md` after "LLM setup":

````markdown
## App (Phase 3)
```bash
supabase start && supabase functions serve   # functions serve reads supabase/functions/.env
npm run dev                                  # http://127.0.0.1:5173 (needs VITE_* in .env.local, see .env.example)
```
Sign-in emails locally land in Inbucket: http://127.0.0.1:55324
````

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src .env.example supabase/config.toml README.md
git commit -m "feat(app): Vite + React scaffold with Diwali theme tokens

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

---

### Task 2: Small pure helpers (dates, chord text, UG links, tempo ladder, keys, lesson meta)

**Files:**
- Create: `src/lib/dates.ts`, `src/lib/text.ts`, `src/lib/ug.ts`, `src/lib/ladder.ts`, `src/lib/keys.ts`, `src/lib/lesson.ts`
- Test: `tests/app/helpers.test.ts`, `tests/app/fixtures.ts`

**Interfaces:**
- Produces:
  - `localDate(d?: Date): string`, `weekDays(date: string): string[]` (Mon..Sun), `clock(secs: number): string`
  - `type Segment = { text: string } | { chord: string }`; `splitChords(s: string): Segment[]`; `chordsIn(texts: string[]): string[]`
  - `ugSearchUrl(title: string, artist: string): string`
  - `tempoLadder(start: number, target: number): number[]`
  - `type KeyAction = 'toggle' | 'next' | 'prev' | null`; `keyAction(key: string, targetTag: string | undefined): KeyAction`
  - `interface TodayLesson { id; lesson_date; status: 'planned' | 'completed' | 'skipped'; plan: LessonPlan; content: LessonContent }`
  - `type Colour = 'gold' | 'blue' | 'pink' | 'muted' | 'teal' | 'violet' | 'saffron'`; `BLOCK_META: Record<BlockKind, { label: string; colour: Colour }>`
  - `bpmTarget(plan, i): number | null`, `startBpm(plan, i): number`, `tonicOf(key): string`, `refLabel(ref): string`
  - `tests/app/fixtures.ts` exports `PLAN` (a 4-block `LessonPlan`) and `memoryKV()`

- [ ] **Step 1: Create the test fixtures**

```ts
// tests/app/fixtures.ts
import type { LessonPlan } from '../../supabase/functions/_shared/engine/types.ts';

/** Four blocks: itemless warm-up, bpm new skill, two-item review, itemless apply. */
export const PLAN = {
  key: 'G',
  blocks: [
    { kind: 'warmup', minutes: 3, items: [] },
    { kind: 'new_skill', minutes: 10.5, items: [{ ref: 'skill:fingerstyle.l1.giuliani_arpeggios', target: { metric: 'bpm', start: 39, target: 60 } }] },
    { kind: 'review', minutes: 5, items: [{ ref: 'skill:rhythm.l1.down_up', target: null }, { ref: 'theory:intervals_basic', target: null }] },
    { kind: 'apply', minutes: 11, items: [] },
  ],
  music: { progression: { roman: ['I', 'IV', 'I', 'V'], chords: ['G', 'C', 'G', 'D'] }, voicings: {} },
} as unknown as LessonPlan;

/** In-memory stand-in for localStorage. */
export function memoryKV() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    map: m,
  };
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// tests/app/helpers.test.ts
import { describe, expect, it } from 'vitest';
import { clock, localDate, weekDays } from '../../src/lib/dates.ts';
import { keyAction } from '../../src/lib/keys.ts';
import { tempoLadder } from '../../src/lib/ladder.ts';
import { BLOCK_META, bpmTarget, refLabel, startBpm, tonicOf } from '../../src/lib/lesson.ts';
import { chordsIn, splitChords } from '../../src/lib/text.ts';
import { ugSearchUrl } from '../../src/lib/ug.ts';
import { PLAN } from './fixtures.ts';

describe('dates', () => {
  it('uses the device calendar day, not UTC', () => {
    expect(localDate(new Date(2026, 8, 29, 23, 30))).toBe('2026-09-29');
    expect(localDate(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
  });
  it('returns Monday..Sunday of the week', () => {
    const w = weekDays('2026-09-29'); // a Tuesday
    expect(w).toHaveLength(7);
    expect(w[0]).toBe('2026-09-28');
    expect(w[6]).toBe('2026-10-04');
    expect(weekDays('2026-10-04')[0]).toBe('2026-09-28'); // Sunday stays in the same week
  });
  it('formats a countdown, with overtime prefixed by +', () => {
    expect(clock(441)).toBe('7:21');
    expect(clock(5)).toBe('0:05');
    expect(clock(0)).toBe('0:00');
    expect(clock(-12)).toBe('+0:12');
  });
});

describe('splitChords', () => {
  it('splits braced chords out of text, in order', () => {
    expect(splitChords('Play {G} then {C/E}.')).toEqual([{ text: 'Play ' }, { chord: 'G' }, { text: ' then ' }, { chord: 'C/E' }, { text: '.' }]);
  });
  it('handles text with no chords and chords at the edges', () => {
    expect(splitChords('No chords here')).toEqual([{ text: 'No chords here' }]);
    expect(splitChords('{Am7}')).toEqual([{ chord: 'Am7' }]);
  });
  it('lists distinct chords across texts in first-seen order', () => {
    expect(chordsIn(['{G} {C} {G}', 'then {D}'])).toEqual(['G', 'C', 'D']);
  });
});

describe('ugSearchUrl', () => {
  it('builds an encoded title search', () => {
    expect(ugSearchUrl('Dust in the Wind', 'Kansas'))
      .toBe('https://www.ultimate-guitar.com/search.php?search_type=title&value=Dust%20in%20the%20Wind%20Kansas');
  });
});

describe('tempoLadder', () => {
  it('gives four rungs ending on the target', () => {
    expect(tempoLadder(39, 60)).toEqual([39, 46, 53, 60]);
  });
  it('collapses when there is no room to climb', () => {
    expect(tempoLadder(60, 60)).toEqual([60]);
    expect(tempoLadder(70, 60)).toEqual([60]);
    expect(tempoLadder(59, 60)).toEqual([59, 60]);
  });
});

describe('keyAction', () => {
  it('maps pedal and keyboard keys', () => {
    expect(keyAction(' ', 'BODY')).toBe('toggle');
    expect(keyAction('ArrowRight', 'BUTTON')).toBe('next');
    expect(keyAction('PageDown', undefined)).toBe('next');
    expect(keyAction('ArrowLeft', 'MAIN')).toBe('prev');
    expect(keyAction('PageUp', 'MAIN')).toBe('prev');
    expect(keyAction('a', 'BODY')).toBeNull();
  });
  it('does nothing while typing in a field', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT', 'input']) {
      expect(keyAction(' ', tag)).toBeNull();
      expect(keyAction('ArrowRight', tag)).toBeNull();
    }
  });
});

describe('lesson meta', () => {
  it('has a label and colour for every block kind', () => {
    for (const k of ['warmup', 'retest', 'new_skill', 'reset', 'review', 'apply', 'create', 'record'] as const) {
      expect(BLOCK_META[k].label).toBeTruthy();
    }
    expect(BLOCK_META.new_skill.colour).toBe('pink');
    expect(BLOCK_META.apply.colour).toBe('teal');
  });
  it('reads bpm targets and starting tempos', () => {
    expect(bpmTarget(PLAN, 1)).toBe(60);
    expect(bpmTarget(PLAN, 0)).toBeNull();
    expect(startBpm(PLAN, 1)).toBe(39);
    expect(startBpm(PLAN, 3)).toBe(39); // apply borrows the new skill's start tempo
  });
  it('gets a tonic from a key and a readable name from a ref', () => {
    expect(tonicOf('F#m')).toBe('F#');
    expect(tonicOf('Bb')).toBe('Bb');
    expect(tonicOf('G')).toBe('G');
    expect(refLabel('skill:fingerstyle.l1.giuliani_arpeggios')).toBe('giuliani arpeggios');
    expect(refLabel('theory:intervals_basic')).toBe('intervals basic');
  });
});
```

- [ ] **Step 3: Run the tests and check they fail**

Run: `npx vitest run tests/app/helpers.test.ts`
Expected: FAIL, because the modules under `src/lib/` do not exist yet.

- [ ] **Step 4: Implement**

```ts
// src/lib/dates.ts
const pad = (n: number) => String(n).padStart(2, '0');

/** The device's local calendar date as YYYY-MM-DD (the lesson date generate-lesson expects). */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Monday..Sunday (YYYY-MM-DD) of the week containing `date`. */
export function weekDays(date: string): string[] {
  const d = new Date(`${date}T12:00:00Z`);
  const monday = d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000;
  return Array.from({ length: 7 }, (_, i) => new Date(monday + i * 86_400_000).toISOString().slice(0, 10));
}

/** m:ss countdown; overtime shows as +m:ss. */
export function clock(secs: number): string {
  const a = Math.abs(Math.round(secs));
  return `${secs < 0 ? '+' : ''}${Math.floor(a / 60)}:${pad(a % 60)}`;
}
```

```ts
// src/lib/text.ts
export type Segment = { text: string } | { chord: string };

/** Splits lesson text on {Chord} braces into plain-text and chord segments, in order. */
export function splitChords(s: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of s.matchAll(/\{([^{}]+)\}/g)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ chord: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

/** Distinct braced chords across the texts, in first-seen order. */
export function chordsIn(texts: string[]): string[] {
  return [...new Set(texts.flatMap(t => splitChords(t).flatMap(s => ('chord' in s ? [s.chord] : []))))];
}
```

```ts
// src/lib/ug.ts
/** Ultimate Guitar title search for a song (UG has no public API, so we link to search). */
export function ugSearchUrl(title: string, artist: string): string {
  return `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(`${title} ${artist}`)}`;
}
```

```ts
// src/lib/ladder.ts
/** Up to four tempo rungs from start to target, evenly spaced and rounded, ending exactly on target. */
export function tempoLadder(start: number, target: number): number[] {
  if (target <= start) return [target];
  const step = (target - start) / 3;
  return [...new Set([0, 1, 2, 3].map(i => Math.round(start + step * i)))];
}
```

```ts
// src/lib/keys.ts
export type KeyAction = 'toggle' | 'next' | 'prev' | null;
const TYPING = ['INPUT', 'TEXTAREA', 'SELECT'];

/** Player shortcut for a key press (page-turn pedals send these keys); null while typing in a field. */
export function keyAction(key: string, targetTag: string | undefined): KeyAction {
  if (targetTag && TYPING.includes(targetTag.toUpperCase())) return null;
  if (key === ' ') return 'toggle';
  if (key === 'ArrowRight' || key === 'PageDown') return 'next';
  if (key === 'ArrowLeft' || key === 'PageUp') return 'prev';
  return null;
}
```

```ts
// src/lib/lesson.ts
import type { BlockKind, LessonPlan } from '../../supabase/functions/_shared/engine/types.ts';
import type { LessonContent } from '../../supabase/functions/_shared/lesson/contract.ts';

/** The lessons row generate-lesson returns (the columns the app reads). */
export interface TodayLesson {
  id: string; lesson_date: string; status: 'planned' | 'completed' | 'skipped'; plan: LessonPlan; content: LessonContent;
}

export type Colour = 'gold' | 'blue' | 'pink' | 'muted' | 'teal' | 'violet' | 'saffron';

/** Display name and festival colour per block kind (UI spec §3). */
export const BLOCK_META: Record<BlockKind, { label: string; colour: Colour }> = {
  warmup: { label: 'Warm-up', colour: 'gold' },
  retest: { label: 'Cold retest', colour: 'blue' },
  new_skill: { label: 'New skill', colour: 'pink' },
  reset: { label: 'Reset', colour: 'muted' },
  review: { label: 'Review', colour: 'blue' },
  apply: { label: 'Apply', colour: 'teal' },
  create: { label: 'Create', colour: 'violet' },
  record: { label: 'Record & rate', colour: 'saffron' },
};

/** The bpm target of a block's first item, or null when the block isn't measured in bpm. */
export function bpmTarget(plan: LessonPlan, i: number): number | null {
  const t = plan.blocks[i]?.items[0]?.target;
  return t?.metric === 'bpm' ? t.target : null;
}

/** Starting metronome tempo: the item's start tempo, else its target, else the day's new-skill start, else 70. */
export function startBpm(plan: LessonPlan, i: number): number {
  const t = plan.blocks[i]?.items[0]?.target;
  if (t?.metric === 'bpm') return t.start ?? t.target ?? 70;
  const skill = plan.blocks.find(b => b.kind === 'new_skill')?.items[0]?.target;
  return skill?.metric === 'bpm' ? skill.start ?? skill.target ?? 70 : 70;
}

/** Tonic pitch class of a key name ("F#m" → "F#"). */
export function tonicOf(key: string): string {
  return /^[A-G][#b]?/.exec(key)?.[0] ?? 'C';
}

/** Readable name for a plan ref ("skill:fingerstyle.l1.giuliani_arpeggios" → "giuliani arpeggios"). */
export function refLabel(ref: string): string {
  const id = ref.slice(ref.indexOf(':') + 1);
  return (id.split('.').pop() ?? id).replaceAll('_', ' ');
}
```

- [ ] **Step 5: Run the tests and check they pass**

Run: `npx vitest run tests/app/helpers.test.ts && npm run typecheck`
Expected: PASS, and the typecheck is clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib tests/app
git commit -m "feat(app): pure helpers for dates, chord text, UG links, tempo ladder, pedal keys, block meta

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

---

### Task 3: Practice session model and offline completion queue

**Files:**
- Create: `src/lib/session.ts`, `src/lib/pending.ts`
- Test: `tests/app/session.test.ts`

**Interfaces:**
- Consumes: `PLAN` and `memoryKV` from `tests/app/fixtures.ts`.
- Produces:
  - `type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>`
  - `interface Log { block_index: number; block_kind: BlockKind; item_ref: string | null; passed: boolean | null; value_reached: number | null; note: string | null }`. This is exactly the element shape `complete_lesson`'s `p_logs` reads.
  - `interface Session { lessonId: string; index: number; logs: Log[]; startedAt: number; blockStartedAt: number }`
  - `newSession(lessonId, now)`, `loadSession(kv, lessonId, now)`, `saveSession(kv, s)`, `clearSession(kv, lessonId)`
  - `slotsFor(plan, i): (string | null)[]`, `logVerdict(s, log): Session`, `goTo(s, to, count, now): Session`
  - `summary(s, now): { bestBpm: number | null; clean: number; rated: number; minutes: number }`, `blockResult(s, i): string`
  - `interface Completion { lessonId: string; logs: Log[]; confidence: number | null; wantMoreTime: boolean; notes: string | null }`
  - `queueCompletion(kv, c): void`, `flushPending(kv, send: (c: Completion) => Promise<void>): Promise<number>`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/app/session.test.ts
import { describe, expect, it } from 'vitest';
import { flushPending, queueCompletion, type Completion } from '../../src/lib/pending.ts';
import {
  blockResult, clearSession, goTo, loadSession, logVerdict, newSession, saveSession, slotsFor, summary, type Log,
} from '../../src/lib/session.ts';
import { PLAN, memoryKV } from './fixtures.ts';

const log = (block_index: number, item_ref: string | null, passed: boolean | null, value_reached: number | null = null): Log =>
  ({ block_index, block_kind: PLAN.blocks[block_index].kind, item_ref, passed, value_reached, note: null });

describe('session', () => {
  it('has one slot per plan item, or a single null slot for itemless blocks', () => {
    expect(slotsFor(PLAN, 0)).toEqual([null]);
    expect(slotsFor(PLAN, 1)).toEqual(['skill:fingerstyle.l1.giuliani_arpeggios']);
    expect(slotsFor(PLAN, 2)).toEqual(['skill:rhythm.l1.down_up', 'theory:intervals_basic']);
  });

  it('replaces an earlier verdict for the same block and item only', () => {
    let s = newSession('L1', 0);
    s = logVerdict(s, log(2, 'skill:rhythm.l1.down_up', false));
    s = logVerdict(s, log(2, 'theory:intervals_basic', true));
    s = logVerdict(s, log(2, 'skill:rhythm.l1.down_up', true));
    expect(s.logs).toHaveLength(2);
    expect(s.logs.every(l => l.passed)).toBe(true);
  });

  it('moves between blocks, clamps, and restarts the block clock only on a real move', () => {
    const s = newSession('L1', 0);
    const a = goTo(s, 1, 4, 500);
    expect(a).toMatchObject({ index: 1, blockStartedAt: 500 });
    expect(goTo(a, 1, 4, 900)).toBe(a);
    expect(goTo(a, -3, 4, 900).index).toBe(0);
    expect(goTo(a, 9, 4, 900).index).toBe(4); // count = finished
  });

  it('survives a reload: save then load resumes the same block with its verdicts', () => {
    const kv = memoryKV();
    let s = goTo(newSession('L1', 1000), 2, 4, 2000);
    s = logVerdict(s, log(1, 'skill:fingerstyle.l1.giuliani_arpeggios', true, 52));
    saveSession(kv, s);
    expect(loadSession(kv, 'L1', 99_999)).toEqual(s);
  });

  it('starts fresh for another lesson, corrupt storage, or after clearing', () => {
    const kv = memoryKV();
    saveSession(kv, goTo(newSession('L1', 0), 2, 4, 0));
    expect(loadSession(kv, 'L2', 5)).toEqual(newSession('L2', 5));
    kv.setItem('gc.session.L3', '{not json');
    expect(loadSession(kv, 'L3', 5)).toEqual(newSession('L3', 5));
    clearSession(kv, 'L1');
    expect(loadSession(kv, 'L1', 5).index).toBe(0);
  });

  it('summarises best clean bpm, clean count and minutes', () => {
    let s = newSession('L1', 0);
    s = logVerdict(s, log(0, null, true));
    s = logVerdict(s, log(1, 'skill:fingerstyle.l1.giuliani_arpeggios', true, 52));
    s = logVerdict(s, log(3, null, false, 60));
    s = logVerdict(s, log(2, 'skill:rhythm.l1.down_up', null));
    expect(summary(s, 31 * 60_000)).toEqual({ bestBpm: 52, clean: 2, rated: 3, minutes: 31 });
    expect(summary(newSession('L1', 0), 10_000)).toEqual({ bestBpm: null, clean: 0, rated: 0, minutes: 1 });
  });

  it('describes each block result for the Done list', () => {
    let s = newSession('L1', 0);
    s = logVerdict(s, log(0, null, true));
    s = logVerdict(s, log(1, 'skill:fingerstyle.l1.giuliani_arpeggios', true, 52));
    s = logVerdict(s, log(2, 'skill:rhythm.l1.down_up', true));
    s = logVerdict(s, log(2, 'theory:intervals_basic', false));
    expect(blockResult(s, 0)).toBe('clean');
    expect(blockResult(s, 1)).toBe('clean at 52');
    expect(blockResult(s, 2)).toBe('1 of 2 clean');
    expect(blockResult(s, 3)).toBe('skipped');
    expect(blockResult(logVerdict(s, log(3, null, false)), 3)).toBe('not yet');
  });
});

describe('pending completions', () => {
  const c = (lessonId: string, notes: string | null = null): Completion =>
    ({ lessonId, logs: [], confidence: 3, wantMoreTime: false, notes });

  it('keeps one completion per lesson, the newest', () => {
    const kv = memoryKV();
    queueCompletion(kv, c('L1', 'old'));
    queueCompletion(kv, c('L2'));
    queueCompletion(kv, c('L1', 'new'));
    const q = JSON.parse(kv.getItem('gc.pending')!) as Completion[];
    expect(q.map(x => [x.lessonId, x.notes])).toEqual([['L2', null], ['L1', 'new']]);
  });

  it('sends everything, keeps failures, and clears the key when all succeed', async () => {
    const kv = memoryKV();
    queueCompletion(kv, c('L1'));
    queueCompletion(kv, c('L2'));
    const sent: string[] = [];
    expect(await flushPending(kv, async x => { sent.push(x.lessonId); if (x.lessonId === 'L2') throw new Error('offline'); })).toBe(1);
    expect(sent).toEqual(['L1', 'L2']);
    expect((JSON.parse(kv.getItem('gc.pending')!) as Completion[]).map(x => x.lessonId)).toEqual(['L2']);
    expect(await flushPending(kv, async () => {})).toBe(0);
    expect(kv.getItem('gc.pending')).toBeNull();
  });

  it('treats a corrupt queue as empty', async () => {
    const kv = memoryKV();
    kv.setItem('gc.pending', 'garbage');
    expect(await flushPending(kv, async () => { throw new Error('should not be called'); })).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `npx vitest run tests/app/session.test.ts`
Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Implement**

```ts
// src/lib/session.ts
import type { BlockKind, LessonPlan } from '../../supabase/functions/_shared/engine/types.ts';

export type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
/** One verdict; exactly the element shape complete_lesson(p_logs) reads. */
export interface Log {
  block_index: number; block_kind: BlockKind; item_ref: string | null;
  passed: boolean | null; value_reached: number | null; note: string | null;
}
export interface Session { lessonId: string; index: number; logs: Log[]; startedAt: number; blockStartedAt: number }

const key = (lessonId: string) => `gc.session.${lessonId}`;

/** A fresh session at block 0. */
export function newSession(lessonId: string, now: number): Session {
  return { lessonId, index: 0, logs: [], startedAt: now, blockStartedAt: now };
}

/** The saved session for this lesson, so a reload resumes the same block; a fresh one if none or corrupt. */
export function loadSession(kv: KV, lessonId: string, now: number): Session {
  try {
    const s = JSON.parse(kv.getItem(key(lessonId)) ?? 'null') as Session | null;
    if (s && s.lessonId === lessonId && Array.isArray(s.logs) && Number.isInteger(s.index)) return s;
  } catch { /* corrupt: start fresh */ }
  return newSession(lessonId, now);
}

/** Persists the session. */
export function saveSession(kv: KV, s: Session): void {
  kv.setItem(key(s.lessonId), JSON.stringify(s));
}

/** Forgets the session once the lesson is finished. */
export function clearSession(kv: KV, lessonId: string): void {
  kv.removeItem(key(lessonId));
}

/** Refs to rate in a block: one per plan item, or a single null slot for blocks without items. */
export function slotsFor(plan: LessonPlan, i: number): (string | null)[] {
  const items = plan.blocks[i]?.items ?? [];
  return items.length ? items.map(it => it.ref) : [null];
}

/** Records a verdict, replacing an earlier one for the same block and item. */
export function logVerdict(s: Session, log: Log): Session {
  const others = s.logs.filter(l => !(l.block_index === log.block_index && l.item_ref === log.item_ref));
  return { ...s, logs: [...others, log] };
}

/** Moves to block `to`, clamped to 0..count (count = finished), restarting the block clock on a real move. */
export function goTo(s: Session, to: number, count: number, now: number): Session {
  const index = Math.max(0, Math.min(count, to));
  return index === s.index ? s : { ...s, index, blockStartedAt: now };
}

/** Headline numbers for the Done screen: best clean bpm, clean vs rated verdicts, minutes practised. */
export function summary(s: Session, now: number): { bestBpm: number | null; clean: number; rated: number; minutes: number } {
  const rated = s.logs.filter(l => l.passed !== null);
  const bpms = rated.filter(l => l.passed && l.value_reached !== null).map(l => l.value_reached!);
  return {
    bestBpm: bpms.length ? Math.max(...bpms) : null,
    clean: rated.filter(l => l.passed).length,
    rated: rated.length,
    minutes: Math.max(1, Math.round((now - s.startedAt) / 60_000)),
  };
}

/** One line per block for the Done list: "clean at 52", "clean", "1 of 2 clean", "not yet" or "skipped". */
export function blockResult(s: Session, i: number): string {
  const logs = s.logs.filter(l => l.block_index === i && l.passed !== null);
  if (!logs.length) return 'skipped';
  const clean = logs.filter(l => l.passed).length;
  if (clean === logs.length) {
    const bpm = Math.max(0, ...logs.map(l => l.value_reached ?? 0));
    return bpm > 0 ? `clean at ${bpm}` : 'clean';
  }
  return clean ? `${clean} of ${logs.length} clean` : 'not yet';
}
```

```ts
// src/lib/pending.ts
import type { KV, Log } from './session.ts';

export interface Completion { lessonId: string; logs: Log[]; confidence: number | null; wantMoreTime: boolean; notes: string | null }
const KEY = 'gc.pending';

function read(kv: KV): Completion[] {
  try {
    const q = JSON.parse(kv.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(q) ? (q as Completion[]) : [];
  } catch {
    return [];
  }
}

/** Keeps a completion on this device until the server accepts it (spec §11); a newer one for the same lesson replaces it. */
export function queueCompletion(kv: KV, c: Completion): void {
  kv.setItem(KEY, JSON.stringify([...read(kv).filter(x => x.lessonId !== c.lessonId), c]));
}

/** Sends every queued completion in order, keeps the ones that fail, and returns how many are still waiting. */
export async function flushPending(kv: KV, send: (c: Completion) => Promise<void>): Promise<number> {
  const left: Completion[] = [];
  for (const c of read(kv)) {
    try { await send(c); } catch { left.push(c); }
  }
  if (left.length) kv.setItem(KEY, JSON.stringify(left));
  else kv.removeItem(KEY);
  return left.length;
}
```

- [ ] **Step 4: Run the tests and check they pass**

Run: `npx vitest run tests/app/session.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts src/lib/pending.ts tests/app/session.test.ts
git commit -m "feat(app): resumable practice session and offline completion queue

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

---

### Task 4: Chord diagrams, voicing sheet and chord chips

**Files:**
- Create: `src/lib/chordLabels.ts`, `src/components/ChordDiagram.tsx`, `src/components/ChordText.tsx`, `src/components/VoicingSheet.tsx`
- Test: `tests/app/chordLabels.test.ts`

**Interfaces:**
- Consumes: `noteAt(string, fret)`, `chordVoicings(name, limit)` and `type Voicing = { frets: number[]; fingers: number[]; barres: number[] }` from `supabase/functions/_shared/engine/music.ts`. Frets are absolute; `-1` = muted and `0` = open. `chordVoicings` **throws** on an unknown name.
- Consumes: `splitChords` (Task 2).
- Produces:
  - `type DotMode = 'fingers' | 'intervals'`
  - `dotLabels(v, chord, mode): (string | null)[]`, `rootStrings(v, chord): boolean[]`, `baseFret(v): number`, `shapesFor(chord, known?): Voicing[]`
  - `<ChordDiagram chord voicing mode width? />`, `<ModeToggle mode onChange />`
  - `<ChordText text onChord />`
  - `<VoicingSheet chord known? onClose />`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/app/chordLabels.test.ts
import { describe, expect, it } from 'vitest';
import { baseFret, dotLabels, rootStrings, shapesFor } from '../../src/lib/chordLabels.ts';

const G = { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], barres: [] };
const D = { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], barres: [] };

describe('dotLabels', () => {
  it('shows finger numbers, blank for open strings, null for muted', () => {
    expect(dotLabels(G, 'G', 'fingers')).toEqual(['2', '1', '', '', '', '3']);
    expect(dotLabels(D, 'D', 'fingers')).toEqual([null, null, '', '1', '3', '2']);
  });
  it('shows intervals from the chord root', () => {
    expect(dotLabels(G, 'G', 'intervals')).toEqual(['R', '3', '5', 'R', '3', 'R']);
    expect(dotLabels(D, 'D', 'intervals')).toEqual([null, null, 'R', '5', 'R', '3']);
    expect(dotLabels({ frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], barres: [] }, 'C', 'intervals'))
      .toEqual([null, 'R', '3', '5', 'R', '3']);
  });
  it('marks root strings', () => {
    expect(rootStrings(G, 'G')).toEqual([true, false, false, true, false, true]);
  });
});

describe('baseFret', () => {
  it('keeps open-position shapes at the nut', () => {
    expect(baseFret(G)).toBe(1);
    expect(baseFret({ frets: [-1, 3, 5, 5, 5, 3], fingers: [], barres: [3] })).toBe(1);
  });
  it('moves the window up for high shapes', () => {
    expect(baseFret({ frets: [6, 8, 8, 7, 6, 6], fingers: [], barres: [6] })).toBe(6);
    expect(baseFret({ frets: [-1, -1, 10, 9, 8, 10], fingers: [], barres: [] })).toBe(8);
  });
});

describe('shapesFor', () => {
  it('puts the lesson voicings first without duplicates', () => {
    const shapes = shapesFor('G', [G]);
    expect(shapes[0]).toEqual(G);
    expect(new Set(shapes.map(s => s.frets.join())).size).toBe(shapes.length);
    expect(shapes.length).toBeGreaterThan(1);
    expect(shapes.length).toBeLessThanOrEqual(6);
  });
  it('returns [] for names chords-db does not know instead of throwing', () => {
    expect(shapesFor('H7')).toEqual([]);
    expect(shapesFor('the E string')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `npx vitest run tests/app/chordLabels.test.ts`
Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement `src/lib/chordLabels.ts`**

```ts
import { Chord, Note } from 'tonal';
import { chordVoicings, noteAt, type Voicing } from '../../supabase/functions/_shared/engine/music.ts';

export type DotMode = 'fingers' | 'intervals';
const DEGREE = ['R', 'b9', '9', 'b3', '3', '4', 'b5', '5', '#5', '6', 'b7', '7'];

function semitones(v: Voicing, chord: string): (number | null)[] {
  const tonic = Chord.get(chord).tonic;
  const root = tonic ? Note.chroma(tonic) : undefined;
  return v.frets.map((f, s) => (f < 0 || root === undefined ? null : (Note.chroma(noteAt(s, f))! - root + 12) % 12));
}

/** Label per string: the finger number ("" when open) or the interval from the chord root; null for muted strings. */
export function dotLabels(v: Voicing, chord: string, mode: DotMode): (string | null)[] {
  const iv = semitones(v, chord);
  return v.frets.map((f, s) => {
    if (f < 0) return null;
    if (mode === 'fingers') return f === 0 ? '' : String(v.fingers[s] || '');
    return iv[s] === null ? '' : DEGREE[iv[s]!];
  });
}

/** True where a string sounds the chord root (drawn in marigold). */
export function rootStrings(v: Voicing, chord: string): boolean[] {
  return semitones(v, chord).map(x => x === 0);
}

/** First fret of the 5-fret window: 1 when the shape fits at the nut, else its lowest fretted note. */
export function baseFret(v: Voicing): number {
  const fretted = v.frets.filter(f => f > 0);
  return fretted.length === 0 || Math.max(...fretted) <= 5 ? 1 : Math.min(...fretted);
}

/** Up to 6 shapes for a chord: the lesson's own voicings first, then chords-db; [] for names it doesn't know. */
export function shapesFor(chord: string, known: Voicing[] = []): Voicing[] {
  let more: Voicing[] = [];
  try { more = chordVoicings(chord, 6); } catch { /* not a chord name */ }
  const seen = new Set(known.map(v => v.frets.join()));
  return [...known, ...more.filter(v => !seen.has(v.frets.join()))].slice(0, 6);
}
```

- [ ] **Step 4: Run the tests and check they pass**

Run: `npx vitest run tests/app/chordLabels.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the components**

```tsx
// src/components/ChordDiagram.tsx
import type { Voicing } from '../../supabase/functions/_shared/engine/music.ts';
import { baseFret, dotLabels, rootStrings, type DotMode } from '../lib/chordLabels.ts';

const X = (s: number) => 15 + 20 * s;   // string 0 = low E, on the left
const Y = (row: number) => 30 + 24 * row; // row 0 = the nut line

/** Vertical chord box: finger numbers or intervals in the dots, root in marigold, x/o above the nut, base fret when high. */
export function ChordDiagram({ chord, voicing, mode, width = 116 }: { chord: string; voicing: Voicing; mode: DotMode; width?: number }) {
  const base = baseFret(voicing);
  const labels = dotLabels(voicing, chord, mode);
  const roots = rootStrings(voicing, chord);
  const barres = voicing.barres
    .map(fret => {
      const on = voicing.frets.flatMap((f, s) => (f === fret ? [s] : []));
      return { fret, from: Math.min(...on), to: Math.max(...on) };
    })
    .filter(b => b.to > b.from);
  const described = voicing.frets.map(f => (f < 0 ? 'x' : String(f))).join(' ');
  return (
    <svg className="chord-diagram" width={width} height={(width * 160) / 130} viewBox="0 0 130 160" role="img"
      aria-label={`${chord}, frets low to high: ${described}`}>
      {base === 1
        ? <rect x="14" y="27" width="102" height="5" rx="1" className="cd-nut" />
        : <text x="124" y={Y(0.5)} className="cd-base">{base}</text>}
      {[1, 2, 3, 4, 5].map(r => <line key={r} x1="15" x2="115" y1={Y(r)} y2={Y(r)} className="cd-fret" />)}
      {[0, 1, 2, 3, 4, 5].map(s => <line key={s} x1={X(s)} x2={X(s)} y1="30" y2="150" className="cd-string" />)}
      {barres.map(b => (
        <rect key={b.fret} x={X(b.from) - 10} width={X(b.to) - X(b.from) + 20} y={Y(b.fret - base + 0.5) - 10} height="20" rx="10" className="cd-barre" />
      ))}
      {voicing.frets.map((f, s) => {
        const root = roots[s] ? ' cd-root' : '';
        if (f < 0) return <text key={s} x={X(s)} y="15" className="cd-mute">×</text>;
        if (f === 0) return <circle key={s} cx={X(s)} cy="14" r="6" className={`cd-open${root}`} />;
        const y = Y(f - base + 0.5);
        return (
          <g key={s}>
            <circle cx={X(s)} cy={y} r="10" className={`cd-dot${root}`} />
            <text x={X(s)} y={y + 1} className={`cd-label${root}`}>{labels[s]}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Fingers / Intervals switch for chord diagrams. */
export function ModeToggle({ mode, onChange }: { mode: DotMode; onChange: (m: DotMode) => void }) {
  return (
    <div className="toggle" role="group" aria-label="Show dots as">
      {(['fingers', 'intervals'] as const).map(m => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => onChange(m)}>
          {m === 'fingers' ? 'Fingers' : 'Intervals'}
        </button>
      ))}
    </div>
  );
}
```

```tsx
// src/components/ChordText.tsx
import { splitChords } from '../lib/text.ts';

/** Lesson text with each {Chord} rendered as a tappable chip that opens its shapes. */
export function ChordText({ text, onChord }: { text: string; onChord: (chord: string) => void }) {
  return (
    <>
      {splitChords(text).map((seg, k) =>
        'chord' in seg
          ? <button key={k} type="button" className="chip" onClick={() => onChord(seg.chord)}>{seg.chord}</button>
          : <span key={k}>{seg.text}</span>)}
    </>
  );
}
```

```tsx
// src/components/VoicingSheet.tsx
import { useEffect, useRef, useState } from 'react';
import type { Voicing } from '../../supabase/functions/_shared/engine/music.ts';
import { shapesFor, type DotMode } from '../lib/chordLabels.ts';
import { ChordDiagram, ModeToggle } from './ChordDiagram.tsx';

/** Modal sheet paging through a chord's shapes ("Shape n of N"); opens only when the user taps a chord. */
export function VoicingSheet({ chord, known, onClose }: { chord: string; known?: Voicing[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [shapes] = useState(() => shapesFor(chord, known));
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<DotMode>('fingers');
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal(); // StrictMode runs effects twice; showModal on an open dialog throws
  }, []);
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-label={`${chord} shapes`}>
      <div className="sheet-head">
        <h2 className="chord-name">{chord}</h2>
        <button type="button" className="btn-ghost" onClick={() => ref.current?.close()}>Close</button>
      </div>
      {shapes.length === 0 ? <p className="muted">No diagram for {chord}.</p> : (
        <>
          <ChordDiagram chord={chord} voicing={shapes[i]} mode={mode} width={180} />
          <div className="row">
            <button type="button" className="round" aria-label="Previous shape" disabled={i === 0} onClick={() => setI(i - 1)}>‹</button>
            <span>Shape {i + 1} of {shapes.length}</span>
            <button type="button" className="round" aria-label="Next shape" disabled={i === shapes.length - 1} onClick={() => setI(i + 1)}>›</button>
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
        </>
      )}
    </dialog>
  );
}
```

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck && npm test`
Expected: clean, with all tests passing.

```bash
git add src/lib/chordLabels.ts src/components tests/app/chordLabels.test.ts
git commit -m "feat(app): SVG chord diagrams with fingers/intervals, voicing sheet, chord chips

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

---

### Task 5: Audio: metronome, drone, chime, and the metronome card

**Files:**
- Create: `src/audio/clock.ts`, `src/audio/metronome.ts`, `src/audio/drone.ts`, `src/audio/useMetronome.ts`, `src/components/Metronome.tsx`
- Test: `tests/app/metronome.test.ts`

**Interfaces:**
- Produces:
  - `audio(): AudioContext`, `blip(when: number, freq: number, dur?: number, gain?: number): void`
  - `scheduleBeats(nextTime, beat, bpm, until, beatsPerBar?): { beats: { time: number; beat: number }[]; nextTime: number; nextBeat: number }`
  - `interface Metronome { readonly running: boolean; start(bpm: number): void; stop(): void; setBpm(bpm: number): void }`; `createMetronome(onBeat: (beat: number) => void): Metronome`
  - `startDrone(tonic: string): () => void`
  - `useMetronome(initial: number): MetronomeControls` where `MetronomeControls = { bpm: number; setBpm(b: number): void; playing: boolean; toggle(): void; beat: number }`; `useDrone(tonic: string | null): void`
  - `<Metronome metro target ladder drone onDrone tonic />`

- [ ] **Step 1: Write the failing test**

```ts
// tests/app/metronome.test.ts
import { describe, expect, it } from 'vitest';
import { scheduleBeats } from '../../src/audio/metronome.ts';

describe('scheduleBeats', () => {
  it('schedules every beat before the horizon at the given tempo', () => {
    const r = scheduleBeats(0, 0, 60, 2.5);
    expect(r.beats).toEqual([{ time: 0, beat: 0 }, { time: 1, beat: 1 }, { time: 2, beat: 2 }]);
    expect(r).toMatchObject({ nextTime: 3, nextBeat: 3 });
  });
  it('wraps the bar and picks up where the last call stopped', () => {
    const r = scheduleBeats(3, 3, 120, 4.1);
    expect(r.beats.map(b => b.beat)).toEqual([3, 0, 1]);
    expect(r.nextTime).toBeCloseTo(4.5);
    expect(r.nextBeat).toBe(2);
  });
  it('schedules nothing when the next beat is past the horizon', () => {
    expect(scheduleBeats(5, 1, 60, 4.9).beats).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run tests/app/metronome.test.ts`
Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement the audio modules**

```ts
// src/audio/clock.ts
let ctx: AudioContext | null = null;

/** The app's single AudioContext, created and resumed on first use (call from a tap: iOS needs a user gesture). */
export function audio(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** A short sine blip at `when` (AudioContext time): metronome clicks and the block-end chime. */
export function blip(when: number, freq: number, dur = 0.05, gain = 0.5): void {
  const ac = audio();
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.frequency.value = freq;
  env.gain.setValueAtTime(gain, when);
  env.gain.exponentialRampToValueAtTime(0.001, when + dur);
  osc.connect(env).connect(ac.destination);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}
```

```ts
// src/audio/metronome.ts
import { audio, blip } from './clock.ts';

/** Beats from `nextTime` up to (not including) `until` at `bpm`, cycling beat numbers through the bar. */
export function scheduleBeats(nextTime: number, beat: number, bpm: number, until: number, beatsPerBar = 4) {
  const spb = 60 / bpm;
  const beats: { time: number; beat: number }[] = [];
  while (nextTime < until) {
    beats.push({ time: nextTime, beat });
    nextTime += spb;
    beat = (beat + 1) % beatsPerBar;
  }
  return { beats, nextTime, nextBeat: beat };
}

export interface Metronome { readonly running: boolean; start(bpm: number): void; stop(): void; setBpm(bpm: number): void }

/** Web Audio metronome: a 25 ms timer schedules clicks 100 ms ahead (sample-accurate); beat 1 is accented. */
export function createMetronome(onBeat: (beat: number) => void): Metronome {
  let timer = 0;
  let bpm = 60;
  let next = 0;
  let beat = 0;
  const tick = () => {
    const ac = audio();
    const r = scheduleBeats(next, beat, bpm, ac.currentTime + 0.1);
    for (const b of r.beats) {
      blip(b.time, b.beat === 0 ? 1600 : 1000);
      window.setTimeout(() => onBeat(b.beat), Math.max(0, (b.time - ac.currentTime) * 1000));
    }
    next = r.nextTime;
    beat = r.nextBeat;
  };
  return {
    get running() { return timer !== 0; },
    start(b) {
      if (timer) return;
      bpm = b;
      next = audio().currentTime + 0.05;
      beat = 0;
      tick();
      timer = window.setInterval(tick, 25);
    },
    stop() { window.clearInterval(timer); timer = 0; },
    setBpm(b) { bpm = b; },
  };
}
```

```ts
// src/audio/drone.ts
import { Note } from 'tonal';
import { audio } from './clock.ts';

/** Starts a soft root + fifth + octave drone on `tonic` (pitch class); returns a stop function that fades it out. */
export function startDrone(tonic: string): () => void {
  const ac = audio();
  const out = ac.createGain();
  out.gain.setValueAtTime(0, ac.currentTime);
  out.gain.linearRampToValueAtTime(0.12, ac.currentTime + 0.5);
  out.connect(ac.destination);
  const oscs = [`${tonic}2`, `${Note.transpose(tonic, '5P')}2`, `${tonic}3`].map(n => {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = Note.freq(n) ?? 110;
    o.connect(out);
    o.start();
    return o;
  });
  return () => {
    const t = ac.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(0, t + 0.4);
    oscs.forEach(o => o.stop(t + 0.45));
  };
}
```

```ts
// src/audio/useMetronome.ts
import { useEffect, useRef, useState } from 'react';
import { startDrone } from './drone.ts';
import { createMetronome, type Metronome } from './metronome.ts';

export interface MetronomeControls { bpm: number; setBpm(b: number): void; playing: boolean; toggle(): void; beat: number }

/** Metronome state for one block; stops when the block unmounts. Tempo is clamped to 30–240. */
export function useMetronome(initial: number): MetronomeControls {
  const [bpm, setBpmState] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(-1);
  const m = useRef<Metronome | null>(null);
  m.current ??= createMetronome(setBeat);
  useEffect(() => () => m.current?.stop(), []);
  return {
    bpm,
    playing,
    beat,
    setBpm(b) {
      const v = Math.min(240, Math.max(30, Math.round(b)));
      setBpmState(v);
      m.current!.setBpm(v);
    },
    toggle() {
      if (m.current!.running) { m.current!.stop(); setPlaying(false); setBeat(-1); }
      else { m.current!.start(bpm); setPlaying(true); }
    },
  };
}

/** Plays a drone on `tonic` while it is non-null; fades out on change or unmount. */
export function useDrone(tonic: string | null): void {
  useEffect(() => (tonic ? startDrone(tonic) : undefined), [tonic]);
}
```

- [ ] **Step 4: Create the metronome card**

```tsx
// src/components/Metronome.tsx
import type { MetronomeControls } from '../audio/useMetronome.ts';

/** Tempo card: ± stepper around a 76 px bpm, ladder chips, beat dots, drone chip, start/stop. */
export function Metronome({ metro, target, ladder, drone, onDrone, tonic }: {
  metro: MetronomeControls; target: number | null; ladder: number[] | null; drone: boolean; onDrone: () => void; tonic: string;
}) {
  return (
    <section className="card metro" aria-label="Metronome">
      <div className="row">
        <button type="button" className="round lg" aria-label="Slower" onClick={() => metro.setBpm(metro.bpm - 1)}>−</button>
        <div className="center">
          <span className="bpm">{metro.bpm}</span>
          <small className="muted">bpm{target !== null ? ` · target ${target}` : ''}</small>
        </div>
        <button type="button" className="round lg" aria-label="Faster" onClick={() => metro.setBpm(metro.bpm + 1)}>+</button>
      </div>
      {ladder && ladder.length > 1 && (
        <div className="ladder" role="group" aria-label="Tempo ladder">
          {ladder.map(v => <button key={v} type="button" aria-pressed={v === metro.bpm} onClick={() => metro.setBpm(v)}>{v}</button>)}
        </div>
      )}
      <div className="row">
        <div className="beats" aria-hidden="true">
          {[0, 1, 2, 3].map(b => <span key={b} className={b === metro.beat ? 'on' : ''} />)}
        </div>
        <button type="button" className="btn-ghost" aria-pressed={drone} onClick={onDrone}>Drone {tonic} · {drone ? 'on' : 'off'}</button>
      </div>
      <button type="button" className="btn-play" aria-pressed={metro.playing} onClick={metro.toggle}>
        {metro.playing ? 'Stop metronome' : 'Start metronome'}
      </button>
    </section>
  );
}
```

- [ ] **Step 5: Verify and commit**

Run: `npx vitest run tests/app/metronome.test.ts && npm run typecheck`
Expected: PASS and clean.

```bash
git add src/audio src/components/Metronome.tsx tests/app/metronome.test.ts
git commit -m "feat(app): lookahead Web Audio metronome, key drone, and the tempo card

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

---

### Task 6: Powder bursts (generator, SVG assets, component)

**Files:**
- Create: `scripts/gen-bursts.ts`, `public/bursts/*.svg` (generated), `src/components/Burst.tsx`
- Test: `tests/scripts/gen-bursts.test.ts`

**Interfaces:**
- Produces:
  - `rng(seed): () => number`, `burstSvg(spec: BurstSpec): string`, `BURSTS: Record<string, BurstSpec>`
  - The keys are `today`, `done`, `block-gold`, `block-pink`, `block-violet`, `block-blue`, `block-teal`, `block-saffron`. `block-<Colour>` matches `BLOCK_META[kind].colour`; `muted` has no burst.
  - `<Burst name variant />`, where `variant` is `'hero' | 'corner' | 'done'`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/scripts/gen-bursts.test.ts
import { describe, expect, it } from 'vitest';
import { BURSTS, burstSvg, rng } from '../../scripts/gen-bursts.ts';

describe('gen-bursts', () => {
  it('is deterministic per seed', () => {
    expect(rng(7)()).toBe(rng(7)());
    expect(rng(7)()).not.toBe(rng(8)());
    expect(burstSvg(BURSTS.today)).toBe(burstSvg(BURSTS.today));
  });
  it('writes standalone SVG with one gradient and five puffs per cloud, and some spray', () => {
    const svg = burstSvg(BURSTS.today);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.match(/<radialGradient /g)).toHaveLength(BURSTS.today.clouds.length);
    expect(svg.match(/<ellipse /g)).toHaveLength(BURSTS.today.clouds.length * 5);
    expect((svg.match(/<circle /g) ?? []).length).toBeGreaterThan(50);
    expect(svg).toContain('feTurbulence');
  });
  it('has a burst for today, done and every block colour except muted', () => {
    expect(Object.keys(BURSTS).sort()).toEqual(
      ['block-blue', 'block-gold', 'block-pink', 'block-saffron', 'block-teal', 'block-violet', 'done', 'today']);
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run tests/scripts/gen-bursts.test.ts`
Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement `scripts/gen-bursts.ts`**

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, isMain } from './vault/lib.ts';

export interface Cloud { cx: number; cy: number; rx: number; ry: number; colour: string; core: string }
export interface BurstSpec { w: number; h: number; seed: number; dots: number; clouds: Cloud[] }

/** Deterministic PRNG (mulberry32) so regenerated bursts are byte-identical. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Standalone powder-cloud SVG: gradient puffs through blur + turbulence + noise-mask, plus a seeded particle spray. */
export function burstSvg({ w, h, seed, dots, clouds }: BurstSpec): string {
  const r = rng(seed);
  const between = (a: number, b: number) => a + (b - a) * r();
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const grads: string[] = [];
  const puffs: string[] = [];
  const spray: string[] = [];
  clouds.forEach((c, i) => {
    grads.push(`<radialGradient id="g${i}"><stop offset="0" stop-color="${c.core}"/><stop offset="0.45" stop-color="${c.colour}" stop-opacity="0.85"/><stop offset="1" stop-color="${c.colour}" stop-opacity="0"/></radialGradient>`);
    puffs.push(`<ellipse cx="${c.cx}" cy="${c.cy}" rx="${c.rx}" ry="${c.ry}" fill="url(#g${i})"/>`);
    for (let k = 0; k < 4; k++) { // satellite puffs make the edge billow instead of forming one blob
      const a = between(0, 2 * Math.PI);
      const d = between(0.5, 0.95);
      puffs.push(`<ellipse cx="${r1(c.cx + Math.cos(a) * c.rx * d)}" cy="${r1(c.cy + Math.sin(a) * c.ry * d)}" rx="${r1(c.rx * between(0.3, 0.5))}" ry="${r1(c.ry * between(0.3, 0.5))}" fill="url(#g${i})" opacity="0.8"/>`);
    }
  });
  for (let k = 0; k < dots; k++) {
    const c = clouds[Math.floor(r() * clouds.length)];
    const a = between(0, 2 * Math.PI);
    const d = Math.abs(1 + 0.45 * gauss()) * 1.2; // spray sits around and beyond the cloud edge
    const x = c.cx + Math.cos(a) * c.rx * d;
    const y = c.cy + Math.sin(a) * c.ry * d;
    const size = [0.6, 0.8, 1, 1, 1.3, 1.7, 2.2][Math.floor(r() * 7)];
    const fill = r() < 0.5 ? c.colour : c.core;
    const opacity = r1(between(0.35, 0.95));
    if (x < 0 || x > w || y < 0 || y > h) continue;
    spray.push(`<circle cx="${r1(x)}" cy="${r1(y)}" r="${size}" fill="${fill}" opacity="${opacity}"/>`);
  }
  const filter = `<filter id="p" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">`
    + `<feGaussianBlur in="SourceGraphic" stdDeviation="10" result="soft"/>`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.014 0.024" numOctaves="4" seed="${seed}" result="warp"/>`
    + `<feDisplacementMap in="soft" in2="warp" scale="95" xChannelSelector="R" yChannelSelector="G" result="wisp"/>`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="${seed + 5}" result="cloud"/>`
    + `<feColorMatrix in="cloud" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -0.75" result="billow"/>`
    + `<feComposite in="wisp" in2="billow" operator="in" result="puffs"/>`
    + `<feComponentTransfer in="wisp" result="haze"><feFuncA type="linear" slope="0.4"/></feComponentTransfer>`
    + `<feMerge><feMergeNode in="haze"/><feMergeNode in="puffs"/></feMerge></filter>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${grads.join('')}${filter}</defs><g filter="url(#p)">${puffs.join('')}</g>${spray.join('')}</svg>\n`;
}

// Burst palette (UI spec §4): [colour, bright core]
const P = {
  gold: ['#FFB627', '#FFE08A'], pink: ['#FF2E97', '#FF8CC6'], violet: ['#9D5CFF', '#C9A6FF'],
  blue: ['#1E7BFF', '#8CC2FF'], teal: ['#14C9B8', '#7FF3E8'], saffron: ['#FF7A1A', '#FFD66B'],
} as const;
type Name = keyof typeof P;
const ORDER: Name[] = ['gold', 'pink', 'violet', 'blue', 'teal', 'saffron'];
const cloud = (cx: number, cy: number, rx: number, ry: number, n: Name): Cloud => ({ cx, cy, rx, ry, colour: P[n][0], core: P[n][1] });

export const BURSTS: Record<string, BurstSpec> = {
  today: { w: 480, h: 360, seed: 3, dots: 190, clouds: [
    cloud(110, 190, 75, 55, 'teal'), cloud(205, 150, 80, 70, 'saffron'), cloud(315, 165, 95, 80, 'pink'),
    cloud(390, 240, 60, 50, 'violet'), cloud(250, 250, 45, 35, 'blue')] },
  done: { w: 500, h: 330, seed: 23, dots: 260, clouds: [
    cloud(95, 170, 80, 60, 'blue'), cloud(185, 150, 75, 70, 'teal'), cloud(255, 120, 80, 75, 'saffron'),
    cloud(355, 150, 95, 80, 'pink'), cloud(440, 200, 60, 50, 'violet')] },
  ...Object.fromEntries(ORDER.map((n, i): [string, BurstSpec] => [`block-${n}`, { w: 260, h: 210, seed: 7 + i, dots: 70, clouds: [
    cloud(120, 100, 55, 45, n), cloud(190, 80, 40, 35, ORDER[(i + 1) % 6]), cloud(170, 150, 35, 28, ORDER[(i + 2) % 6])] }])),
};

if (isMain(import.meta.url)) {
  const dir = join(REPO_ROOT, 'public', 'bursts');
  mkdirSync(dir, { recursive: true });
  for (const [name, spec] of Object.entries(BURSTS)) writeFileSync(join(dir, `${name}.svg`), burstSvg(spec));
  console.log(`wrote ${Object.keys(BURSTS).length} bursts to public/bursts/`);
}
```

- [ ] **Step 4: Run the test, then generate the assets**

Run: `npx vitest run tests/scripts/gen-bursts.test.ts && npm run bursts`
Expected: PASS, then `wrote 8 bursts to public/bursts/`.

- [ ] **Step 5: Create `src/components/Burst.tsx`**

```tsx
/** Decorative powder burst (static SVG from scripts/gen-bursts.ts); hidden from screen readers. */
export function Burst({ name, variant }: { name: string; variant: 'hero' | 'corner' | 'done' }) {
  return <img className={`burst burst-${variant}`} src={`/bursts/${name}.svg`} alt="" />;
}
```

- [ ] **Step 6: Eyeball it, then commit**

Open `public/bursts/today.svg` in a browser. It should look like soft, drifting powder clouds with a fine speckle spray, not solid blobs; compare with the mockup row D.

```bash
git add scripts/gen-bursts.ts public/bursts src/components/Burst.tsx tests/scripts/gen-bursts.test.ts
git commit -m "feat(app): deterministic powder-burst SVGs for the Diwali palette

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

---

### Task 7: API layer, sign-in and the app shell

**Files:**
- Create: `src/lib/api.ts`, `src/screens/SignIn.tsx`, `supabase/templates/magic_link.html`
- Modify: `src/App.tsx` (replace the placeholder), `supabase/config.toml`
- Test: `tests/app/api.test.ts`

**Interfaces:**
- Consumes: `TodayLesson` (Task 2); `Completion`, `flushPending` and `KV` (Task 3); `db`, `SUPABASE_URL` and `ANON_KEY` (Task 1); `localDate` (Task 2).
- Produces:
  - `class ApiError extends Error { status: number }`
  - `GENERATE_TIMEOUT_MS = 120_000`
  - `fetchToday(o: { url: string; anonKey: string; token: string; date: string; storage: KV; fetchFn?: typeof fetch }): Promise<TodayLesson>`
  - `completeLesson(db: Pick<SupabaseClient, 'rpc'>, c: Completion): Promise<void>`
  - `completedDays(db: SupabaseClient, days: string[]): Promise<string[]>`
  - `<SignIn />`
  - `<App />`. Screens come from Tasks 8–10; until then `App` imports only what exists (see Step 6).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/app/api.test.ts
import { describe, expect, it, vi } from 'vitest';
import { ApiError, GENERATE_TIMEOUT_MS, completeLesson, fetchToday } from '../../src/lib/api.ts';
import { memoryKV } from './fixtures.ts';

const ROW = { id: 'L1', lesson_date: '2026-09-29', status: 'planned', plan: {}, content: {} };
const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const base = { url: 'http://api', anonKey: 'anon', token: 'tok', date: '2026-09-29' };

describe('fetchToday', () => {
  it('POSTs the local date with auth, waits up to 120 s, and caches the row', async () => {
    const kv = memoryKV();
    const fetchFn = vi.fn(async () => ok(ROW));
    expect(await fetchToday({ ...base, storage: kv, fetchFn })).toEqual(ROW);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api/functions/v1/generate-lesson');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ date: '2026-09-29' });
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(GENERATE_TIMEOUT_MS).toBe(120_000);
    expect(JSON.parse(kv.getItem('gc.lesson')!)).toEqual({ date: '2026-09-29', lesson: ROW });
  });

  it('serves the cached copy for the same date when the network fails', async () => {
    const kv = memoryKV();
    kv.setItem('gc.lesson', JSON.stringify({ date: '2026-09-29', lesson: ROW }));
    const fetchFn = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    expect(await fetchToday({ ...base, storage: kv, fetchFn })).toEqual(ROW);
  });

  it("never serves yesterday's copy", async () => {
    const kv = memoryKV();
    kv.setItem('gc.lesson', JSON.stringify({ date: '2026-09-28', lesson: ROW }));
    await expect(fetchToday({ ...base, storage: kv, fetchFn: async () => { throw new TypeError('offline'); } }))
      .rejects.toThrow('offline');
  });

  it('throws ApiError with the server message, and a 401 ignores the cache', async () => {
    const kv = memoryKV();
    kv.setItem('gc.lesson', JSON.stringify({ date: '2026-09-29', lesson: ROW }));
    const err = await fetchToday({ ...base, storage: kv, fetchFn: async () => ok({ error: 'not signed in' }, 401) }).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, message: 'not signed in' });
    // a 500 falls back to today's cached copy
    expect(await fetchToday({ ...base, storage: kv, fetchFn: async () => ok({ error: 'boom' }, 500) })).toEqual(ROW);
  });
});

describe('completeLesson', () => {
  const c = { lessonId: 'L1', logs: [], confidence: 4, wantMoreTime: true, notes: 'thumb' };
  it('calls complete_lesson with the mapped params', async () => {
    const rpc = vi.fn(async () => ({ error: null }));
    await completeLesson({ rpc } as never, c);
    expect(rpc).toHaveBeenCalledWith('complete_lesson', {
      p_lesson_id: 'L1', p_logs: [], p_confidence: 4, p_want_more_time: true, p_notes: 'thumb' });
  });
  it('throws on failure so the caller can queue it, but drops a lesson that no longer exists', async () => {
    await expect(completeLesson({ rpc: async () => ({ error: { code: '08006', message: 'offline' } }) } as never, c)).rejects.toBeTruthy();
    await expect(completeLesson({ rpc: async () => ({ error: { code: 'P0002', message: 'lesson not found' } }) } as never, c)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `npx vitest run tests/app/api.test.ts`
Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement `src/lib/api.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TodayLesson } from './lesson.ts';
import type { Completion } from './pending.ts';
import type { KV } from './session.ts';

/** An HTTP error from an edge function, carrying its status. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

/** generate-lesson can take 22–100 s on first open; allow a little more (Phase 2 handoff). */
export const GENERATE_TIMEOUT_MS = 120_000;
const CACHE = 'gc.lesson';

/** Today's lesson from generate-lesson (created on first open), kept as the offline copy; falls back to today's copy on failure. */
export async function fetchToday(o: {
  url: string; anonKey: string; token: string; date: string; storage: KV; fetchFn?: typeof fetch;
}): Promise<TodayLesson> {
  const f = o.fetchFn ?? fetch;
  try {
    const res = await f(`${o.url}/functions/v1/generate-lesson`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${o.token}`, apikey: o.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: o.date }),
      signal: AbortSignal.timeout(GENERATE_TIMEOUT_MS),
    });
    const body = await res.json().catch(() => ({})) as TodayLesson & { error?: string };
    if (!res.ok) throw new ApiError(body.error ?? `HTTP ${res.status}`, res.status);
    o.storage.setItem(CACHE, JSON.stringify({ date: o.date, lesson: body }));
    return body;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw e;
    try {
      const cached = JSON.parse(o.storage.getItem(CACHE) ?? 'null') as { date: string; lesson: TodayLesson } | null;
      if (cached?.date === o.date) return cached.lesson;
    } catch { /* corrupt cache: report the original error */ }
    throw e;
  }
}

/** Calls complete_lesson(); throws so the caller can queue it, except for a lesson that no longer exists (dropped). */
export async function completeLesson(db: Pick<SupabaseClient, 'rpc'>, c: Completion): Promise<void> {
  const { error } = await db.rpc('complete_lesson', {
    p_lesson_id: c.lessonId, p_logs: c.logs, p_confidence: c.confidence, p_want_more_time: c.wantMoreTime, p_notes: c.notes,
  });
  if (error && error.code !== 'P0002') throw error;
}

/** Which of `days` (YYYY-MM-DD, ascending) have a completed lesson. */
export async function completedDays(db: SupabaseClient, days: string[]): Promise<string[]> {
  const { data, error } = await db.from('lessons').select('lesson_date')
    .eq('status', 'completed').gte('lesson_date', days[0]).lte('lesson_date', days[days.length - 1]);
  if (error) throw error;
  return (data ?? []).map(r => r.lesson_date as string);
}
```

- [ ] **Step 4: Run the tests and check they pass**

Run: `npx vitest run tests/app/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Sign-in email with the link and a code**

An installed iOS PWA can't receive a magic-link session, because Safari and the PWA have separate storage. The email therefore carries a 6-digit code as well. Create `supabase/templates/magic_link.html`:

```html
<h2>Sign in to Guitar Coach</h2>
<p><a href="{{ .ConfirmationURL }}">Open Guitar Coach</a></p>
<p>Or type this code in the app: <strong style="font-size:24px;letter-spacing:4px">{{ .Token }}</strong></p>
```

Add to `supabase/config.toml` (near the other `[auth.email]` settings):

```toml
[auth.email.template.magic_link]
subject = "Your Guitar Coach sign-in"
content_path = "./supabase/templates/magic_link.html"
```

Run `supabase stop && supabase start`.

- [ ] **Step 6: Create `src/screens/SignIn.tsx` and the real `src/App.tsx`**

```tsx
// src/screens/SignIn.tsx
import { type FormEvent, useState } from 'react';
import { Burst } from '../components/Burst.tsx';
import { db } from '../lib/supabase.ts';

/** Email sign-in: sends a link and a 6-digit code (the code works inside an installed PWA). No new accounts. */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await db.auth.signInWithOtp({
      email: email.trim(), options: { emailRedirectTo: location.origin, shouldCreateUser: false },
    });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await db.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(error.message); // success: App's auth listener switches screens
  };
  return (
    <main className="screen">
      <Burst name="today" variant="hero" />
      <div style={{ height: 160 }} />
      <h1 className="title">Guitar Coach</h1>
      {!sent ? (
        <form className="stack-sm" onSubmit={send}>
          <label className="stack-sm">Email
            <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <button className="btn-primary" disabled={busy}>Email me a sign-in code</button>
        </form>
      ) : (
        <form className="stack-sm" onSubmit={verify}>
          <p className="text-2">Check your email. Tap the link, or type the 6-digit code here.</p>
          <label className="stack-sm">Code
            <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required value={code} onChange={e => setCode(e.target.value)} />
          </label>
          <button className="btn-primary" disabled={busy}>Sign in</button>
        </form>
      )}
      {error && <p role="alert" className="gold-text">{error}</p>}
    </main>
  );
}
```

```tsx
// src/App.tsx
import type { Session as AuthSession } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Burst } from './components/Burst.tsx';
import { ApiError, completeLesson, fetchToday } from './lib/api.ts';
import { localDate } from './lib/dates.ts';
import type { TodayLesson } from './lib/lesson.ts';
import { flushPending } from './lib/pending.ts';
import { ANON_KEY, SUPABASE_URL, db } from './lib/supabase.ts';
import { SignIn } from './screens/SignIn.tsx';
// Task 8–10 imports (add as each screen lands):
// import { Today } from './screens/Today.tsx';
// import { Player } from './screens/Player.tsx';
// import { Done } from './screens/Done.tsx';

/** Auth gate → flush queued completions → today's lesson → Today / Player / Done. */
export function App() {
  const [auth, setAuth] = useState<AuthSession | null | undefined>(undefined);
  const [lesson, setLesson] = useState<TodayLesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<'today' | 'player' | 'done'>('today');
  const [take, setTake] = useState<string | null>(null);
  const token = useRef<string | undefined>(undefined);
  token.current = auth?.access_token;

  useEffect(() => {
    void db.auth.getSession().then(({ data }) => setAuth(data.session));
    const { data } = db.auth.onAuthStateChange((_event, s) => setAuth(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = auth?.user.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void (async () => {
      await flushPending(localStorage, c => completeLesson(db, c)); // spec §11: retry on the next open
      try {
        const l = await fetchToday({ url: SUPABASE_URL, anonKey: ANON_KEY, token: token.current!, date: localDate(), storage: localStorage });
        if (live) setLesson(l);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await db.auth.signOut();
        else if (live) setError((e as Error).message);
      }
    })();
    return () => { live = false; };
  }, [userId]);

  const finish = useCallback(() => setScreen('done'), []); // used by the Player (Task 9); `take` by Done (Task 10)

  if (auth === undefined) return <main className="screen" />;
  if (auth === null) return <SignIn />;
  if (error) {
    return (
      <main className="screen">
        <h1 className="title title-sm">Couldn't load today's lesson</h1>
        <p className="text-2">{error}</p>
        <div className="spacer" />
        <button type="button" className="btn-primary" onClick={() => location.reload()}>Try again</button>
      </main>
    );
  }
  if (!lesson) {
    return (
      <main className="screen">
        <Burst name="today" variant="hero" />
        <div style={{ height: 200 }} />
        <h1 className="title title-sm">Writing today's lesson…</h1>
        <p className="text-2">The first open of the day can take up to a minute.</p>
      </main>
    );
  }
  return <main className="screen"><h1 className="title">{lesson.content.title}</h1></main>; // replaced in Task 8
}
```

- [ ] **Step 7: Verify sign-in end to end (local)**

1. Run `supabase functions serve` in one terminal and `npm run dev` in another.
2. Open http://127.0.0.1:5173 and enter `66Fishmarket@gmail.com`.
3. Open Inbucket at http://127.0.0.1:55324. The email should show both the link and the 6-digit code.
4. Type the code. Expected: "Writing today's lesson…", then today's lesson title.
5. Reload the page. It should stay signed in, and the title should appear quickly because the row already exists.
6. Try an unknown email. Expected: an error, and no account is created.

- [ ] **Step 8: Verify and commit**

Run: `npm run typecheck && npm test`

```bash
git add src/lib/api.ts src/screens/SignIn.tsx src/App.tsx supabase/templates supabase/config.toml tests/app/api.test.ts
git commit -m "feat(app): today's lesson fetch with offline copy, complete_lesson call, email code sign-in

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

---

### Task 8: Today screen

**Files:**
- Create: `src/screens/Today.tsx`
- Modify: `src/App.tsx` (render `<Today>`)

**Interfaces:**
- Consumes: `TodayLesson`, `BLOCK_META` (Task 2); `weekDays` (Task 2); `ugSearchUrl` (Task 2); `loadSession` (Task 3); `completedDays` (Task 7); `db` (Task 1); `<Burst>` (Task 6).
- Produces: `<Today lesson onStart />`.

- [ ] **Step 1: Create `src/screens/Today.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Burst } from '../components/Burst.tsx';
import { completedDays } from '../lib/api.ts';
import { weekDays } from '../lib/dates.ts';
import { BLOCK_META, type TodayLesson } from '../lib/lesson.ts';
import { loadSession } from '../lib/session.ts';
import { db } from '../lib/supabase.ts';
import { ugSearchUrl } from '../lib/ug.ts';

/** Today: what the session holds and one Start (or Resume / Done for today) button. */
export function Today({ lesson, onStart }: { lesson: TodayLesson; onStart: () => void }) {
  const { plan, content } = lesson;
  const days = weekDays(lesson.lesson_date);
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => {
    completedDays(db, days).then(setDone).catch(() => setDone([])); // offline: dots stay empty
  }, [lesson.lesson_date, lesson.status]); // `days` derives from lesson_date
  const resumeAt = loadSession(localStorage, lesson.id, Date.now()).index;
  const minutes = Math.round(plan.blocks.reduce((t, b) => t + b.minutes, 0));
  const finished = lesson.status === 'completed';
  const dateLabel = new Date(`${lesson.lesson_date}T12:00:00`)
    .toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <main className="screen">
      <Burst name="today" variant="hero" />
      <header className="stack-sm">
        <span className="text-2">{dateLabel}</span>
        <div className="dots" aria-label={`Practised ${done.length} day${done.length === 1 ? '' : 's'} this week`}>
          {days.map(d => (
            <span key={d} className={`dot${done.includes(d) ? ' on' : ''}${d === lesson.lesson_date ? ' today' : ''}`} />
          ))}
          <small className="muted">{done.length} this week</small>
        </div>
      </header>
      <div style={{ height: 40 }} />
      <section className="stack-sm">
        <span className="pill">{plan.track.replaceAll('_', ' ')} · new skill</span>
        <h1 className="title">{content.title}</h1>
        <p className="text-2">{content.why_it_matters}</p>
      </section>
      <section className="list" aria-label="Today's blocks">
        {plan.blocks.map((b, k) => b.kind === 'reset' ? null : (
          <div key={k} className="list-row">
            <span className="swatch" style={{ background: `var(--${BLOCK_META[b.kind].colour})` }} />
            <span style={{ flex: 1 }}>{BLOCK_META[b.kind].label}</span>
            <span className="mono muted">{Math.round(b.minutes)}′</span>
          </div>
        ))}
      </section>
      <details className="card">
        <summary>Why it works</summary>
        <p className="text-2">{content.theory_card}</p>
      </details>
      {content.songs.length > 0 && (
        <section className="stack-sm" aria-label="Hear it in songs">
          <h2 className="label">Hear it in songs</h2>
          {content.songs.map(s => (
            <a key={`${s.title}-${s.artist}`} className="song" href={ugSearchUrl(s.title, s.artist)} target="_blank" rel="noreferrer">
              <span className="stack-sm" style={{ gap: 0 }}>
                <b>{s.title}</b>
                <small className="muted">{s.artist}{s.capo ? ` · capo ${s.capo}` : ''}</small>
              </span>
              <span className="gold-text">Tab ↗</span>
            </a>
          ))}
        </section>
      )}
      <div className="spacer" />
      <button type="button" className="btn-primary" disabled={finished} onClick={onStart}>
        {finished ? 'Done for today ✓' : resumeAt > 0 ? `Resume · block ${resumeAt + 1}` : `Start · ${minutes} min`}
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Wire it into `src/App.tsx`**

Uncomment `import { Today } from './screens/Today.tsx';` and replace the last `return` with:

```tsx
  return <Today lesson={lesson} onStart={() => setScreen('player')} />;
```

- [ ] **Step 3: Verify in the browser**

Run `npm run dev` and use DevTools at a 390×844 viewport. Check:
- the date and 7 dots, with today ringed;
- the pink track pill and the title;
- the block list with a colour dot and minutes for each block, and no Reset row;
- "Why it works" opens;
- each song opens a UG search in a new tab;
- the button reads "Start · 30 min".

There should be no horizontal scroll at 360 px width.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Today.tsx src/App.tsx
git commit -m "feat(app): Today screen with week dots, blocks, theory card and UG song links

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

---

### Task 9: Player (Stage layout, chord panel, recorder, keys, wake lock)

**Files:**
- Create: `src/lib/wakeLock.ts`, `src/components/Rail.tsx`, `src/components/ChordPanel.tsx`, `src/components/Recorder.tsx`, `src/screens/Player.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes:
  - from Tasks 2–6: `BLOCK_META`, `bpmTarget`, `startBpm`, `tonicOf`, `refLabel`, `tempoLadder`, `keyAction`, `clock`;
  - `loadSession`, `saveSession`, `goTo`, `logVerdict`, `slotsFor`, `Session`, `Log`;
  - `ChordText`, `VoicingSheet`, `ChordDiagram`, `ModeToggle`, `Metronome`, `useMetronome`, `useDrone`, `audio`, `blip`, `Burst`.
- Produces:
  - `useWakeLock(active: boolean): void`
  - `<Rail blocks index progress />`, `<ChordPanel chords voicings onShapes />`, `<Recorder onTake />`
  - `<Player lesson onFinish onTake />`. It calls `onFinish()` once every block is passed; `onTake(url)` fires for each recorded take.

- [ ] **Step 1: Create the small pieces**

```ts
// src/lib/wakeLock.ts
import { useEffect } from 'react';

/** Keeps the screen on while `active` (the phone sits on a music stand); re-acquires after the tab returns. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = () => navigator.wakeLock.request('screen')
      .then(l => { if (stopped) void l.release(); else lock = l; })
      .catch(() => { /* denied or unsupported: the screen may dim */ });
    const onVisible = () => { if (document.visibilityState === 'visible') void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopped = true; document.removeEventListener('visibilitychange', onVisible); void lock?.release(); };
  }, [active]);
}
```

```tsx
// src/components/Rail.tsx
import type { BlockKind } from '../../supabase/functions/_shared/engine/types.ts';
import { BLOCK_META } from '../lib/lesson.ts';

/** Session progress: one segment per block, sized by minutes, in the block's colour; the current one fills with time. */
export function Rail({ blocks, index, progress }: { blocks: { kind: BlockKind; minutes: number }[]; index: number; progress: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className="rail" role="progressbar" aria-label="Session progress" aria-valuemin={1} aria-valuemax={blocks.length} aria-valuenow={index + 1}>
      {blocks.map((b, k) => {
        const c = BLOCK_META[b.kind].colour;
        const full = `var(--${c})`;
        const dim = `var(--${c}-dim)`;
        const background = k < index ? full : k > index ? dim : `linear-gradient(90deg, ${full} 0 ${pct}%, ${dim} ${pct}% 100%)`;
        return <span key={k} style={{ flexGrow: b.minutes, background }} />;
      })}
    </div>
  );
}
```

```tsx
// src/components/ChordPanel.tsx
import { useState } from 'react';
import type { Voicing } from '../../supabase/functions/_shared/engine/music.ts';
import type { DotMode } from '../lib/chordLabels.ts';
import { ChordDiagram, ModeToggle } from './ChordDiagram.tsx';

/** Progression blocks: the current chord large, the next chord, tappable progression chips (Instrument layout). */
export function ChordPanel({ chords, voicings, onShapes }: {
  chords: string[]; voicings: Record<string, Voicing[]>; onShapes: (chord: string) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<DotMode>('fingers');
  if (chords.length === 0) return null;
  const cur = chords[idx];
  const next = chords[(idx + 1) % chords.length];
  const v = voicings[cur]?.[0];
  return (
    <>
      <section className="card panel" aria-label="Chords">
        <div className="panel-chord">
          <h2 className="chord-name">{cur}</h2>
          {v ? <ChordDiagram chord={cur} voicing={v} mode={mode} width={150} /> : <p className="muted">No diagram</p>}
        </div>
        <div className="panel-side">
          <div className="next"><small className="muted">NEXT</small><span className="chord-name c-text">{next}</span></div>
          <ModeToggle mode={mode} onChange={setMode} />
          <small className="muted">Marigold = the root.</small>
          <button type="button" className="btn-ghost" onClick={() => onShapes(cur)}>Other shapes ›</button>
        </div>
      </section>
      <div className="prog" role="group" aria-label="Progression">
        {chords.map((c, k) => <button key={k} type="button" aria-pressed={k === idx} onClick={() => setIdx(k)}>{c}</button>)}
      </div>
    </>
  );
}
```

```tsx
// src/components/Recorder.tsx
import { useState } from 'react';

/** Record and listen back with MediaRecorder. The take stays in this tab's memory and is never uploaded. */
export function Recorder({ onTake }: { onTake: (url: string) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = e => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const u = URL.createObjectURL(new Blob(chunks, { type: r.mimeType }));
        setUrl(u); onTake(u); setRec(null);
      };
      r.start();
      setRec(r); setError(null);
    } catch {
      setError('Microphone blocked. Allow it in your browser settings, then try again.');
    }
  };
  return (
    <section className="card" aria-label="Recorder">
      <button type="button" className="btn-play" aria-pressed={rec !== null} onClick={() => (rec ? rec.stop() : void start())}>
        {rec ? 'Stop recording' : url ? 'Record again' : 'Record a take'}
      </button>
      {url && <audio controls src={url} />}
      {error && <p role="alert" className="gold-text">{error}</p>}
    </section>
  );
}
```

- [ ] **Step 2: Create `src/screens/Player.tsx`**

```tsx
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { audio, blip } from '../audio/clock.ts';
import { useDrone, useMetronome } from '../audio/useMetronome.ts';
import { Burst } from '../components/Burst.tsx';
import { ChordPanel } from '../components/ChordPanel.tsx';
import { ChordText } from '../components/ChordText.tsx';
import { Metronome } from '../components/Metronome.tsx';
import { Rail } from '../components/Rail.tsx';
import { Recorder } from '../components/Recorder.tsx';
import { VoicingSheet } from '../components/VoicingSheet.tsx';
import { clock } from '../lib/dates.ts';
import { keyAction } from '../lib/keys.ts';
import { tempoLadder } from '../lib/ladder.ts';
import { BLOCK_META, bpmTarget, refLabel, startBpm, tonicOf, type TodayLesson } from '../lib/lesson.ts';
import { goTo, loadSession, logVerdict, saveSession, slotsFor, type Log, type Session } from '../lib/session.ts';
import { useWakeLock } from '../lib/wakeLock.ts';

/** The block-by-block player. Saves on every change, so a reload resumes the same block with its verdicts. */
export function Player({ lesson, onFinish, onTake }: { lesson: TodayLesson; onFinish: () => void; onTake: (url: string) => void }) {
  const count = lesson.plan.blocks.length;
  const [s, setS] = useState(() => loadSession(localStorage, lesson.id, Date.now()));
  useEffect(() => saveSession(localStorage, s), [s]);
  useEffect(() => { if (s.index >= count) onFinish(); }, [s.index, count, onFinish]);
  useWakeLock(true);
  if (s.index >= count) return null;
  return (
    <BlockView
      key={s.index} // fresh metronome, timer and step per block
      lesson={lesson}
      session={s}
      onLog={log => setS(x => logVerdict(x, log))}
      onMove={to => setS(x => goTo(x, to, count, Date.now()))}
      onTake={onTake}
    />
  );
}

function useSecondsLeft(total: number, since: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return Math.round(total - (now - since) / 1000);
}

function BlockView({ lesson, session, onLog, onMove, onTake }: {
  lesson: TodayLesson; session: Session; onLog: (l: Log) => void; onMove: (to: number) => void; onTake: (url: string) => void;
}) {
  const { plan, content } = lesson;
  const i = session.index;
  const block = plan.blocks[i];
  const text = content.blocks[i];
  const meta = BLOCK_META[block.kind];
  const target = bpmTarget(plan, i);
  const first = startBpm(plan, i);
  const hasMetro = !['reset', 'create', 'record'].includes(block.kind);
  const slots = slotsFor(plan, i);
  const steps = text?.instructions.length ? text.instructions : [''];
  const tonic = tonicOf(plan.key);

  const metro = useMetronome(first);
  const [drone, setDrone] = useState(false);
  useDrone(drone ? tonic : null);
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState<string | null>(null);
  const total = block.minutes * 60;
  const left = useSecondsLeft(total, session.blockStartedAt);
  const chimed = useRef(left <= 0);
  useEffect(() => {
    if (left <= 0 && !chimed.current) { chimed.current = true; blip(audio().currentTime, 880, 0.35, 0.4); }
  }, [left]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = keyAction(e.key, (e.target as HTMLElement | null)?.tagName);
      if (!action) return;
      e.preventDefault();
      if (action === 'toggle' && hasMetro) metro.toggle();
      if (action === 'next') onMove(i + 1);
      if (action === 'prev') onMove(i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // re-bound every render so it sees the current metronome state

  const logged = (ref: string | null) => session.logs.find(l => l.block_index === i && l.item_ref === ref)?.passed;
  const verdict = (ref: string | null, passed: boolean) => onLog({
    block_index: i, block_kind: block.kind, item_ref: ref, passed, value_reached: target !== null ? metro.bpm : null, note: null,
  });
  const decide = (passed: boolean) => { verdict(slots[0], passed); onMove(i + 1); };
  const passLabel = target !== null ? `Clean at ${metro.bpm}` : block.kind === 'record' ? 'Take done' : 'Clean';

  return (
    <main className="screen" style={{ '--c': `var(--${meta.colour})`, '--c-dim': `var(--${meta.colour}-dim)` } as CSSProperties}>
      {meta.colour !== 'muted' && <Burst name={`block-${meta.colour}`} variant="corner" />}
      <Rail blocks={plan.blocks} index={i} progress={1 - left / total} />
      <div className="status">
        <span className="c-text">{i + 1} of {plan.blocks.length} · {meta.label}</span>
        <span className={left < 0 ? 'timer over' : 'timer'} role="timer" aria-label="Block time left">{clock(left)}</span>
      </div>
      <h1 className="title title-sm">{text?.target_text || meta.label}</h1>

      <section className="card step" aria-live="polite">
        <div className="step-text">
          <small className="muted">Step {step + 1} of {steps.length}</small>
          <p><ChordText text={steps[step]} onChord={setSheet} /></p>
        </div>
        <button type="button" className="round" aria-label="Previous step" disabled={step === 0} onClick={() => setStep(step - 1)}>‹</button>
        <button type="button" className="round" aria-label="Next step" disabled={step === steps.length - 1} onClick={() => setStep(step + 1)}>›</button>
      </section>

      {block.kind === 'apply' && <ChordPanel chords={plan.music.progression.chords} voicings={plan.music.voicings} onShapes={setSheet} />}
      {block.kind === 'create' && <section className="card"><p><ChordText text={content.create_prompt} onChord={setSheet} /></p></section>}
      {block.kind === 'record' && <Recorder onTake={onTake} />}
      {hasMetro && (
        <Metronome metro={metro} target={target} ladder={target !== null ? tempoLadder(first, target) : null}
          drone={drone} onDrone={() => setDrone(!drone)} tonic={tonic} />
      )}
      {(text?.tips || text?.explanation) && (
        <details className="card">
          <summary>Tips &amp; why</summary>
          {text.tips && <p>{text.tips}</p>}
          {text.explanation && <p className="text-2">{text.explanation}</p>}
        </details>
      )}

      <div className="spacer" />
      {block.kind === 'reset' ? (
        <button type="button" className="btn-primary" onClick={() => onMove(i + 1)}>Next block</button>
      ) : slots.length > 1 ? (
        <>
          <section className="list" aria-label="Review items">
            {slots.map(ref => (
              <div key={ref} className="list-row">
                <span style={{ flex: 1 }}>{refLabel(ref ?? '')}</span>
                <button type="button" className="btn-ghost" aria-pressed={logged(ref) === false} onClick={() => verdict(ref, false)}>Not yet</button>
                <button type="button" className="btn-ghost" aria-pressed={logged(ref) === true} onClick={() => verdict(ref, true)}>Clean</button>
              </div>
            ))}
          </section>
          <button type="button" className="btn-primary" onClick={() => onMove(i + 1)}>Next block</button>
        </>
      ) : (
        <div className="verdict">
          <button type="button" aria-pressed={logged(slots[0]) === false} onClick={() => decide(false)}>Not yet</button>
          <button type="button" className="pass" aria-pressed={logged(slots[0]) === true} onClick={() => decide(true)}>{passLabel}</button>
        </div>
      )}
      <nav className="row" aria-label="Block navigation">
        <button type="button" className="btn-ghost" disabled={i === 0} onClick={() => onMove(i - 1)}>‹ Back</button>
        <button type="button" className="btn-ghost" onClick={() => onMove(i + 1)}>Skip ›</button>
      </nav>
      {sheet && <VoicingSheet chord={sheet} known={plan.music.voicings[sheet]} onClose={() => setSheet(null)} />}
    </main>
  );
}
```

- [ ] **Step 3: Wire it into `src/App.tsx`**

1. Uncomment the `Player` import.
2. Just above the `Today` return, add:

```tsx
  if (screen === 'player') return <Player lesson={lesson} onFinish={finish} onTake={setTake} />;
```

- [ ] **Step 4: Verify in the browser**

Use a phone viewport (390×844) with `supabase functions serve` and `npm run dev` running, then tap Start. Check each item:

1. **Status and title:** the rail shows 6 segments in block colours. The status shows "1 of 6 · Warm-up" in marigold, the timer counts down, and the title is the target text or the block label.
2. **Steps:** the ‹ › buttons move through the steps. A `{G}` chip opens the voicing sheet ("Shape 1 of N", Fingers/Intervals toggle), and Close returns you to the block.
3. **Metronome:**
   - − and + change the tempo; Start plays clicks with beat 1 accented and a pulsing dot.
   - The drone chip plays a soft drone in the key and stops when you move blocks.
   - **Space** starts and stops the metronome; **→ / ←** move between blocks.
4. **New skill:** ladder chips 39 · 46 · 53 · 60. "Clean at 53" logs the verdict and moves on.
5. **Apply:** the chord panel shows a big G, NEXT C, and G C G D chips that switch the diagram. Intervals mode shows R/3/5.
6. **Record:** the microphone prompt appears; you can record, stop and play back.
7. **Reload mid-session:** Resume lands on the same block.
8. **Screen stays on:** leave a block for 2 minutes. On Android Chrome the screen does not dim.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wakeLock.ts src/components src/screens/Player.tsx src/App.tsx
git commit -m "feat(app): block player with rail, steps, chord panel, metronome, recorder, pedal keys, wake lock

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

---

### Task 10: Done screen and completion

**Files:**
- Create: `src/screens/Done.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `loadSession`, `clearSession`, `summary`, `blockResult` (Task 3); `queueCompletion`, `Completion` (Task 3); `completeLesson` (Task 7); `BLOCK_META` (Task 2); `<Burst>` (Task 6); `db` (Task 1).
- Produces: `<Done lesson take onSaved />`. It calls `onSaved()` after the save succeeds, or after the user acknowledges that it was queued.

- [ ] **Step 1: Create `src/screens/Done.tsx`**

```tsx
import { useState } from 'react';
import { Burst } from '../components/Burst.tsx';
import { completeLesson } from '../lib/api.ts';
import { BLOCK_META, type TodayLesson } from '../lib/lesson.ts';
import { queueCompletion, type Completion } from '../lib/pending.ts';
import { blockResult, clearSession, loadSession, summary } from '../lib/session.ts';
import { db } from '../lib/supabase.ts';

/** Session done: real numbers, a result per block, the take with a 1–5 rating, one fix for tomorrow, then save. */
export function Done({ lesson, take, onSaved }: { lesson: TodayLesson; take: string | null; onSaved: () => void }) {
  const [s] = useState(() => loadSession(localStorage, lesson.id, Date.now()));
  const [sum] = useState(() => summary(s, Date.now()));
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [more, setMore] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'queued'>('idle');

  const save = async () => {
    const c: Completion = { lessonId: lesson.id, logs: s.logs, confidence: rating, wantMoreTime: more, notes: notes.trim() || null };
    setState('saving');
    try {
      await completeLesson(db, c);
      clearSession(localStorage, lesson.id);
      onSaved();
    } catch {
      queueCompletion(localStorage, c); // spec §11: nothing is lost; retried on the next open
      clearSession(localStorage, lesson.id);
      setState('queued');
    }
  };

  return (
    <main className="screen">
      <Burst name="done" variant="done" />
      <div style={{ height: 150 }} />
      <h1 className="title">Session done</h1>
      <div className="stats">
        {sum.bestBpm !== null && <div className="stat"><b style={{ color: 'var(--pink)' }}>{sum.bestBpm}</b><small>bpm reached</small></div>}
        <div className="stat"><b style={{ color: 'var(--teal)' }}>{sum.clean}/{sum.rated}</b><small>clean</small></div>
        <div className="stat"><b style={{ color: 'var(--gold)' }}>{sum.minutes}′</b><small>practised</small></div>
      </div>
      <section className="list" aria-label="Results">
        {lesson.plan.blocks.map((b, k) => b.kind === 'reset' ? null : (
          <div key={k} className="list-row">
            <span className="swatch" style={{ background: `var(--${BLOCK_META[b.kind].colour})` }} />
            <span style={{ flex: 1 }}>{BLOCK_META[b.kind].label}</span>
            <span className="text-2">{blockResult(s, k)}</span>
          </div>
        ))}
      </section>
      <section className="card" aria-label="Today's take">
        {take ? <audio controls src={take} /> : <p className="muted">No take recorded today.</p>}
        <div className="rating" role="group" aria-label="Rate today's session">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" aria-label={`${n} of 5`} aria-pressed={rating !== null && n <= rating} onClick={() => setRating(n)}>{n}</button>
          ))}
        </div>
        <label className="stack-sm">Fix tomorrow
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="One thing to fix" />
        </label>
        <label className="check">
          <input type="checkbox" checked={more} onChange={e => setMore(e.target.checked)} />
          I need more time on today's new skill
        </label>
      </section>
      <div className="spacer" />
      {state === 'queued' ? (
        <>
          <p role="status" className="text-2">Saved on this phone. It will sync next time you open the app.</p>
          <button type="button" className="btn-primary" onClick={onSaved}>Back to Today</button>
        </>
      ) : (
        <button type="button" className="btn-primary" disabled={state === 'saving'} onClick={() => void save()}>Save &amp; finish</button>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Wire it into `src/App.tsx`**

Uncomment the `Done` import and add this above the `player` line:

```tsx
  if (screen === 'done') {
    return <Done lesson={lesson} take={take} onSaved={() => { setLesson({ ...lesson, status: 'completed' }); setScreen('today'); }} />;
  }
```

- [ ] **Step 3: End-to-end check against the local DB**

1. Finish every block. The Done screen should show the stats, the results list and the take.
2. Rate 4, type a fix, and tap Save & finish. You should land back on Today with the button reading "Done for today ✓" and today's dot filled.
3. Confirm the completion reached the server:

```bash
docker exec supabase_db_musiclessons psql -U postgres -At -c "select status, confidence, notes from lessons where lesson_date = current_date; select count(*) from exercise_logs e join lessons l on l.id = e.lesson_id where l.lesson_date = current_date;"
```
Expected: `completed|4|<your note>` and a log count ≥ 1.

4. **Offline path:**
   1. Reset today with `update lessons set status='planned' where lesson_date=current_date; delete from exercise_logs where lesson_id in (select id from lessons where lesson_date=current_date);`.
   2. Reload and go through to Done.
   3. In DevTools → Network, choose Offline, then tap Save & finish. You should see "Saved on this phone…".
   4. Go back online and reload. The row should now be `completed`, and `localStorage['gc.pending']` should be gone.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Done.tsx src/App.tsx
git commit -m "feat(app): Done screen with real numbers, rating, fix-tomorrow, and offline-safe completion

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

---

### Task 11: Skill guides and the picking-pattern engine (roles, tuning-aware)

**Why:** each lesson needs an "About this skill" explanation (e.g. *what is a Giuliani arpeggio?*). Fingerstyle skills also need their picking pattern as data the app can draw and play.

**Design rule (user, 2026-09-29):** music logic is computed from semitones. So a pattern names **roles**, not strings:
- the thumb plays `bass` (the lowest string sounding the root) and `alt` (the alternate bass: the 5th if it sits below the treble strings, else another chord tone there, else the lowest treble string);
- the fingers play `t1` / `t2` / `t3`, the highest, second-highest and third-highest sounding strings.

The roles are resolved against any voicing in any tuning. The voicings still come from `chords-db` in Phase 3; the instrument-agnostic chord generator is a later phase (spec §14). `noteAt` gains an optional `tuning` argument (default standard), so tunings become data only.

**Files:**
- Modify: `supabase/functions/_shared/engine/music.ts` (`noteAt` gains an optional tuning; add `TUNINGS`)
- Create: `supabase/functions/_shared/engine/patterns.ts`, `supabase/functions/_shared/engine/skillGuides.ts`, `src/lib/skillInfo.ts`
- Test: `tests/engine/patterns.test.ts`, `tests/app/skillInfo.test.ts`

**Interfaces:**
- Produces:
  - `TUNINGS` (standard, dropD, dadgad, openD, openG; low → high, with octaves); `noteAt(string, fret, tuning = TUNING)`
  - `type Finger = 'p' | 'i' | 'm' | 'a'`; `type Role = 'bass' | 'alt' | 't1' | 't2' | 't3'`
  - `interface PickPattern { id: string; name: string; beatsPerBar: 3 | 4; stepsPerBeat: 1 | 2 | 3; steps: { finger: Finger; role: Role }[][] }`
  - `PATTERNS: Record<string, PickPattern>`, `SKILL_PATTERNS: Record<string, string[]>`
  - `interface PickNote { finger: Finger; role: Role; string: number; note: string; interval: string }` (`note` includes its octave, e.g. `G2`; `interval` is from the chord root: `R`, `3`, `5`…)
  - `voiceRoles(v, chord, tuning?): Record<Role, number>` (string index per role, 0 = lowest string); `resolvePattern(p, v, chord, tuning?): PickNote[][]`
  - `interface SkillGuide { what: string; how: string[]; listenFor: string }`, `SKILL_GUIDES: Record<string, SkillGuide>`
  - `skillInfo(id): { skill: Skill; guide: SkillGuide | null; patterns: PickPattern[] } | null`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/engine/patterns.test.ts
import { describe, expect, it } from 'vitest';
import { TUNINGS, noteAt } from '../../supabase/functions/_shared/engine/music.ts';
import { PATTERNS, SKILL_PATTERNS, resolvePattern, voiceRoles } from '../../supabase/functions/_shared/engine/patterns.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';

const G = { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], barres: [] };
const C = { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], barres: [] };
const D = { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], barres: [] };

describe('noteAt with tunings', () => {
  it('defaults to standard and counts semitones from any tuning', () => {
    expect(noteAt(0, 3)).toBe('G');
    expect(noteAt(0, 0, TUNINGS.dropD)).toBe('D');
    expect(noteAt(4, 0, TUNINGS.dadgad)).toBe('A');
    expect(noteAt(3, 4, TUNINGS.openD)).toBe('A#');
  });
});

describe('voiceRoles', () => {
  it('puts the thumb on the root and the fifth, fingers on the top three strings (G)', () => {
    expect(voiceRoles(G, 'G')).toEqual({ bass: 0, alt: 2, t1: 5, t2: 4, t3: 3 });
  });
  it('uses another chord tone for the alternate bass when the fifth sits in the treble (C: 4th string E)', () => {
    expect(voiceRoles(C, 'C')).toEqual({ bass: 1, alt: 2, t1: 5, t2: 4, t3: 3 });
  });
  it('shares the lowest treble string when there is no room below it (D: 4th and 3rd)', () => {
    expect(voiceRoles(D, 'D')).toEqual({ bass: 2, alt: 3, t1: 5, t2: 4, t3: 3 });
  });
  it('resolves the same roles in DADGAD from semitones alone (open Dsus4)', () => {
    expect(voiceRoles({ frets: [0, 0, 0, 0, 0, 0], fingers: [0, 0, 0, 0, 0, 0], barres: [] }, 'Dsus4', TUNINGS.dadgad))
      .toEqual({ bass: 0, alt: 1, t1: 5, t2: 4, t3: 3 });
  });
});

describe('resolvePattern', () => {
  it('turns roles into strings, pitches and intervals', () => {
    const steps = resolvePattern(PATTERNS.giuliani_pima, G, 'G');
    expect(steps[0]).toEqual([{ finger: 'p', role: 'bass', string: 0, note: 'G2', interval: 'R' }]);
    expect(steps[1]).toEqual([{ finger: 'i', role: 't3', string: 3, note: 'G3', interval: 'R' }]);
    expect(steps[2]).toEqual([{ finger: 'm', role: 't2', string: 4, note: 'B3', interval: '3' }]);
    expect(steps[3]).toEqual([{ finger: 'a', role: 't1', string: 5, note: 'G4', interval: 'R' }]);
  });
  it('plays the Travis alternate bass on the fifth', () => {
    expect(resolvePattern(PATTERNS.travis, G, 'G')[2]).toEqual([{ finger: 'p', role: 'alt', string: 2, note: 'D3', interval: '5' }]);
  });
});

describe('pattern library', () => {
  it('fills exactly one bar per pattern', () => {
    for (const p of Object.values(PATTERNS)) expect(p.steps.length, p.id).toBe(p.beatsPerBar * p.stepsPerBeat);
  });
  it('maps every fingerstyle skill to known patterns', () => {
    for (const s of SKILLS.filter(x => x.track === 'fingerstyle')) {
      expect(SKILL_PATTERNS[s.id]?.length, s.id).toBeGreaterThan(0);
      for (const id of SKILL_PATTERNS[s.id]) expect(PATTERNS[id], id).toBeDefined();
    }
  });
});
```

```ts
// tests/app/skillInfo.test.ts
import { describe, expect, it } from 'vitest';
import { skillInfo } from '../../src/lib/skillInfo.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';

describe('skillInfo', () => {
  it('joins the skill, its guide and its patterns', () => {
    const info = skillInfo('fingerstyle.l1.giuliani_arpeggios')!;
    expect(info.skill.name).toBe('Arpeggio patterns');
    expect(info.guide?.what).toMatch(/Giuliani/);
    expect(info.patterns.map(p => p.id)).toEqual(['giuliani_pim', 'giuliani_pmi', 'giuliani_pimi', 'giuliani_pima']);
  });
  it('has a guide for every fingerstyle skill', () => {
    for (const s of SKILLS.filter(x => x.track === 'fingerstyle')) expect(skillInfo(s.id)?.guide, s.id).not.toBeNull();
  });
  it('returns the bare skill when no guide is written yet, and null for unknown ids', () => {
    const r = skillInfo('theory.l1.intervals')!;
    expect(r.skill.id).toBe('theory.l1.intervals');
    expect(r.guide).toBeNull();
    expect(r.patterns).toEqual([]);
    expect(skillInfo('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `npx vitest run tests/engine/patterns.test.ts tests/app/skillInfo.test.ts`
Expected: FAIL, because `TUNINGS`, `patterns.ts` and `skillInfo.ts` are missing.

- [ ] **Step 3: Make `noteAt` tuning-aware (`music.ts`)**

Replace the `noteAt` function and add `TUNINGS` right after `TUNING`. Existing callers keep working because the argument is optional.

```ts
/** Named tunings, low → high string, with octaves. Everything downstream is semitone maths from these. */
export const TUNINGS = {
  standard: TUNING,
  dropD: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  dadgad: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'],
  openD: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'],
  openG: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'],
} satisfies Record<string, readonly string[]>;

/** Pitch class sounding at a string (0 = lowest) and fret, in the given tuning (default standard). */
export function noteAt(string: number, fret: number, tuning: readonly string[] = TUNING): string {
  return Note.pitchClass(Note.transpose(tuning[string], Interval.fromSemitones(fret)));
}
```

- [ ] **Step 4: Create `supabase/functions/_shared/engine/patterns.ts`**

```ts
import { Chord, Interval, Note } from 'tonal';
import { TUNING, noteAt, type Voicing } from './music.ts';

export type Finger = 'p' | 'i' | 'm' | 'a';
/** bass = lowest root string; alt = alternate bass; t1/t2/t3 = highest, second- and third-highest sounding strings. */
export type Role = 'bass' | 'alt' | 't1' | 't2' | 't3';
export interface PickPattern {
  id: string; name: string; beatsPerBar: 3 | 4; stepsPerBeat: 1 | 2 | 3;
  /** One entry per step; several notes in a step sound together (a pinch); [] is a rest. */
  steps: { finger: Finger; role: Role }[][];
}
export interface PickNote { finger: Finger; role: Role; string: number; note: string; interval: string }

const DEGREE = ['R', 'b9', '9', 'b3', '3', '4', 'b5', '5', '#5', '6', 'b7', '7'];
const n = (finger: Finger, role: Role) => ({ finger, role });
const P = n('p', 'bass'), PA = n('p', 'alt'), I = n('i', 't3'), M = n('m', 't2'), A = n('a', 't1');
const I2 = n('i', 't2'), M1 = n('m', 't1');
const bar = (cell: PickPattern['steps'], times: number): PickPattern['steps'] => Array.from({ length: times }, () => cell).flat();

/** Picking-hand patterns in teaching order (Giuliani Op.1, thumb independence, Travis, accompaniment families). */
export const PATTERNS: Record<string, PickPattern> = {
  giuliani_pim: { id: 'giuliani_pim', name: 'p-i-m', beatsPerBar: 4, stepsPerBeat: 3, steps: bar([[P], [I], [M]], 4) },
  giuliani_pmi: { id: 'giuliani_pmi', name: 'p-m-i', beatsPerBar: 4, stepsPerBeat: 3, steps: bar([[P], [M], [I]], 4) },
  giuliani_pimi: { id: 'giuliani_pimi', name: 'p-i-m-i', beatsPerBar: 4, stepsPerBeat: 2, steps: bar([[P], [I], [M], [I]], 2) },
  giuliani_pima: { id: 'giuliani_pima', name: 'p-i-m-a', beatsPerBar: 4, stepsPerBeat: 2, steps: bar([[P], [I], [M], [A]], 2) },
  pinch: { id: 'pinch', name: 'Pinch and pluck', beatsPerBar: 4, stepsPerBeat: 1, steps: [[P, A], [I], [PA, M], [I]] },
  thumb_steady: { id: 'thumb_steady', name: 'Steady thumb', beatsPerBar: 4, stepsPerBeat: 1, steps: bar([[P]], 4) },
  thumb_alt: { id: 'thumb_alt', name: 'Alternating thumb', beatsPerBar: 4, stepsPerBeat: 1, steps: bar([[P], [PA]], 2) },
  travis: { id: 'travis', name: 'Travis', beatsPerBar: 4, stepsPerBeat: 2, steps: [[P, M1], [], [PA], [I2], [P], [M1], [PA], [I2]] },
  ballad: { id: 'ballad', name: 'Ballad p-i-m-a-m-i', beatsPerBar: 3, stepsPerBeat: 2, steps: [[P], [I], [M], [A], [M], [I]] },
  waltz: { id: 'waltz', name: 'Waltz boom-chuck-chuck', beatsPerBar: 3, stepsPerBeat: 1, steps: [[P], [I, M, A], [I, M, A]] },
};

/** Which patterns each fingerstyle skill practises, easiest first. */
export const SKILL_PATTERNS: Record<string, string[]> = {
  'fingerstyle.l1.pima_pinches': ['giuliani_pima', 'pinch'],
  'fingerstyle.l1.giuliani_arpeggios': ['giuliani_pim', 'giuliani_pmi', 'giuliani_pimi', 'giuliani_pima'],
  'fingerstyle.l2.thumb_single_bass': ['thumb_steady'],
  'fingerstyle.l2.alternating_thumb': ['thumb_alt'],
  'fingerstyle.l3.travis_basic': ['thumb_alt', 'travis'],
  'fingerstyle.l3.travis_changes': ['travis'],
  'fingerstyle.l4.accompaniment_patterns': ['ballad', 'waltz', 'travis'],
  'fingerstyle.l4.sing_over_pattern': ['thumb_alt', 'ballad', 'travis'],
  'fingerstyle.l5.melody_over_thumb': ['thumb_steady', 'thumb_alt'],
  'fingerstyle.l5.arrange_own_song': ['travis', 'ballad'],
};

/** String index (0 = lowest) for each role on this voicing, worked out from semitones in the given tuning. */
export function voiceRoles(v: Voicing, chord: string, tuning: readonly string[] = TUNING): Record<Role, number> {
  const tonic = Chord.get(chord).tonic;
  const root = tonic ? Note.chroma(tonic) : undefined;
  const sounding = v.frets.flatMap((f, s) => (f >= 0 ? [s] : []));
  const iv = (s: number) => (root === undefined ? -1 : (Note.chroma(noteAt(s, v.frets[s], tuning))! - root + 12) % 12);
  const [t1, t2, t3] = [...sounding].reverse();
  const bass = sounding.find(s => iv(s) === 0) ?? sounding[0];
  const below = sounding.filter(s => s > bass && s < t3);
  const alt = below.find(s => iv(s) === 7) ?? below[0] ?? t3;
  return { bass, alt, t1, t2, t3 };
}

/** Each step of a pattern on this chord shape: finger, role, string, pitch with octave, and interval from the root. */
export function resolvePattern(p: PickPattern, v: Voicing, chord: string, tuning: readonly string[] = TUNING): PickNote[][] {
  const roles = voiceRoles(v, chord, tuning);
  const tonic = Chord.get(chord).tonic;
  return p.steps.map(step => step.map(({ finger, role }) => {
    const string = roles[role];
    const note = Note.transpose(tuning[string], Interval.fromSemitones(Math.max(0, v.frets[string])));
    const interval = tonic ? DEGREE[(Note.chroma(note)! - Note.chroma(tonic)! + 12) % 12] : '';
    return { finger, role, string, note, interval };
  }));
}
```

- [ ] **Step 5: Create `supabase/functions/_shared/engine/skillGuides.ts`**

The content is promoted by hand from `Music_Lessons Vault/Research/guitar_methods/`: `giuliani_120_pima`, `travis_emmanuel_thumbstyle`, `claim_thumb_autopilot_first`. Guides for the other tracks come in a later content pass (spec §14).

```ts
export interface SkillGuide { what: string; how: string[]; listenFor: string }

/** Hand-written explainers per skill ("About this skill"), promoted from Music_Lessons Vault/Research. */
export const SKILL_GUIDES: Record<string, SkillGuide> = {
  'fingerstyle.l1.pima_pinches': {
    what: 'PIMA names the picking-hand fingers from the Spanish: p (pulgar, thumb), i (índice), m (medio), a (anular). Each finger owns a string: the thumb covers the bass strings, i-m-a sit on the top three. A pinch plays the thumb and a finger at the same instant, which is how a bass note and a melody note line up.',
    how: ['Rest i, m and a on the top three strings, thumb on the bass note of the chord.', 'Pluck from the knuckle, not the wrist; the hand stays still.', 'Pinch: thumb and a together, then i, then m. Keep the pinch notes exactly together.'],
    listenFor: 'Both notes of each pinch landing as one sound, and every string at the same volume.',
  },
  'fingerstyle.l1.giuliani_arpeggios': {
    what: "Mauro Giuliani's 120 Right-Hand Studies (Op. 1, 1812) hold one simple chord still and cycle the picking hand through arpeggio patterns: three-finger ones first (p-i-m, p-m-i), then a repeated finger (p-i-m-i), then all four (p-i-m-a). Freezing the fretting hand puts all your attention on the picking hand, so each finger learns its own string and its own volume. It is the classical foundation under almost every fingerpicked accompaniment.",
    how: ['Thumb (p) plays the bass note of the chord; i, m and a play the top three strings.', 'Hold a two-chord loop you already own (G–D or C–G7) so the fretting hand needs no thought.', 'Start the first pattern at the start tempo; move to the next only when every note is even.', 'Climb the tempo ladder one rung at a time; drop a rung after two misses in a row.'],
    listenFor: 'Even volume across all four fingers, and the bass note ringing under the treble.',
  },
  'fingerstyle.l2.thumb_single_bass': {
    what: "The thumb plays one bass string on every beat, dead steady, while the fingers stay out of it. Tommy Emmanuel teaches this before anything else, and has even taped students' fingers down, because a thumb that runs by itself is what later frees the fingers and the voice.",
    how: ['Thumb on the root string of the chord, one note per beat.', 'Rest the side of the picking hand lightly on the bridge to palm-mute the bass a little.', 'Talk or count out loud while it runs; the thumb must not drift.'],
    listenFor: 'Identical spacing and volume on every beat for two full minutes.',
  },
  'fingerstyle.l2.alternating_thumb': {
    what: 'The thumb alternates between the root and a second bass note, usually the fifth, on every beat. It is the engine of Travis picking and most folk accompaniment: a walking bass line from one hand.',
    how: ['Root on beats 1 and 3, the alternate bass note on beats 2 and 4.', 'The app picks the alternate string from the chord: the fifth if it sits below the treble strings, otherwise the nearest chord tone.', 'Fingers stay off until two minutes run without a stumble.'],
    listenFor: 'A steady boom-boom bass with no gaps when the thumb changes string.',
  },
  'fingerstyle.l3.travis_basic': {
    what: 'Travis picking (after Merle Travis, refined by Chet Atkins and Tommy Emmanuel) keeps the alternating thumb on every beat and adds treble notes between the thumb beats, often starting with a pinch on beat 1. The result sounds like bass and a second guitar at once.',
    how: ['Get the alternating thumb automatic first.', 'Pinch the root with the middle finger on the top string on beat 1.', 'Fill the "and" of beats 2, 3 and 4 with index and middle on the top two strings.', 'Keep the bass lightly palm-muted so the treble sits on top.'],
    listenFor: 'The thumb never waits for the fingers; the treble notes fall exactly between the bass notes.',
  },
  'fingerstyle.l3.travis_changes': {
    what: 'The same Travis pattern carried through chord changes without the bass stopping. The thumb re-targets to the new root and alternate note on the change; the pattern itself does not change.',
    how: ['Know where the root and alternate bass move for each chord before playing.', 'Change the fretting hand a beat early if needed; the thumb keeps time.', 'Loop two chords, then the whole progression.'],
    listenFor: 'An unbroken bass line across every chord change.',
  },
  'fingerstyle.l4.accompaniment_patterns': {
    what: 'The pattern families that carry most fingerpicked songs: the ballad arpeggio (p-i-m-a-m-i), the 3/4 waltz (bass then two chord plucks), Travis, and finger-strumming with a thumb bass. Knowing several lets the song choose the pattern, not the other way round.',
    how: ['Play each family over the same progression.', 'Match the pattern to the feel: waltz for 3/4, ballad for slow 4/4, Travis for driving folk.', 'Keep the thumb on the chord roots whatever the fingers do.'],
    listenFor: 'Each pattern keeping its own feel at the same tempo.',
  },
  'fingerstyle.l4.sing_over_pattern': {
    what: 'Singing over a fingerstyle pattern only works once the pattern is automatic. The ladder is hum, then speak the lyric in rhythm, then sing, and you only climb a rung when the hands do not falter.',
    how: ['Run the pattern for two minutes while humming one note.', 'Speak the lyric in rhythm over it.', 'Sing it. If the hands stumble, drop back a rung.'],
    listenFor: 'The picking staying identical when the voice comes in.',
  },
  'fingerstyle.l5.melody_over_thumb': {
    what: 'A melody or fill played on the top strings while the thumb keeps the bass going underneath: a whole arrangement from one guitar.',
    how: ['Thumb on steady or alternating bass first.', 'Add the melody notes on the top strings, on the beat at first, then between beats.', 'Keep fills to one per four bars inside a song.'],
    listenFor: 'The bass carrying on untouched under every melody note.',
  },
  'fingerstyle.l5.arrange_own_song': {
    what: 'A fingerstyle arrangement of one of your own songs: choose a pattern family, place the bass on the roots, and put melody or fills on top. A capo or drop D tuning is allowed if it makes the shapes sit better.',
    how: ["Pick the pattern family that fits the song's feel.", 'Map the bass roots for every chord.', 'Record a full take and listen back for balance between voice and guitar.'],
    listenFor: 'The guitar supporting the voice, never competing with it.',
  },
};
```

- [ ] **Step 6: Create `src/lib/skillInfo.ts`**

```ts
import { PATTERNS, SKILL_PATTERNS, type PickPattern } from '../../supabase/functions/_shared/engine/patterns.ts';
import { SKILL_GUIDES, type SkillGuide } from '../../supabase/functions/_shared/engine/skillGuides.ts';
import type { Skill } from '../../supabase/functions/_shared/engine/types.ts';
import { SKILLS } from '../../supabase/seed/curriculum.ts';

/** Everything the "About this skill" sheet shows: the curriculum row, its guide (if written) and its picking patterns. */
export function skillInfo(id: string): { skill: Skill; guide: SkillGuide | null; patterns: PickPattern[] } | null {
  const skill = SKILLS.find(s => s.id === id);
  if (!skill) return null;
  return { skill, guide: SKILL_GUIDES[id] ?? null, patterns: (SKILL_PATTERNS[id] ?? []).map(p => PATTERNS[p]) };
}
```

- [ ] **Step 7: Run the tests and check they pass**

Run: `npx vitest run tests/engine tests/app && npm run typecheck`
Expected: PASS. The existing `tests/engine/music.test.ts` is unchanged and still green.

If a `voiceRoles` case differs, check it by hand from semitones before touching the test. Example: DADGAD open = D A D G A D, and Dsus4 = D G A. So bass = 0 (D), treble = strings 5, 4, 3, the strings between are 1 (A = 5th) and 2, so alt = 1.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/engine src/lib/skillInfo.ts tests/engine/patterns.test.ts tests/app/skillInfo.test.ts
git commit -m "feat(engine): role-based, tuning-aware picking patterns and fingerstyle skill guides

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

---

### Task 12: "About this skill" sheet and the animated picking pattern

**Files:**
- Modify: `src/audio/clock.ts` (add `pluck`), `src/screens/Today.tsx`, `src/screens/Player.tsx`, `src/theme.css`
- Create: `src/components/PickingPattern.tsx`, `src/components/SkillSheet.tsx`

**Interfaces:**
- Consumes: `skillInfo`, `resolvePattern`, `PickPattern` (Task 11); `audio` (Task 5); `Voicing`.
- Produces:
  - `pluck(when: number, freq: number): void`
  - `<PickingPattern pattern chord voicing bpm />`: a tab-style view with the high string on top and one column per step. Finger dots are coloured p = gold, i = pink, m = teal, a = violet. Play moves a playhead through the bar at `bpm` and plucks each note at its real pitch.
  - `<SkillSheet skillId chord voicing bpm onClose />`

- [ ] **Step 1: Add `pluck` to `src/audio/clock.ts`**

```ts
/** A short plucked-string tone at `when`: triangle wave, fast attack, 0.6 s decay. */
export function pluck(when: number, freq: number): void {
  const ac = audio();
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(0.3, when + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, when + 0.6);
  osc.connect(env).connect(ac.destination);
  osc.start(when);
  osc.stop(when + 0.65);
}
```

- [ ] **Step 2: Create `src/components/PickingPattern.tsx`**

```tsx
import { Note } from 'tonal';
import { useEffect, useMemo, useState } from 'react';
import type { Voicing } from '../../supabase/functions/_shared/engine/music.ts';
import { resolvePattern, type PickPattern } from '../../supabase/functions/_shared/engine/patterns.ts';
import { audio, pluck } from '../audio/clock.ts';

const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
const FINGER_CLASS = { p: 'pk-p', i: 'pk-i', m: 'pk-m', a: 'pk-a' } as const;
const SUB: Record<number, string[]> = { 1: [''], 2: ['', '&'], 3: ['', 'tri', 'let'] };

/** Animated picking pattern: finger dots light up in order on a tab-style string view, each note plucked at its pitch. */
export function PickingPattern({ pattern, chord, voicing, bpm }: { pattern: PickPattern; chord: string; voicing: Voicing; bpm: number }) {
  const steps = useMemo(() => resolvePattern(pattern, voicing, chord), [pattern, voicing, chord]);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(-1);
  const stepMs = 60_000 / bpm / pattern.stepsPerBeat;

  useEffect(() => {
    if (!playing) { setPos(-1); return; }
    let k = 0;
    const play = () => {
      const i = k % steps.length;
      setPos(i);
      const t = audio().currentTime;
      for (const n of steps[i]) pluck(t, Note.freq(n.note) ?? 220);
      k++;
    };
    play();
    const timer = window.setInterval(play, stepMs);
    return () => window.clearInterval(timer);
  }, [playing, steps, stepMs]);

  const W = 44 + steps.length * 30;
  const X = (col: number) => 44 + col * 30 + 15;
  const Y = (string: number) => 16 + (5 - string) * 24; // tab view: high e on top
  const label = steps.map(s => s.map(n => `${n.finger} on ${STRING_NAMES[n.string]} (${n.interval})`).join(' + ') || 'rest').join(', ');
  return (
    <section className="card" aria-label={`${pattern.name} picking pattern on ${chord}`}>
      <div className="row"><b>{pattern.name}</b><small className="muted">{chord} · {bpm} bpm</small></div>
      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={170} viewBox={`0 0 ${W} 170`} role="img" aria-label={label}>
          {pos >= 0 && <rect x={X(pos) - 13} y={4} width={26} height={140} rx={8} className="pk-head" />}
          {[0, 1, 2, 3, 4, 5].map(s => (
            <g key={s}>
              <text x={8} y={Y(s)} className="pk-name">{STRING_NAMES[s]}</text>
              <text x={26} y={Y(s)} className="pk-fret">{voicing.frets[s] < 0 ? '×' : voicing.frets[s]}</text>
              <line x1={40} x2={W - 4} y1={Y(s)} y2={Y(s)} className="pk-string" />
            </g>
          ))}
          {steps.map((step, col) => step.map(n => (
            <g key={`${col}-${n.string}`} className={pos === col ? 'pk-on' : ''}>
              <circle cx={X(col)} cy={Y(n.string)} r={11} className={`pk-dot ${FINGER_CLASS[n.finger]}`} />
              <text x={X(col)} y={Y(n.string) + 1} className="pk-finger">{n.finger}</text>
            </g>
          )))}
          {steps.map((_, col) => (
            <text key={col} x={X(col)} y={162} className="pk-count">
              {col % pattern.stepsPerBeat === 0 ? col / pattern.stepsPerBeat + 1 : SUB[pattern.stepsPerBeat][col % pattern.stepsPerBeat]}
            </text>
          ))}
        </svg>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>p thumb · i index · m middle · a ring. The thumb takes the root and the alternate bass; the fingers take the top chord tones.</p>
      <button type="button" className="btn-play" aria-pressed={playing} onClick={() => setPlaying(!playing)}>
        {playing ? 'Stop' : 'Play the pattern'}
      </button>
    </section>
  );
}
```

Add to `src/theme.css`:

```css
.pk-string { stroke: var(--muted); stroke-width: 1.5; opacity: 0.6; }
.pk-name { fill: var(--muted); font: 600 12px 'IBM Plex Sans', sans-serif; dominant-baseline: central; }
.pk-fret { fill: var(--text-2); font: 500 11px 'IBM Plex Mono', monospace; dominant-baseline: central; }
.pk-head { fill: var(--surface-2); }
.pk-dot { opacity: 0.5; transition: opacity 80ms; }
.pk-on .pk-dot { opacity: 1; }
.pk-p { fill: var(--gold); } .pk-i { fill: var(--pink); } .pk-m { fill: var(--teal); } .pk-a { fill: var(--violet); }
.pk-finger { fill: var(--bg); font: 800 12px 'IBM Plex Sans', sans-serif; text-anchor: middle; dominant-baseline: central; }
.pk-count { fill: var(--muted); font: 500 11px 'IBM Plex Mono', monospace; text-anchor: middle; }
.sheet-tall { max-height: 90dvh; overflow-y: auto; }
.sheet-tall[open] { align-items: stretch; }
@media (prefers-reduced-motion: reduce) { .pk-dot { transition: none; } }
```

- [ ] **Step 3: Create `src/components/SkillSheet.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import type { Voicing } from '../../supabase/functions/_shared/engine/music.ts';
import { skillInfo } from '../lib/skillInfo.ts';
import { PickingPattern } from './PickingPattern.tsx';

/** "About this skill": what it is, how to practise it, what to listen for, and its animated picking patterns. */
export function SkillSheet({ skillId, chord, voicing, bpm, onClose }: {
  skillId: string; chord: string; voicing: Voicing | undefined; bpm: number; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pi, setPi] = useState(0);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); }, []);
  const info = skillInfo(skillId);
  if (!info) return null;
  const { skill, guide, patterns } = info;
  return (
    <dialog ref={ref} className="sheet sheet-tall" onClose={onClose} aria-label={`About ${skill.name}`}>
      <div className="sheet-head">
        <small className="muted">{skill.track.replaceAll('_', ' ')} · level {skill.level}</small>
        <button type="button" className="btn-ghost" onClick={() => ref.current?.close()}>Close</button>
      </div>
      <h2 className="title title-sm">{skill.name}</h2>
      <p className="text-2">{guide?.what ?? skill.description}</p>
      {guide ? (
        <>
          <h3 className="label">How to practise</h3>
          <ol className="stack-sm" style={{ margin: 0, paddingLeft: 20 }}>{guide.how.map(h => <li key={h}>{h}</li>)}</ol>
          <p><b>Listen for:</b> <span className="text-2">{guide.listenFor}</span></p>
        </>
      ) : (
        <p className="muted">A fuller guide for this skill is on the way. The block's "Tips &amp; why" has today's notes.</p>
      )}
      {patterns.length > 0 && voicing && (
        <>
          {patterns.length > 1 && (
            <div className="toggle" role="group" aria-label="Pattern">
              {patterns.map((p, k) => <button key={p.id} type="button" aria-pressed={k === pi} onClick={() => setPi(k)}>{p.name}</button>)}
            </div>
          )}
          <PickingPattern key={patterns[pi].id} pattern={patterns[pi]} chord={chord} voicing={voicing} bpm={bpm} />
        </>
      )}
    </dialog>
  );
}
```

- [ ] **Step 4: Wire it into Today and the Player**

In `src/screens/Today.tsx`:
1. Import `SkillSheet` and add `const [about, setAbout] = useState(false);` next to the other state.
2. Under the `why_it_matters` paragraph, add:

```tsx
        <button type="button" className="btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setAbout(true)}>About this skill ›</button>
```
3. Before `</main>`, add:
```tsx
      {about && (
        <SkillSheet skillId={plan.skill_id} chord={plan.music.progression.chords[0]}
          voicing={plan.music.voicings[plan.music.progression.chords[0]]?.[0]}
          bpm={plan.blocks.find(b => b.kind === 'new_skill')?.items[0]?.target?.start ?? 60}
          onClose={() => setAbout(false)} />
      )}
```

In `src/screens/Player.tsx` (`BlockView`):
1. Import `skillInfo`, `PickingPattern` and `SkillSheet`.
2. Next to the other `useState` calls, so the hook order stays fixed, add:

```tsx
  const [about, setAbout] = useState(false);
```
3. With the other derived values, add:
```tsx
  const skillId = block.kind === 'retest' ? plan.retest?.skill_id : ['new_skill', 'apply'].includes(block.kind) ? plan.skill_id : undefined;
  const firstChord = plan.music.progression.chords[0];
  const firstVoicing = plan.music.voicings[firstChord]?.[0];
  const pattern = skillId ? skillInfo(skillId)?.patterns[0] : undefined;
```
4. Under the `<h1>`, add:
```tsx
      {skillId && <button type="button" className="btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setAbout(true)}>About this skill ›</button>}
```
5. Just above the `Metronome`, add the inline pattern (it follows the metronome tempo):
```tsx
      {pattern && firstVoicing && <PickingPattern pattern={pattern} chord={firstChord} voicing={firstVoicing} bpm={metro.bpm} />}
```
6. Next to the voicing sheet, add:
```tsx
      {about && skillId && <SkillSheet skillId={skillId} chord={firstChord} voicing={firstVoicing} bpm={metro.bpm} onClose={() => setAbout(false)} />}
```

- [ ] **Step 5: Verify in the browser**

On today's Giuliani lesson:
1. Today → "About this skill ›" opens: Arpeggio patterns, the Giuliani explanation, How to practise, Listen for, and chips p-i-m / p-m-i / p-i-m-i / p-i-m-a.
2. "Play the pattern" moves the playhead across the bar. On G with p-i-m-a, the dots light up in order: the gold p on the low E (G2, R), pink i on G (G3), teal m on B (B3), violet a on high e (G4). You hear each of those pitches. Switching chips changes the pattern.
3. In the Player's new-skill block, the inline pattern card follows the tempo as you press − or +.
4. With reduced motion turned on in the OS, the dots stop fading but the playhead still steps.

- [ ] **Step 6: Commit**

```bash
git add src/audio/clock.ts src/components/PickingPattern.tsx src/components/SkillSheet.tsx src/screens src/theme.css
git commit -m "feat(app): About this skill sheet and animated, audible picking patterns

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

---

### Task 13: PWA (installable, works offline)

**Files:**
- Modify: `package.json`, `vite.config.ts`
- Create: `public/icon.svg`

**Interfaces:**
- Produces: a service worker and manifest from `vite-plugin-pwa`. The offline lesson copy already exists from Task 7 (`gc.lesson`).

- [ ] **Step 1: Install**

```bash
npm install -D vite-plugin-pwa@^1.3.0
```

- [ ] **Step 2: Create `public/icon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#140B1F"/>
  <circle cx="190" cy="220" r="120" fill="#FF3D8B" opacity="0.85"/>
  <circle cx="320" cy="200" r="100" fill="#FFB627" opacity="0.85"/>
  <circle cx="280" cy="320" r="95" fill="#14C9B8" opacity="0.85"/>
  <text x="256" y="300" text-anchor="middle" font-family="Georgia, serif" font-size="210" font-weight="700" fill="#FBF4EA">G</text>
</svg>
```

- [ ] **Step 3: Update `vite.config.ts`**

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'bursts/*.svg'],
      manifest: {
        name: 'Guitar Coach',
        short_name: 'Guitar Coach',
        description: 'Daily guitar practice for a singer-songwriter accompanist.',
        theme_color: '#140B1F',
        background_color: '#140B1F',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // the chunk carrying chords-db is ~300 KB; headroom
        runtimeCaching: [{
          urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
          handler: 'CacheFirst',
          options: { cacheName: 'fonts', expiration: { maxEntries: 20 } },
        }],
      },
    }),
  ],
});
```

- [ ] **Step 4: Verify with a production build**

```bash
npm run build && npm run preview
```

Open http://127.0.0.1:5173 in Chrome.
- **DevTools → Application → Manifest:** there should be no installability errors. If Chrome asks for PNG icons, run `npx @vite-pwa/assets-generator --preset minimal-2023 public/icon.svg` once. That is a one-off command, not a dependency. Then add the generated `pwa-192x192.png` and `pwa-512x512.png` to `manifest.icons`.
- **Service Workers:** one should be activated.
- **Offline:** sign in and load today, then set Network to Offline and reload. The app shell and today's lesson should still appear (from `gc.lesson`), and the Player should work.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts public/icon.svg
git commit -m "feat(app): installable PWA with offline shell and font caching

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

---

### Task 14: Local end-to-end pass, vault sync and handoff notes

**Files:**
- Modify: `README.md` (if anything drifted)
- Create: `docs/SESSION_HANDOFF_2026-09-29.md`

- [ ] **Step 1: Full test run**

```bash
npm run typecheck && npm test && npm run test:db && npm run build
```
Expected: everything passes. There are 157 existing unit tests plus the new `tests/app/*` and `tests/scripts/gen-bursts.test.ts`.

- [ ] **Step 2: Phone check on the local network (optional, 10 min)**

1. Temporarily run `npx vite --host 0.0.0.0` and open `http://<PC LAN IP>:5173` on the phone.
2. Sign-in redirects will point at 127.0.0.1, so use the **code** from Inbucket.
3. Play one block with the phone on the music stand. Check that the tempo number and timer are readable at arm's length and that the screen stays awake.

- [ ] **Step 3: Vault sync**

Run: `npm run vault:sync`
Expected: `Codebase/_actions/` gains `screen` action hubs for `src/screens/*`.

- [ ] **Step 4: Write the handoff**

Write `docs/SESSION_HANDOFF_2026-09-29.md` in the same shape as `SESSION_HANDOFF_2026-09-28b.md`: what was built, the design decisions, known gaps, and what's next (Task 15 deploy, Phase 4).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/SESSION_HANDOFF_2026-09-29.md
git commit -m "docs: Phase 3 handoff

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

---

### Task 15: Deploy (hosted Supabase + Netlify). **Ask the user at every gate**

**Files:**
- Create: `netlify.toml`

Every step marked **ASK** needs an explicit yes from the user in the conversation first. Do not batch these asks.

- [ ] **Step 1: `netlify.toml` (commit on dev; no ask needed)**

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "24"
```

```bash
git add netlify.toml && git commit -m "chore: Netlify build config

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BsxF15yCGFvAGAgAc6SMZC"
```

- [ ] **Step 2: ASK, then pause the idle `4n4l-engine` Supabase project.** The free plan allows 2 active projects, and the user confirmed on 2026-09-28 that 4n4l-engine is unused. Pause it only after the user says yes in this session.

- [ ] **Step 3: ASK, then create the hosted project `musiclessons`** in the "4 Now 4 Life's Org" org, in the region nearest the user (London, `eu-west-2`). Then:

```bash
supabase link --project-ref <ref>
supabase db push --include-seed        # migrations + supabase/seed.sql (curriculum)
```

- [ ] **Step 4: Secrets and function**

```bash
supabase secrets set LLM_BASE_URL=https://openrouter.ai/api/v1 LLM_MODEL=qwen/qwen3.7-plus LLM_FALLBACK_MODEL=moonshotai/kimi-k2.6
supabase secrets set LLM_API_KEY="$(grep '^LLM_API_KEY=' supabase/functions/.env | cut -d= -f2-)"   # never echo the key
supabase functions deploy generate-lesson --no-verify-jwt
```

- [ ] **Step 5: Auth settings (the user clicks these in the Dashboard, in this order)**

1. Authentication → Users → Add user → create `66Fishmarket@gmail.com`.
2. **Then** Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".
3. Authentication → Emails → Magic Link template. Paste the contents of `supabase/templates/magic_link.html` so the code is included.
4. Authentication → URL Configuration: set Site URL to the Netlify URL (from Step 7), and add that URL to Redirect URLs.

- [ ] **Step 6: ASK, then import the legacy lessons into the hosted DB**

1. Create `.env.hosted` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for the hosted project (it is gitignored by `.env*`).
2. Run `node --env-file=.env.hosted scripts/import-legacy.ts --dry-run`. The user reviews the report.
3. Then run it again without `--dry-run`.

- [ ] **Step 7: ASK, then create and deploy the Netlify site**

1. Link the repo (Netlify MCP or `netlify init`). Set the env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the hosted values.
2. Deploy from `main` **only after the user approves a dev → main merge**.
3. Until then, a deploy preview from `dev` is fine **if the user agrees**.

- [ ] **Step 8: Smoke test on the phone**

1. Sign in with the code.
2. Today's lesson generates in ≤ 60 s.
3. Install to the home screen and open it from there.
4. Play one block, finish, and Save.
5. Confirm the row in hosted Studio is `completed`.
6. Record the Netlify URL in memory (`project_webapp_rebuild.md`) and in the handoff.
