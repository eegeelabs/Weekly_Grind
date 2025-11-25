// Weekly_Grind unified server (no filesystem CSV storage)

// Load environment (DB credentials, SESSION_SECRET, etc.)
require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');

const { pool, testDbConnection } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------------------------------------------------------
// Core middleware
// -----------------------------------------------------------------------------

app.use(express.json({ limit: '5mb' }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// ===== TEMP DEV AUTH STUB =====
// Until real auth is wired into the UI, pretend every request is a logged-in admin
// if there is no existing session user.
app.use((req, _res, next) => {
  if (!req.session.user && !req.user) {
    req.user = {
      id: 1,
      username: 'dev-admin',
      role: 'admin',
    };
    console.log('Stub user applied', req.user, req.path);
  }
  next();
});
// ===== END TEMP DEV AUTH STUB =====

// -----------------------------------------------------------------------------
// Auth helpers (session + stub user)
// -----------------------------------------------------------------------------

function getCurrentUser(req) {
  return req.session?.user || req.user || null;
}

function requireAuth(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Auth required' });
  }
  req.user = user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Auth required' });
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = user;
    next();
  };
}

// Resolve which tech IDs a user can see (for projects scope)
async function getVisibleTechIds(user) {
  const { id, role } = user;

  if (role === 'admin') return null; // all
  if (role === 'coordinator') return null; // all

  if (role === 'tech') return [id];

  if (role === 'supervisor') {
    const result = await pool.query(
      'SELECT tech_id FROM supervisor_techs WHERE supervisor_id = $1',
      [id]
    );
    return result.rows.map((r) => r.tech_id);
  }

  if (role === 'manager') {
    const result = await pool.query(
      `SELECT DISTINCT st.tech_id
       FROM manager_supervisors ms
       JOIN supervisor_techs st ON st.supervisor_id = ms.supervisor_id
       WHERE ms.manager_id = $1`,
      [id]
    );
    return result.rows.map((r) => r.tech_id);
  }

  return [];
}

// -----------------------------------------------------------------------------
// AUTH ROUTES
// -----------------------------------------------------------------------------

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, display_name, email, role,
              password_hash, active, is_active
       FROM users
       WHERE username = $1`,
      [username]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const active =
      (user.active ?? true) && (user.is_active ?? true);

    if (!active) {
      return res.status(403).json({ error: 'Account disabled' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    };

    res.json({ ok: true, role: user.role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

app.get('/auth/me', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json(user);
});

// -----------------------------------------------------------------------------
// DATABASE HEALTH CHECK
// -----------------------------------------------------------------------------

app.get('/api/db-health', async (req, res) => {
  try {
    const now = await testDbConnection();
    res.json({ status: 'ok', time: now });
  } catch (err) {
    console.error('DB health check failed:', err);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// -----------------------------------------------------------------------------
// PROJECTS API
// -----------------------------------------------------------------------------

// List projects (scoped by role/visibility)
app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const visibleTechIds = await getVisibleTechIds(user);

    let result;
    if (!visibleTechIds) {
      // admin / coordinator: all projects
      result = await pool.query(
        `
        SELECT
          pid,
          client_id,
          project_name,
          status,
          assigned_tech_id,
          date_project_opened,
          date_hardware_received,
          date_last_contacted,
          customer_temp,
          days_open,
          config_goal_date,
          days_past_config_goal,
          project_goal_date,
          days_past_project_goal,
          days_since_comms
        FROM project_metrics_view
        ORDER BY date_project_opened DESC
        LIMIT 100;
        `
      );
    } else if (visibleTechIds.length === 0) {
      result = { rows: [] };
    } else {
      result = await pool.query(
        `
        SELECT
          pid,
          client_id,
          project_name,
          status,
          assigned_tech_id,
          date_project_opened,
          date_hardware_received,
          date_last_contacted,
          customer_temp,
          days_open,
          config_goal_date,
          days_past_config_goal,
          project_goal_date,
          days_past_project_goal,
          days_since_comms
        FROM project_metrics_view
        WHERE assigned_tech_id = ANY($1)
        ORDER BY date_project_opened DESC
        LIMIT 100;
        `,
        [visibleTechIds]
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Single project by PID (scoped by role)
app.get('/api/projects/:pid', requireAuth, async (req, res) => {
  try {
    const { pid } = req.params;
    const user = req.user;
    const visibleTechIds = await getVisibleTechIds(user);

    const result = await pool.query(
      'SELECT * FROM project_metrics_view WHERE pid = $1',
      [pid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const proj = result.rows[0];

    if (visibleTechIds && visibleTechIds.length > 0) {
      if (
        proj.assigned_tech_id == null ||
        !visibleTechIds.includes(proj.assigned_tech_id)
      ) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json(proj);
  } catch (err) {
    console.error('Error fetching project by PID:', err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create/Update project (Admin/Coordinator)
app.post(
  '/api/projects',
  requireRole('admin', 'coordinator'),
  async (req, res) => {
    try {
      const {
        pid,
        client_id,
        project_name,
        description,
        num_desktops,
        num_laptops,
        num_images,
        onsite_or_ship,
        onsite_scheduled,
        onsite_date,
        date_project_opened,
        date_hardware_received,
        hardware_eta,
        assigned_tech_id,
        date_last_contacted,
        contact_method,
        customer_temp,
        status,
        notes,
      } = req.body;

      if (!pid || !project_name || !date_project_opened) {
        return res.status(400).json({
          error: 'pid, project_name, and date_project_opened are required',
        });
      }

      const insertQuery = `
        INSERT INTO projects (
          pid,
          client_id,
          project_name,
          description,
          num_desktops,
          num_laptops,
          num_images,
          onsite_or_ship,
          onsite_scheduled,
          onsite_date,
          date_project_opened,
          date_hardware_received,
          hardware_eta,
          assigned_tech_id,
          date_last_contacted,
          contact_method,
          customer_temp,
          status,
          notes
        ) VALUES (
          $1,$2,$3,$4,
          $5,$6,$7,
          $8,$9,$10,
          $11,$12,$13,
          $14,$15,$16,
          $17,$18,$19
        )
        ON CONFLICT (pid) DO UPDATE
        SET
          client_id              = EXCLUDED.client_id,
          project_name           = EXCLUDED.project_name,
          description            = EXCLUDED.description,
          num_desktops           = EXCLUDED.num_desktops,
          num_laptops            = EXCLUDED.num_laptops,
          num_images             = EXCLUDED.num_images,
          onsite_or_ship         = EXCLUDED.onsite_or_ship,
          onsite_scheduled       = EXCLUDED.onsite_scheduled,
          onsite_date            = EXCLUDED.onsite_date,
          date_project_opened    = EXCLUDED.date_project_opened,
          date_hardware_received = EXCLUDED.date_hardware_received,
          hardware_eta           = EXCLUDED.hardware_eta,
          assigned_tech_id       = EXCLUDED.assigned_tech_id,
          date_last_contacted    = EXCLUDED.date_last_contacted,
          contact_method         = EXCLUDED.contact_method,
          customer_temp          = EXCLUDED.customer_temp,
          status                 = EXCLUDED.status,
          notes                  = EXCLUDED.notes,
          updated_at             = NOW()
        RETURNING pid;
      `;

      const values = [
        pid,
        client_id || null,
        project_name,
        description || null,
        num_desktops != null ? Number(num_desktops) : null,
        num_laptops != null ? Number(num_laptops) : null,
        num_images != null ? Number(num_images) : null,
        onsite_or_ship || null,
        typeof onsite_scheduled === 'boolean'
          ? onsite_scheduled
          : onsite_scheduled === 'true',
        onsite_date || null,
        date_project_opened,
        date_hardware_received || null,
        hardware_eta || null,
        assigned_tech_id != null ? Number(assigned_tech_id) : null,
        date_last_contacted || null,
        contact_method || null,
        customer_temp != null && customer_temp !== ''
          ? Number(customer_temp)
          : null,
        status || 'open',
        notes || null,
      ];

      await pool.query('BEGIN');
      await pool.query(insertQuery, values);

      const metrics = await pool.query(
        'SELECT * FROM project_metrics_view WHERE pid = $1',
        [pid]
      );

      await pool.query('COMMIT');
      return res.status(201).json(metrics.rows[0]);
    } catch (err) {
      console.error('Error creating/updating project:', err);
      try {
        await pool.query('ROLLBACK');
      } catch (_) {}
      return res.status(500).json({ error: 'Failed to create project' });
    }
  }
);

// Delete project (Admin only)
app.delete(
  '/api/projects/:pid',
  requireRole('admin'),
  async (req, res) => {
    const { pid } = req.params;

    if (!pid) {
      return res.status(400).json({ error: 'PID is required' });
    }

    try {
      await pool.query('BEGIN');

      const result = await pool.query(
        'DELETE FROM projects WHERE pid = $1',
        [pid]
      );

      await pool.query('COMMIT');

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      return res.status(204).send();
    } catch (err) {
      console.error('Error deleting project:', err);
      try {
        await pool.query('ROLLBACK');
      } catch (_) {}
      return res.status(500).json({ error: 'Failed to delete project' });
    }
  }
);

// -----------------------------------------------------------------------------
// USERS & ROLES API (Admin only)
// -----------------------------------------------------------------------------

// List users
app.get('/api/users', requireRole('admin'), async (req, res) => {
  const { role } = req.query;
  const params = [];
  let where = '';

  if (role) {
    params.push(role);
    where = 'WHERE role = $1';
  }

  try {
    const result = await pool.query(
      `SELECT id, username, display_name, email, role, active, is_active
       FROM users
       ${where}
       ORDER BY role, username`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user
app.post('/api/users', requireRole('admin'), async (req, res) => {
  const { username, display_name, email, role, password } = req.body || {};

  if (!username || !display_name || !role || !password) {
    return res
      .status(400)
      .json({ error: 'username, display_name, role, password required' });
  }

  try {
    const hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (username, display_name, email, role, password_hash, active, is_active)
       VALUES ($1,$2,$3,$4,$5,TRUE,TRUE)
       RETURNING id, username, display_name, email, role, active, is_active`,
      [username, display_name, email || null, role, hash]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (no password)
app.patch('/api/users/:id', requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);
  const { display_name, email, role, active, is_active } = req.body || {};

  try {
    const result = await pool.query(
      `UPDATE users
       SET display_name = COALESCE($1, display_name),
           email        = COALESCE($2, email),
           role         = COALESCE($3, role),
           active       = COALESCE($4, active),
           is_active    = COALESCE($5, is_active),
           updated_at   = now()
       WHERE id = $6
       RETURNING id, username, display_name, email, role, active, is_active`,
      [display_name, email, role, active, is_active, id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Reset password
app.post(
  '/api/users/:id/reset-password',
  requireRole('admin'),
  async (req, res) => {
    const id = Number(req.params.id);
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    try {
      const hash = await bcrypt.hash(password, 12);
      const result = await pool.query(
        `UPDATE users
         SET password_hash = $1,
             updated_at = now()
         WHERE id = $2
         RETURNING id`,
        [hash, id]
      );

      if (!result.rows[0]) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('Error resetting password:', err);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }
);

// Combined relationships payload
app.get(
  '/api/user-relations',
  requireRole('admin'),
  async (_req, res) => {
    try {
      const [usersRes, supTechRes, mgrSupRes] = await Promise.all([
        pool.query(
          'SELECT id, username, display_name, role FROM users ORDER BY role, username'
        ),
        pool.query('SELECT supervisor_id, tech_id FROM supervisor_techs'),
        pool.query(
          'SELECT manager_id, supervisor_id FROM manager_supervisors'
        ),
      ]);

      res.json({
        users: usersRes.rows,
        supervisorTechs: supTechRes.rows,
        managerSupervisors: mgrSupRes.rows,
      });
    } catch (err) {
      console.error('Error fetching relations:', err);
      res.status(500).json({ error: 'Failed to fetch relations' });
    }
  }
);

// Replace all techs for a supervisor
app.post(
  '/api/supervisor-techs/:supervisorId',
  requireRole('admin'),
  async (req, res) => {
    const supervisorId = Number(req.params.supervisorId);
    const { techIds } = req.body || {};

    await pool.query('BEGIN');
    try {
      await pool.query(
        'DELETE FROM supervisor_techs WHERE supervisor_id = $1',
        [supervisorId]
      );

      if (Array.isArray(techIds) && techIds.length > 0) {
        const values = techIds.map((_, i) => `($1,$${i + 2})`).join(', ');
        await pool.query(
          `INSERT INTO supervisor_techs (supervisor_id, tech_id)
           VALUES ${values}`,
          [supervisorId, ...techIds]
        );
      }

      await pool.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('Error updating supervisor_techs:', err);
      res
        .status(500)
        .json({ error: 'Failed to update supervisor/tech mapping' });
    }
  }
);

// Replace all supervisors for a manager
app.post(
  '/api/manager-supervisors/:managerId',
  requireRole('admin'),
  async (req, res) => {
    const managerId = Number(req.params.managerId);
    const { supervisorIds } = req.body || {};

    await pool.query('BEGIN');
    try {
      await pool.query(
        'DELETE FROM manager_supervisors WHERE manager_id = $1',
        [managerId]
      );

      if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
        const values = supervisorIds
          .map((_, i) => `($1,$${i + 2})`)
          .join(', ');
        await pool.query(
          `INSERT INTO manager_supervisors (manager_id, supervisor_id)
           VALUES ${values}`,
          [managerId, ...supervisorIds]
        );
      }

      await pool.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('Error updating manager_supervisors:', err);
      res
        .status(500)
        .json({ error: 'Failed to update manager/supervisor mapping' });
    }
  }
);

// -----------------------------------------------------------------------------
// WEEKLY GRIND SCHEDULE – DB-ONLY CSV STORAGE
// -----------------------------------------------------------------------------

const PUB_DIR = path.join(__dirname, 'public');
const WG_DIR = path.join(PUB_DIR, 'weekly-grind');

const CSV_HEADER = [
  'week_start',
  'tech',
  'day',
  'slot',
  'type',
  'details',
  'notes',
  'status',
];

const isISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// Ensure a week exists in week_schedules; return CSV text
async function ensureWeekCSV(mondayISO) {
  if (!isISO(mondayISO)) throw new Error('bad mondayISO');

  const existing = await pool.query(
    'SELECT csv FROM week_schedules WHERE week_start = $1',
    [mondayISO]
  );

  if (existing.rowCount > 0) {
    return existing.rows[0].csv;
  }

  const headerLine = CSV_HEADER.join(',') + '\n';

  await pool.query(
    `
    INSERT INTO week_schedules (week_start, csv)
    VALUES ($1, $2)
    ON CONFLICT (week_start) DO NOTHING
    `,
    [mondayISO, headerLine]
  );

  return headerLine;
}

// Save CSV text to DB
async function saveWeekCSV(mondayISO, csvText) {
  if (!isISO(mondayISO)) throw new Error('bad mondayISO');
  if (typeof csvText !== 'string' || !csvText.trim()) {
    throw new Error('empty csv');
  }

  const firstLine = (csvText.split(/\r?\n/)[0] || '').trim();
  const expectedHeader = CSV_HEADER.join(',');
  if (firstLine !== expectedHeader) {
    throw new Error('header mismatch');
  }

  await pool.query(
    `
    INSERT INTO week_schedules (week_start, csv)
    VALUES ($1, $2)
    ON CONFLICT (week_start)
    DO UPDATE SET csv = EXCLUDED.csv, updated_at = now();
    `,
    [mondayISO, csvText]
  );
}

// Return CSV for a given Monday (from DB)
app.get('/weekly-grind/cantina-schedule-:monday.csv', async (req, res) => {
  try {
    const monday = req.params.monday;
    if (!isISO(monday)) return res.status(400).send('Bad date');

    const csvText = await ensureWeekCSV(monday);
    res.type('text/csv').send(csvText);
  } catch (e) {
    console.error('ensureWeekCSV (DB)', e);
    res.status(500).send('Server error');
  }
});

// Save schedule from Admin (DB-backed)
app.post('/weekly-grind/api/save', async (req, res) => {
  try {
    const { mondayISO, csv } = req.body || {};
    if (!isISO(mondayISO) || typeof csv !== 'string') {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    await saveWeekCSV(mondayISO, csv);

    const url = `/weekly-grind/cantina-schedule-${mondayISO}.csv`;
    res.json({ ok: true, file: url });
  } catch (e) {
    console.error('save error (DB)', e);
    res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// Simple auth check used by frontend
app.get('/weekly-grind/api/auth-check', (_req, res) =>
  res.json({ ok: true })
);

// -----------------------------------------------------------------------------
// HTML PAGES (Weekly Grind)
// -----------------------------------------------------------------------------

// Admin page
app.get(['/weekly-grind/admin', '/weekly-grind/admin/'], (_req, res) => {
  res.sendFile(path.join(WG_DIR, 'cantina_admin.html'));
});

// View page
app.get(['/weekly-grind/view', '/weekly-grind/view/'], (_req, res) => {
  res.sendFile(path.join(WG_DIR, 'cantina_view.html'));
});

// Projects page
app.get(['/weekly-grind/projects', '/weekly-grind/projects/'], (_req, res) => {
  res.sendFile(path.join(WG_DIR, 'cantina_projects.html'));
});

// New Project page
app.get(
  ['/weekly-grind/projects/new', '/weekly-grind/projects/new/'],
  (_req, res) => {
    res.sendFile(path.join(WG_DIR, 'cantina_projects_new.html'));
  }
);

// Edit Project page
app.get('/weekly-grind/projects/:pid/edit', (_req, res) => {
  res.sendFile(path.join(WG_DIR, 'cantina_projects_edit.html'));
});

// Users & Roles page
app.get(['/weekly-grind/users', '/weekly-grind/users/'], (_req, res) => {
  res.sendFile(path.join(WG_DIR, 'weekly-grind-users.html'));
});

// Initiatives page (Under Construction)
app.get(
  ['/weekly-grind/initiatives', '/weekly-grind/initiatives/'],
  (_req, res) => {
    res.sendFile(path.join(WG_DIR, 'cantina_initiatives.html'));
  }
);

// Optional: convenience redirect
app.get(['/weekly-grind', '/weekly-grind/'], (_req, res) => {
  res.redirect('/weekly-grind/view');
});

// Health endpoint
app.get('/health', (_req, res) => res.json({ ok: true }));

// Redirect root to the View page
app.get('/', (_req, res) => {
  res.redirect('/weekly-grind/view');
});

// Static assets (must come after dynamic routes)
app.use(
  express.static(PUB_DIR, { index: false, maxAge: '1h', etag: true })
);

// -----------------------------------------------------------------------------
// START SERVER
// -----------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Weekly_Grind server listening on ${PORT}`);
});
