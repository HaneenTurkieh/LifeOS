const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');

// Same "owner-only" allowlist pattern used in db/connection.js for the
// free-Premium override — anyone else hitting this route gets a plain
// 403, no matter how they authenticated.
const OWNER_EMAILS = ['haneenturkieh@hotmail.com', '20tasbeeh06@gmail.com'];

function requireOwner(req, res, next) {
  const email = (req.user?.email || '').toLowerCase();
  if (!OWNER_EMAILS.map((e) => e.toLowerCase()).includes(email)) {
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

module.exports = router;
