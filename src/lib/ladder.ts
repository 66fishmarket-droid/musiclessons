/** Up to four tempo rungs from start to target, evenly spaced and rounded, ending exactly on target. */
export function tempoLadder(start: number, target: number): number[] {
  if (target <= start) return [target];
  const step = (target - start) / 3;
  return [...new Set([0, 1, 2, 3].map(i => Math.round(start + step * i)))];
}
