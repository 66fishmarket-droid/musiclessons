/**
 * Side-by-side model test (spec §12, Phase 2): three fixed plans through each model, one HTML page to pick the default.
 *   node --env-file=supabase/functions/.env scripts/compare-models.ts [--models a,b]
 * Costs a few cents per model. Writes docs/superpowers/model-comparison-<date>.html.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { planLesson } from '../supabase/functions/_shared/engine/planner.ts';
import { STYLE_CATALOG } from '../supabase/functions/_shared/engine/styles.ts';
import type { LessonPlan, PlannerState, Skill } from '../supabase/functions/_shared/engine/types.ts';
import { LESSON_JSON_SCHEMA, validateLesson, type LessonContent } from '../supabase/functions/_shared/lesson/contract.ts';
import { parseJson } from '../supabase/functions/_shared/lesson/generate.ts';
import { openRouterComplete } from '../supabase/functions/_shared/lesson/llm.ts';
import { buildMessages } from '../supabase/functions/_shared/lesson/prompt.ts';
import { DEFAULT_SETTINGS } from '../supabase/functions/_shared/lesson/state.ts';
import { SKILLS } from '../supabase/seed/curriculum.ts';
import { REPO_ROOT, isMain, today } from './vault/lib.ts';

export const DEFAULT_MODELS = ['moonshotai/kimi-k2.6', 'qwen/qwen3.7-plus'];
const SKILL_MAP = new Map<string, Skill>(SKILLS.map(s => [s.id, s]));
const base = (over: Partial<PlannerState>): PlannerState => ({
  today: '2026-10-10', settings: DEFAULT_SETTINGS, skills: SKILLS, progress: [], reviewItems: [], recentLessons: [], recentLogs: [], ...over,
});

/** A first lesson, a mid-progress day with retest and review, and a 25-minute "more time" repeat with a style element. */
export const FIXTURES: { name: string; state: PlannerState }[] = [
  { name: 'First lesson', state: base({}) },
  { name: 'Mid-progress with retest and review', state: base({
    progress: [
      { skill_id: 'rhythm.l1.locked_8ths', status: 'mastered', score: 0, current_target: 90, last_seen: '2026-09-20', last_key: 'D' },
      { skill_id: 'rhythm.l1.accents_palm_mute', status: 'mastered', score: 0, current_target: 85, last_seen: '2026-09-25', last_key: 'A' },
      { skill_id: 'fills.l1.sus_add_hammers', status: 'active', score: 1, current_target: 75, last_seen: '2026-10-09', last_key: 'G' },
    ],
    reviewItems: [
      { item_type: 'skill', ref: 'rhythm.l1.locked_8ths', interval_days: 3, next_due: '2026-10-08', last_result: true },
      { item_type: 'theory', ref: 'theory.l1.intervals', interval_days: 1, next_due: '2026-10-09', last_result: true },
    ],
    recentLessons: [
      { date: '2026-10-09', track: 'fills', skill_id: 'fills.l1.sus_add_hammers', key: 'G', style_element: null, want_more_time: false, status: 'completed', create_task_id: null },
      { date: '2026-10-07', track: 'rhythm', skill_id: 'rhythm.l1.accents_palm_mute', key: 'A', style_element: null, want_more_time: false, status: 'completed', create_task_id: null },
    ],
  }) },
  { name: 'Repeat day, 25 minutes', state: base({
    settings: { ...DEFAULT_SETTINGS, session_minutes: 25, vocal_low: 'A2', vocal_high: 'E4' },
    recentLessons: [{
      date: '2026-10-09', track: 'fingerstyle', skill_id: 'fingerstyle.l1.pima_pinches', key: 'D',
      style_element: { style: 'folk', element_id: 'folk.boom_chick', kind: 'rhythm', is_new: true }, want_more_time: true, status: 'completed',
      create_task_id: null,
    }],
  }) },
];

export interface Result {
  fixture: string; plan: LessonPlan; model: string; ok: boolean; errors: string[];
  content: LessonContent | null; cost: number | null; ms: number;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const chordify = (s: unknown) => esc(s).replace(/\{([^{}]+)\}/g, '<b class="chord">$1</b>');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const rec = (v: unknown) => (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;

function lessonHtml(c: Record<string, unknown>): string {
  const blocks = arr(c.blocks).map(rec).map(b => `<section class="block"><h4>${esc(b.kind)}</h4><ol>` +
    arr(b.instructions).map(i => `<li>${chordify(i)}</li>`).join('') + '</ol>' +
    (b.target_text ? `<p class="target">Target: ${chordify(b.target_text)}</p>` : '') +
    (b.tips ? `<p class="muted">Tip: ${chordify(b.tips)}</p>` : '') +
    (b.explanation ? `<p class="muted">${chordify(b.explanation)}</p>` : '') + '</section>').join('');
  const songs = arr(c.songs).map(rec).map(s => `<li>${esc(s.title)} (${esc(s.artist)}, capo ${esc(s.capo)}): ${esc(s.why)}</li>`).join('');
  return `<h3>${esc(c.title)}</h3><p>${chordify(c.why_it_matters)}</p>` +
    `<details><summary>Theory card</summary><p>${chordify(c.theory_card)}</p></details>${blocks}` +
    `<p><strong>Create:</strong> ${chordify(c.create_prompt)}</p><p><strong>Songs</strong></p><ul>${songs}</ul>`;
}

const CSS = `:root{--bg:#fbfaf7;--fg:#1d1c1a;--muted:#6b675f;--line:#e2ded5;--card:#fff;--ok:#1f7a3f;--bad:#b3261e;--accent:#8a4b12}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#161513;--fg:#ece9e2;--muted:#a19c92;--line:#34312c;--card:#1f1d1a;--ok:#6cc58a;--bad:#f2867d;--accent:#e0a867}}
:root[data-theme="dark"]{--bg:#161513;--fg:#ece9e2;--muted:#a19c92;--line:#34312c;--card:#1f1d1a;--ok:#6cc58a;--bad:#f2867d;--accent:#e0a867}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px}
.muted{color:var(--muted)}.ok{color:var(--ok);font-weight:600}.bad{color:var(--bad)}.chord{color:var(--accent)}
table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:16px}
.col{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;min-width:0;overflow-wrap:anywhere}
.block{border-top:1px solid var(--line);padding-top:8px}.block h4{margin:8px 0 4px;text-transform:capitalize}.model{font-weight:600}`;

/** Renders the results as one self-contained HTML page: a summary table, then each fixture with a column per model. */
export function renderComparison(results: Result[], models: string[], date: string): string {
  const summary = models.map(m => {
    const r = results.filter(x => x.model === m);
    const cost = r.reduce((t, x) => t + (x.cost ?? 0), 0);
    const secs = r.length ? r.reduce((t, x) => t + x.ms, 0) / r.length / 1000 : 0;
    return `<tr><td>${esc(m)}</td><td>${r.filter(x => x.ok).length}/${r.length}</td><td>${secs.toFixed(1)} s</td><td>$${cost.toFixed(4)}</td></tr>`;
  }).join('');
  const sections = [...new Set(results.map(r => r.fixture))].map(name => {
    const rs = results.filter(r => r.fixture === name);
    const p = rs[0].plan;
    const cols = models.map(m => {
      const r = rs.find(x => x.model === m);
      if (!r) return `<div class="col"><p class="model">${esc(m)}</p><p class="muted">not run</p></div>`;
      const status = r.ok ? '<span class="ok">valid</span>'
        : `<span class="bad">invalid</span><ul class="bad">${r.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`;
      return `<div class="col"><p class="model">${esc(m)} · ${status} · ${(r.ms / 1000).toFixed(1)} s · $${(r.cost ?? 0).toFixed(4)}</p>` +
        `${r.content ? lessonHtml(rec(r.content)) : ''}</div>`;
    }).join('');
    return `<h2>${esc(name)}</h2><p class="muted">${esc(p.track)} · ${esc(p.skill_id)} · key ${esc(p.key)} · ` +
      `${esc(p.music.progression.chords.join(' '))}${p.style_element ? ` · style ${esc(p.style_element.element_id)}` : ''}</p><div class="grid">${cols}</div>`;
  }).join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<title>Model Comparison</title><style>${CSS}</style></head><body><main><h1>Model comparison</h1>` +
    `<p class="muted">${esc(date)} · the same three plans sent to each model. Pick the one you would rather practise from.</p>` +
    `<table><thead><tr><th>Model</th><th>Valid</th><th>Avg time</th><th>Cost</th></tr></thead><tbody>${summary}</tbody></table>` +
    `${sections}</main></body></html>`;
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { models: { type: 'string' } } });
  const models = values.models ? values.models.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_MODELS;
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY is missing: add it to supabase/functions/.env');
  const complete = openRouterComplete({ baseUrl: process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1', apiKey, timeoutMs: 120_000 });
  const results: Result[] = [];
  for (const f of FIXTURES) {
    const plan = planLesson(f.state, STYLE_CATALOG);
    const style = plan.style_element ? STYLE_CATALOG.profiles.find(p => p.id === plan.style_element!.style) ?? null : null;
    const messages = buildMessages({ plan, skills: SKILL_MAP, style, settings: f.state.settings, recent: [], questions: [] });
    await Promise.all(models.map(async model => {
      const t0 = Date.now();
      try {
        const { text, cost } = await complete(model, messages, LESSON_JSON_SCHEMA);
        const parsed = parseJson(text);
        const v = validateLesson(parsed, plan, SKILL_MAP);
        results.push({ fixture: f.name, plan, model, ok: v.ok, errors: v.ok ? [] : v.errors,
          content: (parsed ?? null) as LessonContent | null, cost, ms: Date.now() - t0 });
      } catch (e) {
        results.push({ fixture: f.name, plan, model, ok: false, errors: [(e as Error).message], content: null, cost: null, ms: Date.now() - t0 });
      }
    }));
  }
  const date = today();
  const out = join(REPO_ROOT, 'docs', 'superpowers', `model-comparison-${date}.html`);
  writeFileSync(out, renderComparison(results, models, date));
  for (const m of models) {
    const r = results.filter(x => x.model === m);
    console.log(`${m}: ${r.filter(x => x.ok).length}/${r.length} valid, avg ${(r.reduce((t, x) => t + x.ms, 0) / r.length / 1000).toFixed(1)} s, ` +
      `$${r.reduce((t, x) => t + (x.cost ?? 0), 0).toFixed(4)}`);
    r.filter(x => !x.ok).forEach(x => console.log(`  ${x.fixture}: ${x.errors.slice(0, 3).join('; ')}`));
  }
  console.log(`→ ${out}`);
}

if (isMain(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
