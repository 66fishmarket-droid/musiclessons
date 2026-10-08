import { useEffect, useState } from 'react';
import { Burst } from '../components/Burst.tsx';
import { SkillSheet } from '../components/SkillSheet.tsx';
import { completedDays } from '../lib/api.ts';
import { weekDays } from '../lib/dates.ts';
import { BLOCK_META, type TodayLesson } from '../lib/lesson.ts';
import { loadSession } from '../lib/session.ts';
import { db } from '../lib/supabase.ts';
import { ugSearchUrl } from '../lib/ug.ts';

/** Today: what the session holds and one Start (or Resume / Done for today) button. */
export function Today({ lesson, onStart }: { lesson: TodayLesson; onStart: () => void }) {
  const { plan, content } = lesson;
  const days = weekDays(lesson.lesson_date);
  const [done, setDone] = useState<string[]>([]);
  const [about, setAbout] = useState(false);
  useEffect(() => {
    completedDays(db, days).then(setDone).catch(() => setDone([])); // offline: dots stay empty
  }, [lesson.lesson_date, lesson.status]); // `days` derives from lesson_date
  const resumeAt = loadSession(localStorage, lesson.id, Date.now()).index;
  const minutes = Math.round(plan.blocks.reduce((t, b) => t + b.minutes, 0));
  const finished = lesson.status === 'completed';
  const dateLabel = new Date(`${lesson.lesson_date}T12:00:00`)
    .toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <main className="screen">
      <Burst name="today" variant="hero" />
      <header className="stack-sm">
        <span className="text-2">{dateLabel}</span>
        <div className="dots" aria-label={`Practised ${done.length} day${done.length === 1 ? '' : 's'} this week`}>
          {days.map(d => (
            <span key={d} className={`dot${done.includes(d) ? ' on' : ''}${d === lesson.lesson_date ? ' today' : ''}`} />
          ))}
          <small className="muted">{done.length} this week</small>
        </div>
      </header>
      <div style={{ height: 40 }} />
      <section className="stack-sm">
        <span className="pill">{plan.track.replaceAll('_', ' ')} · new skill</span>
        <h1 className="title">{content.title}</h1>
        <p className="text-2">{content.why_it_matters}</p>
        {content.path && content.path.length > 0 && (
          <ul className="stack-sm" aria-label="Today's path" style={{ paddingLeft: 18, margin: 0 }}>
            {content.path.map(line => <li key={line} className="text-2">{line.replace(/[{}]/g, '')}</li>)}
          </ul>
        )}
        <button type="button" className="btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setAbout(true)}>About this skill ›</button>
      </section>
      <section className="list" aria-label="Today's blocks">
        {plan.blocks.map((b, k) => b.kind === 'reset' ? null : (
          <div key={k} className="list-row">
            <span className="swatch" style={{ background: `var(--${BLOCK_META[b.kind].colour})` }} />
            <span style={{ flex: 1 }}>{BLOCK_META[b.kind].label}</span>
            <span className="mono muted">{Math.round(b.minutes)}′</span>
          </div>
        ))}
      </section>
      <details className="card">
        <summary>Why it works</summary>
        <p className="text-2">{content.theory_card}</p>
      </details>
      {content.songs.length > 0 && (
        <section className="stack-sm" aria-label="Hear it in songs">
          <h2 className="label">Hear it in songs</h2>
          {content.songs.map(s => (
            <a key={`${s.title}-${s.artist}`} className="song" href={ugSearchUrl(s.title, s.artist)} target="_blank" rel="noreferrer">
              <span className="stack-sm" style={{ gap: 0 }}>
                <b>{s.title}</b>
                <small className="muted">{s.artist}{s.capo ? ` · capo ${s.capo}` : ''}</small>
              </span>
              <span className="gold-text">Tab ↗</span>
            </a>
          ))}
        </section>
      )}
      <div className="spacer" />
      <button type="button" className="btn-primary" disabled={finished} onClick={onStart}>
        {finished ? 'Done for today ✓' : resumeAt > 0 ? `Resume · block ${resumeAt + 1}` : `Start · ${minutes} min`}
      </button>
      {about && (
        <SkillSheet skillId={plan.skill_id} chord={plan.music.progression.chords[0]}
          voicing={plan.music.voicings[plan.music.progression.chords[0]]?.[0]}
          bpm={plan.blocks.find(b => b.kind === 'new_skill')?.items[0]?.target?.start ?? 60}
          onClose={() => setAbout(false)} />
      )}
    </main>
  );
}
