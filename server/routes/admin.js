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
    const [total, today, week, month, byDay, instructors, channels, channelStudents] = await Promise.all([
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
      // Classroom system adoption — "add these to my stats as the
      // owner" (the last item on the big feature list).
      db.execute(`SELECT COUNT(*) c FROM users WHERE role = 'instructor'`),
      db.execute(`SELECT COUNT(*) c FROM channels`),
      db.execute(`SELECT COUNT(DISTINCT student_id) c FROM channel_members`),
    ]);
    res.json({
      total_users:       Number(total.rows[0].c),
      new_today:         Number(today.rows[0].c),
      new_last_7_days:   Number(week.rows[0].c),
      new_last_30_days:  Number(month.rows[0].c),
      by_day:            byDay.rows.map((r) => ({ day: r.day, count: Number(r.c) })),
      total_instructors: Number(instructors.rows[0].c),
      total_channels:    Number(channels.rows[0].c),
      channel_students:  Number(channelStudents.rows[0].c),
    });
  } catch (err) {
    console.error('GET /admin/stats error:', err);
    res.status(500).json({ error: 'Could not load stats' });
  }
});

// ── GET /users — full signup list (name, email, joined), owner-only ────
router.get('/users', requireOwner, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT u.id, u.name, u.email, u.created_at, COALESCE(p.is_premium, 0) AS is_premium
      FROM users u LEFT JOIN user_premium p ON p.user_id = u.id
      ORDER BY u.created_at ASC
    `);
    res.json({
      users: result.rows.map((r) => ({
        id: r.id, name: r.name, email: r.email, created_at: r.created_at,
        is_premium: Boolean(Number(r.is_premium)),
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

// ── GET /cron-health — is the external reminders cron still alive? ────
// The push/email reminder pipeline depends entirely on cron-job.org (a
// free external service) pinging POST /cron/reminders on a schedule —
// nothing inside the app was watching whether that ever stopped. Every
// successful run now stamps app_meta.last_reminders_run_at (see
// routes/cron.js); this just reads it back and flags staleness so it's
// actually visible instead of silently broken.
const STALE_AFTER_MINUTES = 20; // reminders cron is expected roughly every ~10-15 min
router.get('/cron-health', requireOwner, async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT value FROM app_meta WHERE key = 'last_reminders_run_at'`
    );
    const lastRunAt = result.rows[0]?.value || null;
    let minutesAgo = null;
    if (lastRunAt) {
      const diffResult = await db.execute({
        sql: `SELECT (julianday('now') - julianday(?)) * 24 * 60 AS mins`,
        args: [lastRunAt],
      });
      minutesAgo = Math.round(Number(diffResult.rows[0].mins));
    }
    res.json({
      last_run_at: lastRunAt,
      minutes_ago: minutesAgo,
      stale: lastRunAt === null || minutesAgo > STALE_AFTER_MINUTES,
    });
  } catch (err) {
    console.error('GET /admin/cron-health error:', err);
    res.status(500).json({ error: 'Could not load cron health' });
  }
});

// ── POST /users/:id/premium — manually grant or revoke premium ────────
// Backs the "Request Premium" honor-system flow (routes/focus.js
// POST /premium/request) — that route only emails the owner and
// deliberately does NOT flip is_premium (payment isn't verified there).
// Before this endpoint existed, the only way to actually fulfill that
// request was hand-editing the database directly. { grant: true|false }.
router.post('/users/:id/premium', requireOwner, async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const grant  = !!req.body.grant;
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'Invalid user id' });

    const user = (await db.execute({
      sql: `SELECT id, email FROM users WHERE id = ?`, args: [userId],
    })).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    await db.execute({
      sql: `INSERT INTO user_premium (user_id, is_premium, plan) VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET is_premium = excluded.is_premium, plan = excluded.plan`,
      args: [userId, grant ? 1 : 0, grant ? 'manual' : null],
    });

    res.json({ ok: true, user_id: userId, email: user.email, is_premium: grant });
  } catch (err) {
    console.error('POST /admin/users/:id/premium error:', err);
    res.status(500).json({ error: 'Could not update premium status' });
  }
});

// ── Bank transfer requests — owner-only review queue ───────────────
// Backs the Stats tab's "Bank transfers" section. Paddle isn't a
// reliable path right now (see routes/focus.js PLANS comment), so this
// manual-transfer honor-system queue (POST /focus/premium/bank-transfer)
// is the primary way someone actually pays. Haneen checks her own bank
// app for a matching transfer, then approves or rejects here — approving
// is the only thing that ever grants Premium from this flow.
router.get('/bank-transfers', requireOwner, async (req, res) => {
  try {
    const rows = (await db.execute(`
      SELECT b.id, b.user_id, b.plan_key, b.amount_usd, b.reference_note, b.status,
             b.created_at, b.reviewed_at, u.name, u.email
      FROM bank_transfer_requests b
      JOIN users u ON u.id = b.user_id
      ORDER BY (b.status = 'pending') DESC, b.created_at DESC
      LIMIT 100
    `)).rows;
    res.json({
      requests: rows.map((r) => ({
        id: r.id, user_id: r.user_id, plan_key: r.plan_key,
        amount_usd: Number(r.amount_usd), reference_note: r.reference_note,
        status: r.status, created_at: r.created_at, reviewed_at: r.reviewed_at,
        name: r.name, email: r.email,
      })),
    });
  } catch (err) {
    console.error('GET /admin/bank-transfers error:', err);
    res.status(500).json({ error: 'Could not load bank transfer requests' });
  }
});

async function reviewBankTransfer(req, res, { approve }) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid request id' });

    const row = (await db.execute({
      sql: `SELECT id, user_id, plan_key, status FROM bank_transfer_requests WHERE id = ?`,
      args: [id],
    })).rows[0];
    if (!row) return res.status(404).json({ error: 'Request not found' });
    if (row.status !== 'pending') {
      return res.status(400).json({ error: `Already ${row.status}` });
    }

    await db.execute({
      sql: `UPDATE bank_transfer_requests SET status = ?, reviewed_at = datetime('now') WHERE id = ?`,
      args: [approve ? 'approved' : 'rejected', id],
    });

    if (approve) {
      // Same grant mechanism as the manual /users/:id/premium route
      // above, except plan is the real plan the person paid for
      // (monthly/semester/annual) instead of the generic 'manual' label
      // — so their Premium tab shows the actual plan they're on.
      await db.execute({
        sql: `INSERT INTO user_premium (user_id, is_premium, plan) VALUES (?, 1, ?)
              ON CONFLICT(user_id) DO UPDATE SET is_premium = 1, plan = excluded.plan`,
        args: [row.user_id, row.plan_key],
      });
    }

    res.json({ ok: true, id, status: approve ? 'approved' : 'rejected' });
  } catch (err) {
    console.error('POST /admin/bank-transfers/:id review error:', err);
    res.status(500).json({ error: 'Could not update request' });
  }
}
router.post('/bank-transfers/:id/approve', requireOwner, (req, res) => reviewBankTransfer(req, res, { approve: true }));
router.post('/bank-transfers/:id/reject',  requireOwner, (req, res) => reviewBankTransfer(req, res, { approve: false }));

module.exports = router;
