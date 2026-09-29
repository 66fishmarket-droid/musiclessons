import { useState } from 'react';
import { Burst } from '../components/Burst.tsx';
import { completeLesson } from '../lib/api.ts';
import { BLOCK_META, type TodayLesson } from '../lib/lesson.ts';
import { queueCompletion, type Completion } from '../lib/pending.ts';
import { blockResult, clearSession, loadSession, summary } from '../lib/session.ts';
import { db } from '../lib/supabase.ts';

/** Session done: real numbers, a result per block, the take with a 1–5 rating, one fix for tomorrow, then save. */
export function Done({ lesson, take, onSaved }: { lesson: TodayLesson; take: string | null; onSaved: () => void }) {
  const [s] = useState(() => loadSession(localStorage, lesson.id, Date.now()));
  const [sum] = useState(() => summary(s, Date.now()));
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [more, setMore] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'queued'>('idle');

  const save = async () => {
    const c: Completion = { lessonId: lesson.id, logs: s.logs, confidence: rating, wantMoreTime: more, notes: notes.trim() || null };
    setState('saving');
    try {
      await completeLesson(db, c);
      clearSession(localStorage, lesson.id);
      onSaved();
    } catch {
      queueCompletion(localStorage, c); // spec §11: nothing is lost; retried on the next open
      clearSession(localStorage, lesson.id);
      setState('queued');
    }
  };

  return (
    <main className="screen">
      <Burst name="done" variant="done" />
      <div style={{ height: 150 }} />
      <h1 className="title">Session done</h1>
      <div className="stats">
        {sum.bestBpm !== null && <div className="stat"><b style={{ color: 'var(--pink)' }}>{sum.bestBpm}</b><small>bpm reached</small></div>}
        <div className="stat"><b style={{ color: 'var(--teal)' }}>{sum.clean}/{sum.rated}</b><small>clean</small></div>
        <div className="stat"><b style={{ color: 'var(--gold)' }}>{sum.minutes}′</b><small>practised</small></div>
      </div>
      <section className="list" aria-label="Results">
        {lesson.plan.blocks.map((b, k) => b.kind === 'reset' ? null : (
          <div key={k} className="list-row">
            <span className="swatch" style={{ background: `var(--${BLOCK_META[b.kind].colour})` }} />
            <span style={{ flex: 1 }}>{BLOCK_META[b.kind].label}</span>
            <span className="text-2">{blockResult(s, k)}</span>
          </div>
        ))}
      </section>
      <section className="card" aria-label="Today's take">
        {take ? <audio controls src={take} /> : <p className="muted">No take recorded today.</p>}
        <div className="rating" role="group" aria-label="Rate today's session">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" aria-label={`${n} of 5`} aria-pressed={rating !== null && n <= rating} onClick={() => setRating(n)}>{n}</button>
          ))}
        </div>
        <label className="stack-sm">Fix tomorrow
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="One thing to fix" />
        </label>
        <label className="check">
          <input type="checkbox" checked={more} onChange={e => setMore(e.target.checked)} />
          I need more time on today's new skill
        </label>
      </section>
      <div className="spacer" />
      {state === 'queued' ? (
        <>
          <p role="status" className="text-2">Saved on this phone. It will sync next time you open the app.</p>
          <button type="button" className="btn-primary" onClick={onSaved}>Back to Today</button>
        </>
      ) : (
        <button type="button" className="btn-primary" disabled={state === 'saving'} onClick={() => void save()}>Save &amp; finish</button>
      )}
    </main>
  );
}
