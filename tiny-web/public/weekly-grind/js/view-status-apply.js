/* view-status-apply.js — add green border to Details on View when Status is done */
(() => {
  if (window.__VIEW_STATUS_APPLY__) return;
  window.__VIEW_STATUS_APPLY__ = true;

  const root =
    document.getElementById("wg-view") ||
    document.querySelector(".weekly-grid") ||
    document.getElementById("grid") ||
    document.body;

  // Inject minimal CSS once (green border on details)
  const injectCSS = () => {
    if (document.getElementById("wg-view-status-style")) return;
    const s = document.createElement("style");
    s.id = "wg-view-status-style";
    s.textContent = `
      .wg-done-saved {
        border: 2px solid #04E762 !important;
        border-radius: 6px;
        box-shadow: 0 0 0 1px rgba(4,231,98,.2) inset !important;
        display: inline-block;
        padding: 2px 4px;
      }
    `;
    document.head.appendChild(s);
  };

  const TYPE_CODES = ['OoO','R/R','IMG','CFG','ADUM','OnB'];
  const isTypeText = (t) => {
    const s = String(t || '').trim();
    return TYPE_CODES.includes(s);
  };

  // Heuristic: get a linear list of element nodes inside the cell for ordering
  const linearize = (cell) =>
    [...cell.querySelectorAll('*')].filter(el => el.childElementCount === 0 || /^(A|SPAN|DIV|P|INPUT|SMALL|EM|STRONG)$/.test(el.tagName));

  const norm = (x) => String(x || '').trim().toLowerCase();

  // Decide if a small segment contains a "done" status
  const segmentIsDone = (els) => {
    for (const el of els) {
      const ds = (el.getAttribute?.('data-status') || '').toLowerCase();
      const txt = norm(el.textContent);
      if (ds === 'done') return true;
      if (/\b(done|complete|completed)\b/.test(txt)) return true;
      if (/[??]/.test(txt)) return true;
    }
    return false;
  };

  // Choose the best "details-like" element within a segment
  const pickDetails = (els) => {
    // Prefer an obvious "details" role/selector
    let cand = els.find(el =>
      el.matches?.('[data-role="details"], .details, .wg-details, a, p, span, div, input[type="text"]')
      && norm(el.textContent || el.value).length > 0
    );
    // Fall back to first readable text-y element
    if (!cand) cand = els.find(el => {
      const t = norm(el.textContent || el.value);
      return t && t.length > 1 && !/^(done|complete|completed)$/i.test(t);
    });
    return cand || null;
  };

  const processCell = (cell) => {
    // Build a linear pass of small elements to preserve ordering
    const els = linearize(cell);
    if (!els.length) return;

    // Identify indices where a Type code appears
    const typeIdxs = [];
    els.forEach((el, i) => {
      const t = el.getAttribute?.('data-type') || el.textContent;
      if (isTypeText(t)) typeIdxs.push(i);
    });
    if (!typeIdxs.length) return;

    // For each Type, look ahead to next Type (or end) = one pair "segment"
    for (let k = 0; k < typeIdxs.length; k++) {
      const start = typeIdxs[k];
      const stop  = (k + 1 < typeIdxs.length) ? typeIdxs[k + 1] : els.length;

      // Bound segment between this type and before the next type
      const seg = els.slice(start + 1, stop);

      // If we hit a textarea/notes container, stop there
      const notesCut = seg.findIndex(el => el.tagName === 'TEXTAREA' || /notes?/i.test(el.getAttribute?.('aria-label') || ''));
      const range = (notesCut >= 0) ? seg.slice(0, notesCut) : seg;

      if (!range.length) continue;

      // Determine if this pair is "done"
      const done = segmentIsDone(range);
      if (!done) continue;

      // Find the details box to style
      const details = pickDetails(range);
      if (!details) continue;

      // If the details is plain text (e.g., a text node), wrap it to apply a border
      if (!details.classList) {
        // Shouldn't happen with our selectors, but guard anyway
        continue;
      }

      details.classList.add('wg-done-saved');
    }
  };

  const run = () => {
    injectCSS();
    const cells = root.querySelectorAll('td, .cell');
    cells.forEach(processCell);
  };

  // Run after CSV render and on subsequent small changes
  const once = (() => { let done=false; return () => { if (!done) { done=true; run(); } }; })();
  window.addEventListener('csv:rendered', once, { once: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(run, 0));
  } else {
    setTimeout(run, 0);
  }

  // Re-apply if DOM mutates (e.g., week switched)
  new MutationObserver(() => run()).observe(root, { childList: true, subtree: true });
})();
