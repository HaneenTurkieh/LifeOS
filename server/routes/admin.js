const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const { isOwnerEmail } = require('../lib/ownerEmails');
// The actual tree/collection/premium grant logic used to live inline
// here — now shared with the instant Lahza gateway path (routes/
// lahza.js) via lib/grantPurchase.js, so manual approval and an
// automatic card payment can never drift apart on what a purchase
// actually grants.
const { grantPurchase } = require('../lib/grantPurchase');
// Tree Shop's premium trees (Aurora/Phoenix/Galaxy/...) aren't tied to
// Premium/is_premium at all, and — since Paddle was removed and no
// replacement checkout exists yet (see routes/trees.js) — there's no
// purchase flow that can grant one either. Before the endpoint below
// existed, the only way to give someone a premium tree was inserting a
// row into user_trees by hand in Turso. Reusing the same catalogue
// trees.js exports so this can't drift from what TreeShop.jsx actually
// sells.
const { PREMIUM_TREES, TREE_COLLECTIONS } = require('./trees');
// For notification copy only (see reviewBankTransfer below) — the
// catalogue name to show the payer, e.g. "Aurora Tree" or "Pro Plan",
// rather than the bare plan_key.
const { PLANS } = require('./focus');

function itemLabel(itemType, planKey) {
  if (itemType === 'tree')       return PREMIUM_TREES.find((t) => t.key === planKey)?.name || planKey;
  if (itemType === 'collection') return TREE_COLLECTIONS.find((c) => c.key === planKey)?.name || planKey;
  return PLANS.find((p) => p.key === planKey)?.name || planKey;
}

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

// ── POST /users/:id/trees — manually grant/revoke ONE premium tree ──
// { tree_key, grant: true|false }. Same "manual until a real payment
// processor exists" pattern as the /premium endpoint above, but for an
// individual Tree Shop collectible instead of the account-wide Premium
// flag — those are two separate systems (user_trees vs user_premium),
// so granting Premium here does nothing for someone's shelf, and vice
// versa. Idempotent both ways: granting an already-owned tree, or
// revoking one never owned, both just succeed as a no-op.
router.post('/users/:id/trees', requireOwner, async (req, res) => {
  try {
    const userId   = Number(req.params.id);
    const treeKey  = req.body.tree_key;
    const grant    = !!req.body.grant;
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'Invalid user id' });
    const tree = PREMIUM_TREES.find((t) => t.key === treeKey);
    if (!tree) return res.status(400).json({ error: 'Unknown premium tree' });

    const user = (await db.execute({
      sql: `SELECT id, email FROM users WHERE id = ?`, args: [userId],
    })).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (grant) {
      await db.execute({
        sql: `INSERT INTO user_trees (user_id, tree_key) VALUES (?, ?)
              ON CONFLICT(user_id, tree_key) DO NOTHING`,
        args: [userId, treeKey],
      });
    } else {
      await db.execute({
        sql: `DELETE FROM user_trees WHERE user_id = ? AND tree_key = ?`,
        args: [userId, treeKey],
      });
    }

    res.json({ ok: true, user_id: userId, email: user.email, tree_key: treeKey, owned: grant });
  } catch (err) {
    console.error('POST /admin/users/:id/trees error:', err);
    res.status(500).json({ error: 'Could not update tree ownership' });
  }
});

// ── Bank transfer requests — owner-only review queue ───────────────
// Backs the Stats tab's "Bank transfers" section. This manual-transfer
// honor-system queue (POST /focus/premium/bank-transfer, and now also
// POST /trees/bank-transfer for Tree Shop) is the only way someone
// actually pays for anything (Paddle was removed Sept 2026 — see
// routes/focus.js PLANS comment). Haneen checks her own bank app for a
// matching transfer, then approves or rejects here — approving is what
// grants Premium (item_type 'premium'/legacy rows) or a Tree Shop
// tree/collection (item_type 'tree'/'collection'), branched below in
// reviewBankTransfer.
router.get('/bank-transfers', requireOwner, async (req, res) => {
  try {
    // LEFT JOIN (not JOIN) for the gift recipient — gift_recipient_id is
    // NULL on every non-gift request, and even a gift request's
    // recipient row could theoretically be gone (deleted account) while
    // the request itself stays reviewable using the raw
    // gift_recipient_email already stored on the row.
    const rows = (await db.execute(`
      SELECT b.id, b.user_id, b.plan_key, b.amount_usd, b.reference_note, b.status,
             b.item_type, b.created_at, b.reviewed_at, u.name, u.email,
             b.gift_recipient_id, b.gift_recipient_email, ru.name AS gift_recipient_name
      FROM bank_transfer_requests b
      JOIN users u ON u.id = b.user_id
      LEFT JOIN users ru ON ru.id = b.gift_recipient_id
      ORDER BY (b.status = 'pending') DESC, b.created_at DESC
      LIMIT 100
    `)).rows;
    res.json({
      requests: rows.map((r) => ({
        id: r.id, user_id: r.user_id, plan_key: r.plan_key,
        item_type: r.item_type || 'premium',
        amount_usd: Number(r.amount_usd), reference_note: r.reference_note,
        status: r.status, created_at: r.created_at, reviewed_at: r.reviewed_at,
        name: r.name, email: r.email,
        gift_recipient_email: r.gift_recipient_email || null,
        gift_recipient_name: r.gift_recipient_name || null,
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
      sql: `SELECT id, user_id, plan_key, status, item_type, gift_recipient_id, gift_recipient_email
            FROM bank_transfer_requests WHERE id = ?`,
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

    const itemType = row.item_type || 'premium';
    // Gifting only ever applies to tree/collection requests (trees.js is
    // the only place that ever sets gift_recipient_id) — grant to
    // whoever's actually supposed to end up with it, which is the payer
    // themselves unless this was a gift.
    const grantToUserId = row.gift_recipient_id || row.user_id;

    // Same grant logic the instant Lahza gateway path uses (routes/
    // lahza.js) — extracted to lib/grantPurchase.js so manual approval
    // here and an automatic card payment there can never drift apart.
    if (approve) {
      await grantPurchase({ itemType, planKey: row.plan_key, userId: grantToUserId });
    }

    // Instant bell + push the moment Haneen reviews a transfer — before
    // this, the payer's only way to find out was reopening Settings/Tree
    // Shop and noticing the status badge had changed, which could sit
    // unnoticed for a day. Same direct-INSERT pattern channels.js uses
    // for instructor-triggered events (see channel_task_assigned etc.
    // there) — this is admin-triggered, not something generateNotifications
    // computes lazily, so it's written straight into the table. Goes to
    // the PAYER regardless of gift status: they submitted this request
    // and are waiting on an answer either way, separate from the
    // gift-recipient email below (which is about who received the item,
    // not whether the payment cleared). Registered in PUSHABLE_TYPES
    // (lib/pushReminders.js) so the next push tick actually delivers it,
    // not just the in-app bell.
    try {
      const label = itemLabel(itemType, row.plan_key);
      await db.execute({
        sql: `INSERT INTO notifications (user_id, type, title, body, link, dedupe_key, data)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(user_id, dedupe_key) DO NOTHING`,
        args: [
          row.user_id,
          approve ? 'purchase_approved' : 'purchase_rejected',
          approve ? 'Payment confirmed!' : "Transfer couldn't be confirmed",
          approve
            ? `${label} is ${itemType === 'premium' ? 'now active' : 'on its way to your Shelf'} — enjoy!`
            : `We couldn't match your bank transfer for ${label}. Double-check the IBAN/amount and try again, or pay by card instead.`,
          itemType === 'premium' ? '/' : '/trees',
          `bank_transfer_review:${id}`,
          JSON.stringify({ itemType, planKey: row.plan_key }),
        ],
      });
    } catch (e) {
      console.error('bank-transfer review notification failed (non-fatal):', e.message);
    }

    // Tell the RECIPIENT, not the payer — the payer already sees their
    // own request's status flip in Settings, but a gift recipient never
    // submitted anything and has no other way to learn a tree just
    // landed on their Shelf. Only on approval — rejecting a gift isn't
    // news anyone but the payer needs.
    if (approve && row.gift_recipient_id && (itemType === 'tree' || itemType === 'collection')) {
      try {
        const { sendTreeGiftGrantedEmail } = require('../lib/email');
        const catalogueItem = itemType === 'tree'
          ? PREMIUM_TREES.find((t) => t.key === row.plan_key)
          : TREE_COLLECTIONS.find((c) => c.key === row.plan_key);
        const payer = (await db.execute({
          sql: `SELECT name FROM users WHERE id = ?`, args: [row.user_id],
        })).rows[0];
        await sendTreeGiftGrantedEmail({
          to: row.gift_recipient_email,
          giftedByName: payer?.name || null,
          itemLabel: catalogueItem?.name || row.plan_key,
        });
      } catch (e) {
        console.error('sendTreeGiftGrantedEmail failed (non-fatal):', e.message);
      }
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
