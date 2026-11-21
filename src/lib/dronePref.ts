type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const KEY = 'drone-off';

/** True when the learner switched the warm-up drone off last time; storage blocked or missing reads as "on". */
export function readDroneOff(store: Store | undefined): boolean {
  try { return store?.getItem(KEY) === '1'; } catch { return false; }
}

/** Whether the warm-up drone starts on: only after a tap this page load (browsers keep audio silent until one) and unless switched off last time. */
export function droneStartsOn(store: Store | undefined, activated: boolean): boolean {
  return activated && !readDroneOff(store);
}

/** Remembers the learner's drone switch on this device (a convenience only: losing it just means the drone starts on). */
export function writeDroneOff(off: boolean, store: Store | undefined): void {
  try { if (off) store?.setItem(KEY, '1'); else store?.removeItem(KEY); } catch { /* storage blocked: nothing to remember */ }
}
