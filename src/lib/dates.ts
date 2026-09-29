const pad = (n: number) => String(n).padStart(2, '0');

/** The device's local calendar date as YYYY-MM-DD (the lesson date generate-lesson expects). */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Monday..Sunday (YYYY-MM-DD) of the week containing `date`. */
export function weekDays(date: string): string[] {
  const d = new Date(`${date}T12:00:00Z`);
  const monday = d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000;
  return Array.from({ length: 7 }, (_, i) => new Date(monday + i * 86_400_000).toISOString().slice(0, 10));
}

/** m:ss countdown; overtime shows as +m:ss. */
export function clock(secs: number): string {
  const a = Math.abs(Math.round(secs));
  return `${secs < 0 ? '+' : ''}${Math.floor(a / 60)}:${pad(a % 60)}`;
}
