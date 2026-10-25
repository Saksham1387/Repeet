import type { Question } from '../types';
import { addDays, diffDays } from './date';

export const dueList = (qs: Record<string, Question>, today: string): Question[] =>
  Object.values(qs)
    .filter((q) => q.card.due <= today)
    .sort((a, b) => a.card.due.localeCompare(b.card.due));

export const activityDays = (qs: Record<string, Question>): Set<string> => {
  const s = new Set<string>();
  for (const q of Object.values(qs)) {
    (q.solves || []).forEach((x) => s.add(x.date));
    (q.reviews || []).forEach((x) => s.add(x.date));
  }
  return s;
};

export const streak = (qs: Record<string, Question>, today: string): number => {
  const days = activityDays(qs);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
};

export const relativeDue = (due: string, today: string): string => {
  const d = diffDays(today, due);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
};

export const plural = (n: number, one: string, many?: string): string =>
  `${n} ${n === 1 ? one : many || one + 's'}`;

export const problemLabel = (q: { frontendId?: string | null; title: string }): string =>
  (q.frontendId ? `${q.frontendId}. ` : '') + q.title;
