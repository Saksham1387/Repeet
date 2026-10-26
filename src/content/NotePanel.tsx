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
  :host {
    all: initial;
    --p-bg: #fff;
    --p-ink: #16213A;
    --p-muted: #5B6784;
    --p-line: #BFC8D8;
    --p-rule: #DCE5F7;
    --p-margin: #E5484D;
    --p-accent: #3550F5;
    --p-accent-hover: #2640E0;
    --p-easy: #1F9D6B;
    --p-medium: #B97A00;
    --p-hard: #D6454A;
    --p-tab-bg: #16213A;
    --p-tab-text: #fff;
    --p-shadow: rgba(22,33,58,.45);
  }
  :host(.dark) {
    --p-bg: #161D2B;
    --p-ink: #E6EAF2;
    --p-muted: #9AA6BD;
    --p-line: #2A3446;
    --p-rule: #243047;
    --p-margin: #FF6B6F;
    --p-accent: #7488FF;
    --p-accent-hover: #5F74F0;
    --p-easy: #4ADE9B;
    --p-medium: #F5B84B;
    --p-hard: #FF7A7E;
    --p-tab-bg: #2A3446;
    --p-tab-text: #E6EAF2;
    --p-shadow: rgba(0,0,0,.55);
  }
  * { box-sizing: border-box; }
  .tab {
    position: fixed; right: 0; top: 42%; z-index: 2147483646;
    writing-mode: vertical-rl; padding: 12px 7px; border: 0; cursor: pointer;
    background: var(--p-tab-bg); color: var(--p-tab-text); font: 600 12px/1 system-ui, sans-serif; letter-spacing: .04em;
    border-radius: 6px 0 0 6px; box-shadow: 0 2px 10px rgba(0,0,0,.25);
  }
  .tab:hover { background: var(--p-accent); }
  .panel {
    position: fixed; right: 16px; top: 84px; z-index: 2147483647; width: 330px;
    background: var(--p-bg); color: var(--p-ink); border: 1px solid var(--p-line); border-radius: 4px;
    box-shadow: 0 18px 40px -12px var(--p-shadow);
    font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 12px 14px 10px; border-bottom: 2px solid var(--p-margin); }
  .status { font-weight: 600; }
  .status.ok { color: var(--p-easy); }
  .x { border: 0; background: none; font-size: 20px; line-height: 1; cursor: pointer; color: var(--p-muted); padding: 0 2px; }
  .x:hover { color: var(--p-ink); }
  .body { padding: 12px 14px 4px; }
  .title { font: 600 17px/1.25 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; margin: 0 0 6px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
  .chip { font-size: 11px; padding: 1px 7px; border-radius: 4px; border: 1px solid var(--p-line); color: var(--p-muted); }
  .chip.Easy { color: var(--p-easy); border-color: currentColor; }
  .chip.Medium { color: var(--p-medium); border-color: currentColor; }
  .chip.Hard { color: var(--p-hard); border-color: currentColor; }
  .due { color: var(--p-muted); font-size: 12px; margin-bottom: 8px; }
  textarea {
    display: block; width: 100%; min-height: 112px; resize: vertical; border: 0; outline: 0;
    padding: 0; margin: 0; color: var(--p-ink); background-color: transparent; background-attachment: local;
    background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 21px, var(--p-rule) 21px, var(--p-rule) 22px);
    font: 13px/22px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px 12px; }
  .msg { font-size: 12px; color: var(--p-muted); min-height: 1em; }
  .msg.err { color: var(--p-hard); }
  .primary { border: 0; border-radius: 6px; background: var(--p-accent); color: #fff; cursor: pointer;
    font: 600 13px/1 system-ui, sans-serif; padding: 9px 14px; }
  .primary:hover { background: var(--p-accent-hover); }
  .primary:disabled { opacity: .6; cursor: default; }
  :focus-visible { outline: 2px solid var(--p-accent); outline-offset: 2px; }
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
