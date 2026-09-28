import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';
const ROOT = join(import.meta.dirname, '..', '..');
const EMAIL = 'import-test@test.dev';
let client: pg.Client;

const runImport = () => execFileSync(process.execPath, ['--env-file=.env.local', 'scripts/import-legacy.ts',
  '--email', EMAIL, '--dir', join(ROOT, 'tests/fixtures/legacy')], { cwd: ROOT, stdio: 'pipe' });
const cleanup = () => client.query('delete from auth.users where email = $1', [EMAIL]);

beforeAll(async () => { client = new pg.Client({ connectionString: DB_URL }); await client.connect(); await cleanup(); });
afterAll(async () => { await cleanup(); await client.end(); });

describe('import-legacy', () => {
  it('never overwrites progress made after the first import', async () => {
    runImport();
    await client.query(`update public.skill_progress set status = 'mastered', score = 2
      where skill_id = 'theory.l1.intervals' and user_id = (select id from auth.users where email = $1)`, [EMAIL]);
    runImport();
    const { rows } = await client.query(`select status, score from public.skill_progress
      where skill_id = 'theory.l1.intervals' and user_id = (select id from auth.users where email = $1)`, [EMAIL]);
    expect(rows).toEqual([{ status: 'mastered', score: 2 }]);
  });
});
