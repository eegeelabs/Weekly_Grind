#!/usr/bin/env bash
set -Eeuo pipefail

WEBROOT="${1:-$HOME/tiny-web/public/weekly-grind}"
JS_DIR="$WEBROOT/js"
STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$HOME/tiny-web/backup/$STAMP"

mkdir -p "$JS_DIR" "$BACKUP_DIR"

bk(){ [[ -e "$1" ]] && cp -a "$1" "$BACKUP_DIR/"; }
inj_bodyend(){ local f="$1" l="$2"; grep -qF "$l" "$f" || sed -i.bak "/<\/body>/i\\
$l
" "$f"; rm -f "$f.bak"; }

# --- Write the inline status script ---
FILE="$JS_DIR/admin-status-inline.js"; bk "$FILE"
cat >"$FILE" <<'JS'
/* admin-status-inline.js — per-item "Complete" checkbox; persists to hidden Status */
(() => {
  if (window.__ADMIN_STATUS_INLINE__) return;
  window.__ADMIN_STATUS_INLINE__ = true;

  const root =
    document.getElementById("wg-admin") ||
    document.querySelector(".weekly-grid-admin") ||
    document.getElementById("grid-admin") ||
    document.body;

  const TYPE_CODES = ['OoO','R/R','IMG','CFG','ADUM','OnB'];
  const looksTypeSelect = (sel) => {
    if (!sel || sel.tagName !== 'SELECT') return false;
    try { return [...sel.options].some(o => TYPE_CODES.includes((o.value||o.text||'').trim())); }
    catch { return false; }
  };

  const findItems = () => {
    const sels = [...root.querySelectorAll('select')].filter(looksTypeSelect);
    const items = [];
    for (const sel of sels) {
      const cell = sel.closest('.cell') || sel.closest('td') || sel.parentElement;
      if (!cell) continue;
      let details = null;
      const candidates = [...cell.querySelectorAll('input[type="text"], input:not([type]), [placeholder*="detail" i], [placeholder*="project" i]')]
        .filter(el => el.tagName === 'INPUT');
      if (candidates.length) {
        const all = [...cell.querySelectorAll('select, input, textarea, *')];
        const iSel = all.indexOf(sel);
        details = candidates.reduce((best, el) => {
          const idx = all.indexOf(el);
          return (idx > iSel && (!best || idx < best.idx)) ? { el, idx } : best;
        }, null)?.el || candidates[0];
      }
      const anchor = details || sel;
      items.push({ cell, sel, details, anchor });
    }
    return items;
  };

  const wireItem = ({ cell, anchor }) => {
    if (!cell || !anchor || cell.__wgStatusWired) return;
    cell.__wgStatusWired = true;

    // Hidden Status input so the CSV pipeline can read "done"
    let hidden = cell.querySelector('input.wg-status-hidden');
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'Status';
      hidden.className = 'wg-status-hidden';
      hidden.value = '';
      cell.appendChild(hidden);
    }

    // Checkbox UI
    const label = document.createElement('label');
    label.className = 'wg-status-wrap';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'wg-done-toggle';
    const txt = document.createElement('span');
    txt.textContent = 'Complete';
    label.append(cb, txt);

    // Place after the details (or Type) control
    anchor.insertAdjacentElement('afterend', label);

    const setDone = (on) => {
      hidden.value = on ? 'done' : '';
      cell.classList.toggle('wg-done', on);
      window.wgAdminMarkDirty?.();
    };

    setDone(cb.checked);
    cb.addEventListener('change', () => setDone(cb.checked));
  };

  const run = () => findItems().forEach(wireItem);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else setTimeout(run, 0);

  window.addEventListener('csv:rendered', run, { once: true });
  new MutationObserver(() => run()).observe(root, { childList: true, subtree: true });
})();
JS
echo "Wrote: $FILE"

# --- Inject the script into Admin pages ---
mapfile -t ADMIN_HTML < <(find "$WEBROOT" -maxdepth 1 -type f -iname "*admin*.html" | sort)
TAG='<script defer src="/weekly-grind/js/admin-status-inline.js?v=1"></script>'
for f in "${ADMIN_HTML[@]}"; do
  [[ -e "$f" ]] || continue
  bk "$f"
  inj_bodyend "$f" "$TAG"
  echo "Patched: $(basename "$f")"
done

echo "Backups: $BACKUP_DIR"
