# Cantina Two-Page Site (v4)

**What this does**
- Stores weekly CSV files **in the same folder** as the pages (no folder picker).
- On first load of a week: server **creates** the CSV if missing (header-only).
- **Only** saves when you click **Save Week** on the Admin page (no auto-save).
- Switching weeks clears the page and loads that week's CSV; if missing, a blank CSV is created and loaded.
- View page reflects the same CSVs.

## Files
- `cantina_admin.html` — edit page (with Save button)
- `cantina_view.html` — read-only view
- `server.js` — tiny Node server that reads/writes CSV next to the pages
- `package.json` — Node metadata
- logo — optional

## Run it
1. Install Node (v16+).
2. In this folder, run:
   ```bash
   npm install
   npm start
   ```
3. Open:
   - Admin: http://localhost:5173/cantina_admin.html
   - View:  http://localhost:5173/cantina_view.html

> CSVs will be created beside these files as `cantina-schedule-YYYY-MM-DD.csv` (YYYY-MM-DD is the Monday of the selected week).

## CSV format
Header row:
```
week_start,tech,day,slot,type,details,notes,status
```
Then **two rows per tech per day** (slot 1 and slot 2), in UI order.

## Versioning
- The running version is sourced from `package.json` (`4.0.1` right now) and exposed at `/api/version`.
- Both HTML pages fetch and display the version at the bottom automatically.
- To bump the version, edit `"version"` in `package.json` (we recommend incrementing the patch by `.01`-style using semver patch: e.g., 4.0.1 → 4.0.2).
