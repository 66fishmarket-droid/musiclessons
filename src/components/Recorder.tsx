import { useEffect, useRef, useState } from 'react';
import { createTakeRecorder, type TakeRecorder } from '../audio/takeRecorder.ts';

/** Record and listen back. The take stays in this tab's memory and is never uploaded; leaving the block ends it. */
export function Recorder({ onTake }: { onTake: (url: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onTakeRef = useRef(onTake);
  onTakeRef.current = onTake;
  const rec = useRef<TakeRecorder | null>(null);
  useEffect(() => { // created per mount, so StrictMode's test unmount can't dispose the live one
    const r = createTakeRecorder({
      getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }),
      makeRecorder: stream => new MediaRecorder(stream),
      onTake: blob => {
        const u = URL.createObjectURL(blob);
        setUrl(old => { if (old) URL.revokeObjectURL(old); return u; });
        onTakeRef.current(u);
        setRecording(false);
      },
    });
    rec.current = r;
    return () => r.dispose();
  }, []);

  const start = async () => {
    try {
      await rec.current!.start();
      setRecording(rec.current!.recording);
      setError(null);
    } catch (e) {
      setError((e as Error).name === 'NotAllowedError'
        ? 'Microphone blocked. Allow it in your browser settings, then try again.'
        : "Recording isn't available in this browser.");
    }
  };
  return (
    <section className="card" aria-label="Recorder">
      <button type="button" className="btn-play" aria-pressed={recording} onClick={() => (recording ? rec.current!.stop() : void start())}>
        {recording ? 'Stop recording' : url ? 'Record again' : 'Record a take'}
      </button>
      {url && <audio controls src={url} />}
      {error && <p role="alert" className="gold-text">{error}</p>}
    </section>
  );
}
