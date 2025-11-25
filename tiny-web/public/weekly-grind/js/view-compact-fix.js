/* view-compact-fix.js — v2.3 (boundary-aware, safer first pass) */
(() => {
  if (window.__VIEW_COMPACT_FIX_V23__) return;
  window.__VIEW_COMPACT_FIX_V23__ = true;

  // Inject minimal styles (CSS hotfix handles the rest)
  const css = `
    .wg-is-empty { display: none !important; }
    ul.wg-empty, ol.wg-empty { display:none !important; }
    .wg-compact-list { list-style: none; padding-left: 0; margin-left: 0; }
    .wg-collapsed-br br + br { display: none; }
    .wg-is-empty::before, .wg-is-empty::after { content: none !important; }
  `;
  const styleId = "wg-view-compact-style";
  if (!document.getElementById(styleId)) {
    const s = document.createElement("style");
    s.id = styleId;
    s.textContent = css;
    document.head.appendChild(s);
  }

  // Find/mark a pruning boundary (we never hide this element)
  const boundary =
    document.getElementById("wg-view") ||
    document.getElementById("grid") ||
    document.querySelector(".weekly-grid, main") ||
    document.body;
  boundary.setAttribute("data-wg-boundary", "1");

  // Empty-ish detectors
  const ZERO_WIDTH = /[\u200B-\u200D\u2060]/g;
  const NBSP = /\u00A0/g;
  const DOT_OR_DASH = /^[\u2022\u00B7•·.\-–—_]{1,4}$/;
  const ONLY_PUNCT = /^[\s,;:!?'"]*$/;

  const cleanText = (s) =>
    (s || "").replace(ZERO_WIDTH, "").replace(NBSP, " ").replace(/\s+/g, " ").trim();

  const isEmptyishText = (s) => {
    const t = cleanText(s);
    return !t || DOT_OR_DASH.test(t) || ONLY_PUNCT.test(t);
  };

  const isVisuallyEmptyPill = (el) => {
    if (!el || el === boundary) return false;
    if (el.closest("[data-wg-boundary]") === el) return false;
    if (el.matches("table, thead, tbody, tr")) return false;
    if (el.querySelector("img, svg, video, canvas")) return false;

    const txt = cleanText(el.textContent);
    if (txt) return false;

    const cs = getComputedStyle(el);
    const hasBg =
      cs.backgroundImage !== "none" ||
      (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent");
    const borderW =
      (parseFloat(cs.borderTopWidth) || 0) +
      (parseFloat(cs.borderRightWidth) || 0) +
      (parseFloat(cs.borderBottomWidth) || 0) +
      (parseFloat(cs.borderLeftWidth) || 0);
    const hasShadow = cs.boxShadow && cs.boxShadow !== "none";
    if (!(hasBg || borderW > 0 || hasShadow)) return false;

    const rect = el.getBoundingClientRect();
    const h = rect.height, w = rect.width;
    const radius = parseFloat(cs.borderRadius) || 0;
    const looksPill = (h <= 18) || (radius >= 6);
    const notHuge   = (w <= 500 && h <= 50);
    return looksPill && notHuge;
  };

  const collapseBrRuns = (root) => {
    root.querySelectorAll("p, td, th, li, div, section").forEach((el) => {
      const html = (el.innerHTML || "").replace(/\s+/g, " ").trim();
      if (/^(<br\s*\/?>\s*){2,}$/i.test(html)) el.innerHTML = "<br>";
      el.classList.add("wg-collapsed-br");
    });
  };

  const hasMeaningfulContent = (el) => {
    if (el.querySelector("img, svg, video, canvas")) return true;
    const text = cleanText(el.textContent);
    if (text && !isEmptyishText(text)) return true;
    for (const child of el.children) {
      if (!child.classList.contains("wg-is-empty") &&
          !child.classList.contains("wg-visual-empty") &&
          child.offsetParent !== null) return true;
    }
    return false;
  };

  const bubbleUpEmpty = (start) => {
    let el = start;
    while (el && el !== boundary && el !== document.body) {
      if (!hasMeaningfulContent(el)) {
        el.classList.add("wg-is-empty");
        el = el.parentElement;
      } else break;
    }
  };

  const markVisualPills = (root) => {
    root.querySelectorAll("div, span, p, li, td, th").forEach((el) => {
      if (el === boundary) return;
      if (el.matches("[data-wg-boundary], table, thead, tbody, tr")) return;
      if (el.matches("td, th") && cleanText(el.textContent)) return;
      const isPill = isVisuallyEmptyPill(el);
      el.classList.toggle("wg-visual-empty", isPill);
      if (isPill) bubbleUpEmpty(el);
    });
  };

  const pruneEmpties = (root) => {
    const container = root || document;

    container.querySelectorAll("td, th").forEach((cell) => {
      if (cell.closest("[data-wg-boundary]") === cell) return;
      if (cell.querySelector("img, svg")) return;
      const emptyish = isEmptyishText(cell.textContent);
      cell.classList.toggle("wg-is-empty", emptyish);
      if (emptyish) bubbleUpEmpty(cell);
    });

    container.querySelectorAll("ul, ol").forEach((list) => {
      if (list === boundary || list.closest("[data-wg-boundary]") === list) return;
      let kept = 0;
      list.classList.add("wg-compact-list");
      list.querySelectorAll("li").forEach((li) => {
        const hasMedia = li.querySelector("img, svg");
        const txt = cleanText(li.textContent);
        const emptyish = !hasMedia && isEmptyishText(txt);
        li.classList.toggle("wg-is-empty", emptyish);
        if (!emptyish) kept++; else bubbleUpEmpty(li);
      });
      list.classList.toggle("wg-empty", kept === 0);
      if (kept === 0) bubbleUpEmpty(list);
    });

    container.querySelectorAll("p, .cell, .value, .field, .wg-text, span, div").forEach((el) => {
      if (el === boundary) return;
      if (el.matches("[data-wg-boundary], table, thead, tbody, tr, td, th")) return;
      if (el.querySelector("img, svg")) return;
      const emptyish = isEmptyishText(el.textContent);
      el.classList.toggle("wg-is-empty", emptyish);
      if (emptyish) bubbleUpEmpty(el);
    });

    markVisualPills(container);
    collapseBrRuns(container);
  };

  // Defer the first prune until data likely exists
  const firstRun = () => pruneEmpties(boundary);
  const deferMs = 350; // fallback delay if no events fired yet

  const runOnce = (() => {
    let ran = false;
    return () => { if (!ran) { ran = true; firstRun(); } };
  })();

  window.addEventListener("csv:rendered", runOnce, { once: true });
  window.addEventListener("csv:loaded",   runOnce, { once: true });

  // Fallback: run once shortly after DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(runOnce, deferMs));
  } else {
    setTimeout(runOnce, deferMs);
  }

  // Keep it clean after changes
  const mo = new MutationObserver((muts) => {
    const seen = new Set();
    muts.forEach((m) => {
      const scope = (m.target && (m.target.closest?.("[data-wg-boundary]") || m.target)) || boundary;
      if (!seen.has(scope)) { pruneEmpties(scope); seen.add(scope); }
    });
  });
  mo.observe(boundary, { childList: true, subtree: true, characterData: true });

  // Also respond to explicit events later on
  window.addEventListener("csv:rendered", () => pruneEmpties(boundary));
})();
