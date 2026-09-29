import { useEffect, useRef, useState } from 'react';
import { startDrone } from './drone.ts';
import { createMetronome, type Metronome } from './metronome.ts';

export interface MetronomeControls { bpm: number; setBpm(b: number): void; playing: boolean; toggle(): void; beat: number }

/** Metronome state for one block; stops when the block unmounts. Tempo is clamped to 30–240. */
export function useMetronome(initial: number): MetronomeControls {
  const [bpm, setBpmState] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(-1);
  const m = useRef<Metronome | null>(null);
  m.current ??= createMetronome(setBeat);
  useEffect(() => () => m.current?.stop(), []);
  return {
    bpm,
    playing,
    beat,
    setBpm(b) {
      const v = Math.min(240, Math.max(30, Math.round(b)));
      setBpmState(v);
      m.current!.setBpm(v);
    },
    toggle() {
      if (m.current!.running) { m.current!.stop(); setPlaying(false); setBeat(-1); }
      else { m.current!.start(bpm); setPlaying(true); }
    },
  };
}

/** Plays a drone on `tonic` while it is non-null; fades out on change or unmount. */
export function useDrone(tonic: string | null): void {
  useEffect(() => (tonic ? startDrone(tonic) : undefined), [tonic]);
}
