#!/usr/bin/env bash
set -euo pipefail

WEBROOT="/home/user/tiny-web/public/weekly-grind"
CSS_DIR="$WEBROOT/css"
HOTFIX="$CSS_DIR/hotfix.css"
JS_DIR="$WEBROOT/js"
BACKUP_DIR="$WEBROOT/.backup_cssjs_$(date +%Y%m%d_%H%M%S)"

log() { echo -e "\e[38;5;39m==>\e[0m $*"; }
ok()  { echo -e "    \e[38;5;40m?\e[0m $*"; }
warn(){ echo -e "    \e[38;5;214m!\e[0m $*"; }

[[ -d "$WEBROOT" ]] || { echo "Webroot not found: $WEBROOT"; exit 1; }

mkdir -p "$BACKUP_DIR" "$CSS_DIR" "$JS_DIR"

# --- 1) Write hotfix.css ---
log "Writing CSS hot patch ? $HOTFIX"
cat > "$HOTFIX" <<'CSS'
/* Weekly Grind hotfix: remove pseudo/border/shadow ghosts on empty elements */
.wg-is-empty::before,
.wg-is-empty::after { content: none !important; }

.wg-is-empty:not(td):not(th):not(tr):not(table),
.wg-is-empty:not(td):not(th):not(tr):not(table) * {
  background: none !important;
  border: 0 !important;
  box-shadow: none !important;
}

/* Additional guard for visually empty 'pill' bars the JS marks */
.wg-visual-empty::before,
.wg-visual-empty::after { content: none !important; }
.wg-visual-empty,
.wg-visual-empty * {
  background: none !important;
  border: 0 !important;
  box-shadow: none !important;
  display: none !important;
}
CSS
ok "hotfix.css written"

# --- 2) Link hotfix.css in Admin + View pages ---
link_css () {
  local html="$1"
  [[ -f "$html" ]] || return 0
  cp -a "$html" "$BACKUP_DIR/"
  if grep -q '/weekly-grind/css/hotfix.css' "$html"; then
    ok "$(basename "$html"): already linked"
  else
    if grep -qi "</head>" "$html"; then
      sed -i '/<\/head>/i \ \ <link rel="stylesheet" href="/weekly-grind/css/hotfix.css">' "$html"
    else
      echo '<link rel="stylesheet" href="/weekly-grind/css/hotfix.css">' >> "$html"
    fi
    ok "Linked hotfix.css in $(basename "$html")"
  fi
}

log "Linking CSS in HTML files"
link_css "$WEBROOT/cantina_admin.html"
link_css "$WEBROOT/cantina_view.html"

# --- 3) Upgrade view-compact-fix.js to v2.2 (handles visual pills) ---
log "Updating $JS_DIR/view-compact-fix.js to v2.2"
[[ -f "$JS_DIR/view-compact-fix.js" ]] && cp -a "$JS_DIR/view-compact-fix.js" "$BACKUP_DIR/view-compact-fix.js.bak"

cat > "$JS_DIR/view-compact-fix.js" <<'JS'
/* view-compact-fix.js — v2.2 (adds visual-empty detection) */
(() => {
  if (window.__VIEW_COMPACT_FIX_V22__) return;
  window.__VIEW_COMPACT_FIX_V22__ = true;

  const css = `
    .wg-is-empty { display: none !important; }
    ul.wg-empty, ol.wg-empty { display:none !important; }
    .wg-compact-list { list-style: none; padding-left: 0; margin-left: 0; }
    .wg-collapsed-br br + br { display: none; }
    .wg-is-empty::before, .wg-is-empty::after { content: none !important; }
    .wg-is-empty:not(td):not(th):not(tr):not(table),
    .wg-is-empty:not(td):not(th):not(tr):not(table) * {
      background: none !important; border: 0 !important; box-shadow: none !important;
    }
  `;
  const styleId = "wg-view-compact-style";
  if (!document.getElementById(styleId)) {
    const s = document.createElement("style");
    s.id = styleId;
    s.textContent = css;
    document.head.appendChild(s);
  }

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

  // Consider tiny rounded/styled blocks with no text as decorative "pills"
  const isVisuallyEmptyPill = (el) => {
    if (!el || el.matches("table, thead, tbody, tr")) return false;
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
    const notHuge = (w <= 500 && h <= 50);
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
    const stop = document.body;
    while (el && el !== stop) {
      if (!hasMeaningfulContent(el)) {
        el.classList.add("wg-is-empty");
        el = el.parentElement;
      } else break;
    }
  };

  const markVisualPills = (root) => {
    root.querySelectorAll("div, span, p, li, td, th").forEach((el) => {
      if (el.matches("td, th") && cleanText(el.textContent)) return;
      const isPill = isVisuallyEmptyPill(el);
      el.classList.toggle("wg-visual-empty", isPill);
      if (isPill) bubbleUpEmpty(el);
    });
  };

  const pruneEmpties = (root) => {
    const container = root || document;

    container.querySelectorAll("td, th").forEach((cell) => {
      if (cell.querySelector("img, svg")) return;
      const emptyish = isEmptyishText(cell.textContent);
      cell.classList.toggle("wg-is-empty", emptyish);
      if (emptyish) bubbleUpEmpty(cell);
    });

    container.querySelectorAll("ul, ol").forEach((list) => {
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
      if (el.matches("table, thead, tbody, tr, td, th")) return;
      if (el.querySelector("img, svg")) return;
      const emptyish = isEmptyishText(el.textContent);
      el.classList.toggle("wg-is-empty", emptyish);
      if (emptyish) bubbleUpEmpty(el);
    });

    markVisualPills(container);
    collapseBrRuns(container);
  };

  const ready = () => document.readyState === "complete" || document.readyState === "interactive";
  const runNowOrLater = (fn) => (ready() ? fn() : document.addEventListener("DOMContentLoaded", fn));
  runNowOrLater(() => pruneEmpties(document));

  const target = document.getElementById("wg-view") || document.getElementById("grid") || document.body;

  const mo = new MutationObserver((muts) => {
    const seen = new Set();
    muts.forEach((m) => {
      const scope = (m.target && (m.target.closest?.("table, ul, ol, #wg-view, #grid") || m.target)) || target;
      if (!seen.has(scope)) { pruneEmpties(scope); seen.add(scope); }
    });
  });
  mo.observe(target, { childList: true, subtree: true, characterData: true });

  window.addEventListener("csv:loaded", () => pruneEmpties(document));
  window.addEventListener("csv:rendered", () => pruneEmpties(document));
})();
JS
ok "view-compact-fix.js updated"

echo
log "Backups at: $BACKUP_DIR"
echo "Done. Hard-refresh (Ctrl+F5) Admin + View to bust cache."
