/**
 * Imports the Make-era Google Sheets history into Supabase.
 *   node --env-file=.env.local scripts/import-legacy.ts --email you@example.com [--dir data/legacy] [--dry-run]
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Never overwrites lessons created by the app.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import { newReport, transformLessons, transformProgress, type Row } from './legacy/transform.ts';
import { REPO_ROOT, isMain, today } from './vault/lib.ts';

const read = (file: string): Row[] => parse(readFileSync(file, 'utf8'), { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true });

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { email: { type: 'string' }, dir: { type: 'string', default: join(REPO_ROOT, 'data/legacy') }, 'dry-run': { type: 'boolean', default: false } } });
  if (!values.email) throw new Error('--email is required (the address you will log in with)');
  const report = newReport();
  const lessons = transformLessons(read(join(values.dir!, 'Lessons.csv')), read(join(values.dir!, 'Feedback.csv')), report);
  const { progress, reviews } = transformProgress(read(join(values.dir!, 'SubFocusProgress.csv')), report, today());
  console.log(JSON.stringify(report, null, 2));
  if (values['dry-run']) return;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (.env.local)');
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: list, error: listErr } = await db.auth.admin.listUsers();
  if (listErr) throw listErr;
  let user = list.users.find(u => u.email?.toLowerCase() === values.email!.toLowerCase());
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email: values.email, email_confirm: true });
    if (error) throw error;
    user = data.user;
  }
  const user_id = user.id;
  const must = <T>(r: { error: unknown; data: T }) => { if (r.error) throw r.error; return r.data; };

  must(await db.from('settings').upsert({ user_id }, { onConflict: 'user_id', ignoreDuplicates: true }));
  const appDates = new Set((must(await db.from('lessons').select('lesson_date').eq('user_id', user_id).eq('source', 'app')) ?? [])
    .map((r: { lesson_date: string }) => r.lesson_date));
  const toWrite = lessons.filter(l => !appDates.has(l.lesson_date)).map(l => ({ ...l, user_id }));
  must(await db.from('lessons').upsert(toWrite, { onConflict: 'user_id,lesson_date' }));
  must(await db.from('skill_progress').upsert(progress.map(p => ({ ...p, user_id })), { onConflict: 'user_id,skill_id', ignoreDuplicates: true }));
  must(await db.from('review_items').upsert(reviews.map(r => ({ ...r, user_id })), { onConflict: 'user_id,item_type,ref', ignoreDuplicates: true }));
  console.log(`Imported ${toWrite.length} lessons (${appDates.size} app dates kept), ${progress.length} progress rows, ${reviews.length} reviews for ${values.email}`);
}

if (isMain(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
