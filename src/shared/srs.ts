import type { Card, Rating, RatingOption } from '../types';
import { addDays } from './date';

export const MAX_INTERVAL = 365;

export const RATINGS: readonly RatingOption[] = [
  { key: 'again', label: 'Again', hotkey: '1' },
  { key: 'hard', label: 'Hard', hotkey: '2' },
  { key: 'good', label: 'Good', hotkey: '3' },
  { key: 'easy', label: 'Easy', hotkey: '4' },
] as const;

// A freshly solved question is first reviewed the next day.
export const newCard = (today: string): Card => ({
  ease: 2.5,
  interval: 1,
  reps: 0,
  lapses: 0,
  due: addDays(today, 1),
  lastReviewed: null,
});

export function step(
  card: Card,
  rating: Rating
): { ease: number; interval: number; reps: number; lapses: number } {
  let { ease, interval, reps, lapses } = card;

  switch (rating) {
    case 'again':
      lapses += 1;
      ease = Math.max(1.3, ease - 0.2);
      interval = 1;
      reps = 0;
      break;

    case 'hard':
      ease = Math.max(1.3, ease - 0.15);
      interval = Math.max(interval + 1, Math.round(interval * 1.2));
      reps += 1;
      break;

    case 'good':
      interval = reps === 0 ? 3 : Math.max(interval + 1, Math.round(interval * ease));
      reps += 1;
      break;

    case 'easy':
      ease += 0.15;
      interval = reps === 0 ? 6 : Math.max(interval + 2, Math.round(interval * ease * 1.3));
      reps += 1;
      break;

    default:
      throw new Error(`Unknown rating: ${rating}`);
  }

  return {
    ease: +ease.toFixed(2),
    interval: Math.min(MAX_INTERVAL, interval),
    reps,
    lapses,
  };
}

export const applyRating = (card: Card, rating: Rating, today: string): Card => {
  const n = step(card, rating);
  return {
    ...n,
    due: addDays(today, n.interval),
    lastReviewed: today,
  };
};

export const preview = (card: Card): Record<Rating, number> => ({
  again: step(card, 'again').interval,
  hard: step(card, 'hard').interval,
  good: step(card, 'good').interval,
  easy: step(card, 'easy').interval,
});

export const fmtInterval = (d: number): string => {
  if (d < 14) return `${d}d`;
  if (d < 60) return `${Math.round(d / 7)}w`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return '1y';
};
