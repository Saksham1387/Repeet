export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Unknown';

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface RatingOption {
  key: Rating;
  label: string;
  hotkey: string;
}

export interface Card {
  ease: number;
  interval: number;
  reps: number;
  lapses: number;
  due: string;
  lastReviewed: string | null;
}

export interface SolveRecord {
  id: string;
  date: string;
  ts: number;
  lang: string;
  runtime: string;
  manual?: boolean;
}

export interface ReviewRecord {
  date: string;
  ts: number;
  rating: Rating;
}

export interface LeetCodeMeta {
  slug: string;
  title: string;
  frontendId: string | null;
  difficulty: Difficulty;
  tags: string[];
}

export interface Question {
  slug: string;
  title: string;
  frontendId: string | null;
  difficulty: Difficulty;
  tags: string[];
  url: string;
  notes: string;
  addedAt: string;
  solves: SolveRecord[];
  reviews: ReviewRecord[];
  card: Card;
}

export interface StorageSchema {
  questions?: Record<string, Question>;
  lastNotified?: string;
}

export type RuntimeMessage =
  | { type: 'SUBMISSION'; meta: LeetCodeMeta; submissionId: string; lang: string; runtime: string }
  | { type: 'ADD_MANUAL'; meta: LeetCodeMeta; notes?: string }
  | { type: 'SET_NOTES'; slug: string; notes: string }
  | { type: 'REVIEW'; slug: string; rating: Rating }
  | { type: 'DELETE'; slug: string }
  | { type: 'IMPORT'; questions: Record<string, Question> };

export type RuntimeResponse<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export interface SubmissionResponse {
  isNew: boolean;
  question: Question;
}

export interface SetNotesResponse {
  question: Question;
}

export interface ReviewResponse {
  question: Question;
}

export interface ImportResponse {
  added: number;
}

export interface InjectedMessage {
  __lcRepeet: true;
  type: 'ACCEPTED';
  submissionId: string;
  lang: string;
  runtime: string;
}
