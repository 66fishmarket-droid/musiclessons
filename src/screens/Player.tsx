import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { audio, blip } from '../audio/clock.ts';
import { useDrone, useMetronome } from '../audio/useMetronome.ts';
import { Burst } from '../components/Burst.tsx';
import { ChordPanel } from '../components/ChordPanel.tsx';
import { ChordText } from '../components/ChordText.tsx';
import { Metronome } from '../components/Metronome.tsx';
import { PickingPattern } from '../components/PickingPattern.tsx';
import { Rail } from '../components/Rail.tsx';
import { Recorder } from '../components/Recorder.tsx';
import { SkillSheet } from '../components/SkillSheet.tsx';
import { VoicingSheet } from '../components/VoicingSheet.tsx';
import { clock } from '../lib/dates.ts';
import { keyAction } from '../lib/keys.ts';
import { tempoLadder } from '../lib/ladder.ts';
import { BLOCK_META, bpmTarget, refLabel, startBpm, tonicOf, type TodayLesson } from '../lib/lesson.ts';
import { skillInfo } from '../lib/skillInfo.ts';
import { goTo, loadSession, logVerdict, saveSession, slotsFor, verdictFor, type Log, type Session } from '../lib/session.ts';
import { useWakeLock } from '../lib/wakeLock.ts';

/** The block-by-block player. Saves on every change, so a reload resumes the same block with its verdicts. */
export function Player({ lesson, onFinish, onTake }: { lesson: TodayLesson; onFinish: () => void; onTake: (url: string) => void }) {
  const count = lesson.plan.blocks.length;
  const [s, setS] = useState(() => loadSession(localStorage, lesson.id, Date.now()));
  useEffect(() => saveSession(localStorage, s), [s]);
  useEffect(() => { if (s.index >= count) onFinish(); }, [s.index, count, onFinish]);
  useWakeLock(true);
  if (s.index >= count) return null;
  return (
    <BlockView
      key={s.index} // fresh metronome, timer and step per block
      lesson={lesson}
      session={s}
      onLog={log => setS(x => logVerdict(x, log))}
      onMove={to => setS(x => goTo(x, to, count, Date.now()))}
      onTake={onTake}
    />
  );
}

function useSecondsLeft(total: number, since: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return Math.round(total - (now - since) / 1000);
}

function BlockView({ lesson, session, onLog, onMove, onTake }: {
  lesson: TodayLesson; session: Session; onLog: (l: Log) => void; onMove: (to: number) => void; onTake: (url: string) => void;
}) {
  const { plan, content } = lesson;
  const i = session.index;
  const block = plan.blocks[i];
  const text = content.blocks[i];
  const meta = BLOCK_META[block.kind];
  const target = bpmTarget(plan, i);
  const first = startBpm(plan, i);
  const hasMetro = !['reset', 'create', 'record'].includes(block.kind);
  const slots = slotsFor(plan, i);
  const steps = text?.instructions.length ? text.instructions : [''];
  const tonic = tonicOf(plan.key);
  const skillId = block.kind === 'retest' ? plan.retest?.skill_id : ['new_skill', 'apply'].includes(block.kind) ? plan.skill_id : undefined;
  const firstChord = plan.music.progression.chords[0];
  const firstVoicing = plan.music.voicings[firstChord]?.[0];
  const pattern = skillId ? skillInfo(skillId)?.patterns[0] : undefined;

  const metro = useMetronome(first);
  const [drone, setDrone] = useState(false);
  useDrone(drone ? tonic : null);
  const [step, setStep] = useState(0);
  const [sheet, setSheet] = useState<string | null>(null);
  const [about, setAbout] = useState(false);
  const total = block.minutes * 60;
  const left = useSecondsLeft(total, session.blockStartedAt);
  const chimed = useRef(left <= 0);
  useEffect(() => {
    if (left <= 0 && !chimed.current) { chimed.current = true; blip(audio().currentTime, 880, 0.35, 0.4); }
  }, [left]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = keyAction(e.key, (e.target as HTMLElement | null)?.tagName);
      if (!action) return;
      e.preventDefault();
      if (action === 'toggle' && hasMetro) metro.toggle();
      if (action === 'next') onMove(i + 1);
      if (action === 'prev') onMove(i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // re-bound every render so it sees the current metronome state

  const logged = (ref: string | null) => {
    const l = session.logs.find(x => x.block_index === i && x.item_ref === ref);
    return l ? l.passed !== false : undefined; // clean below target (null) still shows as clean
  };
  const verdict = (ref: string | null, clean: boolean) => onLog({
    block_index: i, block_kind: block.kind, item_ref: ref, passed: verdictFor(clean, metro.bpm, target),
    value_reached: target !== null ? metro.bpm : null, note: null,
  });
  const decide = (clean: boolean) => { verdict(slots[0], clean); onMove(i + 1); };
  const passLabel = target !== null ? `Clean at ${metro.bpm}` : block.kind === 'record' ? 'Take done' : 'Clean';

  return (
    <main className="screen" style={{ '--c': `var(--${meta.colour})`, '--c-dim': `var(--${meta.colour}-dim)` } as CSSProperties}>
      {meta.colour !== 'muted' && <Burst name={`block-${meta.colour}`} variant="corner" />}
      <Rail blocks={plan.blocks} index={i} progress={1 - left / total} />
      <div className="status">
        <span className="c-text">{i + 1} of {plan.blocks.length} · {meta.label}</span>
        <span className={left < 0 ? 'timer over' : 'timer'} role="timer" aria-label="Block time left">{clock(left)}</span>
      </div>
      <h1 className="title title-sm">{text?.target_text || meta.label}</h1>
      {skillId && <button type="button" className="btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setAbout(true)}>About this skill ›</button>}

      <section className="card step" aria-live="polite">
        <div className="step-text">
          <small className="muted">Step {step + 1} of {steps.length}</small>
          <p><ChordText text={steps[step]} onChord={setSheet} /></p>
        </div>
        <button type="button" className="round" aria-label="Previous step" disabled={step === 0} onClick={() => setStep(step - 1)}>‹</button>
        <button type="button" className="round" aria-label="Next step" disabled={step === steps.length - 1} onClick={() => setStep(step + 1)}>›</button>
      </section>

      {block.kind === 'apply' && <ChordPanel chords={plan.music.progression.chords} voicings={plan.music.voicings} onShapes={setSheet} />}
      {block.kind === 'create' && <section className="card"><p><ChordText text={content.create_prompt} onChord={setSheet} /></p></section>}
      {block.kind === 'record' && <Recorder onTake={onTake} />}
      {pattern && firstVoicing && <PickingPattern pattern={pattern} chord={firstChord} voicing={firstVoicing} bpm={metro.bpm} />}
      {hasMetro && (
        <Metronome metro={metro} target={target} ladder={target !== null ? tempoLadder(first, target) : null}
          drone={drone} onDrone={() => setDrone(!drone)} tonic={tonic} />
      )}
      {(text?.tips || text?.explanation) && (
        <details className="card">
          <summary>Tips &amp; why</summary>
          {text.tips && <p>{text.tips}</p>}
          {text.explanation && <p className="text-2">{text.explanation}</p>}
        </details>
      )}

      <div className="spacer" />
      {block.kind === 'reset' ? (
        <button type="button" className="btn-primary" onClick={() => onMove(i + 1)}>Next block</button>
      ) : slots.length > 1 ? (
        <>
          <section className="list" aria-label="Review items">
            {slots.map(ref => (
              <div key={ref} className="list-row">
                <span style={{ flex: 1 }}>{refLabel(ref ?? '')}</span>
                <button type="button" className="btn-ghost" aria-pressed={logged(ref) === false} onClick={() => verdict(ref, false)}>Not yet</button>
                <button type="button" className="btn-ghost" aria-pressed={logged(ref) === true} onClick={() => verdict(ref, true)}>Clean</button>
              </div>
            ))}
          </section>
          <button type="button" className="btn-primary" onClick={() => onMove(i + 1)}>Next block</button>
        </>
      ) : (
        <div className="verdict">
          <button type="button" aria-pressed={logged(slots[0]) === false} onClick={() => decide(false)}>Not yet</button>
          <button type="button" className="pass" aria-pressed={logged(slots[0]) === true} onClick={() => decide(true)}>{passLabel}</button>
        </div>
      )}
      <nav className="row" aria-label="Block navigation">
        <button type="button" className="btn-ghost" disabled={i === 0} onClick={() => onMove(i - 1)}>‹ Back</button>
        <button type="button" className="btn-ghost" onClick={() => onMove(i + 1)}>Skip ›</button>
      </nav>
      {about && skillId && <SkillSheet skillId={skillId} chord={firstChord} voicing={firstVoicing} bpm={metro.bpm} onClose={() => setAbout(false)} />}
      {sheet && <VoicingSheet chord={sheet} known={plan.music.voicings[sheet]} onClose={() => setSheet(null)} />}
    </main>
  );
}
