/*
 * Runs in the PAGE's JS world (manifest "world": "MAIN") so it can see
 * LeetCode's own network calls. After you press Submit, LeetCode polls
 *   /submissions/detail/<numeric id>/check/
 * until the verdict is ready. We watch those responses and, when the verdict
 * is "Accepted", tell the content script via window.postMessage.
 *
 * "Run" (sample tests) uses ids like runcode_xxx, which the numeric-only
 * pattern below deliberately ignores.
 */
export {};

interface CheckResponse {
  state?: string;
  status_msg?: string;
  pretty_lang?: string;
  lang?: string;
  status_runtime?: string;
}

declare global {
  interface Window {
    __lcRepeetHooked?: boolean;
  }
}

(() => {
  if (window.__lcRepeetHooked) return;
  window.__lcRepeetHooked = true;

  const CHECK = /\/submissions\/detail\/(\d+)\/check\/?(\?|$)/;
  const seen = new Set<string>();

  function report(id: string, data: CheckResponse | null): void {
    if (!data || data.state !== 'SUCCESS' || data.status_msg !== 'Accepted') return;
    if (seen.has(id)) return;
    seen.add(id);

    window.postMessage(
      {
        __lcRepeet: true,
        type: 'ACCEPTED',
        submissionId: id,
        lang: data.pretty_lang || data.lang || '',
        runtime: data.status_runtime || '',
      },
      location.origin
    );
  }

  const origFetch = window.fetch;
  window.fetch = function (...args: Parameters<typeof fetch>): Promise<Response> {
    const p = origFetch.apply(this, args);
    try {
      const input = args[0];
      const url = typeof input === 'string' ? input : (input && 'url' in input ? input.url : '');
      const m = url && CHECK.exec(url);
      if (m) {
        p.then((res) => res.clone().json())
          .then((d: CheckResponse) => report(m[1], d))
          .catch(() => {});
      }
    } catch {
      /* never break the page */
    }
    return p;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: [boolean?, (string | null)?, (string | null)?]
  ) {
    try {
      const m = CHECK.exec(String(url));
      if (m) {
        this.addEventListener('load', () => {
          try {
            report(m[1], JSON.parse(this.responseText) as CheckResponse);
          } catch {
            // ignore
          }
        });
      }
    } catch {
      /* never break the page */
    }
    // @ts-expect-error handling variable arity of open
    return origOpen.call(this, method, url, ...rest);
  };
})();
