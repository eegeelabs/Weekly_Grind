/* admin-status-inline.js — V3
   One checkbox per Type?Details pair (Sections 1 & 2).
   When checked + SAVED (csv:saved), the Details input border turns green.
*/
(() => {
  if (window.__ADMIN_STATUS_INLINE_V3__) return;
  window.__ADMIN_STATUS_INLINE_V3__ = true;

  const root =
    document.getElementById("wg-admin") ||
    document.querySelector(".weekly-grid-admin") ||
    document.getElementById("grid-admin") ||
    document.body;

  const TYPE_CODES = ['OoO','R/R','IMG','CFG','ADUM','OnB'];

  const looksTypeSelect = (sel) => {
    if (!sel || sel.tagName !== 'SELECT') return false;
    try { return [...sel.options].some(o => TYPE_CODES.includes((o.value || o.text || '').trim())); }
    catch { return false; }
  };

  // Find all Type selects in a cell and their nearest Details input
  const collectPairsInCell = (cell) => {
    const selects = [...cell.querySelectorAll('select')].filter(looksTypeSelect);
    if (!selects.length) return [];
    const all = [...cell.querySelectorAll('select, input, textarea, *')]; // DOM order
    const pairs = [];

    selects.forEach((sel, i) => {
      const startIdx = all.indexOf(sel);
      const nextSel = selects[i + 1];
      const endIdx = nextSel ? all.indexOf(nextSel) : all.length;

      // choose first INPUT[type=text] between this select and the next select (skip textarea/notes)
      let details = null;
      for (let j = startIdx + 1; j < endIdx; j++) {
        const el = all[j];
        if (!el || el.nodeType !== 1) continue;
        if (el.tagName === 'TEXTAREA') break; // notes start — stop searching
        if (el.tagName === 'INPUT' && (!el.type || el.type === 'text')) { details = el; break; }
      }

      // anchor where we place the checkbox UI
      const anchor = details || sel;
      pairs.push({ sel, details, anchor });
    });

    return pairs;
  };

  // Apply “saved done” visual to the details input
  const setDetailsSaved = (details, on) => {
    if (!details) return;
    if (on) {
      details.classList.add('wg-done-saved');
    } else {
      details.classList.remove('wg-done-saved');
    }
  };

  // Create/return a hidden input that stores status for this pair
  const ensureHidden = (cell, pairIndex) => {
    let hidden = cell.querySelector(`input.wg-status-hidden[data-index="${pairIndex}"]`);
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'Status';           // your CSV side can read these per pair
      hidden.className = 'wg-status-hidden';
      hidden.dataset.index = String(pairIndex);
      hidden.value = '';                // '' or 'done'
      cell.appendChild(hidden);
    }
    return hidden;
  };

  const wirePair = (cell, pair, idx) => {
    const { anchor, details } = pair;
    if (!anchor) return;
    if (anchor.__wgPairWired) return;
    anchor.__wgPairWired = true;

    const hidden = ensureHidden(cell, idx);

    // Build the checkbox UI
    const label = document.createElement('label');
    label.className = 'wg-status-wrap';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'wg-done-toggle';
    cb.dataset.index = String(idx);
    const txt = document.createElement('span');
    txt.textContent = 'Complete';
    label.append(cb, txt);

    // Place after details (preferred) or after the Type select
    anchor.insertAdjacentElement('afterend', label);

    // Initial state from persisted value (if present)
    const wasSavedDone = (hidden.value || '').trim().toLowerCase() === 'done';
    cb.checked = wasSavedDone;
    setDetailsSaved(details, wasSavedDone);

    // Changing the checkbox does NOT turn green yet — it only marks dirty/pending
    cb.addEventListener('change', () => {
      // store intent (‘done’ or ‘’) for this pair
      hidden.value = cb.checked ? 'done' : '';
      // show unsaved
      window.wgAdminMarkDirty?.();
      // do not apply green until csv:saved arrives
      setDetailsSaved(details, false);
    });
  };

  const wireCell = (cell) => {
    const pairs = collectPairsInCell(cell);
    pairs.forEach((p, i) => wirePair(cell, p, i));
  };

  const run = () => {
    const cells = root.querySelectorAll('td, .cell');
    cells.forEach(wireCell);
  };

  // When a SAVE completes, apply green to all checked pairs (persist intent)
  const applySavedState = () => {
    const hiddens = root.querySelectorAll('input.wg-status-hidden');
    hiddens.forEach((h) => {
      const idx = h.dataset.index;
      // find matching checkbox + details input in same cell
      const cell = h.closest('td, .cell');
      if (!cell) return;
      const cb = cell.querySelector(`.wg-done-toggle[data-index="${idx}"]`);
      // Apply only if the current intent is 'done'
      const on = (h.value || '').trim().toLowerCase() === 'done';
      // Find the details for the same pair index again
      const pairs = collectPairsInCell(cell);
      const pair = pairs[idx] || null;
      setDetailsSaved(pair?.details, on);
    });
  };

  // Initial + dynamic wiring
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(run, 0));
  } else {
    setTimeout(run, 0);
  }
  window.addEventListener('csv:rendered', run, { once: true });
  new MutationObserver(() => run()).observe(root, { childList: true, subtree: true });

  // Listen for your real save success signal
  window.addEventListener('csv:saved', () => {
    applySavedState();
  });
})();
