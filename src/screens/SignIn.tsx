import { type FormEvent, useState } from 'react';
import { Burst } from '../components/Burst.tsx';
import { db } from '../lib/supabase.ts';

/** Email sign-in: sends a link and a 6-digit code (the code works inside an installed PWA). No new accounts. */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await db.auth.signInWithOtp({
      email: email.trim(), options: { emailRedirectTo: location.origin, shouldCreateUser: false },
    });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await db.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(error.message); // success: App's auth listener switches screens
  };
  return (
    <main className="screen">
      <Burst name="today" variant="hero" />
      <div style={{ height: 160 }} />
      <h1 className="title">Guitar Coach</h1>
      {!sent ? (
        <form className="stack-sm" onSubmit={send}>
          <label className="stack-sm">Email
            <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <button className="btn-primary" disabled={busy}>Email me a sign-in code</button>
        </form>
      ) : (
        <form className="stack-sm" onSubmit={verify}>
          <p className="text-2">Check your email. Tap the link, or type the 6-digit code here.</p>
          <label className="stack-sm">Code
            <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required value={code} onChange={e => setCode(e.target.value)} />
          </label>
          <button className="btn-primary" disabled={busy}>Sign in</button>
        </form>
      )}
      {error && <p role="alert" className="gold-text">{error}</p>}
    </main>
  );
}
