import React, { useMemo } from 'react';
import type { Question, SolveRecord, ReviewRecord } from '../types';
import { dayKey, parseKey, dayLabel } from '../shared/date';
import { plural, problemLabel } from '../shared/query';

interface DailyLogTabProps {
  questions: Record<string, Question>;
}

export const DailyLogTab: React.FC<DailyLogTabProps> = ({ questions }) => {
  const today = dayKey();

  const { byDay, dates } = useMemo(() => {
    const map: Record<string, { solved: Set<string>; reviews: number }> = {};
    const getEntry = (k: string) => (map[k] ||= { solved: new Set(), reviews: 0 });

    for (const q of Object.values(questions)) {
      (q.solves || []).forEach((s: SolveRecord) => getEntry(s.date).solved.add(q.slug));
      (q.reviews || []).forEach((r: ReviewRecord) => {
        getEntry(r.date).reviews++;
      });
    }

    const sortedDates = Object.keys(map).sort().reverse();
    return { byDay: map, dates: sortedDates };
  }, [questions]);

  // 26-week activity grid
  const heatmapCells = useMemo(() => {
    const weeks = 26;
    const end = parseKey(today);
    const start = new Date(end);
    start.setDate(end.getDate() - end.getDay() - (weeks - 1) * 7);

    const cells: React.ReactNode[] = [];
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);

      if (d > end) {
        cells.push(<i key={`gap-${i}`} className="gap" />);
        continue;
      }

      const k = dayKey(d);
      const entry = byDay[k];
      const count = entry ? entry.solved.size + entry.reviews : 0;
      const lvl = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : count < 10 ? 3 : 4;

      cells.push(
        <i
          key={k}
          className={`l${lvl}`}
          title={`${k}: ${plural(count, 'action')}`}
        />
      );
    }
    return cells;
  }, [today, byDay]);

  return (
    <section>
      <div className="heat" role="img" aria-label="Activity over the last 26 weeks">
        {heatmapCells}
      </div>
      <p className="cap">
        Last 26 weeks. Darker squares mean more questions solved and reviewed that day.
      </p>

      {dates.length > 0 ? (
        dates.map((dateKey) => {
          const dayData = byDay[dateKey];
          const solvedItems = [...dayData.solved]
            .map((slug) => questions[slug])
            .filter(Boolean);

          const tallyParts: string[] = [];
          if (dayData.solved.size > 0) {
            tallyParts.push(`${plural(dayData.solved.size, 'question')} solved`);
          }
          if (dayData.reviews > 0) {
            tallyParts.push(`${plural(dayData.reviews, 'review')} done`);
          }
          const tallyText = tallyParts.join(', ');

          return (
            <section key={dateKey} className="day">
              <h2>{dayLabel(dateKey, today)}</h2>
              <p className="tally">{tallyText}</p>

              {solvedItems.length > 0 && (
                <ul className="items">
                  {solvedItems.map((q) => {
                    const isNew = q.addedAt === dateKey;
                    const notes = (q.notes || '').trim();

                    return (
                      <li key={q.slug}>
                        <div className="item-top">
                          <a href={q.url} target="_blank" rel="noreferrer">
                            {problemLabel(q)}
                          </a>
                          <span className={`chip ${q.difficulty}`}>{q.difficulty}</span>
                          {(q.tags || []).slice(0, 3).map((tag: string) => (
                            <span key={tag} className="chip">
                              {tag}
                            </span>
                          ))}
                          <span className="chip">{isNew ? 'New' : 'Solved again'}</span>
                        </div>
                        {notes && (
                          <p className="item-notes">
                            {notes.length > 220 ? `${notes.slice(0, 220)}…` : notes}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })
      ) : (
        <p className="empty">
          No activity yet. Your accepted submissions will be logged here by day.
        </p>
      )}
    </section>
  );
};
