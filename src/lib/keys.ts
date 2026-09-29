export type KeyAction = 'toggle' | 'next' | 'prev' | null;
const TYPING = ['INPUT', 'TEXTAREA', 'SELECT'];

/** Player shortcut for a key press (page-turn pedals send these keys); null while typing in a field. */
export function keyAction(key: string, targetTag: string | undefined): KeyAction {
  if (targetTag && TYPING.includes(targetTag.toUpperCase())) return null;
  if (key === ' ') return 'toggle';
  if (key === 'ArrowRight' || key === 'PageDown') return 'next';
  if (key === 'ArrowLeft' || key === 'PageUp') return 'prev';
  return null;
}
