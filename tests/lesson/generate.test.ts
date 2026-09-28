import { describe, expect, it } from 'vitest';
import { parseJson, writeLesson } from '../../supabase/functions/_shared/lesson/generate.ts';
import type { Complete } from '../../supabase/functions/_shared/lesson/llm.ts';
import type { ChatMessage } from '../../supabase/functions/_shared/lesson/prompt.ts';
import { PLAN, SKILL_MAP, validContent } from './fixtures.ts';

const good = JSON.stringify(validContent());
const msgs: ChatMessage[] = [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }];
/** A stub model that gives the scripted answers in order (an Error is thrown). */
function scripted(answers: (string | Error)[], calls: string[] = []): Complete {
  return async model => {
    calls.push(model);
    const a = answers.shift();
    if (a === undefined) throw new Error('no answer scripted');
    if (a instanceof Error) throw a;
    return { text: a, cost: 0.001 };
  };
}

describe('parseJson', () => {
  it('reads plain, fenced and prose-wrapped JSON', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJson('Here you go: {"a":1} Enjoy!')).toEqual({ a: 1 });
  });
  it('returns undefined for garbage', () => expect(parseJson('no json here')).toBeUndefined());
});

describe('writeLesson', () => {
  it('returns the first valid answer without calling the fallback model', async () => {
    const calls: string[] = [];
    const w = await writeLesson(msgs, PLAN, SKILL_MAP, scripted([good], calls), ['m1', 'm2']);
    expect(w).toMatchObject({ llm_model: 'm1', attempts: [{ model: 'm1', errors: [], cost: 0.001 }] });
    expect(calls).toEqual(['m1']);
  });
  it('retries on the fallback model when the first answer is invalid', async () => {
    const w = await writeLesson(msgs, PLAN, SKILL_MAP, scripted(['{"title":"x"}', `\`\`\`json\n${good}\n\`\`\``]), ['m1', 'm2']);
    expect(w.llm_model).toBe('m2');
    expect(w.attempts[0].errors.length).toBeGreaterThan(0);
    expect(w.content.fallback).toBeUndefined();
  });
  it('serves the plan-only lesson when every model fails, without throwing', async () => {
    const w = await writeLesson(msgs, PLAN, SKILL_MAP, scripted([new Error('timeout'), 'not json']), ['m1', 'm2']);
    expect(w.llm_model).toBe('fallback');
    expect(w.content.fallback).toBe(true);
    expect(w.attempts.map(a => a.errors)).toEqual([['timeout'], ['not a JSON object']]);
  });
  it('skips blank and duplicate model names, and calls nothing when none is set', async () => {
    const calls: string[] = [];
    await writeLesson(msgs, PLAN, SKILL_MAP, scripted([good], calls), ['', undefined, 'm1', 'm1']);
    expect(calls).toEqual(['m1']);
    const none: string[] = [];
    expect((await writeLesson(msgs, PLAN, SKILL_MAP, scripted([], none), [undefined, ''])).llm_model).toBe('fallback');
    expect(none).toEqual([]);
  });
});
