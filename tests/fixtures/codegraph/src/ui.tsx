/** Rendered only through JSX. */
export function Box() {
  return <div />;
}

/** Renders Box; nothing renders it. */
export function Page() {
  return <Box />;
}

const pair = (a: string): [string, string] => [a, a];
/** Built at module level, so `pair` has a caller outside any function. */
export const TABLE = Object.fromEntries([pair('x')]);
