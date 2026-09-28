import { createClient } from '@supabase/supabase-js';
import { openRouterComplete } from '../_shared/lesson/llm.ts';
import { InputError, checkDate, getOrCreateLesson } from '../_shared/lesson/service.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });

// POST { date: 'YYYY-MM-DD' } (the client's local date) → today's lesson row for the caller, created on first open.
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const date = checkDate((body as { date?: unknown }).date, new Date());
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false },
    });
    // The only auth gate: config.toml sets verify_jwt = false for this function (CLI gateway cannot verify ES256).
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return reply({ error: 'not signed in' }, 401);
    const complete = openRouterComplete({
      baseUrl: Deno.env.get('LLM_BASE_URL') || 'https://openrouter.ai/api/v1', apiKey: Deno.env.get('LLM_API_KEY') ?? '',
    });
    return reply(await getOrCreateLesson(db, date, complete, [Deno.env.get('LLM_MODEL'), Deno.env.get('LLM_FALLBACK_MODEL')]));
  } catch (e) {
    console.error(e);
    return reply({ error: (e as Error).message }, e instanceof InputError ? 400 : 500);
  }
});
