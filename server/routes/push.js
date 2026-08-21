const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');

// Client needs this to call pushManager.subscribe({ applicationServerKey })
// — the public key is, by design, safe to hand to anyone (that's the
// point of public/private key pairs), so no auth needed on the value
// itself, but it's mounted under the authenticated /api/push prefix
// along with everything else here for simplicity.
router.get('/vapid-public-key', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(500).json({ error: 'Push not configured on this server' });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Body: the raw PushSubscription object from the browser —
// { endpoint, keys: { p256dh, auth } }. Upsert on (user_id, endpoint):
// re-subscribing the same device (e.g. after re-enabling notifications)
// just refreshes the keys instead of erroring on the UNIQUE constraint.
router.post('/subscribe', async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    await db.execute({
      sql:  `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(user_id, endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth`,
      args: [req.user.id, endpoint, keys.p256dh, keys.auth],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /push/subscribe error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Called when the user turns push off in Settings, or when the browser
// itself reports the subscription as no longer valid.
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });
    await db.execute({
      sql:  `DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?`,
      args: [req.user.id, endpoint],
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /push/unsubscribe error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// So Settings can show "push is on for this device" correctly on load,
// without the client having to keep its own separate source of truth.
router.get('/status', async (req, res) => {
  try {
    const count = (await db.execute({
      sql: `SELECT COUNT(*) c FROM push_subscriptions WHERE user_id=?`,
      args: [req.user.id],
    })).rows[0].c;
    res.json({ subscriptionCount: Number(count) });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Blunt "start completely fresh" tool — deletes EVERY subscription row on
// the account, not just the one the calling browser currently knows
// about. Normal /unsubscribe only ever targets its own endpoint (so
// turning push off on a laptop can't kill a phone's subscription too),
// but that's exactly the gap that lets a stale, orphaned row survive
// under the hood: re-adding Nuvora to the Home Screen, or re-enabling
// push after the browser silently rotated the subscription, can leave
// an old row behind that /unsubscribe never had a chance to target
// (the browser itself no longer remembers it existed) while a new one
// gets created alongside it — two rows, same physical device, both
// still valid, so every notification arrives twice. This is the
// explicit escape hatch: wipe every row for this account, then
// re-enable push from a clean slate.
router.post('/reset', async (req, res) => {
  try {
    const result = await db.execute({
      sql: `DELETE FROM push_subscriptions WHERE user_id=?`,
      args: [req.user.id],
    });
    res.json({ ok: true, removed: result.rowsAffected });
  } catch (err) {
    console.error('POST /push/reset error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
