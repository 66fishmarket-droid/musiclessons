import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

pg.types.setTypeParser(1082, v => v); // date → 'YYYY-MM-DD'
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
type Q = (sql: string, params?: unknown[]) => Promise<pg.QueryResult>;
let client: pg.Client;

beforeAll(async () => { client = new pg.Client({ connectionString: DB_URL }); await client.connect(); });
afterAll(async () => { await client.end(); });

/** Runs fn as user A inside a transaction that is always rolled back. `setup` runs first as postgres. */
async function asUser(fn: (q: Q) => Promise<void>, setup?: (q: Q) => Promise<void>): Promise<void> {
  const q: Q = (sql, params) => client.query(sql, params as unknown[]);
  await q('begin');
  try {
    await q(`insert into auth.users (id, email) values ($1, 'a@test.dev'), ($2, 'b@test.dev')`, [A, B]);
    if (setup) await setup(q);
    await q(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: A, role: 'authenticated' })]);
    await q('set local role authenticated');
    await fn(q);
  } finally {
    await q('rollback');
  }
}
const newLesson = async (q: Q, plan: object = {}) => (await q(
  `insert into public.lessons (lesson_date, template, track, skill_id, key, plan)
   values ('2026-10-01', 'standard_30', 'rhythm', 'rhythm.l1.locked_8ths', 'G', $1::jsonb) returning id`,
  [JSON.stringify(plan)])).rows[0].id as string;
const complete = (q: Q, id: string, logs: object[], wantMore = false) =>
  q('select public.complete_lesson($1, $2::jsonb, 4::smallint, $3, null)', [id, JSON.stringify(logs), wantMore]);
const newSkill = (passed: boolean | null, value: number | null = null) =>
  ({ block_index: 1, block_kind: 'new_skill', item_ref: 'skill:rhythm.l1.locked_8ths', passed, value_reached: value });
const progress = async (q: Q) => (await q(`select status, score, current_target::float as target, last_seen, last_key
  from public.skill_progress where skill_id = 'rhythm.l1.locked_8ths'`)).rows[0];

describe('complete_lesson', () => {
  it('scores a pass: +1, target +5 bpm, stamps last_seen/key, completes the lesson, stores logs', () => asUser(async q => {
    const id = await newLesson(q);
    await complete(q, id, [newSkill(true, 70)]);
    expect(await progress(q)).toEqual({ status: 'active', score: 1, target: 75, last_seen: '2026-10-01', last_key: 'G' });
    expect((await q('select status, confidence from public.lessons where id = $1', [id])).rows[0]).toEqual({ status: 'completed', confidence: 4 });
    expect((await q('select count(*)::int as n from public.exercise_logs where lesson_id = $1', [id])).rows[0].n).toBe(1);
  }));

  it('scores +2 when the target is exceeded', () => asUser(async q => {
    await complete(q, await newLesson(q), [newSkill(true, 80)]);
    expect((await progress(q)).score).toBe(2);
  }));

  it('masters at +3 and schedules a review tomorrow', () => asUser(async q => {
    await q(`insert into public.skill_progress (skill_id, score, current_target) values ('rhythm.l1.locked_8ths', 2, 70)`);
    await complete(q, await newLesson(q), [newSkill(true, 70)]);
    expect(await progress(q)).toMatchObject({ status: 'mastered', score: 0 });
    expect((await q(`select interval_days, next_due from public.review_items where ref = 'rhythm.l1.locked_8ths'`)).rows[0])
      .toEqual({ interval_days: 1, next_due: '2026-10-02' });
  }));

  it('drops the target on a fail and cuts it 10% at −3', () => asUser(async q => {
    await q(`insert into public.skill_progress (skill_id, score, current_target) values ('rhythm.l1.locked_8ths', -2, 70)`);
    await complete(q, await newLesson(q), [newSkill(false)]);
    expect(await progress(q)).toMatchObject({ status: 'active', score: 0, target: 59 }); // 70−5=65, then round(65×0.9)=59
  }));

  it('applies −2 and leaves the target alone when more time is requested', () => asUser(async q => {
    await complete(q, await newLesson(q), [newSkill(true, 90)], true);
    expect(await progress(q)).toMatchObject({ score: -2, target: 70 });
  }));

  it('moves review items up the 1-3-7-14-30-60 ladder, back to 1 on a fail', () => asUser(async q => {
    await q(`insert into public.review_items (item_type, ref, interval_days, next_due) values
      ('skill', 'fills.l1.sus_add_hammers', 3, '2026-10-01'), ('style', 'folk.boom_chick', 7, '2026-10-01')`);
    await complete(q, await newLesson(q), [
      { block_index: 4, block_kind: 'review', item_ref: 'skill:fills.l1.sus_add_hammers', passed: true },
      { block_index: 4, block_kind: 'review', item_ref: 'style:folk.boom_chick', passed: false },
    ]);
    const rows = (await q('select ref, interval_days, next_due from public.review_items order by ref')).rows;
    expect(rows).toEqual([
      { ref: 'fills.l1.sus_add_hammers', interval_days: 7, next_due: '2026-10-08' },
      { ref: 'folk.boom_chick', interval_days: 1, next_due: '2026-10-02' },
    ]);
  }));

  it('scores theory quiz reviews against the theory skill', () => asUser(async q => {
    await complete(q, await newLesson(q), [{ block_index: 4, block_kind: 'review', item_ref: 'theory:theory.l1.intervals', passed: true }]);
    expect((await q(`select score from public.skill_progress where skill_id = 'theory.l1.intervals'`)).rows[0].score).toBe(1);
  }));

  it('enters the theory card and a new style element into review', () => asUser(async q => {
    const id = await newLesson(q, { theory_topic_id: 'theory.l2.triads', style_element: { style: 'folk', element_id: 'folk.boom_chick', kind: 'rhythm', is_new: true } });
    await complete(q, id, []);
    const rows = (await q('select item_type, ref, next_due from public.review_items order by item_type')).rows;
    expect(rows).toEqual([
      { item_type: 'style', ref: 'folk.boom_chick', next_due: '2026-10-02' },
      { item_type: 'theory', ref: 'theory.l2.triads', next_due: '2026-10-02' },
    ]);
  }));

  it('leaves scores and review intervals alone for blocks logged without a result', () => asUser(async q => {
    await q(`insert into public.skill_progress (skill_id, score, current_target) values ('rhythm.l1.locked_8ths', 1, 70)`);
    await q(`insert into public.review_items (item_type, ref, interval_days, next_due) values ('style', 'folk.boom_chick', 7, '2026-10-01')`);
    await complete(q, await newLesson(q), [
      newSkill(null),
      { block_index: 4, block_kind: 'review', item_ref: 'style:folk.boom_chick', passed: null },
    ]);
    expect(await progress(q)).toMatchObject({ score: 1, target: 70 });
    expect((await q(`select interval_days from public.review_items where ref = 'folk.boom_chick'`)).rows[0].interval_days).toBe(7);
  }));

  it('is a no-op when called twice (offline retry)', () => asUser(async q => {
    const id = await newLesson(q);
    await complete(q, id, [newSkill(true, 70)]);
    await complete(q, id, [newSkill(true, 70)]);
    expect((await progress(q)).score).toBe(1);
    expect((await q('select count(*)::int as n from public.exercise_logs where lesson_id = $1', [id])).rows[0].n).toBe(1);
  }));

  it('refuses another user\'s lesson (RLS)', async () => {
    let otherId = '';
    await expect(asUser(async q => { await complete(q, otherId, []); }, async q => {
      otherId = (await q(`insert into public.lessons (user_id, lesson_date, template) values ($1, '2026-10-01', 'standard_30') returning id`, [B])).rows[0].id;
    })).rejects.toThrow(/lesson not found/);
  });
});
