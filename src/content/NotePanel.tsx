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
    --p-bg: #f4eee4;
    --p-ink: #171412;
    --p-muted: #6d655d;
    --p-dim: #9b9288;
    --p-line: #d8cdbd;
    --p-card: #fbf7f0;
    --p-rule: #e3dacb;
    --p-accent: #b64e33;
    --p-accent-hover: #9d3f28;
    --p-easy: #5c7050;
    --p-medium: #8f642c;
    --p-hard: #ab3f27;
    --p-on-accent: #fffaf2;
    --p-tab-bg: #171412;
    --p-tab-text: #f2ece3;
    --p-shadow: rgba(23,20,18,.2);
    --p-sans: "Geist", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --p-mono: "Geist Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace;
  }
  :host(.dark) {
    --p-bg: #171412;
    --p-ink: #f2ece3;
    --p-muted: #9b9288;
    --p-dim: #6d655d;
    --p-line: #35302b;
    --p-card: #1b1714;
    --p-rule: #2b2723;
    --p-accent: #cc5a3b;
    --p-accent-hover: #b84c30;
    --p-easy: #8b9d7f;
    --p-medium: #c9a166;
    --p-hard: #cf6a52;
    --p-on-accent: #171412;
    --p-tab-bg: #f2ece3;
    --p-tab-text: #171412;
    --p-shadow: rgba(0,0,0,.65);
  }
  * { box-sizing: border-box; }
  .tab {
    position: fixed; right: 0; top: 42%; z-index: 2147483646;
    writing-mode: vertical-rl; padding: 14px 8px; border: 1px solid var(--p-line); border-right: 0; cursor: pointer;
    background: var(--p-tab-bg); color: var(--p-tab-text); font: 500 9px/1 var(--p-mono); letter-spacing: .18em; text-transform: uppercase;
    box-shadow: 0 8px 24px -8px var(--p-shadow); border-radius: 0;
    transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
  }
  .tab:hover { background: var(--p-accent); border-color: var(--p-accent); color: var(--p-on-accent); }
  .panel {
    position: fixed; right: 16px; top: 84px; z-index: 2147483647; width: 340px;
    background-color: var(--p-bg);
    background-image: radial-gradient(circle at 100% 0, color-mix(in srgb, var(--p-accent) 9%, transparent), transparent 55%);
    color: var(--p-ink); border: 1px solid var(--p-line); border-top: 2px solid var(--p-accent); border-radius: 0;
    box-shadow: 0 30px 60px -24px var(--p-shadow);
    font: 13px/1.6 var(--p-sans); overflow: hidden;
  }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 13px 14px 11px; border-bottom: 1px solid var(--p-line); }
  .status { color: var(--p-muted); font: 500 8.5px/1 var(--p-mono); letter-spacing: .16em; text-transform: uppercase; }
  .status.ok { color: var(--p-accent); }
  .x { border: 0; background: none; font-size: 18px; line-height: 1; cursor: pointer; color: var(--p-dim); padding: 0 2px; }
  .x:hover { color: var(--p-ink); }
  .body { padding: 16px 16px 6px; }
  .title { font: 500 18px/1.2 var(--p-sans); letter-spacing: -.03em; margin: 0 0 8px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
  .chip { font: 500 8px/1.3 var(--p-mono); letter-spacing: .12em; text-transform: uppercase; padding: 3px 6px; border: 1px solid var(--p-line); color: var(--p-muted); }
  .chip.Easy { color: var(--p-easy); border-color: currentColor; }
  .chip.Medium { color: var(--p-medium); border-color: currentColor; }
  .chip.Hard { color: var(--p-hard); border-color: currentColor; }
  .due { color: var(--p-dim); font: 500 8px/1.4 var(--p-mono); letter-spacing: .12em; text-transform: uppercase; margin-bottom: 12px; }
  textarea {
    display: block; width: 100%; min-height: 120px; resize: vertical; border: 1px solid var(--p-line); border-radius: 0;
    outline: 0; padding: 10px; margin: 0; color: var(--p-ink); background: var(--p-card); background-image: none;
    font: 13px/1.7 var(--p-sans);
    transition: border-color 160ms ease;
  }
  textarea:focus { border-color: var(--p-accent); }
  textarea::placeholder { color: var(--p-dim); }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 16px 14px; }
  .msg { min-height: 1em; color: var(--p-dim); font: 500 8px/1.4 var(--p-mono); letter-spacing: .12em; text-transform: uppercase; }
  .msg.err { color: var(--p-hard); }
  .primary { border: 1px solid var(--p-ink); border-radius: 0; background: var(--p-ink); color: var(--p-bg); cursor: pointer;
    font: 500 9px/1 var(--p-mono); letter-spacing: .16em; text-transform: uppercase; padding: 10px 14px;
    transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease; }
  .primary:hover { background: var(--p-accent); border-color: var(--p-accent); color: var(--p-on-accent); }
  .primary:disabled { opacity: .55; cursor: default; }
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
