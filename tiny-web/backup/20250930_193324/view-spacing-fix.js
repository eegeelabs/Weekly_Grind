/* view-spacing-fix.js — Scale-to-fit (no H-scroll) + hard nowrap + vertical compaction + no inner V-scroll */
(() => {
  if (window.__VIEW_SPACING_FIX_V10__) return;
  window.__VIEW_SPACING_FIX_V10__ = true;

  const root =
    document.getElementById("wg-view") ||
    document.querySelector(".weekly-grid") ||
    document.getElementById("grid") ||
    document.body;

  const imp = (el, prop, val) => { try { el.style.setProperty(prop, val, "important"); } catch {} };

  const qTable = () => root.querySelector("table");

  // remove artifacts from older attempts
  const cleanOld = () => {
    const old = document.getElementById("wg-no-scroll-style");
    if (old) old.remove();
    const tbl = qTable();
    if (!tbl) return;
    const p = tbl.parentElement;
    if (p && p.classList && p.classList.contains("wg-scroll")) p.replaceWith(tbl);
  };

  // create (or reuse) a host/wrap to scale the table
  const ensureScaleWrap = () => {
    const tbl = qTable();
    if (!tbl) return {};

    let host = document.getElementById("wg-fit-host");
    let wrap = document.getElementById("wg-fit-wrap");

    if (!host) {
      host = document.createElement("div");
      host.id = "wg-fit-host";
      host.style.position = "relative";
      host.style.width = "100%";
      host.style.overflow = "hidden";      // kill inner scrollbars
      tbl.parentNode.insertBefore(host, tbl);
    }
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "wg-fit-wrap";
      wrap.style.transformOrigin = "top left";
      wrap.style.display = "inline-block"; // measure natural width
      host.appendChild(wrap);
      wrap.appendChild(tbl);
    }
    return { host, wrap, tbl };
  };

  // strong default table/cell rules
  const normalizeStyles = ({ tbl }) => {
    if (!tbl) return;
    imp(tbl, "table-layout", "auto");
    imp(tbl, "width", "max-content");
    imp(tbl, "max-width", "none");
    imp(tbl, "min-width", "0");
    imp(tbl, "border-collapse", "separate");
    imp(tbl, "border-spacing", "8px 3px");

    tbl.querySelectorAll("th, td").forEach((cell) => {
      imp(cell, "white-space", "nowrap");
      imp(cell, "vertical-align", "top");
      imp(cell, "height", "auto");
      imp(cell, "min-height", "0");
      imp(cell, "padding", "2px 6px");
      imp(cell, "min-width", "0");
    });

    tbl.querySelectorAll("th, td, td *").forEach((el) => {
      imp(el, "white-space", "nowrap");
    });

    tbl.querySelectorAll("td *").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "flex") {
        el.style.alignItems = "flex-start";
        el.style.flexWrap = "nowrap";
        const gap = parseFloat(cs.gap) || 0;
        if (gap > 6) el.style.gap = "4px";
      }
      if (el.classList && el.classList.contains("cell")) {
        el.style.minHeight = "0";
        el.style.gridTemplateRows = "none";
        el.style.gridAutoRows = "min-content";
        el.style.alignContent = "start";
        const g = parseFloat(cs.gap) || 0;
        if (g > 4) el.style.gap = "2px";
      }
      if ((parseFloat(cs.minHeight) || 0) > 0) el.style.minHeight = "0";
      if ((parseFloat(cs.paddingTop) || 0) > 8) el.style.paddingTop = "2px";
      if ((parseFloat(cs.paddingBottom) || 0) > 8) el.style.paddingBottom = "2px";
      if ((parseFloat(cs.marginTop) || 0) > 8) el.style.marginTop = "2px";
      if ((parseFloat(cs.marginBottom) || 0) > 8) el.style.marginBottom = "2px";
    });
  };

  // kill vertical scroll on wrappers in the parent chain
  const relaxWrappers = ({ host }) => {
    let el = host;
    while (el && el !== document.body) {
      imp(el, "max-height", "none");
      imp(el, "overflow-y", "hidden");   // hide inner vertical scrollbar
      el = el.parentElement;
      if (!el || el === root) break;
    }
    // root itself should not create inner scrolling
    imp(root, "overflow-y", "visible");
  };

  // scale to fit width; round height up to avoid 1px overflow (scrollbar)
  const applyScale = ({ host, wrap, tbl }, forcedScale = null) => {
    if (!host || !wrap || !tbl) return;
    wrap.style.transform = "scale(1)";
    void wrap.offsetWidth; // layout flush
    const natW = tbl.scrollWidth;
    const avail = host.clientWidth;
    const s = forcedScale != null ? forcedScale : Math.min(1, avail / Math.max(1, natW));
    wrap.style.transform = `scale(${s})`;

    const rect = wrap.getBoundingClientRect();
    host.style.height = `${Math.ceil(rect.height) + 2}px`; // pad to dodge rounding
    host.style.overflowX = "hidden";
    host.style.overflowY = "hidden"; // <— no vertical scrollbar inside the grid
  };

  // toggle Fit ? 100%
  const ensureToggle = (scope) => {
    if (document.getElementById("wg-width-toggle")) return;
    const b = document.createElement("button");
    b.id = "wg-width-toggle";
    b.textContent = "Mode: Fit";
    Object.assign(b.style, {
      position: "fixed", right: "12px", bottom: "12px",
      zIndex: "2147483647", padding: "6px 10px",
      borderRadius: "999px", font: "600 12px/1 system-ui, sans-serif",
      background: "#0b1324", color: "#cde1ff", border: "1px solid #26406f",
      boxShadow: "0 2px 10px rgba(0,0,0,.35)", cursor: "pointer"
    });
    b.addEventListener("mouseenter", () => b.style.background = "#0f1a33");
    b.addEventListener("mouseleave", () => b.style.background = "#0b1324");

    let fitMode = true;
    b.addEventListener("click", () => {
      fitMode = !fitMode;
      b.textContent = "Mode: " + (fitMode ? "Fit" : "100%");
      if (fitMode) {
        applyScale(scope, null);
        relaxWrappers(scope);
      } else {
        scope.wrap.style.transform = "scale(1)";
        const rect = scope.wrap.getBoundingClientRect();
        scope.host.style.height = `${Math.ceil(rect.height) + 2}px`;
        scope.host.style.overflowX = "auto";   // allow H-scroll in 100% mode
        scope.host.style.overflowY = "hidden"; // still no inner V-scroll
      }
    });

    document.body.appendChild(b);
  };

  const runAll = () => {
    cleanOld();
    const scope = ensureScaleWrap();
    if (!scope.tbl) return;
    normalizeStyles(scope);
    relaxWrappers(scope);
    ensureToggle(scope);
    applyScale(scope, null);
  };

  // first run
  const once = (() => {
    let done = false;
    return () => { if (!done) { done = true; runAll(); } };
  })();
  window.addEventListener("csv:rendered", once, { once: true });
  window.addEventListener("csv:loaded",   once, { once: true });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(once, 250));
  } else {
    setTimeout(once, 250);
  }

  // refit on resize / DOM changes
  let raf = null;
  const refit = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = null; runAll(); });
  };
  window.addEventListener("resize", refit);
  const mo = new MutationObserver(refit);
  mo.observe(root, { childList: true, subtree: true, characterData: true });
})();
