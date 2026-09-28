import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Complete } from '../../supabase/functions/_shared/lesson/llm.ts';
import { PROMPT_VERSION } from '../../supabase/functions/_shared/lesson/prompt.ts';
import { getOrCreateLesson } from '../../supabase/functions/_shared/lesson/service.ts';

process.loadEnvFile(join(import.meta.dirname, '..', '..', '.env.local'));
const SUPABASE_URL = process.env.SUPABASE_URL!;
const EMAIL = 'generate-test@test.dev';
const PASSWORD = 'local-test-password-1';
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let db: SupabaseClient;
let userId = '';

/** A stub model that answers with minimal valid content for whatever plan it is briefed on. */
function stub(calls: string[], fail = false): Complete {
  return async (model, messages) => {
    calls.push(model);
    if (fail) throw new Error('model down');
    const user = messages[1].content;
    const brief = JSON.parse(user.slice(user.indexOf('\n') + 1)) as { blocks: { kind: string }[] };
    return { cost: 0, text: JSON.stringify({
      title: 't', why_it_matters: 'w', theory_card: 'c', create_prompt: 'p',
      songs: [1, 2, 3].map(i => ({ title: `Song ${i}`, artist: 'Artist', why: 'w', capo: 0 })),
      blocks: brief.blocks.map(b => ({ kind: b.kind, instructions: [`Do ${b.kind}.`], target_text: '', tips: '', explanation: '' })),
    }) };
  };
}

beforeAll(async () => {
  const { data: list } = await admin.auth.admin.listUsers();
  for (const u of list.users.filter(u => u.email === EMAIL)) await admin.auth.admin.deleteUser(u.id);
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
  db = createClient(SUPABASE_URL, process.env.ANON_KEY!, { auth: { persistSession: false } });
  const { error: signInError } = await db.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (signInError) throw signInError;
});
afterAll(async () => { if (userId) await admin.auth.admin.deleteUser(userId); });

describe('getOrCreateLesson', () => {
  it('creates the lesson once, returns the same row afterwards, and completes end to end', async () => {
    const calls: string[] = [];
    const first = await getOrCreateLesson(db, '2026-10-01', stub(calls), ['stub-a', 'stub-b']);
    expect(first).toMatchObject({ lesson_date: '2026-10-01', status: 'planned', llm_model: 'stub-a', prompt_version: PROMPT_VERSION });
    const again = await getOrCreateLesson(db, '2026-10-01', stub(calls), ['stub-a']);
    expect(again.id).toBe(first.id);
    expect(calls).toEqual(['stub-a']);

    const plan = first.plan as { skill_id: string; blocks: { kind: string }[] };
    const blockIndex = plan.blocks.findIndex(b => b.kind === 'new_skill');
    const { error } = await db.rpc('complete_lesson', {
      p_lesson_id: first.id, p_confidence: 4, p_want_more_time: false, p_notes: null,
      p_logs: [{ block_index: blockIndex, block_kind: 'new_skill', item_ref: `skill:${plan.skill_id}`, passed: true, value_reached: null }],
    });
    expect(error).toBeNull();
    const { data: progress } = await db.from('skill_progress').select('score').eq('skill_id', plan.skill_id).single();
    expect(progress?.score).toBe(1);
    const { data: reviews } = await db.from('review_items').select('item_type');
    expect(reviews?.some(r => r.item_type === 'theory')).toBe(true);
  });

  it('saves the plan-only lesson when every model fails', async () => {
    const row = await getOrCreateLesson(db, '2026-10-02', stub([], true), ['stub-a', 'stub-b']);
    expect(row.llm_model).toBe('fallback');
    expect(row.content).toMatchObject({ fallback: true, generation: [{ model: 'stub-a' }, { model: 'stub-b' }] });
  });

  it('converges on one row when two first-opens race', async () => {
    const [a, b] = await Promise.all([
      getOrCreateLesson(db, '2026-10-03', stub([]), ['stub-a']),
      getOrCreateLesson(db, '2026-10-03', stub([]), ['stub-a']),
    ]);
    expect(a.id).toBe(b.id);
    const { count } = await db.from('lessons').select('id', { count: 'exact', head: true }).eq('lesson_date', '2026-10-03');
    expect(count).toBe(1);
  });
});
