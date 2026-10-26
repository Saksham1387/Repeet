// src/shared/date.ts
var pad = (n) => String(n).padStart(2, "0");
var dayKey = (d = /* @__PURE__ */ new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
var parseKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
var addDays = (k, n) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
var diffDays = (a, b) => Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 864e5);

// src/shared/srs.ts
var MAX_INTERVAL = 365;
var newCard = (today) => ({
  ease: 2.5,
  interval: 1,
  reps: 0,
  lapses: 0,
  due: addDays(today, 1),
  lastReviewed: null
});
function step(card, rating) {
  let { ease, interval, reps, lapses } = card;
  switch (rating) {
    case "again":
      lapses += 1;
      ease = Math.max(1.3, ease - 0.2);
      interval = 1;
      reps = 0;
      break;
    case "hard":
      ease = Math.max(1.3, ease - 0.15);
      interval = Math.max(interval + 1, Math.round(interval * 1.2));
      reps += 1;
      break;
    case "good":
      interval = reps === 0 ? 3 : Math.max(interval + 1, Math.round(interval * ease));
      reps += 1;
      break;
    case "easy":
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
    lapses
  };
}
var applyRating = (card, rating, today) => {
  const n = step(card, rating);
  return {
    ...n,
    due: addDays(today, n.interval),
    lastReviewed: today
  };
};

// src/shared/query.ts
var dueList = (qs, today) => Object.values(qs).filter((q) => q.card.due <= today).sort((a, b) => a.card.due.localeCompare(b.card.due));

// src/shared/storage.ts
var getQuestions = async () => {
  const data = await chrome.storage.local.get("questions");
  return data.questions || {};
};
var putQuestions = async (qs) => {
  await chrome.storage.local.set({ questions: qs });
};

// src/background/index.ts
var chain = Promise.resolve(void 0);
var serial = (fn) => {
  const p = chain.then(fn);
  chain = p.catch(() => {
  });
  return p;
};
function createQuestion(meta, today) {
  return {
    slug: meta.slug,
    title: meta.title,
    frontendId: meta.frontendId || null,
    difficulty: meta.difficulty || "Unknown",
    tags: meta.tags || [],
    url: `https://leetcode.com/problems/${meta.slug}/`,
    notes: "",
    addedAt: today,
    solves: [],
    reviews: [],
    card: newCard(today)
  };
}
function refreshMeta(q, meta) {
  if (meta.difficulty && meta.difficulty !== "Unknown") {
    q.title = meta.title;
    q.frontendId = meta.frontendId || q.frontendId;
    q.difficulty = meta.difficulty;
    q.tags = meta.tags || q.tags;
  }
}
var handlers = {
  async SUBMISSION(msg) {
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
  async ADD_MANUAL(msg) {
    const { meta, notes } = msg;
    const qs = await getQuestions();
    const today = dayKey();
    let q = qs[meta.slug];
    let isNew = false;
    if (!q) {
      q = qs[meta.slug] = createQuestion(meta, today);
      q.solves.push({
        id: "manual-" + Date.now(),
        date: today,
        ts: Date.now(),
        lang: "",
        runtime: "",
        manual: true
      });
      isNew = true;
    } else {
      refreshMeta(q, meta);
    }
    if (typeof notes === "string" && notes) {
      q.notes = notes;
    }
    await putQuestions(qs);
    return { isNew, question: q };
  },
  async SET_NOTES(msg) {
    const { slug, notes } = msg;
    const qs = await getQuestions();
    if (!qs[slug]) throw new Error("Question not in deck");
    qs[slug].notes = notes;
    await putQuestions(qs);
    return { question: qs[slug] };
  },
  async REVIEW(msg) {
    const { slug, rating } = msg;
    const qs = await getQuestions();
    const q = qs[slug];
    if (!q) throw new Error("Question not in deck");
    const today = dayKey();
    q.card = applyRating(q.card, rating, today);
    q.reviews.push({ date: today, ts: Date.now(), rating });
    await putQuestions(qs);
    return { question: q };
  },
  async RESCHEDULE(msg) {
    const { slug, due, interval, reset } = msg;
    const qs = await getQuestions();
    const q = qs[slug];
    if (!q) throw new Error("Question not in deck");
    const today = dayKey();
    if (reset) {
      q.card = newCard(today);
    } else if (typeof due === "string") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || dayKey(parseKey(due)) !== due) {
        throw new Error("Invalid due date");
      }
      q.card = {
        ...q.card,
        due,
        interval: Math.max(1, Math.min(MAX_INTERVAL, diffDays(today, due)))
      };
    } else if (typeof interval === "number") {
      if (!Number.isFinite(interval) || interval < 1) {
        throw new Error("Interval must be at least 1 day");
      }
      const days = Math.min(MAX_INTERVAL, Math.round(interval));
      q.card = { ...q.card, interval: days, due: addDays(today, days) };
    } else {
      throw new Error("Provide a due date, an interval, or reset the card");
    }
    await putQuestions(qs);
    return { question: q };
  },
  async DELETE(msg) {
    const { slug } = msg;
    const qs = await getQuestions();
    delete qs[slug];
    await putQuestions(qs);
    return {};
  },
  async IMPORT(msg) {
    const { questions } = msg;
    const qs = await getQuestions();
    let added = 0;
    for (const [slug, q] of Object.entries(questions || {})) {
      if (qs[slug] || !q || !q.title || !q.card || !q.card.due) continue;
      qs[slug] = {
        ...q,
        slug,
        notes: q.notes || "",
        tags: q.tags || [],
        solves: q.solves || [],
        reviews: q.reviews || []
      };
      added++;
    }
    await putQuestions(qs);
    return { added };
  }
};
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = msg && handlers[msg.type];
  if (!handler) return false;
  serial(async () => {
    const result = await handler(msg);
    await refreshBadge();
    return result;
  }).then(
    (r) => sendResponse({ ok: true, ...r }),
    (e) => sendResponse({ ok: false, error: String(e && e.message || e) })
  );
  return true;
});
async function refreshBadge() {
  const n = dueList(await getQuestions(), dayKey()).length;
  await chrome.action.setBadgeText({ text: n ? String(n) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#3550F5" });
  return n;
}
async function maybeNotify(n) {
  if (!n || (/* @__PURE__ */ new Date()).getHours() < 8) return;
  const today = dayKey();
  const { lastNotified } = await chrome.storage.local.get("lastNotified");
  if (lastNotified === today) return;
  await chrome.storage.local.set({ lastNotified: today });
  chrome.notifications.create("due-" + today, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Time to revise",
    message: `${n} LeetCode question${n === 1 ? "" : "s"} due today.`
  });
}
async function tick() {
  const dueCount = await refreshBadge();
  await maybeNotify(dueCount);
}
function setup() {
  chrome.alarms.create("tick", { delayInMinutes: 1, periodInMinutes: 60 });
  tick();
}
chrome.runtime.onInstalled.addListener(setup);
chrome.runtime.onStartup.addListener(setup);
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "tick") tick();
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.questions) refreshBadge();
});
