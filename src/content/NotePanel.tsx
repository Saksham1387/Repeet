import React, { useState, useEffect, useRef } from 'react';
import type { LeetCodeMeta, Question, SetNotesResponse, SubmissionResponse } from '../types';
import { dayKey } from '../shared/date';
import { relativeDue } from '../shared/query';
import { sendRuntimeMessage } from '../shared/messaging';
import panelTailwindCss from '../../.cache/content-tailwind.css';

export interface PanelState {
  slug: string;
  meta: LeetCodeMeta;
  q: Question | null;
  accepted: boolean;
  isNew: boolean;
}

interface NotePanelProps {
  currentSlug: string | null;
  panelState: PanelState | null;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onUpdateQuestion: (q: Question) => void;
}

const PANEL_CSS = `
  @layer components {
  :host { all: initial; }
  * { box-sizing: border-box; }
  .tab {
    position: fixed; right: 0; top: 42%; z-index: 2147483646;
    writing-mode: vertical-rl; padding: 12px 7px; border: 0; cursor: pointer;
    background: #16213A; color: #fff; font: 600 12px/1 system-ui, sans-serif; letter-spacing: .04em;
    border-radius: 6px 0 0 6px; box-shadow: 0 2px 10px rgba(0,0,0,.25);
  }
  .tab:hover { background: #3550F5; }
  .panel {
    position: fixed; right: 16px; top: 84px; z-index: 2147483647; width: 330px;
    background: #fff; color: #16213A; border: 1px solid #BFC8D8; border-radius: 4px;
    box-shadow: 0 18px 40px -12px rgba(22,33,58,.45);
    font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 12px 14px 10px; border-bottom: 2px solid #E5484D; }
  .status { font-weight: 600; }
  .status.ok { color: #1F9D6B; }
  .x { border: 0; background: none; font-size: 20px; line-height: 1; cursor: pointer; color: #5B6784; padding: 0 2px; }
  .x:hover { color: #16213A; }
  .body { padding: 12px 14px 4px; }
  .title { font: 600 17px/1.25 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; margin: 0 0 6px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
  .chip { font-size: 11px; padding: 1px 7px; border-radius: 4px; border: 1px solid #BFC8D8; color: #5B6784; }
  .chip.Easy { color: #1F9D6B; border-color: currentColor; }
  .chip.Medium { color: #B97A00; border-color: currentColor; }
  .chip.Hard { color: #D6454A; border-color: currentColor; }
  .due { color: #5B6784; font-size: 12px; margin-bottom: 8px; }
  textarea {
    display: block; width: 100%; min-height: 112px; resize: vertical; border: 0; outline: 0;
    padding: 0; margin: 0; color: #16213A; background-color: transparent; background-attachment: local;
    background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 21px, #DCE5F7 21px, #DCE5F7 22px);
    font: 13px/22px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px 12px; }
  .msg { font-size: 12px; color: #5B6784; min-height: 1em; }
  .msg.err { color: #D6454A; }
  .primary { border: 0; border-radius: 6px; background: #3550F5; color: #fff; cursor: pointer;
    font: 600 13px/1 system-ui, sans-serif; padding: 9px 14px; }
  .primary:hover { background: #2640E0; }
  .primary:disabled { opacity: .6; cursor: default; }
  :focus-visible { outline: 2px solid #3550F5; outline-offset: 2px; }
  }
`;

export const NotePanel: React.FC<NotePanelProps> = ({
  currentSlug,
  panelState,
  isOpen,
  onToggle,
  onClose,
  onUpdateQuestion,
}) => {
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<{ text: string; isErr: boolean }>({ text: '', isErr: false });
  const [loading, setLoading] = useState(false);
  const touchedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync initial notes whenever panelState changes
  useEffect(() => {
    if (panelState) {
      setNotes(panelState.q?.notes || '');
      setMessage({ text: '', isErr: false });
      touchedRef.current = false;
    }
  }, [panelState]);

  // Handle 30s auto close on accepted submission
  useEffect(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }

    if (isOpen && panelState?.accepted) {
      autoCloseTimerRef.current = setTimeout(() => {
        if (!touchedRef.current && document.activeElement !== textareaRef.current) {
          onClose();
        }
      }, 30000);
    }

    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, [isOpen, panelState, onClose]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    touchedRef.current = true;
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    setNotes(e.target.value);
  };

  const handleSave = async () => {
    if (!panelState || loading) return;
    setLoading(true);

    try {
      if (panelState.q) {
        const res = await sendRuntimeMessage<SetNotesResponse>({
          type: 'SET_NOTES',
          slug: panelState.slug,
          notes,
        });
        onUpdateQuestion(res.question);
        setMessage({ text: 'Notes saved', isErr: false });
      } else {
        const res = await sendRuntimeMessage<SubmissionResponse>({
          type: 'ADD_MANUAL',
          meta: panelState.meta,
          notes,
        });
        onUpdateQuestion(res.question);
        setMessage({ text: 'Added to your deck', isErr: false });
      }
      touchedRef.current = false;
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : 'Failed to save notes',
        isErr: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  // Prevent LeetCode hotkeys inside the panel
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  if (!currentSlug) return null;

  const meta = panelState?.meta;
  const q = panelState?.q;
  const isAccepted = panelState?.accepted;
  const isNew = panelState?.isNew;

  const statusText = isAccepted
    ? isNew
      ? 'Accepted. Saved to your deck.'
      : 'Accepted. Already in your deck.'
    : q
    ? 'In your deck'
    : 'Not in your deck yet';

  const dueText = q
    ? `Due ${relativeDue(q.card.due, dayKey())}`
    : 'Add it to start reviewing it.';

  return (
    <>
      <style>{panelTailwindCss}</style>
      <style>{PANEL_CSS}</style>

      {/* Slim vertical trigger tab */}
      <button className="tab" type="button" onClick={onToggle}>
        Repeet
      </button>

      {/* Slide-out card panel */}
      {isOpen && panelState && (
        <section
          className="panel"
          role="dialog"
          aria-label="Repeet notes"
          onKeyDown={stopPropagation}
          onKeyUp={stopPropagation}
          onKeyPress={stopPropagation}
        >
          <div className="head">
            <span className={`status ${isAccepted ? 'ok' : ''}`}>{statusText}</span>
            <button className="x" type="button" aria-label="Close" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="body">
            <h2 className="title">
              {meta ? `${meta.frontendId ? meta.frontendId + '. ' : ''}${meta.title}` : currentSlug}
            </h2>

            <div className="chips">
              {meta && (
                <>
                  <span className={`chip ${meta.difficulty}`}>{meta.difficulty}</span>
                  {(meta.tags || []).slice(0, 3).map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                </>
              )}
            </div>

            <div className="due">{dueText}</div>

            <textarea
              ref={textareaRef}
              aria-label="Notes"
              placeholder="Notes: the pattern, the trick, where you slipped…"
              value={notes}
              onChange={handleNotesChange}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="foot">
            <span className={`msg ${message.isErr ? 'err' : ''}`} aria-live="polite">
              {message.text}
            </span>
            <button
              className="primary"
              type="button"
              disabled={loading}
              onClick={handleSave}
            >
              {q ? 'Save notes' : 'Add to deck'}
            </button>
          </div>
        </section>
      )}
    </>
  );
};
