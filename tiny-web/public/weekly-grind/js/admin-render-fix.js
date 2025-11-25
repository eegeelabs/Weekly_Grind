/* admin-render-fix.js — v2 */
(() => {
  if (window.__ADMIN_RENDER_FIX_V2__) return;
  window.__ADMIN_RENDER_FIX_V2__ = true;

  const styleId = "wg-admin-fix-style";
  if (!document.getElementById(styleId)) {
    const s = document.createElement("style");
    s.id = styleId;
    s.textContent = `
      .wg-statusbar {
        position: sticky; top: 0; z-index: 1000;
        display: flex; align-items: center; gap: .5rem;
        background: #0b1324; color: #dbe7ff;
        font: 500 12px/1.2 system-ui, sans-serif;
        padding: .4rem .6rem; border-bottom: 1px solid #1d2a4a;
      }
      .wg-chip {
        display: inline-flex; align-items:center; gap:.4rem;
        border: 1px solid currentColor; border-radius: 999px;
        padding: .15rem .5rem; font-weight: 600;
      }
      .wg-chip--ok { color: #7fd38a; }
      .wg-chip--warn { color: #ffb86b; }
      .wg-chip--danger { color: #ff6b6b; }
      .wg-chip-dot { width: .45rem; height: .45rem; border-radius: 999px; background: currentColor; }
      .wg-spacer { flex: 1 1 auto; }
      .wg-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .wg-admin-compact .label:empty,
      .wg-admin-compact .hint:empty,
      .wg-admin-compact p:empty { display: none !important; }
      .wg-admin-compact ul, .wg-admin-compact ol { margin: 0.25rem 0; }
    `;
    document.head.appendChild(s);
  }

  const ensureStatusBar = () => {
    let bar = document.querySelector(".wg-statusbar");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "wg-statusbar";
      bar.innerHTML = `
        <span id="wg-dirty-chip" class="wg-chip wg-chip--ok">
          <span class="wg-chip-dot"></span> Saved
        </span>
        <span id="wg-last-saved" class="wg-mono"></span>
        <span class="wg-spacer"></span>
        <span id="wg-week-label" class="wg-mono"></span>
      `;
      const parent = document.querySelector("#admin-header") || document.body;
      parent.prepend(bar);
    }
    return bar;
  };

  let DIRTY = false;
  const setDirty = (dirty) => {
    DIRTY = !!dirty;
    const chip = document.getElementById("wg-dirty-chip");
    if (!chip) return;
    if (DIRTY) {
      chip.className = "wg-chip wg-chip--warn";
      chip.innerHTML = `<span class="wg-chip-dot"></span> Unsaved changes`;
    } else {
      chip.className = "wg-chip wg-chip--ok";
      chip.innerHTML = `<span class="wg-chip-dot"></span> Saved`;
    }
  };

  const markDirtyOnChange = () => {
    const scope =
      document.getElementById("wg-admin") ||
      document.getElementById("grid") ||
      document.body;
    scope.addEventListener("input", () => setDirty(true), { capture: true });
    scope.addEventListener("change", () => setDirty(true), { capture: true });
  };

  const LS_KEY = (week) => `wg:lastSaved:${week || "unknown"}`;
  const fmt = (d) => {
    const dt = new Date(d);
    return dt.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };
  const updateLastSavedUI = (week) => {
    const el = document.getElementById("wg-last-saved");
    if (!el) return;
    const ts = localStorage.getItem(LS_KEY(week));
    el.textContent = ts ? `Last saved: ${fmt(+ts)}` : `Last saved: —`;
  };
  const setLastSavedNow = (week) => {
    localStorage.setItem(LS_KEY(week), String(Date.now()));
    updateLastSavedUI(week);
  };

  const getWeekValue = () =>
    (document.getElementById("week") && document.getElementById("week").value) || "";

  const attachToSave = () => {
    window.addEventListener("csv:saved", () => {
      setLastSavedNow(getWeekValue());
      setDirty(false);
    });
    const btn =
      document.getElementById("saveWeekBtn") ||
      document.querySelector("[data-role='save-week']");
    if (btn && !btn.__wg_patched__) {
      btn.__wg_patched__ = true;
      btn.addEventListener("click", () => {
        setLastSavedNow(getWeekValue()); // optimistic; csv:saved will finalize
      });
    }
  };

  const compactAdmin = () => {
    const root =
      document.getElementById("wg-admin") ||
      document.getElementById("grid") ||
      document.body;
    root.classList.add("wg-admin-compact");
    root.querySelectorAll("p, .hint, .label").forEach((el) => {
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!el.querySelector("input, select, textarea") && !txt) {
        el.style.display = "none";
      }
    });
    root.querySelectorAll("ul, ol").forEach((list) => {
      list.style.margin = "0.25rem 0";
      list.querySelectorAll("li").forEach((li) => {
        const hasControl = li.querySelector("input, select, textarea");
        const t = (li.textContent || "").replace(/\s+/g, " ").trim();
        if (!hasControl && (/^[\u2022\u00B7•·.\-–—]{1,2}$/.test(t) || t === "")) {
          li.style.display = "none";
        }
      });
    });
  };

  const enableLeaveGuard = () => {
    window.addEventListener("beforeunload", (e) => {
      if (!DIRTY) return;
      e.preventDefault();
      e.returnValue = "";
    });
  };

  const updateWeekLabel = () => {
    const w = getWeekValue();
    const el = document.getElementById("wg-week-label");
    if (el) el.textContent = w ? `Week: ${w}` : "";
  };

  const boot = () => {
    ensureStatusBar();
    compactAdmin();
    markDirtyOnChange();
    enableLeaveGuard();
    attachToSave();
    updateLastSavedUI(getWeekValue());
    updateWeekLabel();

    window.addEventListener("csv:loaded", () => {
      setDirty(false);
      updateLastSavedUI(getWeekValue());
      updateWeekLabel();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
