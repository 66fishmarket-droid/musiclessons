/** Adds one via a private helper. */
export function helper(n: number): number {
  return addOne(n);
}

function addOne(n: number): number {
  return n + 1;
}

/** Never called by anything. */
export const unused = (): number => 42;

export function tested(): string {
  return 'x';
}

export function twinA(xs: number[]): number {
  let total = 0;
  for (const x of xs) total += x;
  return total;
}

export function twinB(xs: number[]): number {
  let total = 0;
  for (const x of xs) total += x;
  return total;
}
