export const pad = (n: number): string => String(n).padStart(2, '0');

export const dayKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseKey = (k: string): Date => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (k: string, n: number): string => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

// Number of days from a to b (b - a)
export const diffDays = (a: string, b: string): number =>
  Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 864e5);

export const fmtDate = (key: string, opts?: Intl.DateTimeFormatOptions): string =>
  parseKey(key).toLocaleDateString(undefined, opts || { day: 'numeric', month: 'short' });

export const dayLabel = (key: string, today: string): string => {
  const d = diffDays(key, today);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return parseKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};
