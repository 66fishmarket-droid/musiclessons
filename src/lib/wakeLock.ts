import { useEffect } from 'react';

/** Keeps the screen on while `active` (the phone sits on a music stand); re-acquires after the tab returns. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = () => navigator.wakeLock.request('screen')
      .then(l => { if (stopped) void l.release(); else lock = l; })
      .catch(() => { /* denied or unsupported: the screen may dim */ });
    const onVisible = () => { if (document.visibilityState === 'visible') void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopped = true; document.removeEventListener('visibilitychange', onVisible); void lock?.release(); };
  }, [active]);
}
