import { useState } from 'react';

/** Record and listen back with MediaRecorder. The take stays in this tab's memory and is never uploaded. */
export function Recorder({ onTake }: { onTake: (url: string) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = e => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const u = URL.createObjectURL(new Blob(chunks, { type: r.mimeType }));
        setUrl(u); onTake(u); setRec(null);
      };
      r.start();
      setRec(r); setError(null);
    } catch {
      setError('Microphone blocked. Allow it in your browser settings, then try again.');
    }
  };
  return (
    <section className="card" aria-label="Recorder">
      <button type="button" className="btn-play" aria-pressed={rec !== null} onClick={() => (rec ? rec.stop() : void start())}>
        {rec ? 'Stop recording' : url ? 'Record again' : 'Record a take'}
      </button>
      {url && <audio controls src={url} />}
      {error && <p role="alert" className="gold-text">{error}</p>}
    </section>
  );
}
