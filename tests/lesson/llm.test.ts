import { describe, expect, it } from 'vitest';
import { openRouterComplete } from '../../supabase/functions/_shared/lesson/llm.ts';

const msgs = [{ role: 'user' as const, content: 'hi' }];
function fakeFetch(status: number, body: unknown, seen: { url?: string; init?: RequestInit } = {}): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    seen.url = url; seen.init = init;
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

describe('openRouterComplete', () => {
  it('posts a strict json_schema request that excludes providers that train on prompts', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const complete = openRouterComplete({ baseUrl: 'https://openrouter.ai/api/v1/', apiKey: 'k' },
      fakeFetch(200, { choices: [{ message: { content: '{"a":1}' } }], usage: { cost: 0.0123 } }, seen));
    expect(await complete('moonshotai/kimi-k2.6', msgs, { type: 'object' })).toEqual({ text: '{"a":1}', cost: 0.0123 });
    expect(seen.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((seen.init!.headers as Record<string, string>).Authorization).toBe('Bearer k');
    expect(JSON.parse(seen.init!.body as string)).toMatchObject({
      model: 'moonshotai/kimi-k2.6', messages: msgs,
      response_format: { type: 'json_schema', json_schema: { name: 'lesson', strict: true, schema: { type: 'object' } } },
      provider: { data_collection: 'deny', require_parameters: true }, usage: { include: true }, reasoning: { enabled: false },
    });
  });
  it('throws on HTTP errors and empty content', async () => {
    await expect(openRouterComplete({ baseUrl: 'u', apiKey: 'k' }, fakeFetch(429, 'rate limited'))('m', msgs, {})).rejects.toThrow(/LLM 429: rate limited/);
    await expect(openRouterComplete({ baseUrl: 'u', apiKey: 'k' }, fakeFetch(200, { choices: [] }))('m', msgs, {})).rejects.toThrow(/no content/);
  });
});
