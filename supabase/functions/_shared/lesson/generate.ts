import type { LessonPlan, Skill } from '../engine/types.ts';
import { COLOUR_JSON_SCHEMA, validateColour, type LessonContent } from './contract.ts';
import { assembleLesson, fallbackColour } from './fallback.ts';
import type { Complete } from './llm.ts';
import type { ChatMessage } from './prompt.ts';
import { buildSteps, stepsText, type EngineSteps } from './steps.ts';

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

/**
 * Tries each configured model in order; the first valid colour wins, else the fallback colour. Content is
 * assembled with the engine's steps. Throws only if the plan itself can't be rendered (buildSteps/renderSteps
 * hit a slot the plan has no data for) — never because every model failed or returned bad JSON.
 */
export async function writeLesson(
  messages: ChatMessage[], plan: LessonPlan, skills: Map<string, Skill>, complete: Complete, models: (string | undefined)[],
  metSkills: string[] = [],
  steps: EngineSteps = buildSteps(plan, skills), // computed once per request, shared with assembleLesson
): Promise<Written> {
  const attempts: Attempt[] = [];
  const engineStepsText = stepsText(steps);
  for (const model of [...new Set(models.filter((m): m is string => !!m && m.trim() !== ''))]) {
    const t0 = Date.now();
    try {
      const { text, cost } = await complete(model, messages, COLOUR_JSON_SCHEMA);
      const v = validateColour(parseJson(text), plan, skills, { metSkills, stepsText: engineStepsText });
      attempts.push({ model, errors: v.ok ? [] : v.errors, cost, ms: Date.now() - t0 });
      if (v.ok) return { content: assembleLesson(plan, skills, v.colour, false, steps), llm_model: model, attempts };
    } catch (e) {
      attempts.push({ model, errors: [(e as Error).message], cost: null, ms: Date.now() - t0 });
    }
  }
  return { content: assembleLesson(plan, skills, fallbackColour(plan, skills), true, steps), llm_model: 'fallback', attempts };
}
