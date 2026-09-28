/**
 * Prints an access token for a user on the LOCAL Supabase, for curl-testing edge functions.
 *   node --env-file=.env.local scripts/dev-session.ts --email you@example.com
 * Creates the user if missing. Refuses to run against anything but 127.0.0.1/localhost.
 */
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { isMain } from './vault/lib.ts';

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { email: { type: 'string' } } });
  if (!values.email) throw new Error('--email is required');
  const url = process.env.SUPABASE_URL ?? '';
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error(`Refusing: ${url || 'SUPABASE_URL'} is not a local Supabase`);
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  if (!list.users.some(u => u.email?.toLowerCase() === values.email!.toLowerCase())) {
    const { error } = await admin.auth.admin.createUser({ email: values.email, email_confirm: true });
    if (error) throw error;
  }
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: values.email });
  if (linkError) throw linkError;
  const anon = createClient(url, process.env.ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (error || !data.session) throw error ?? new Error('no session returned');
  console.log(data.session.access_token);
}

if (isMain(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
