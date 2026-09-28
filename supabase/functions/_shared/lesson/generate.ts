import type { LessonPlan, Skill } from '../engine/types.ts';
import { LESSON_JSON_SCHEMA, validateLesson, type LessonContent } from './contract.ts';
import { fallbackLesson } from './fallback.ts';
import type { Complete } from './llm.ts';
import type { ChatMessage } from './prompt.ts';

export interface Attempt { model: string; errors: string[]; cost: number | null; ms: number }
export interface Written { content: LessonContent; llm_model: string; attempts: Attempt[] }

/** Parses model output, tolerating ```json fences and prose around the object; undefined when unparseable. */
export function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t); } catch { /* try the outermost braces */ }
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch { /* unparseable */ } }
  return undefined;
}

/** Tries each configured model in order; the first valid lesson wins, else the plan-only lesson. Never throws. */
export async function writeLesson(
  messages: ChatMessage[], plan: LessonPlan, skills: Map<string, Skill>, complete: Complete, models: (string | undefined)[],
): Promise<Written> {
  const attempts: Attempt[] = [];
  for (const model of [...new Set(models.filter((m): m is string => !!m && m.trim() !== ''))]) {
    const t0 = Date.now();
    try {
      const { text, cost } = await complete(model, messages, LESSON_JSON_SCHEMA);
      const v = validateLesson(parseJson(text), plan, skills);
      attempts.push({ model, errors: v.ok ? [] : v.errors, cost, ms: Date.now() - t0 });
      if (v.ok) return { content: v.content, llm_model: model, attempts };
    } catch (e) {
      attempts.push({ model, errors: [(e as Error).message], cost: null, ms: Date.now() - t0 });
    }
  }
  return { content: fallbackLesson(plan, skills), llm_model: 'fallback', attempts };
}
