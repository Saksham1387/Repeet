import type {
  LeetCodeMeta,
  Question,
  RuntimeMessage,
  SubmissionResponse,
  SetNotesResponse,
  ReviewResponse,
  ImportResponse,
} from '../types';
import { dayKey } from '../shared/date';
import { newCard, applyRating } from '../shared/srs';
import { dueList } from '../shared/query';
import { getQuestions, putQuestions } from '../shared/storage';

/*
 * All writes go through this worker and are serialized, so two quick
 * submissions (or a review + a note edit) can never overwrite each other.
 */
let chain = Promise.resolve<unknown>(undefined);
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const p = chain.then(fn);
  chain = p.catch(() => {});
  return p;
};

function createQuestion(meta: LeetCodeMeta, today: string): Question {
  return {
    slug: meta.slug,
    title: meta.title,
    frontendId: meta.frontendId || null,
    difficulty: meta.difficulty || 'Unknown',
    tags: meta.tags || [],
    url: `https://leetcode.com/problems/${meta.slug}/`,
    notes: '',
    addedAt: today,
    solves: [],
    reviews: [],
    card: newCard(today),
  };
}

function refreshMeta(q: Question, meta: LeetCodeMeta): void {
  if (meta.difficulty && meta.difficulty !== 'Unknown') {
    q.title = meta.title;
    q.frontendId = meta.frontendId || q.frontendId;
    q.difficulty = meta.difficulty;
    q.tags = meta.tags || q.tags;
  }
}

const handlers = {
  async SUBMISSION(msg: Extract<RuntimeMessage, { type: 'SUBMISSION' }>): Promise<SubmissionResponse> {
    const { meta, submissionId, lang, runtime } = msg;
    const qs = await getQuestions();
    const today = dayKey();
    let q = qs[meta.slug];
    let isNew = false;

    if (!q) {
      q = qs[meta.slug] = createQuestion(meta, today);
      isNew = true;
    } else {
      refreshMeta(q, meta);
    }

    if (!q.solves.some((s) => s.id === submissionId)) {
      q.solves.push({ id: submissionId, date: today, ts: Date.now(), lang, runtime });
    }

    await putQuestions(qs);
    return { isNew, question: q };
  },

  async ADD_MANUAL(msg: Extract<RuntimeMessage, { type: 'ADD_MANUAL' }>): Promise<SubmissionResponse> {
    const { meta, notes } = msg;
    const qs = await getQuestions();
    const today = dayKey();
    let q = qs[meta.slug];
    let isNew = false;

    if (!q) {
      q = qs[meta.slug] = createQuestion(meta, today);
      q.solves.push({
        id: 'manual-' + Date.now(),
        date: today,
        ts: Date.now(),
        lang: '',
        runtime: '',
        manual: true,
      });
      isNew = true;
    } else {
      refreshMeta(q, meta);
    }

    if (typeof notes === 'string' && notes) {
      q.notes = notes;
    }

    await putQuestions(qs);
    return { isNew, question: q };
  },

  async SET_NOTES(msg: Extract<RuntimeMessage, { type: 'SET_NOTES' }>): Promise<SetNotesResponse> {
    const { slug, notes } = msg;
    const qs = await getQuestions();
    if (!qs[slug]) throw new Error('Question not in deck');
    qs[slug].notes = notes;
    await putQuestions(qs);
    return { question: qs[slug] };
  },

  async REVIEW(msg: Extract<RuntimeMessage, { type: 'REVIEW' }>): Promise<ReviewResponse> {
    const { slug, rating } = msg;
    const qs = await getQuestions();
    const q = qs[slug];
    if (!q) throw new Error('Question not in deck');
    const today = dayKey();
    q.card = applyRating(q.card, rating, today);
    q.reviews.push({ date: today, ts: Date.now(), rating });
    await putQuestions(qs);
    return { question: q };
  },

  async DELETE(msg: Extract<RuntimeMessage, { type: 'DELETE' }>): Promise<Record<string, never>> {
    const { slug } = msg;
    const qs = await getQuestions();
    delete qs[slug];
    await putQuestions(qs);
    return {};
  },

  async IMPORT(msg: Extract<RuntimeMessage, { type: 'IMPORT' }>): Promise<ImportResponse> {
    const { questions } = msg;
    const qs = await getQuestions();
    let added = 0;

    for (const [slug, q] of Object.entries(questions || {})) {
      if (qs[slug] || !q || !q.title || !q.card || !q.card.due) continue;
      qs[slug] = {
        ...q,
        slug,
        notes: q.notes || '',
        tags: q.tags || [],
        solves: q.solves || [],
        reviews: q.reviews || [],
      };
      added++;
    }

    await putQuestions(qs);
    return { added };
  },
};

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  const handler = msg && handlers[msg.type];
  if (!handler) return false;

  serial(async () => {
    // @ts-expect-error message handler mapping
    const result = await handler(msg);
    await refreshBadge();
    return result;
  }).then(
    (r) => sendResponse({ ok: true, ...(r as object) }),
    (e) => sendResponse({ ok: false, error: String((e && e.message) || e) })
  );

  return true; // asynchronous response
});

/* ---------- Badge + daily nudge ---------- */
async function refreshBadge(): Promise<number> {
  const n = dueList(await getQuestions(), dayKey()).length;
  await chrome.action.setBadgeText({ text: n ? String(n) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#3550F5' });
  return n;
}

async function maybeNotify(n: number): Promise<void> {
  if (!n || new Date().getHours() < 8) return;
  const today = dayKey();
  const { lastNotified } = (await chrome.storage.local.get('lastNotified')) as { lastNotified?: string };
  if (lastNotified === today) return;

  await chrome.storage.local.set({ lastNotified: today });
  chrome.notifications.create('due-' + today, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Time to revise',
    message: `${n} LeetCode question${n === 1 ? '' : 's'} due today.`,
  });
}

async function tick(): Promise<void> {
  const dueCount = await refreshBadge();
  await maybeNotify(dueCount);
}

function setup(): void {
  chrome.alarms.create('tick', { delayInMinutes: 1, periodInMinutes: 60 });
  tick();
}

chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'tick') tick();
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.questions) refreshBadge();
});
