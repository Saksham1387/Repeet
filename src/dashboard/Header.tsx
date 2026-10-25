import React from 'react';

export type DashboardTab = 'review' | 'log' | 'library';

interface HeaderProps {
  currentTab: DashboardTab;
  dueCount: number;
  totalCount: number;
  streakCount: number;
  onTabChange: (tab: DashboardTab) => void;
}

const TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: 'review', label: 'Review' },
  { id: 'log', label: 'Daily log' },
  { id: 'library', label: 'Library' },
];

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  dueCount,
  totalCount,
  streakCount,
  onTabChange,
}) => {
  return (
    <header id="head">
      <div className="brand">
        <span className="logo" aria-hidden="true" />
        Repeet
      </div>

      <nav className="tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="tab"
            aria-current={currentTab === id ? 'page' : undefined}
            onClick={() => onTabChange(id)}
          >
            {label}
            {id === 'review' && dueCount > 0 && <span className="count">{dueCount}</span>}
            {id === 'library' && totalCount > 0 && (
              <span className="count quiet">{totalCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="streak">
        {streakCount > 0 ? `${streakCount}-day streak` : 'No streak yet'}
      </div>
    </header>
  );
};
