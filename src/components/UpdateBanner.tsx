import { useRegisterSW } from 'virtual:pwa-register/react';

/** A new deploy is waiting: reload only when the learner says so (registerType 'prompt'). The player resumes the same block after a reload. */
export function UpdateBanner() {
  const { needRefresh: [need, setNeed], updateServiceWorker } = useRegisterSW();
  if (!need) return null;
  return (
    <div className="card row" role="status" style={{ position: 'fixed', top: 8, left: 8, right: 8, zIndex: 10 }}>
      <span>A new version is ready.</span>
      <span>
        <button type="button" className="btn-ghost" onClick={() => setNeed(false)}>Later</button>
        <button type="button" className="btn-ghost" onClick={() => void updateServiceWorker(true)}>Reload</button>
      </span>
    </div>
  );
}
