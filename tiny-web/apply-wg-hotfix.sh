#!/usr/bin/env bash
set -Eeuo pipefail

# === Config ==================================================================
WEBROOT="${1:-$(cd "$(dirname "$0")" && pwd)/public/weekly-grind}"
JS_DIR="$WEBROOT/js"
CSS_DIR="$WEBROOT/css"

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_ROOT="$HOME/tiny-web/backup"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"

mkdir -p "$JS_DIR" "$CSS_DIR" "$BACKUP_DIR"

echo "==> Webroot:       $WEBROOT"
echo "==> Backup folder: $BACKUP_DIR"

# === Helpers =================================================================
bk() { [[ -e "$1" ]] && cp -a "$1" "$BACKUP_DIR/" && echo "    • Backed up $(basename "$1")"; }
inj_head() { local f="$1" l="$2"; grep -qF "$l" "$f" || { sed -i.bak "/<\/head>/i\\
$l
" "$f"; rm -f "$f.bak"; echo "    + <head> inject -> $(basename "$f")"; }; }
inj_bodyend() { local f="$1" l="$2"; grep -qF "$l" "$f" || { sed -i.bak "/<\/body>/i\\
$l
" "$f"; rm -f "$f.bak"; echo "    + </body> inject -> $(basename "$f")"; }; }

# === Files we add ============================================================

# 1) CSS for done highlight + hidden value shim
STATUS_CSS="$CSS_DIR/status.css"; bk "$STATUS_CSS"
cat >"$STATUS_CSS" <<'CSS'
/* Admin/View: "done" highlight and Status cell helpers */
.wg-done {
  background: #04E762 !important;
  color: #06210c !important;
  border-color: #04E762 !important;
}

/* Hide the text used for CSV serialization but keep it in DOM text flow */
.wg-status-value {
  position: absolute !important;
  left: -9999px !important;
  width: 1px !important;
  height: 1px !important;
  overflow: hidden !important;
  white-space: nowrap !important;
}

/* Checkbox label styling (compact) */
.wg-status-wrap {
  display: inline-flex; align-items: center; gap: 6px;
  font: 600 12px/1 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}
.wg-status-wrap input[type="checkbox"]{ transform: translateY(0.5px); }
CSS
echo "==> Wrote $(realpath --relative-to="$WEBROOT" "$STATUS_CSS")"

# 2) Admin script: inject checkbox into Status column, persist as 'done', toggle highlight
ADMIN_STATUS="$JS_DIR/admin-status-toggle.js"; bk "$ADMIN_STATUS"
cat >"$ADMIN_STATUS" <<'JS'
/* admin-status-toggle.js — per-row "Complete" checkbox using the Status column */
(() => {
  if (window.__ADMIN_STATUS_TOGGLE__) return;
  window.__ADMIN_STATUS_TOGGLE__ = true;

  const root =
    document.getElementById("wg-admin") ||
    document.querySelector(".weekly-grid-admin") ||
    document.getElementById("grid-admin") ||
    document.body;

  const norm = (s) => String(s ?? '').trim().toLowerCase();
  const isDone = (v) => (['done','complete','completed','x','1','true'].includes(norm(v)));

  const findTable = () =>
    root.querySelector('#wg-admin table, .weekly-grid-admin table, #grid-admin table') ||
    root.querySelector('table');

  const headerIndex = (table, name) => {
    const ths = table?.querySelectorAll('thead th, thead td') || [];
    for (let i = 0; i < ths.length; i++) {
      if (norm(ths[i].textContent) === norm(name)) return i;
    }
    return -1;
  };

  const applyRow = (tr, idxs) => {
    if (!tr || !tr.children) return;
    const tdStatus  = idxs.status  >= 0 ? tr.children[idxs.status]  : null;
    if (!tdStatus) return;

    // Prefer to highlight Details, else Type, else the whole row
    const tdDetails = idxs.details >= 0 ? tr.children[idxs.details] : null;
    const tdType    = idxs.type    >= 0 ? tr.children[idxs.type]    : null;
    const highlightTargets = tdDetails ? [tdDetails] : (tdType ? [tdType] : [tr]);

    // Current normalized value from the cell's visible text (if any)
    const current = isDone(tdStatus.textContent) ? 'done' : '';

    // Build checkbox UI, keep a hidden value span for CSV serializers that read text
    tdStatus.style.position = 'relative';
    const wrap = document.createElement('label');
    wrap.className = 'wg-status-wrap';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'wg-done-toggle';
    cb.checked = current === 'done';
    const lab = document.createElement('span');
    lab.textContent = 'Complete';

    // Hidden value span used to ensure CSV exports keep "done" text
    const hidden = tdStatus.querySelector('.wg-status-value') || document.createElement('span');
    hidden.className = 'wg-status-value';
    hidden.textContent = current;

    // Clear existing text but preserve any non-control children
    [...tdStatus.childNodes].forEach(n => n.remove());
    wrap.appendChild(cb); wrap.appendChild(lab);
    tdStatus.appendChild(wrap);
    tdStatus.appendChild(hidden);

    const setDone = (on) => {
      hidden.textContent = on ? 'done' : '';
      highlightTargets.forEach(el => el.classList.toggle('wg-done', on));
      // Let the badge know we have edits
      window.wgAdminMarkDirty?.();
    };

    // Initial paint
    setDone(cb.checked);

    // Toggle handler
    cb.addEventListener('change', () => setDone(cb.checked), false);
  };

  const run = () => {
    const table = findTable();
    if (!table) return;

    const idxs = {
      status:  headerIndex(table, 'Status'),
      type:    headerIndex(table, 'Type'),
      details: headerIndex(table, 'Details'),
    };
    if (idxs.status < 0) {
      console.warn('[wg] No "Status" column found on Admin grid — nothing to wire.');
      return;
    }
    const rows = table.tBodies?.[0]?.rows || table.querySelectorAll('tbody tr');
    rows.forEach ? rows.forEach((tr) => applyRow(tr, idxs)) : Array.from(rows).forEach(tr => applyRow(tr, idxs));
  };

  // Wire after admin render; also handle dynamic changes
  const once = (() => { let done=false; return ()=>{ if(!done){ done=true; run(); } };})();
  window.addEventListener('csv:rendered', once, { once: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 0));
  else setTimeout(run, 0);

  new MutationObserver(() => run()).observe(root, { childList: true, subtree: true });
})();
JS
echo "==> Wrote $(realpath --relative-to="$WEBROOT" "$ADMIN_STATUS")"

# === Inject into Admin HTML ==================================================
echo "==> Scanning Admin HTML…"
mapfile -t ADMIN_HTML < <(find "$WEBROOT" -maxdepth 1 -type f -iname "*admin*.html" | sort)
echo "    Admin pages: ${#ADMIN_HTML[@]}"

CSS_TAG='<link rel="stylesheet" href="/weekly-grind/css/status.css?v=1">'
ADMIN_STATUS_TAG='<script defer src="/weekly-grind/js/admin-status-toggle.js?v=1"></script>'

for f in "${ADMIN_HTML[@]}"; do
  echo "==> Patch (Admin): $(basename "$f")"
  bk "$f"
  inj_head "$f" "$CSS_TAG"
  inj_bodyend "$f" "$ADMIN_STATUS_TAG"
done

echo "==> Done. Files written and Admin HTML patched."
echo "    Backups: $BACKUP_DIR"

cat <<'POST'

Quick test (Admin):
1) Hard refresh (Ctrl/Cmd+F5).
2) You should see a checkbox in the **Status** column for each row.
3) Ticking it highlights the Details cell (or Type if Details not present) in #04E762.
4) Saving should now persist 'done' via the hidden value inside the Status cell.

Notes:
- This does NOT change your CSV schema — it simply uses the existing Status column.
- If your Admin table uses different header names than "Status/Type/Details", tell me and I’ll tune the selector map.
- Want the View page to also highlight completed items? We can add a tiny view-side script next that reads each item’s Status and paints the corresponding cell.

POST
