import React, { useState, useMemo, useRef } from 'react';
import type { Question, ImportResponse, RescheduleResponse } from '../types';
import { dayKey } from '../shared/date';
import { fmtInterval } from '../shared/srs';
import { relativeDue, plural, problemLabel } from '../shared/query';
import { slugFromInput, fetchMeta } from '../shared/leetcode';
import { sendRuntimeMessage } from '../shared/messaging';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LibraryTabProps {
  questions: Record<string, Question>;
  onRefreshQuestions: () => void;
}

type SortOption = 'due' | 'new' | 'title';

export const LibraryTab: React.FC<LibraryTabProps> = ({ questions, onRefreshQuestions }) => {
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<string>('all');
  const [sort, setSort] = useState<SortOption>('due');
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [addLinkText, setAddLinkText] = useState('');
  const [flash, setFlash] = useState<{ text: string; isErr: boolean }>({ text: '', isErr: false });
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [dueDrafts, setDueDrafts] = useState<Record<string, string>>({});
  const [intervalDrafts, setIntervalDrafts] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = dayKey();

  const handleFlash = (text: string, isErr = false) => {
    setFlash({ text, isErr });
  };

  const handleAddByLink = async () => {
    const slug = slugFromInput(addLinkText);
    if (!slug) {
      return handleFlash('That does not look like a LeetCode problem link.', true);
    }
    handleFlash('Adding…');

    try {
      const meta = await fetchMeta(slug);
      await sendRuntimeMessage({ type: 'ADD_MANUAL', meta });
      setAddLinkText('');
      onRefreshQuestions();
      handleFlash(
        meta.difficulty === 'Unknown'
          ? 'Added, but the problem details could not be loaded. Check your connection.'
          : `Added ${meta.title}. First review is tomorrow.`
      );
    } catch (err) {
      handleFlash(err instanceof Error ? err.message : 'Failed to add problem', true);
    }
  };

  const handleExportBackup = () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      questions,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repeet-backup-${today}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as { questions?: Record<string, Question> };
      if (!data || typeof data.questions !== 'object') {
        throw new Error('This is not a Repeet backup file.');
      }

      const res = await sendRuntimeMessage<ImportResponse>({
        type: 'IMPORT',
        questions: data.questions,
      });

      onRefreshQuestions();
      handleFlash(`Imported ${plural(res.added, 'question')}.`);
    } catch (err) {
      handleFlash(err instanceof Error ? err.message : 'Import failed', true);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveNotes = async (slug: string) => {
    const notes = editingNotes[slug] !== undefined ? editingNotes[slug] : questions[slug]?.notes || '';
    try {
      await sendRuntimeMessage({ type: 'SET_NOTES', slug, notes });
      onRefreshQuestions();
      handleFlash('Notes saved.');
    } catch (err) {
      handleFlash(err instanceof Error ? err.message : 'Failed to save notes', true);
    }
  };

  const clearScheduleDraft = (slug: string) => {
    setDueDrafts((prev) => {
      if (!(slug in prev)) return prev;
      const next = { ...prev };
      delete next[slug];
      return next;
    });
    setIntervalDrafts((prev) => {
      if (!(slug in prev)) return prev;
      const next = { ...prev };
      delete next[slug];
      return next;
    });
  };

  const handleReschedule = async (
    q: Question,
    payload: { due?: string; interval?: number; reset?: boolean }
  ) => {
    try {
      await sendRuntimeMessage<RescheduleResponse>({
        type: 'RESCHEDULE',
        slug: q.slug,
        ...payload,
      });
      clearScheduleDraft(q.slug);
      onRefreshQuestions();
      handleFlash(
        payload.reset
          ? `"${q.title}" reset to a new card.`
          : `Schedule updated for "${q.title}".`
      );
    } catch (err) {
      handleFlash(err instanceof Error ? err.message : 'Failed to reschedule', true);
    }
  };

  const handleSetDue = (q: Question, due: string) => {
    if (!due) {
      handleFlash('Pick a due date first.', true);
      return;
    }
    void handleReschedule(q, { due });
  };

  const handleSetInterval = (q: Question, raw: string) => {
    const days = Number(raw);
    if (!Number.isFinite(days) || days < 1) {
      handleFlash('Interval must be at least 1 day.', true);
      return;
    }
    void handleReschedule(q, { interval: Math.round(days) });
  };

  const handleResetCard = (q: Question) => {
    if (
      !confirm(
        `Reset "${q.title}" to a new card? It will be due tomorrow; notes and review history stay.`
      )
    ) {
      return;
    }
    void handleReschedule(q, { reset: true });
  };

  const handleDelete = async (q: Question) => {
    if (
      !confirm(
        `Remove "${q.title}" from your deck? Its notes and history will be deleted.`
      )
    ) {
      return;
    }

    if (openSlug === q.slug) {
      setOpenSlug(null);
    }

    try {
      await sendRuntimeMessage({ type: 'DELETE', slug: q.slug });
      onRefreshQuestions();
      handleFlash(`Removed "${q.title}".`);
    } catch (err) {
      handleFlash(err instanceof Error ? err.message : 'Failed to delete problem', true);
    }
  };

  const filteredQuestions = useMemo(() => {
    let list = Object.values(questions);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((item) =>
        `${item.title} ${item.frontendId || ''} ${item.tags.join(' ')} ${item.notes}`
          .toLowerCase()
          .includes(q)
      );
    }

    if (difficulty !== 'all') {
      list = list.filter((item) => item.difficulty === difficulty);
    }

    list.sort((a, b) => {
      if (sort === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sort === 'new') {
        return (
          b.addedAt.localeCompare(a.addedAt) ||
          (b.solves[0]?.ts || 0) - (a.solves[0]?.ts || 0)
        );
      }
      return a.card.due.localeCompare(b.card.due);
    });

    return list;
  }, [questions, query, difficulty, sort]);

  return (
    <section>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search title, tag or notes"
          aria-label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select value={difficulty} onValueChange={setDifficulty}>
          <SelectTrigger aria-label="Difficulty" className="min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All difficulties</SelectItem>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
          <SelectTrigger aria-label="Sort" className="min-w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due">Due soonest</SelectItem>
            <SelectItem value="new">Recently added</SelectItem>
            <SelectItem value="title">Title</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="addform">
        <input
          type="text"
          placeholder="Add a solved problem: paste a LeetCode link or its slug"
          aria-label="Problem link"
          value={addLinkText}
          onChange={(e) => setAddLinkText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddByLink();
          }}
        />
        <button type="button" className="btn" onClick={handleAddByLink}>
          Add to deck
        </button>
      </div>

      <div className="tools">
        <button type="button" className="linkbtn" onClick={handleExportBackup}>
          Export backup
        </button>
        <button
          type="button"
          className="linkbtn"
          onClick={() => fileInputRef.current?.click()}
        >
          Import backup
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={handleImportFile}
        />
        <span id="flash" className={flash.isErr ? 'err' : ''} aria-live="polite">
          {flash.text}
        </span>
      </div>

      <ul className="list">
        {filteredQuestions.length > 0 ? (
          filteredQuestions.map((x) => {
            const isOpen = openSlug === x.slug;
            const currentNote =
              editingNotes[x.slug] !== undefined ? editingNotes[x.slug] : x.notes || '';

            return (
              <li key={x.slug}>
                <button
                  type="button"
                  className="row-head"
                  aria-expanded={isOpen}
                  onClick={() => setOpenSlug(isOpen ? null : x.slug)}
                >
                  <span className="row-title">{problemLabel(x)}</span>
                  <span className={`chip ${x.difficulty}`}>{x.difficulty}</span>
                  {(x.tags || []).slice(0, 2).map((t: string) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                  <span className="row-due">Due {relativeDue(x.card.due, today)}</span>
                </button>

                {isOpen && (
                  <div className="row-body">
                    <textarea
                      aria-label="Notes"
                      placeholder="Notes: the pattern, the trick, where you slipped…"
                      value={currentNote}
                      onChange={(e) =>
                        setEditingNotes((prev) => ({ ...prev, [x.slug]: e.target.value }))
                      }
                    />
                    <div className="schedule">
                      <span className="schedule-label">Reschedule</span>
                      <label className="schedule-field">
                        <span>Due</span>
                        <input
                          type="date"
                          aria-label={`Due date for ${x.title}`}
                          value={dueDrafts[x.slug] ?? x.card.due}
                          onChange={(e) =>
                            setDueDrafts((prev) => ({ ...prev, [x.slug]: e.target.value }))
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleSetDue(x, dueDrafts[x.slug] ?? x.card.due)}
                      >
                        Set due date
                      </button>
                      <label className="schedule-field">
                        <span>Interval</span>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          aria-label={`Interval in days for ${x.title}`}
                          value={intervalDrafts[x.slug] ?? String(x.card.interval)}
                          onChange={(e) =>
                            setIntervalDrafts((prev) => ({ ...prev, [x.slug]: e.target.value }))
                          }
                        />
                        <span>days</span>
                      </label>
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          handleSetInterval(
                            x,
                            intervalDrafts[x.slug] ?? String(x.card.interval)
                          )
                        }
                      >
                        Set interval
                      </button>
                      <button
                        type="button"
                        className="btn danger"
                        onClick={() => handleResetCard(x)}
                      >
                        Reset to new
                      </button>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => handleSaveNotes(x.slug)}
                      >
                        Save notes
                      </button>
                      <a href={x.url} target="_blank" rel="noreferrer">
                        Open on LeetCode
                      </a>
                      <button
                        type="button"
                        className="btn danger"
                        onClick={() => handleDelete(x)}
                      >
                        Remove
                      </button>
                      <span className="stats">
                        {`Interval ${fmtInterval(x.card.interval)}, ease ${x.card.ease}, ${plural(
                          x.solves.length,
                          'solve'
                        )}, ${plural(x.reviews.length, 'review')}`}
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })
        ) : (
          <li className="empty">
            {Object.keys(questions).length > 0
              ? 'No questions match your filters.'
              : 'Nothing here yet. Accepted LeetCode submissions are added automatically.'}
          </li>
        )}
      </ul>
    </section>
  );
};
