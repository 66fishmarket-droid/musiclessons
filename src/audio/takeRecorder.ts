export interface TakeRecorder { readonly recording: boolean; start(): Promise<void>; stop(): void; dispose(): void }

/**
 * One-take recorder around MediaRecorder. A second start while the mic prompt is pending is ignored; dispose()
 * (leaving the block) stops a running take, still delivering it, and always releases the mic.
 */
export function createTakeRecorder(deps: {
  getUserMedia: () => Promise<MediaStream>;
  makeRecorder: (stream: MediaStream) => MediaRecorder;
  onTake: (take: Blob) => void;
}): TakeRecorder {
  let recorder: MediaRecorder | null = null;
  let starting = false;
  let disposed = false;
  return {
    get recording() { return recorder?.state === 'recording'; },
    async start() {
      if (starting || recorder?.state === 'recording' || disposed) return;
      starting = true;
      try {
        const stream = await deps.getUserMedia();
        if (disposed) { stream.getTracks().forEach(t => t.stop()); return; }
        const r = deps.makeRecorder(stream);
        const chunks: Blob[] = [];
        r.ondataavailable = e => chunks.push(e.data);
        r.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          deps.onTake(new Blob(chunks, { type: r.mimeType }));
        };
        r.start();
        recorder = r;
      } finally {
        starting = false;
      }
    },
    stop() {
      if (recorder?.state === 'recording') recorder.stop();
    },
    dispose() {
      disposed = true;
      if (recorder?.state === 'recording') recorder.stop();
    },
  };
}
