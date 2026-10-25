"use strict";
(() => {
  // src/content/inject.ts
  (() => {
    if (window.__lcRepeetHooked) return;
    window.__lcRepeetHooked = true;
    const CHECK = /\/submissions\/detail\/(\d+)\/check\/?(\?|$)/;
    const seen = /* @__PURE__ */ new Set();
    function report(id, data) {
      if (!data || data.state !== "SUCCESS" || data.status_msg !== "Accepted") return;
      if (seen.has(id)) return;
      seen.add(id);
      window.postMessage(
        {
          __lcRepeet: true,
          type: "ACCEPTED",
          submissionId: id,
          lang: data.pretty_lang || data.lang || "",
          runtime: data.status_runtime || ""
        },
        location.origin
      );
    }
    const origFetch = window.fetch;
    window.fetch = function(...args) {
      const p = origFetch.apply(this, args);
      try {
        const input = args[0];
        const url = typeof input === "string" ? input : input && "url" in input ? input.url : "";
        const m = url && CHECK.exec(url);
        if (m) {
          p.then((res) => res.clone().json()).then((d) => report(m[1], d)).catch(() => {
          });
        }
      } catch {
      }
      return p;
    };
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      try {
        const m = CHECK.exec(String(url));
        if (m) {
          this.addEventListener("load", () => {
            try {
              report(m[1], JSON.parse(this.responseText));
            } catch {
            }
          });
        }
      } catch {
      }
      return origOpen.call(this, method, url, ...rest);
    };
  })();
})();
