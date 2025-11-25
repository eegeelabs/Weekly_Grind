/* admin-unsaved-indicator.js — Unsaved badge + Last saved timestamp (Admin only) */
(() => {
  if (window.__ADMIN_UNSAVED_INDICATOR__) return;
  window.__ADMIN_UNSAVED_INDICATOR__ = true;

  // Scope root on Admin page only
  const root =
    document.getElementById("wg-admin") ||
    document.querySelector(".weekly-grid-admin") ||
    document.getElementById("grid-admin") ||
    document.body;

  // Inject minimal styles (isolated IDs, no theme conflicts)
  const injectStyles = () => {
    if (document.getElementById("wg-unsaved-style")) return;
    const css = `
      #wg-unsaved-wrap {
        position: fixed; right: 14px; top: 70px; z-index: 2147483647;
        display: flex; gap: 8px; align-items: center;
        font: 600 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        color: #cde1ff;
      }
      #wg-unsaved-pill {
        display: none;
        padding: 6px 10px; border-radius: 999px;
        background: #2a0f16; color: #ffd0d6; border: 1px solid #531a24;
        box-shadow: 0 2px 10px rgba(0,0,0,.35);
      }
      #wg-saved-pill {
        padding: 6px 10px; border-radius: 999px;
        background: #0b1324; color: #cde1ff; border: 1px solid #26406f;
        box-shadow: 0 2px 10px rgba(0,0,0,.25);
      }
      #wg-saved-pill .dot {
        width: 8px; height: 8px; border-radius: 50%;
        display: inline-block; margin-right: 6px; background: #3cde7c;
      }
      #wg-unsaved-pill .dot {
        width: 8px; height: 8px; border-radius: 50%;
        display: inline-block; margin-right: 6px; background: #ff6b81;
      }
      @media (max-width: 720px) {
        #wg-unsaved-wrap { top: 56px; right: 10px; font-size: 11px; }
      }
    `;
    const s = document.createElement("style");
    s.id = "wg-unsaved-style";
    s.textContent = css;
    document.head.appendChild(s);
  };

  // UI elements
  const ensureUI = () => {
    if (document.getElementById("wg-unsaved-wrap")) return;
    const wrap = document.createElement("div");
    wrap.id = "wg-unsaved-wrap";

    const unsaved = document.createElement("div");
    unsaved.id = "wg-unsaved-pill";
    unsaved.innerHTML = `<span class="dot"></span>Unsaved changes`;

    const saved = document.createElement("div");
    saved.id = "wg-saved-pill";
    saved.innerHTML = `<span class="dot"></span><span id="wg-saved-text">Saved</span>`;

    wrap.appendChild(unsaved);
    wrap.appendChild(saved);
    document.body.appendChild(wrap);
  };

  injectStyles();
  ensureUI();

  const $ = (sel) => document.querySelector(sel);
  const unsavedPill = $("#wg-unsaved-pill");
  const savedPill   = $("#wg-saved-pill");
  const savedText   = $("#wg-saved-text");

  let dirty = false;
  let lastSaved = null;

  const fmtTime = (d) =>
    d.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });

  const render = () => {
    if (dirty) {
      unsavedPill.style.display = "inline-block";
      savedPill.style.opacity = "0.7";
      savedText.textContent = lastSaved ? `Last saved ${fmtTime(lastSaved)}` : "No saves yet";
    } else {
      unsavedPill.style.display = "none";
      savedPill.style.opacity = "1";
      savedText.textContent = lastSaved ? `Saved • ${fmtTime(lastSaved)}` : "Saved";
    }
  };

  // Public helpers if you want to trigger manually from your save code
  window.wgAdminMarkDirty = () => { dirty = true; render(); };
  window.wgAdminMarkSaved = (when = new Date()) => { dirty = false; lastSaved = when; render(); };

  // Detect edits in the admin grid (inputs, selects, textareas, contenteditable)
  const editSelector = 'input, select, textarea, [contenteditable=""], [contenteditable="true"]';
  root.addEventListener("input", (e) => {
    if (e.target.closest(editSelector)) { dirty = true; render(); }
  }, true);
  root.addEventListener("change", (e) => {
    if (e.target.closest(editSelector)) { dirty = true; render(); }
  }, true);

  // Integrate with your existing lifecycle events (emit these from your code if not already)
  window.addEventListener("csv:loaded",   () => { dirty = false; render(); });
  window.addEventListener("csv:rendered", () => { /* no-op, but keeps timing consistent */ });
  window.addEventListener("csv:saved",    () => { dirty = false; lastSaved = new Date(); render(); });

  // Warn if there are unsaved changes
  window.addEventListener("beforeunload", (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = ""; // required for some browsers
  });

  // Kick off initial state
  render();
})();
