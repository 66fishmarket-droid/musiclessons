import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';
const SQL = readFileSync(join(import.meta.dirname, '..', '..', 'supabase', 'migrations', '20261001000001_fretboard_shortcuts.sql'), 'utf8');
const NEW = ['fretboard.l1.b_string_rule', 'fretboard.l2.interval_shapes', 'fretboard.l2.progression_grid', 'fretboard.l4.one_string_scale'];
const U = '00000000-0000-4000-8000-0000000000f1';
let client: pg.Client;

beforeAll(async () => { client = new pg.Client({ connectionString: DB_URL }); await client.connect(); });
afterAll(async () => { await client.end(); });

describe('fretboard shortcuts migration', () => {
  it('upserts the new skills and leaves existing progress untouched, and is safe to re-run', async () => {
    await client.query('begin');
    try {
      await client.query(`insert into auth.users (id, email) values ($1, 'f@test.dev')`, [U]);
      await client.query(`insert into public.skill_progress (user_id, skill_id, status, score) values ($1, 'fretboard.l1.octave_shapes', 'mastered', 3)`, [U]);
      await client.query(SQL);
      await client.query(SQL);
      const skills = await client.query('select id, level from public.skills where id = any($1) order by id', [NEW]);
      expect(skills.rows.map(r => r.id)).toEqual([...NEW].sort());
      const name = await client.query(`select name, description from public.skills where id = 'fretboard.l1.octave_shapes'`);
      expect(name.rows[0].description).toContain('B-string');
      const prog = await client.query('select status, score from public.skill_progress where user_id = $1', [U]);
      expect(prog.rows).toEqual([{ status: 'mastered', score: 3 }]);
    } finally {
      await client.query('rollback');
    }
  });
});
