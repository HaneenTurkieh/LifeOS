const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const { isOwnerEmail } = require('../lib/ownerEmails');

function requireOwner(req, res, next) {
  if (!isOwnerEmail(req.user?.email)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  next();
}

// ── GET /stats — total users + signup growth, owner-only ──────────
router.get('/stats', requireOwner, async (req, res) => {
  try {
    const [total, today, week, month, byDay] = await Promise.all([
      db.execute(`SELECT COUNT(*) c FROM users`),
      db.execute(`SELECT COUNT(*) c FROM users WHERE date(created_at) = date('now')`),
      db.execute(`SELECT COUNT(*) c FROM users WHERE created_at >= datetime('now','-7 days')`),
      db.execute(`SELECT COUNT(*) c FROM users WHERE created_at >= datetime('now','-30 days')`),
      db.execute(`
        SELECT date(created_at) day, COUNT(*) c
        FROM users
        WHERE created_at >= datetime('now','-30 days')
        GROUP BY day
        ORDER BY day ASC
      `),
    ]);
    res.json({
      total_users:       Number(total.rows[0].c),
      new_today:         Number(today.rows[0].c),
      new_last_7_days:   Number(week.rows[0].c),
      new_last_30_days:  Number(month.rows[0].c),
      by_day:            byDay.rows.map((r) => ({ day: r.day, count: Number(r.c) })),
    });
  } catch (err) {
    console.error('GET /admin/stats error:', err);
    res.status(500).json({ error: 'Could not load stats' });
  }
});

// ── GET /users — full signup list (name, email, joined), owner-only ────
router.get('/users', requireOwner, async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT id, name, email, created_at FROM users ORDER BY created_at ASC`
    );
    res.json({
      users: result.rows.map((r) => ({
        id: r.id, name: r.name, email: r.email, created_at: r.created_at,
      })),
    });
  } catch (err) {
    console.error('GET /admin/users error:', err);
    res.status(500).json({ error: 'Could not load users' });
  }
});

// ── GET /errors — recent AI-call failures, owner-only ──────────────
// Backs the "Recent failures" section of the Stats tab — the actual
// visibility Haneen asked for into whether/how often Lumi (or the
// anti-procrastination feature) is failing for real users, without
// needing anyone to report it to her first.
router.get('/errors', requireOwner, async (req, res) => {
  try {
    const [recent, last24h, last7d] = await Promise.all([
      db.execute(`
        SELECT e.id, e.source, e.message, e.created_at, u.email
        FROM error_logs e LEFT JOIN users u ON u.id = e.user_id
        ORDER BY e.id DESC LIMIT 25
      `),
      db.execute(`SELECT COUNT(*) c FROM error_logs WHERE created_at >= datetime('now','-1 day')`),
      db.execute(`SELECT COUNT(*) c FROM error_logs WHERE created_at >= datetime('now','-7 days')`),
    ]);
    res.json({
      last_24h: Number(last24h.rows[0].c),
      last_7_days: Number(last7d.rows[0].c),
      recent: recent.rows.map((r) => ({
        id: r.id, source: r.source, message: r.message,
        created_at: r.created_at, email: r.email || null,
      })),
    });
  } catch (err) {
    console.error('GET /admin/errors error:', err);
    res.status(500).json({ error: 'Could not load error log' });
  }
});

module.exports = router;
