import React, { useEffect, useState } from 'react';
import type { Question } from '../types';
import { dayKey } from '../shared/date';
import { dueList, streak, plural, problemLabel } from '../shared/query';
import { getQuestions } from '../shared/storage';

export const App: React.FC = () => {
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQuestions().then((qs) => {
      setQuestions(qs);
      setLoading(false);
    });
  }, []);

  const openDashboard = (hash: string) => {
    chrome.tabs
      .create({ url: chrome.runtime.getURL(`dashboard.html#${hash}`) })
      .then(() => window.close());
  };

  if (loading) {
    return <main id="root" />;
  }

  const today = dayKey();
  const total = Object.keys(questions).length;
  const dueCount = dueList(questions, today).length;
  const streakCount = streak(questions, today);
  const solvedToday = Object.values(questions).filter((q) =>
    (q.solves || []).some((s) => s.date === today)
  );

  const headline = !total
    ? 'Your deck is empty'
    : dueCount
    ? `${plural(dueCount, 'question')} to revise today`
    : 'Nothing due today';

  const sub = !total
    ? 'Submit a solution on LeetCode and it is saved here automatically.'
    : streakCount
    ? `${streakCount}-day streak. Keep it going.`
    : 'Solve or review something to start a streak.';

  return (
    <main id="root">
      <h1 className="headline">{headline}</h1>
      <p className="sub">{sub}</p>

      {dueCount > 0 && (
        <button
          type="button"
          className="btn primary wide big"
          onClick={() => openDashboard('review')}
        >
          Start review
        </button>
      )}

      <h2>Solved today</h2>
      {solvedToday.length > 0 ? (
        <ul className="solved">
          {solvedToday.slice(0, 6).map((q) => (
            <li key={q.slug}>
              <a href={q.url} target="_blank" rel="noreferrer">
                {problemLabel(q)}
              </a>
              <span className={`chip ${q.difficulty}`}>{q.difficulty}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Nothing yet. Accepted submissions appear here.</p>
      )}

      <footer>
        <button type="button" onClick={() => openDashboard('log')}>
          Daily log
        </button>
        <button type="button" onClick={() => openDashboard('library')}>
          Library
        </button>
      </footer>
    </main>
  );
};
