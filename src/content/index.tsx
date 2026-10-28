import { createRoot } from 'react-dom/client';
import type { InjectedMessage, LeetCodeMeta, Question, SubmissionResponse } from '../types';
import { fetchMeta } from '../shared/leetcode';
import { getQuestions } from '../shared/storage';
import { sendRuntimeMessage } from '../shared/messaging';
import { NotePanel, type PanelState } from './NotePanel';

declare global {
  interface Window {
    __lcRepeetUI?: boolean;
  }
}

(() => {
  if (window.__lcRepeetUI) return;
  window.__lcRepeetUI = true;

  const slugFromPath = (): string | null =>
    (location.pathname.match(/^\/problems\/([^/]+)/) || [])[1] || null;

  const metaCache: Record<string, LeetCodeMeta> = {};
  const getMeta = async (slug: string): Promise<LeetCodeMeta> => {
    if (!metaCache[slug]) {
      metaCache[slug] = await fetchMeta(slug);
    }
    return metaCache[slug];
  };

  const getStored = async (slug: string): Promise<Question | null> => {
    const qs = await getQuestions();
    return qs[slug] || null;
  };

  // Mount Host and Shadow DOM
  const host = document.createElement('div');
  host.id = 'lc-repeet-host';
  const rootElement = host.attachShadow({ mode: 'open' });
  (document.body || document.documentElement).append(host);

  const applyPanelTheme = (value: unknown): void => {
    host.classList.toggle('dark', value !== 'light');
  };

  chrome.storage.local
    .get('theme')
    .then(({ theme }) => applyPanelTheme(theme))
    .catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.theme) applyPanelTheme(changes.theme.newValue);
  });

  const reactRoot = createRoot(rootElement);

  // Content Script Container State
  let currentSlug: string | null = slugFromPath();
  let panelState: PanelState | null = null;
  let isOpen = false;

  function renderApp(): void {
    reactRoot.render(
      <NotePanel
        currentSlug={currentSlug}
        panelState={panelState}
        isOpen={isOpen}
        onToggle={async () => {
          if (isOpen) {
            isOpen = false;
            renderApp();
            return;
          }
          const slug = slugFromPath();
          if (!slug) return;
          const [meta, q] = await Promise.all([getMeta(slug), getStored(slug)]);
          panelState = { slug, meta, q, accepted: false, isNew: false };
          isOpen = true;
          renderApp();
        }}
        onClose={() => {
          isOpen = false;
          renderApp();
        }}
        onUpdateQuestion={(updatedQ) => {
          if (panelState) {
            panelState = { ...panelState, q: updatedQ };
            renderApp();
          }
        }}
      />
    );
  }

  renderApp();

  // Route change polling
  let lastSlug = currentSlug;
  setInterval(() => {
    const slug = slugFromPath();
    if (slug !== lastSlug) {
      lastSlug = slug;
      currentSlug = slug;
      if (isOpen) {
        isOpen = false;
      }
      renderApp();
    }
  }, 700);

  // Listen for ACCEPTED submissions reported by inject.js
  window.addEventListener('message', async (e: MessageEvent) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data as InjectedMessage;
    if (!d || d.__lcRepeet !== true || d.type !== 'ACCEPTED') return;

    const slug = slugFromPath();
    if (!slug) return;

    try {
      const meta = await getMeta(slug);
      const res = await sendRuntimeMessage<SubmissionResponse>({
        type: 'SUBMISSION',
        meta,
        submissionId: d.submissionId,
        lang: d.lang,
        runtime: d.runtime,
      });

      panelState = {
        slug,
        meta,
        q: res.question,
        accepted: true,
        isNew: res.isNew,
      };
      isOpen = true;
      renderApp();
    } catch {
      const meta = await getMeta(slug);
      panelState = {
        slug,
        meta,
        q: null,
        accepted: true,
        isNew: false,
      };
      isOpen = true;
      renderApp();
    }
  });
})();
