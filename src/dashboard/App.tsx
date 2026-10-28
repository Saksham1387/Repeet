import React, { useState, useEffect, useCallback } from 'react';
import type { Question } from '../types';
import { dayKey } from '../shared/date';
import { dueList, streak } from '../shared/query';
import { getQuestions } from '../shared/storage';
import { Header, type DashboardTab } from './Header';
import { ReviewTab } from './ReviewTab';
import { DailyLogTab } from './DailyLogTab';
import { LibraryTab } from './LibraryTab';

const VALID_TABS: DashboardTab[] = ['review', 'log', 'library'];

const TAB_COPY: Record<
  DashboardTab,
  { index: string; label: string; title: string; sub: string }
> = {
  review: {
    index: '[01]',
    label: 'Review',
    title: 'review.',
    sub: 'Retrieve the pattern before you reveal the note.',
  },
  log: {
    index: '[02]',
    label: 'Daily log',
    title: 'daily log.',
    sub: 'Every solve and review, kept by day.',
  },
  library: {
    index: '[03]',
    label: 'Library',
    title: 'library.',
    sub: 'Search the deck, refine notes, and reschedule cards.',
  },
};

export const App: React.FC = () => {
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [tab, setTab] = useState<DashboardTab>(() => {
    const hash = window.location.hash.slice(1) as DashboardTab;
    return VALID_TABS.includes(hash) ? hash : 'review';
  });

  const refreshQuestions = useCallback(() => {
    getQuestions().then(setQuestions);
  }, []);

  useEffect(() => {
    refreshQuestions();

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes.questions) {
        setQuestions((changes.questions.newValue as Record<string, Question>) || {});
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [refreshQuestions]);

  // Sync hash change
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) as DashboardTab;
      if (VALID_TABS.includes(hash) && hash !== tab) {
        setTab(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [tab]);

  const handleTabChange = (newTab: DashboardTab) => {
    setTab(newTab);
    if (window.location.hash !== `#${newTab}`) {
      window.history.replaceState(null, '', `#${newTab}`);
    }
  };

  const today = dayKey();
  const dueCount = dueList(questions, today).length;
  const totalCount = Object.keys(questions).length;
  const streakCount = streak(questions, today);

  return (
    <>
      <Header
        currentTab={tab}
        dueCount={dueCount}
        totalCount={totalCount}
        streakCount={streakCount}
        onTabChange={handleTabChange}
      />
      <main id="body">
        <div className="page-head">
          <p className="eyebrow">
            <span>{TAB_COPY[tab].index}</span>
            {TAB_COPY[tab].label}
            <span className="rule" aria-hidden="true" />
          </p>
          <h1>{TAB_COPY[tab].title}</h1>
          <p className="page-sub">{TAB_COPY[tab].sub}</p>
        </div>

        {tab === 'review' && (
          <ReviewTab questions={questions} onRefreshQuestions={refreshQuestions} />
        )}
        {tab === 'log' && <DailyLogTab questions={questions} />}
        {tab === 'library' && (
          <LibraryTab questions={questions} onRefreshQuestions={refreshQuestions} />
        )}
      </main>
    </>
  );
};
