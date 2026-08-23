// server/routes/paddle.js
//
// Handles Paddle payment events. This is the ONLY place that's allowed to
// grant real (paid) Premium going forward — the old /focus/premium/request
// honor-system route no longer flips is_premium on its own.
//
// Mounted at /api/paddle in index.js, UNAUTHENTICATED (no `authenticate`
// middleware) because Paddle — not a logged-in user — calls this. Trust is
// established instead by verifying the Paddle-Signature header against our
// notification destination's secret key.
//
// IMPORTANT: index.js registers `express.raw({ type: 'application/json' })`
// on the exact path '/api/paddle/webhook' BEFORE the global express.json()
// middleware. That's what makes req.body a raw Buffer here instead of a
// parsed object — required because the signature is computed over the
// exact bytes Paddle sent; re-serializing a parsed object would produce a
// different (and therefore "invalid") signature.

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { db }  = require('../db/connection');

// Maps a Paddle Price ID (from the Nuvora Premium product) to our internal
// plan key. Keep this in sync with the PLANS array in routes/focus.js.
const PRICE_TO_PLAN = {
  'pri_01kzrz0epxcy9v8qhe5md6qmbd': 'monthly',
  'pri_01kzrz863vxsrjcjnkrnk1pzya': 'semester',
  'pri_01kzrz9dxpyt5pwyb4kkb26gb6': 'annual',
};

// Subscription statuses that mean "this person should have Premium".
const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);
// past_due is included deliberately — Paddle is still retrying the card,
// and cutting someone off on the first failed charge is a harsher UX than
// most apps use. subscription.updated will flip them out once Paddle
// gives up (status becomes 'canceled' or 'paused').

function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(';').map((p) => p.split('='))
  );
  const { ts, h1 } = parts;
  if (!ts || !h1) return false;

  // Reject stale events (replay-attack protection), same 5s tolerance
  // Paddle's own SDKs use.
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 5) return false;

  const signedPayload = `${ts}:${rawBody}`;
  const computed = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  const a = Buffer.from(computed, 'utf8');
  const b = Buffer.from(h1, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function upsertPremium(userId, { isPremium, plan, customerId, subscriptionId, priceId, status, eventOccurredAt }) {
  await db.execute({
    sql: `INSERT INTO user_premium
            (user_id, is_premium, plan, paddle_customer_id, paddle_subscription_id, paddle_price_id, paddle_status, paddle_last_event_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            is_premium              = excluded.is_premium,
            plan                    = excluded.plan,
            paddle_customer_id      = excluded.paddle_customer_id,
            paddle_subscription_id  = excluded.paddle_subscription_id,
            paddle_price_id         = excluded.paddle_price_id,
            paddle_status           = excluded.paddle_status,
            paddle_last_event_at    = excluded.paddle_last_event_at`,
    args: [userId, isPremium ? 1 : 0, plan, customerId || null, subscriptionId || null, priceId || null, status || null, eventOccurredAt || null],
  });
}

// Paddle doesn't guarantee delivery order — a retried/delayed event can
// arrive after a newer one already landed. Without this, an out-of-order
// "still active" event could silently resurrect Premium right after a
// real cancellation. Returns true if `eventOccurredAt` is not older than
// whatever we last actually applied for this user (so it's safe to
// process); an event with no timestamp at all is let through rather than
// silently dropped, since that's a Paddle payload shape change, not
// something we want to fail closed on.
async function isNewerEvent(userId, eventOccurredAt) {
  if (!eventOccurredAt) return true;
  const row = (await db.execute({
    sql: `SELECT paddle_last_event_at FROM user_premium WHERE user_id = ?`,
    args: [userId],
  })).rows[0];
  const lastAppliedAt = row?.paddle_last_event_at;
  if (!lastAppliedAt) return true;
  return new Date(eventOccurredAt).getTime() >= new Date(lastAppliedAt).getTime();
}

router.post('/webhook', async (req, res) => {
  // Guard against a misconfigured middleware order silently breaking
  // verification (e.g. after some future refactor of index.js).
  if (!Buffer.isBuffer(req.body)) {
    console.error('Paddle webhook: req.body is not a raw Buffer — check express.raw() ordering in index.js');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const signature = req.headers['paddle-signature'];
  const secret     = process.env.PADDLE_WEBHOOK_SECRET;
  const rawBody    = req.body.toString('utf8');

  if (!verifySignature(rawBody, signature, secret)) {
    console.error('Paddle webhook: signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error('Paddle webhook: failed to parse body', err.message);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Acknowledge immediately-ish; we still process inline since our work
  // here is a couple of fast DB writes, not a slow job.
  try {
    const { event_type: eventType, data } = event;
    const userId = Number(data?.custom_data?.user_id);

    if (!userId || Number.isNaN(userId)) {
      // Nothing we can do without knowing who this is for — most likely
      // a test event fired from the Paddle dashboard with no custom_data.
      console.warn(`Paddle webhook: ${eventType} had no usable custom_data.user_id — ignoring`);
      return res.status(200).json({ received: true, ignored: true });
    }

    if (eventType === 'subscription.created' || eventType === 'subscription.updated' ||
        eventType === 'subscription.activated' || eventType === 'subscription.resumed' ||
        eventType === 'subscription.trialing') {
      if (!(await isNewerEvent(userId, event.occurred_at))) {
        console.warn(`Paddle webhook: ${eventType} for user ${userId} is older than the last applied event — ignoring (out of order)`);
        return res.status(200).json({ received: true, ignored: true });
      }
      const priceId  = data.items?.[0]?.price?.id;
      const plan     = PRICE_TO_PLAN[priceId] || null;
      const isActive = ACTIVE_STATUSES.has(data.status);
      await upsertPremium(userId, {
        isPremium: isActive,
        plan: isActive ? plan : null,
        customerId: data.customer_id,
        subscriptionId: data.id,
        priceId,
        status: data.status,
        eventOccurredAt: event.occurred_at,
      });
      console.log(`Paddle: user ${userId} subscription ${data.id} → ${data.status} (${plan || 'unknown plan'})`);
    } else if (eventType === 'subscription.canceled' || eventType === 'subscription.paused') {
      if (!(await isNewerEvent(userId, event.occurred_at))) {
        console.warn(`Paddle webhook: ${eventType} for user ${userId} is older than the last applied event — ignoring (out of order)`);
        return res.status(200).json({ received: true, ignored: true });
      }
      await upsertPremium(userId, {
        isPremium: false,
        plan: null,
        customerId: data.customer_id,
        subscriptionId: data.id,
        priceId: data.items?.[0]?.price?.id,
        status: data.status,
        eventOccurredAt: event.occurred_at,
      });
      console.log(`Paddle: user ${userId} subscription ${data.id} → ${data.status}, Premium revoked`);
    } else {
      // transaction.* events and anything else — subscription.* is our
      // source of truth for is_premium, so these are just logged.
      console.log(`Paddle webhook: received ${eventType} (no action taken)`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Paddle webhook processing error:', err);
    // 500 on purpose — Paddle automatically retries non-2xx responses with
    // backoff, so a transient failure (e.g. DB hiccup) self-heals instead
    // of silently dropping a payment event.
    res.status(500).json({ error: 'processing_failed' });
  }
});

module.exports = router;
