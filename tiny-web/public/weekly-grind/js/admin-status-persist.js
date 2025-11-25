/* admin-status-persist.js
   Intercepts /weekly-grind/api/save and writes checkbox states to CSV "status" column.
   Matches rows by (tech, day, slot). Day = week_start + column offset, Slot = 1/2 (pair index+1).
*/
(() => {
  if (window.__ADMIN_STATUS_PERSIST__) return;
  window.__ADMIN_STATUS_PERSIST__ = true;

  const root =
    document.getElementById("wg-admin") ||
    document.querySelector(".weekly-grid-admin") ||
    document.getElementById("grid-admin") ||
    document.body;

  // ---------- helpers ----------
  const pad = n => String(n).padStart(2, '0');
  const toYmd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  // Find all “Complete” pairs in the grid and return {tech, dayOffset, slot, status}
  const collectIntents = () => {
    const out = [];
    const table = root.querySelector('table') || root;
    const rows = [...table.querySelectorAll('tr')];

    for (const tr of rows) {
      const tds = [...tr.children].filter(el => el.tagName === 'TD');
      if (!tds.length) continue;

      // tech from the first cell in the row (row header)
      const techCell = tds[0];
      const tech = (techCell?.textContent || '').trim();
      if (!tech) continue;

      for (let i = 1; i < tds.length; i++) {
        const td = tds[i];
        if (!td) continue;

        // Each pair is .wg-done-toggle + a hidden .wg-status-hidden[data-index]
        const pairs = [...td.querySelectorAll('.wg-done-toggle')];
        pairs.forEach(cb => {
          const idx = parseInt(cb.dataset.index || '0', 10) || 0;
          const hidden = td.querySelector(`.wg-status-hidden[data-index="${idx}"]`);
          const status = (hidden?.value || '').trim().toLowerCase() === 'done' ? 'done' : '';
          const slot = idx + 1;               // 0->slot1, 1->slot2
          const dayOffset = (td.cellIndex || i) - 1; // column offset from Monday (first column is tech)
          out.push({ tech, dayOffset, slot, status });
        });
      }
    }
    return out;
  };

  // Parse a CSV string into { header: string[], rows: string[][] }
  const parseCsv = (csv) => {
    const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const raw = lines.filter(l => l.length > 0);
    if (raw.length === 0) return { header: [], rows: [] };

    const header = raw[0].split(',').map(s => s.trim());
    const rows = raw.slice(1).map(line => line.split(',')); // fields don’t include commas in your sample
    return { header, rows };
  };

  // Serialize back to CSV
  const toCsv = (header, rows) => {
    const head = header.join(',');
    const body = rows.map(r => r.join(',')).join('\r\n');
    return head + '\r\n' + body + '\r\n';
  };

  // Build a fast lookup { key -> rowIndex }, key is "tech|day|slot"
  const buildIndex = (header, rows) => {
    const m = {};
    const idx = (name) => header.indexOf(name);
    const Iw = idx('week_start'), It = idx('tech'), Id = idx('day'), Is = idx('slot');
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const key = `${r[It]}|${r[Id]}|${r[Is]}`;
      m[key] = i;
    }
    return m;
  };

  // Given week_start and dayOffset, compute YYYY-MM-DD
  const dayFromOffset = (weekStart, dayOffset) => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + (dayOffset || 0));
    return toYmd(d);
  };

  // Update a CSV string with current checkbox intents; return new CSV string
  const rewriteCsvWithStatus = (csv) => {
    const intents = collectIntents(); // [{tech, dayOffset, slot, status}, ...]
    if (!intents.length) return csv;

    const { header, rows } = parseCsv(csv);
    if (!header.length || !rows.length) return csv;

    const H = (name) => header.indexOf(name);
    const H_tech = H('tech'), H_day = H('day'), H_slot = H('slot'), H_status = H('status'), H_week = H('week_start');
    if (H_tech < 0 || H_day < 0 || H_slot < 0 || H_status < 0 || H_week < 0) return csv;

    // pick week_start from the first row
    const weekStart = rows[0][H_week];

    // row index by key
    const rowIndex = buildIndex(header, rows);

    // Merge intents
    for (const it of intents) {
      const day = dayFromOffset(weekStart, it.dayOffset);
      const key = `${it.tech}|${day}|${String(it.slot)}`;
      const idx = rowIndex[key];
      if (idx === undefined) {
        // couldn’t match a row; ignore gracefully
        continue;
      }
      rows[idx][H_status] = it.status || '';
    }

    return toCsv(header, rows);
  };

  // ---- Intercept fetch (and XHR) to /api/save ----
  const SAVE_PATH_FRAGMENT = '/weekly-grind/api/save';

  const patchFetch = () => {
    const _fetch = window.fetch;
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : (input?.url || '');
      if (url.includes(SAVE_PATH_FRAGMENT)) {
        let bodyText = '';
        let jsonWrapped = false; // true when body is JSON string of CSV

        if (typeof init.body === 'string') {
          // Could be JSON string of CSV e.g. "\"week_start,...\\r\\n...\""
          try {
            const parsed = JSON.parse(init.body);
            if (typeof parsed === 'string') {
              bodyText = parsed;
              jsonWrapped = true;
            } else {
              bodyText = init.body; // some other JSON shape; let it pass
            }
          } catch {
            bodyText = init.body; // raw CSV in string
          }
        } else if (init.body instanceof Blob) {
          bodyText = await init.body.text();
        } else if (init.body) {
          // unknown body; let it pass
        }

        if (bodyText && bodyText.includes('week_start,tech,day,slot,type,details,notes,status')) {
          const newCsv = rewriteCsvWithStatus(bodyText);
          if (jsonWrapped) {
            init.body = JSON.stringify(newCsv);
          } else {
            init.body = newCsv;
          }
        }
      }
      return _fetch(input, init);
    };
  };

  const patchXhr = () => {
    const X = window.XMLHttpRequest;
    if (!X) return;
    const open = X.prototype.open;
    const send = X.prototype.send;
    X.prototype.open = function (m, u, ...rest) {
      this.__wg_is_save = typeof u === 'string' && u.includes(SAVE_PATH_FRAGMENT);
      return open.call(this, m, u, ...rest);
    };
    X.prototype.send = function (body) {
      if (this.__wg_is_save && typeof body === 'string' && body.includes('week_start,tech,day,slot,type,details,notes,status')) {
        try {
          let jsonWrapped = false;
          let txt = body;
          try {
            const parsed = JSON.parse(body);
            if (typeof parsed === 'string') {
              txt = parsed;
              jsonWrapped = true;
            }
          } catch {}
          const newCsv = rewriteCsvWithStatus(txt);
          body = jsonWrapped ? JSON.stringify(newCsv) : newCsv;
        } catch {}
      }
      return send.call(this, body);
    };
  };

  patchFetch();
  patchXhr();
})();
