import type { ChatMessage } from './prompt.ts';

export interface Completion { text: string; cost: number | null }
export type Complete = (model: string, messages: ChatMessage[], schema: object) => Promise<Completion>;
export interface LlmConfig { baseUrl: string; apiKey: string; timeoutMs?: number }

/** OpenRouter (OpenAI-compatible) chat client over fetch: strict JSON-schema output, no-training providers only, cost reported. */
export function openRouterComplete({ baseUrl, apiKey, timeoutMs = 55_000 }: LlmConfig, fetchFn: typeof fetch = fetch): Complete {
  return async (model, messages, schema) => {
    const res = await fetchFn(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, messages, temperature: 0.7,
        response_format: { type: 'json_schema', json_schema: { name: 'lesson', strict: true, schema } },
        provider: { data_collection: 'deny', require_parameters: true },
        usage: { include: true },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`LLM ${res.status}: ${body.slice(0, 200)}`);
    const json = JSON.parse(body) as { choices?: { message?: { content?: unknown } }[]; usage?: { cost?: unknown } };
    const text = json.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('LLM returned no content');
    return { text, cost: typeof json.usage?.cost === 'number' ? json.usage.cost : null };
  };
}
