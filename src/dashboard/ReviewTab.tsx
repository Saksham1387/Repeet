import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Question, Rating } from '../types';
import { dayKey, fmtDate } from '../shared/date';
import { RATINGS, preview, fmtInterval } from '../shared/srs';
import { dueList, relativeDue, plural, problemLabel } from '../shared/query';
import { sendRuntimeMessage } from '../shared/messaging';

interface QueueItem {
  slug: string;
  relearn: boolean;
}

interface ReviewSession {
  queue: QueueItem[];
  total: number;
  reviewed: number;
  revealed: boolean;
}

interface ReviewTabProps {
  questions: Record<string, Question>;
  onRefreshQuestions: () => void;
}

export const ReviewTab: React.FC<ReviewTabProps> = ({ questions, onRefreshQuestions }) => {
  const [session, setSession] = useState<ReviewSession>(() => {
    const list = dueList(questions, dayKey()).map((q) => ({ slug: q.slug, relearn: false }));
    return { queue: list, total: list.length, reviewed: 0, revealed: false };
  });

  const [notesValue, setNotesValue] = useState('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSession = useCallback(() => {
    const list = dueList(questions, dayKey()).map((q) => ({ slug: q.slug, relearn: false }));
    setSession({ queue: list, total: list.length, reviewed: 0, revealed: false });
  }, [questions]);

  const currentItem = session.queue[0];
  const currentQuestion = currentItem ? questions[currentItem.slug] : undefined;

  // Sync notes when card changes
  useEffect(() => {
    if (currentQuestion) {
      setNotesValue(currentQuestion.notes || '');
    }
  }, [currentQuestion?.slug]);

  const saveNotes = useCallback(
    (newNotes: string) => {
      if (!currentQuestion) return;
      if (newNotes !== currentQuestion.notes) {
        sendRuntimeMessage({
          type: 'SET_NOTES',
          slug: currentQuestion.slug,
          notes: newNotes,
        })
          .then(() => onRefreshQuestions())
          .catch(() => {});
      }
    },
    [currentQuestion, onRefreshQuestions]
  );

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotesValue(val);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveNotes(val), 700);
  };

  const handleNotesBlur = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveNotes(notesValue);
  };

  const handleRate = useCallback(
    async (rating: Rating) => {
      if (!currentItem) return;

      try {
        if (!currentItem.relearn) {
          await sendRuntimeMessage({
            type: 'REVIEW',
            slug: currentItem.slug,
            rating,
          });
          onRefreshQuestions();
        }

        setSession((prev) => {
          const nextQueue = prev.queue.slice(1);
          let nextReviewed = prev.reviewed;

          if (rating === 'again') {
            nextQueue.push({ slug: currentItem.slug, relearn: true });
          } else {
            nextReviewed += 1;
          }

          return {
            ...prev,
            queue: nextQueue,
            reviewed: nextReviewed,
            revealed: false,
          };
        });
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to save review');
      }
    },
    [currentItem, onRefreshQuestions]
  );

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ['TEXTAREA', 'INPUT', 'SELECT'].includes(target.tagName)) return;

      if (!session.queue.length) return;

      if (!session.revealed) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setSession((prev) => ({ ...prev, revealed: true }));
        }
        return;
      }

      if (currentItem?.relearn) {
        if (e.key === '1') handleRate('again');
        if (e.key === '2') handleRate('good');
      } else {
        if (e.key === '1') handleRate('again');
        if (e.key === '2') handleRate('hard');
        if (e.key === '3') handleRate('good');
        if (e.key === '4') handleRate('easy');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [session, currentItem, handleRate]);

  // Done / Empty State
  if (!currentItem || !currentQuestion) {
    const today = dayKey();
    const totalCount = Object.keys(questions).length;
    const upcoming = Object.values(questions)
      .filter((q) => q.card.due > today)
      .sort((a, b) => a.card.due.localeCompare(b.card.due));
    const nextDue = upcoming[0]?.card?.due;
    const nextCount = nextDue ? upcoming.filter((q) => q.card.due === nextDue).length : 0;

    let headline: string;
    let desc: string;

    if (!totalCount) {
      headline = 'Your deck is empty';
      desc =
        'Submit a solution on LeetCode and it is saved here automatically. Already solved some? Add them from the Library tab.';
    } else if (session.reviewed > 0) {
      headline = 'Session complete';
      desc = `You reviewed ${plural(session.reviewed, 'question')}.`;
    } else {
      headline = 'Nothing due right now';
      desc = 'Come back tomorrow, or solve something new today.';
    }

    if (totalCount && nextDue) {
      desc += ` Next up: ${plural(nextCount, 'question')} due ${relativeDue(nextDue, today)}.`;
    }

    return (
      <section className="done">
        <h1>{headline}</h1>
        <p>{desc}</p>
        <button type="button" className="btn" onClick={startSession}>
          Check for due questions
        </button>
      </section>
    );
  }

  const pct = session.total ? Math.round((100 * session.reviewed) / session.total) : 0;
  const firstSolve = currentQuestion.solves?.[0];
  const intervalPreview = preview(currentQuestion.card);

  return (
    <section>
      <div className="progress">
        <span>{`${Math.min(session.reviewed + 1, session.total)} of ${session.total}`}</span>
        <div className="bar">
          <i style={{ width: `${pct}%` }} />
        </div>
        {currentItem.relearn && <span className="chip">Second look</span>}
      </div>

      <article className="index-card">
        <header className="index-head">
          <h1>{problemLabel(currentQuestion)}</h1>
          <div className="meta">
            <span className={`chip ${currentQuestion.difficulty}`}>
              {currentQuestion.difficulty}
            </span>
            {(currentQuestion.tags || []).slice(0, 4).map((tag: string) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
            <a
              className="open"
              href={currentQuestion.url}
              target="_blank"
              rel="noreferrer"
            >
              Open on LeetCode
            </a>
          </div>
        </header>

        <div className="index-body">
          {session.revealed ? (
            <textarea
              className="notes ruled"
              rows={7}
              aria-label="Notes"
              placeholder="No notes yet. Write what you want to remember: the pattern, the trick, where you slipped."
              value={notesValue}
              onChange={handleNotesChange}
              onBlur={handleNotesBlur}
            />
          ) : (
            <p className="prompt">
              Say the approach and the complexity out loud first. Then check your notes.
            </p>
          )}
        </div>

        <footer className="index-foot">
          {firstSolve ? `First solved ${fmtDate(firstSolve.date)}. ` : ''}
          {`Reviewed ${plural(currentQuestion.reviews.length, 'time')}, forgotten ${plural(
            currentQuestion.card.lapses,
            'time'
          )}.`}
        </footer>
      </article>

      {!session.revealed ? (
        <div className="actions">
          <button
            type="button"
            className="btn primary big"
            onClick={() => setSession((prev) => ({ ...prev, revealed: true }))}
          >
            Show notes
          </button>
          <span className="hint">Space</span>
        </div>
      ) : currentItem.relearn ? (
        <div className="rates two">
          <button
            type="button"
            className="rate again"
            onClick={() => handleRate('again')}
          >
            <span className="rl">Still fuzzy</span>
            <span className="rs">Show again this session</span>
            <kbd>1</kbd>
          </button>
          <button
            type="button"
            className="rate good"
            onClick={() => handleRate('good')}
          >
            <span className="rl">Got it</span>
            <span className="rs">Done for today</span>
            <kbd>2</kbd>
          </button>
        </div>
      ) : (
        <div className="rates">
          {RATINGS.map((r) => (
            <button
              key={r.key}
              type="button"
              className={`rate ${r.key}`}
              onClick={() => handleRate(r.key)}
            >
              <span className="rl">{r.label}</span>
              <span className="rs">{fmtInterval(intervalPreview[r.key])}</span>
              <kbd>{r.hotkey}</kbd>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
