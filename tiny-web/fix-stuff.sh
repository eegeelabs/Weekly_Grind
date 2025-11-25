#!/usr/bin/env bash
set -Eeuo pipefail

# === Config ================================================================
# Webroot can be passed as $1; defaults to your tiny-web public path.
WEBROOT="${1:-$(cd "$(dirname "$0")" && pwd)/public/weekly-grind}"
JS_DIR="$WEBROOT/js"
CSS_DIR="$WEBROOT/css"

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_ROOT="${HOME}/tiny-web/backup"
BACKUP_DIR="${BACKUP_ROOT}/${STAMP}"

mkdir -p "$JS_DIR" "$CSS_DIR" "$BACKUP_DIR"

echo "==> Target webroot: $WEBROOT"
echo "==> Backup root   : $BACKUP_ROOT"
echo "==> This run bkdir: $BACKUP_DIR"

# === Helpers ==============================================================

backup_file() {
  local f="$1"
  [[ -e "$f" ]] || return 0
  mkdir -p "$BACKUP_DIR"
  cp -a "$f" "$BACKUP_DIR/"
  echo "    ? Backed up: $(basename "$f") -> $BACKUP_DIR/"
}

ensure_in_head() {
  local file="$1" line="$2"
  if grep -qF "$line" "$file"; then
    return
  fi
  if grep -qi "</head>" "$file"; then
    sed -i.bak "/<\/head>/i\\
$line
" "$file"
  else
    # no <head> tag? prepend
    sed -i.bak "1i $line" "$file"
  fi
  rm -f "${file}.bak"
  echo "    + Injected into <head>: $line"
}

ensure_before_body_end() {
  local file="$1" line="$2"
  if grep -qF "$line" "$file"; then
    return
  fi
  if grep -qi "</body>" "$file"; then
    sed -i.bak "/<\/body>/i\\
$line
" "$file"
  else
    # no </body>? append
    printf "\n%s\n" "$line" >> "$file"
  fi
  rm -f "${file}.bak"
  echo "    + Injected before </body>: $line"
}

# === Write files ===========================================================

# 1) Minimal CSS hotfix (ghost scrub only; layout handled by JS)
HOTFIX_CSS="$CSS_DIR/hotfix.css"
if [[ -e "$HOTFIX_CSS" ]]; then backup_file "$HOTFIX_CSS"; fi
cat > "$HOTFIX_CSS" <<'CSS'
/* Weekly Grind hotfix: scrub visual ghosts */
.wg-is-empty::before,.wg-is-empty::after,
.wg-visual-empty::before,.wg-visual-empty::after { content: none !important; }

.wg-is-empty:not(td):not(th):not(tr):not(table),
.wg-visual-empty {
  background: none !important;
  border: 0 !important;
  box-shadow: none !important;
}
.wg-visual-empty { display: none !important; }
CSS
echo "==> Wrote $HOTFIX_CSS"

# 2) View: scale-to-fit (no H-scroll) + nowrap + compact + no inner V-scroll
VIEW_SPACING_JS="$JS_DIR/view-spacing-fix.js"
if [[ -e "$VIEW_SPACING_JS" ]]; then backup_file "$VIEW_SPACING_JS"; fi
cat > "$VIEW_SPACING_JS" <<'JS'
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

  const cleanOld = () => {
    const old = document.getElementById("wg-no-scroll-style");
    if (old) old.remove();
    const tbl = qTable();
    if (!tbl) return;
    const p = tbl.parentElement;
    if (p && p.classList && p.classList.contains("wg-scroll")) p.replaceWith(tbl);
  };

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
      host.style.overflow = "hidden";
      tbl.parentNode.insertBefore(host, tbl);
    }
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "wg-fit-wrap";
      wrap.style.transformOrigin = "top left";
      wrap.style.display = "inline-block";
      host.appendChild(wrap);
      wrap.appendChild(tbl);
    }
    return { host, wrap, tbl };
  };

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
    tbl.querySelectorAll("th, td, td *").forEach((el) => imp(el, "white-space", "nowrap"));
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

  const relaxWrappers = ({ host }) => {
    let el = host;
    while (el && el !== document.body) {
      imp(el, "max-height", "none");
      imp(el, "overflow-y", "hidden");
      el = el.parentElement;
      if (!el || el === root) break;
    }
    imp(root, "overflow-y", "visible");
  };

  const applyScale = ({ host, wrap, tbl }, forcedScale = null) => {
    if (!host || !wrap || !tbl) return;
    wrap.style.transform = "scale(1)";
    void wrap.offsetWidth;
    const natW = tbl.scrollWidth;
    const avail = host.clientWidth;
    const s = forcedScale != null ? forcedScale : Math.min(1, avail / Math.max(1, natW));
    wrap.style.transform = `scale(${s})`;
    const rect = wrap.getBoundingClientRect();
    host.style.height = `${Math.ceil(rect.height) + 2}px`;
    host.style.overflowX = "hidden";
    host.style.overflowY = "hidden";
  };

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
        scope.host.style.overflowX = "auto";
        scope.host.style.overflowY = "hidden";
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

  let raf = null;
  const refit = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = null; runAll(); });
  };
  window.addEventListener("resize", refit);
  const mo = new MutationObserver(refit);
  mo.observe(root, { childList: true, subtree: true, characterData: true });
})();
JS
echo "==> Wrote $VIEW_SPACING_JS"

# 3) Admin: Unsaved badge + Last saved timestamp (no layout changes)
ADMIN_IND_JS="$JS_DIR/admin-unsaved-indicator.js"
if [[ -e "$ADMIN_IND_JS" ]]; then backup_file "$ADMIN_IND_JS"; fi
cat > "$ADMIN_IND_JS" <<'JS'
/* admin-unsaved-indicator.js — Unsaved badge + Last saved timestamp (Admin only) */
(() => {
  if (window.__ADMIN_UNSAVED_INDICATOR__) return;
  window.__ADMIN_UNSAVED_INDICATOR__ = true;

  const root =
    document.getElementById("wg-admin") ||
    document.querySelector(".weekly-grid-admin") ||
    document.getElementById("grid-admin") ||
    document.body;

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

  window.wgAdminMarkDirty = () => { dirty = true; render(); };
  window.wgAdminMarkSaved = (when = new Date()) => { dirty = false; lastSaved = when; render(); };

  const editSelector = 'input, select, textarea, [contenteditable=""], [contenteditable="true"]';
  root.addEventListener("input",  (e) => { if (e.target.closest(editSelector)) { dirty = true; render(); } }, true);
  root.addEventListener("change", (e) => { if (e.target.closest(editSelector)) { dirty = true; render(); } }, true);

  window.addEventListener("csv:loaded",   () => { dirty = false; render(); });
  window.addEventListener("csv:rendered", () => { /* no-op */ });
  window.addEventListener("csv:saved",    () => { dirty = false; lastSaved = new Date(); render(); });

  render();
})();
JS
echo "==> Wrote $ADMIN_IND_JS"

# === Patch HTML pages ======================================================

echo "==> Scanning for Admin and View HTML"
mapfile -t ADMIN_PAGES < <(find "$WEBROOT" -maxdepth 1 -type f -iname "*admin*.html" | sort)
mapfile -t VIEW_PAGES  < <(find "$WEBROOT" -maxdepth 1 -type f -iname "*view*.html"  | sort)
echo "    ? Admin pages: ${#ADMIN_PAGES[@]}"
echo "    ? View pages:  ${#VIEW_PAGES[@]}"

# Common includes (cache-busted once)
CSS_LINK='<link rel="stylesheet" href="/weekly-grind/css/hotfix.css?v=1">'
VIEW_FIX='<script defer src="/weekly-grind/js/view-spacing-fix.js?v=10"></script>'
ADMIN_UNSAVED='<script defer src="/weekly-grind/js/admin-unsaved-indicator.js?v=1"></script>'

# Patch Admin pages
for f in "${ADMIN_PAGES[@]}"; do
  echo "==> Patching Admin page: $(basename "$f")"
  backup_file "$f"
  ensure_in_head "$f" "$CSS_LINK"
  ensure_before_body_end "$f" "$ADMIN_UNSAVED"
done

# Patch View pages
for f in "${VIEW_PAGES[@]}"; do
  echo "==> Patching View page: $(basename "$f")"
  backup_file "$f"
  ensure_in_head "$f" "$CSS_LINK"
  ensure_before_body_end "$f" "$VIEW_FIX"
done

echo "==> All done."

echo
echo "JS dir   : $JS_DIR"
echo "CSS dir  : $CSS_DIR"
if [[ -d "$BACKUP_DIR" ]]; then
  echo "Backups  : $BACKUP_DIR"
fi

cat <<'TIP'

After saving on Admin, signal success so the badge clears:
  window.dispatchEvent(new Event('csv:saved'));
  // or:
  window.wgAdminMarkSaved?.();

TIP
