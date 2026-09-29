import type { Session as AuthSession } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Burst } from './components/Burst.tsx';
import { ApiError, completeLesson, fetchToday } from './lib/api.ts';
import { localDate } from './lib/dates.ts';
import type { TodayLesson } from './lib/lesson.ts';
import { flushPending } from './lib/pending.ts';
import { ANON_KEY, SUPABASE_URL, db } from './lib/supabase.ts';
import { Done } from './screens/Done.tsx';
import { Player } from './screens/Player.tsx';
import { SignIn } from './screens/SignIn.tsx';
import { Today } from './screens/Today.tsx';

/** Auth gate → flush queued completions → today's lesson → Today / Player / Done. */
export function App() {
  const [auth, setAuth] = useState<AuthSession | null | undefined>(undefined);
  const [lesson, setLesson] = useState<TodayLesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<'today' | 'player' | 'done'>('today');
  const [take, setTake] = useState<string | null>(null);
  const token = useRef<string | undefined>(undefined);
  token.current = auth?.access_token;

  useEffect(() => {
    void db.auth.getSession().then(({ data }) => setAuth(data.session));
    const { data } = db.auth.onAuthStateChange((_event, s) => setAuth(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = auth?.user.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void (async () => {
      await flushPending(localStorage, c => completeLesson(db, c)); // spec §11: retry on the next open
      try {
        const l = await fetchToday({ url: SUPABASE_URL, anonKey: ANON_KEY, token: token.current!, date: localDate(), storage: localStorage });
        if (live) setLesson(l);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await db.auth.signOut();
        else if (live) setError((e as Error).message);
      }
    })();
    return () => { live = false; };
  }, [userId]);

  const finish = useCallback(() => setScreen('done'), []);

  if (auth === undefined) return <main className="screen" />;
  if (auth === null) return <SignIn />;
  if (error) {
    return (
      <main className="screen">
        <h1 className="title title-sm">Couldn't load today's lesson</h1>
        <p className="text-2">{error}</p>
        <div className="spacer" />
        <button type="button" className="btn-primary" onClick={() => location.reload()}>Try again</button>
      </main>
    );
  }
  if (!lesson) {
    return (
      <main className="screen">
        <Burst name="today" variant="hero" />
        <div style={{ height: 200 }} />
        <h1 className="title title-sm">Writing today's lesson…</h1>
        <p className="text-2">The first open of the day can take up to a minute.</p>
      </main>
    );
  }
  if (screen === 'done') {
    return <Done lesson={lesson} take={take} onSaved={() => { setLesson({ ...lesson, status: 'completed' }); setScreen('today'); }} />;
  }
  if (screen === 'player') return <Player lesson={lesson} onFinish={finish} onTake={setTake} />;
  return <Today lesson={lesson} onStart={() => setScreen('player')} />;
}
