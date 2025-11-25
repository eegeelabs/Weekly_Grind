/* admin-unsaved-indicator.js — Unsaved badge + Last saved timestamp (auto-detect ANY successful write) */
(() => {
  if (window.__ADMIN_UNSAVED_INDICATOR__) return;
  window.__ADMIN_UNSAVED_INDICATOR__ = true;

  const root =
    document.getElementById("wg-admin") ||
    document.querySelector(".weekly-grid-admin") ||
    document.getElementById("grid-admin") ||
    document.body;

  // --- Styles --------------------------------------------------------------
  const css = `
    #wg-unsaved-wrap {
      position: fixed; right: 14px; top: 70px; z-index: 2147483647;
      display: flex; gap: 8px; align-items: center;
      font: 600 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      color: #cde1ff;
    }
    #wg-unsaved-pill {
      display: none; padding: 6px 10px; border-radius: 999px;
      background: #2a0f16; color: #ffd0d6; border: 1px solid #531a24;
      box-shadow: 0 2px 10px rgba(0,0,0,.35);
    }
    #wg-saved-pill {
      padding: 6px 10px; border-radius: 999px;
      background: #0b1324; color: #cde1ff; border: 1px solid #26406f;
      box-shadow: 0 2px 10px rgba(0,0,0,.25);
    }
    #wg-saved-pill .dot, #wg-unsaved-pill .dot {
      width: 8px; height: 8px; border-radius: 50%;
      display: inline-block; margin-right: 6px;
    }
    #wg-saved-pill .dot { background: #3cde7c; }
    #wg-unsaved-pill .dot { background: #ff6b81; }
    @media (max-width: 720px) { #wg-unsaved-wrap{ top:56px; right:10px; font-size:11px; } }
  `;
  if (!document.getElementById("wg-unsaved-style")) {
    const s = document.createElement("style");
    s.id = "wg-unsaved-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  // --- UI ------------------------------------------------------------------
  if (!document.getElementById("wg-unsaved-wrap")) {
    const wrap = document.createElement("div");
    wrap.id = "wg-unsaved-wrap";

    const uns = document.createElement("div");
    uns.id = "wg-unsaved-pill";
    uns.innerHTML = `<span class="dot"></span>Unsaved changes`;

    const sv = document.createElement("div");
    sv.id = "wg-saved-pill";
    sv.innerHTML = `<span class="dot"></span><span id="wg-saved-text">Saved</span>`;

    wrap.appendChild(uns);
    wrap.appendChild(sv);
    document.body.appendChild(wrap);
  }

  const $ = (sel) => document.querySelector(sel);
  const uns = $("#wg-unsaved-pill");
  const sv  = $("#wg-saved-pill");
  const txt = $("#wg-saved-text");

  let dirty = false;
  let lastSaved = null;

  const fmt = (d) => d.toLocaleString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });

  const render = () => {
    if (dirty) {
      uns.style.display = "inline-block";
      sv.style.opacity = "0.7";
      txt.textContent = lastSaved ? `Last saved ${fmt(lastSaved)}` : "No saves yet";
    } else {
      uns.style.display = "none";
      sv.style.opacity = "1";
      txt.textContent = lastSaved ? `Saved • ${fmt(lastSaved)}` : "Saved";
    }
  };

  // Public helpers (optional to call from your code)
  window.wgAdminMarkDirty = () => { dirty = true; render(); };
  window.wgAdminMarkSaved = (when = new Date()) => { dirty = false; lastSaved = when; render(); };

  // Mark dirty when editing
  const editSel = 'input, select, textarea, [contenteditable=""], [contenteditable="true"]';
  root.addEventListener("input",  e => { if (e.target.closest(editSel)) { dirty = true; render(); } }, true);
  root.addEventListener("change", e => { if (e.target.closest(editSel)) { dirty = true; render(); } }, true);

  // Lifecycle events (useful if you already fire these)
  window.addEventListener("csv:loaded", () => { dirty = false; render(); });
  window.addEventListener("csv:saved",  () => { dirty = false; lastSaved = new Date(); render(); });

  // --- Auto-detect: treat ANY successful POST/PUT/PATCH (same-origin) as "saved"
  const isWrite = (m) => /^(POST|PUT|PATCH)$/i.test(m || "");
  const sameOrigin = (u) => {
    try { return new URL(String(u), location.href).origin === location.origin; }
    catch { return true; } // if we can't parse, assume true
  };

  // fetch()
  if (window.fetch) {
    const _fetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const res = await _fetch(...args);
      try {
        const req = args[0];
        const url = (req && req.url) ? req.url : req;
        const method =
          (args[1]?.method) ||
          (req && req.method) ||
          "GET";
        if (isWrite(method) && sameOrigin(url) && res && res.ok) {
          window.wgAdminMarkSaved?.(new Date());
          window.dispatchEvent(new Event('csv:saved'));
        }
      } catch {}
      return res;
    };
  }

  // XMLHttpRequest
  const X = XMLHttpRequest;
  if (X) {
    const _open = X.prototype.open;
    const _send = X.prototype.send;
    X.prototype.open = function(method, url, ...rest) {
      this.__wg_isWrite = isWrite(method) && sameOrigin(url);
      return _open.call(this, method, url, ...rest);
    };
    X.prototype.send = function(...a) {
      this.addEventListener("load", () => {
        if (this.__wg_isWrite && this.status >= 200 && this.status < 300) {
          window.wgAdminMarkSaved?.(new Date());
          window.dispatchEvent(new Event('csv:saved'));
        }
      });
      return _send.apply(this, a);
    };
  }

  render();
})();
