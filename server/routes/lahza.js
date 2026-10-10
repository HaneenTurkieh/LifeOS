const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const { PLANS } = require('./focus');
const { PREMIUM_TREES, TREE_COLLECTIONS } = require('./trees');
const { initializeTransaction, verifyTransaction } = require('../lib/lahza');
const { grantPurchase } = require('../lib/grantPurchase');
const { rateLimit } = require('../lib/rateLimit');
const { requireVerified } = require('../lib/auth');

const CLIENT_URL = process.env.CLIENT_URL || 'https://nuvora.ps';

function resolveItem(itemType, itemKey) {
  if (itemType === 'premium') {
    const plan = PLANS.find((p) => p.key === itemKey);
    return plan ? { priceUsd: plan.price, label: plan.name } : null;
  }
  if (itemType === 'tree') {
    const tree = PREMIUM_TREES.find((t) => t.key === itemKey);
    return tree ? { priceUsd: tree.priceUsd, label: tree.name, emoji: tree.emoji } : null;
  }
  if (itemType === 'collection') {
    const collection = TREE_COLLECTIONS.find((c) => c.key === itemKey);
    return collection ? { priceUsd: collection.priceUsd, label: collection.name, emoji: '🎁' } : null;
  }
  return null;
}

// Idempotent — safe to call more than once for the same reference. The
// webhook (routes/lahzaWebhook.js) and the post-redirect client check
// (GET /verify/:reference below) can both race to confirm the same
// purchase; only whichever call finds the row still 'pending' actually
// grants anything, the other just reports alreadyProcessed.
async function completeLahzaPayment(reference) {
  const row = (await db.execute({
    sql: `SELECT * FROM bank_transfer_requests WHERE lahza_reference = ?`,
    args: [reference],
  })).rows[0];
  if (!row) return { ok: false, reason: 'unknown_reference' };
  // Included on every branch below (including alreadyProcessed) so the
  // client can render the purchase-reveal celebration off a single
  // verify call regardless of which race won — see TreeShop.jsx.
  const itemInfo = resolveItem(row.item_type || 'premium', row.plan_key) || {};
  if (row.status !== 'pending') {
    return { ok: true, alreadyProcessed: true, status: row.status, itemType: row.item_type, itemKey: row.plan_key, isGift: Boolean(row.gift_recipient_email), giftRecipientEmail: row.gift_recipient_email || null, ...itemInfo };
  }

  const verified = await verifyTransaction(reference);
  if (!verified.success) {
    // Used to flip the row to 'rejected' right here. But "not successful
    // YET" is a normal state — a customer still on the 3-D Secure screen,
    // or the redirect landing a moment before Lahza finalises — and once
    // the row was 'rejected', the real charge.success webhook that arrived
    // seconds later hit the `status !== 'pending'` guard above and granted
    // NOTHING: a customer who genuinely paid ended up with no product.
    // Leave it pending instead; the webhook (or the next verify) completes
    // it if/when the money actually lands, and an abandoned checkout is
    // harmless as a pending row.
    return { ok: false, reason: 'payment_not_successful', verified };
  }

  // Optional strict check that Lahza collected what we asked for. Off by
  // default ONLY because this integration was written from Lahza's docs
  // and hasn't been confirmed against a live transaction yet (their
  // amount/currency fields might not be shaped exactly as assumed) — a
  // wrong guess here would block real, paid orders. After one real test
  // payment, set LAHZA_STRICT_AMOUNT_CHECK=1 on the server. Until then a
  // mismatch is logged loudly instead of blocking.
  {
    const expectedUsd = Number(row.amount_usd);
    const amountBad   = typeof verified.amount === 'number' && Number.isFinite(expectedUsd) && verified.amount + 0.01 < expectedUsd;
    const currencyBad = verified.currency && String(verified.currency).toUpperCase() !== 'USD';
    if (amountBad || currencyBad) {
      console.error('[lahza] verify mismatch for', reference, { expectedUsd, got: verified.amount, currency: verified.currency });
      if (process.env.LAHZA_STRICT_AMOUNT_CHECK === '1') {
        return { ok: false, reason: 'amount_mismatch' };
      }
    }
  }

  // Trust our own recorded price, not whatever the verify call echoes
  // back — the real fraud check here is that /checkout (below) is what
  // told Lahza how much to charge in the first place, using the live
  // catalogue price, not anything the client could have tampered with.
  // This step just confirms Lahza actually collected that amount.
  // ATOMIC claim. The webhook and the post-redirect verify() both fire
  // within moments of a payment, and both used to read 'pending', then both
  // write 'approved', then both grant — so the same payment could grant
  // twice (a second 'premium' grant stacks months on top of the first).
  // `AND status = 'pending'` makes the database pick exactly one winner;
  // the loser sees 0 rows changed and just reports alreadyProcessed.
  const claim = await db.execute({
    sql: `UPDATE bank_transfer_requests SET status = 'approved', reviewed_at = datetime('now') WHERE id = ? AND status = 'pending'`,
    args: [row.id],
  });
  if (!claim.rowsAffected) {
    return { ok: true, alreadyProcessed: true, status: 'approved', itemType: row.item_type, itemKey: row.plan_key, isGift: Boolean(row.gift_recipient_email), giftRecipientEmail: row.gift_recipient_email || null, ...itemInfo };
  }

  const grantToUserId = row.gift_recipient_id || row.user_id;
  try {
    await grantPurchase({ itemType: row.item_type || 'premium', planKey: row.plan_key, userId: grantToUserId });
  } catch (e) {
    // We already claimed the row, so a failed grant would strand a paying
    // customer (row says 'approved', nothing granted). Put it back to
    // 'pending' so the next webhook retry / verify completes it.
    console.error('[lahza] grantPurchase failed after claim — reverting to pending:', reference, e.message);
    await db.execute({
      sql: `UPDATE bank_transfer_requests SET status = 'pending', reviewed_at = NULL WHERE id = ?`,
      args: [row.id],
    }).catch(() => {});
    throw e;
  }

  // Same "tell the recipient, not the payer" gift email as the manual
  // bank-transfer approval path (routes/admin.js) — a gift recipient
  // never submitted anything themselves and has no other way to learn a
  // tree just landed on their Shelf.
  if (row.gift_recipient_id && (row.item_type === 'tree' || row.item_type === 'collection')) {
    try {
      const { sendTreeGiftGrantedEmail } = require('../lib/email');
      const catalogueItem = row.item_type === 'tree'
        ? PREMIUM_TREES.find((t) => t.key === row.plan_key)
        : TREE_COLLECTIONS.find((c) => c.key === row.plan_key);
      const payer = (await db.execute({ sql: `SELECT name FROM users WHERE id = ?`, args: [row.user_id] })).rows[0];
      await sendTreeGiftGrantedEmail({
        to: row.gift_recipient_email,
        giftedByName: payer?.name || null,
        itemLabel: catalogueItem?.name || row.plan_key,
      });
    } catch (e) { console.error('sendTreeGiftGrantedEmail failed (non-fatal):', e.message); }
  }

  return { ok: true, alreadyProcessed: false, itemType: row.item_type, itemKey: row.plan_key, isGift: Boolean(row.gift_recipient_email), giftRecipientEmail: row.gift_recipient_email || null, ...itemInfo };
}

// Start a Lahza checkout — mirrors trees.js's POST /bank-transfer input
// shape (item_type/item_key/gift_recipient_email) so the client can
// reuse the same form for "pay by card instantly" as it does for "pay by
// bank transfer and wait for review", just hitting a different endpoint.
router.post('/checkout', requireVerified, async (req, res) => {
  try {
    if (rateLimit([`checkout:user:${req.user.id}`], { 'checkout:user:': { max: 20, windowMs: 60 * 60 * 1000 } })) {
      return res.status(429).json({ error: 'Too many checkout attempts. Please try again later.' });
    }
    const { item_type, item_key, gift_recipient_email } = req.body || {};
    const itemType = ['premium', 'tree', 'collection'].includes(item_type) ? item_type : 'premium';
    const item = resolveItem(itemType, item_key);
    if (!item) return res.status(400).json({ error: 'Unknown item' });

    let giftRecipientId = null, giftRecipientEmail = null;
    if (gift_recipient_email && (itemType === 'tree' || itemType === 'collection')) {
      const recipient = (await db.execute({
        sql: `SELECT id, email FROM users WHERE lower(email) = lower(?)`,
        args: [String(gift_recipient_email).trim()],
      })).rows[0];
      if (!recipient) return res.status(400).json({ error: 'No Nuvora account found with that email' });
      if (recipient.id === req.user.id) return res.status(400).json({ error: "You can't gift an item to yourself" });
      giftRecipientId = recipient.id;
      giftRecipientEmail = recipient.email;
    }

    // Unique per attempt (not just per item) — retrying a failed/
    // abandoned checkout must not collide with the earlier pending row.
    const reference = `nuvora_${req.user.id}_${itemType}_${item_key}_${Date.now()}`;
    await db.execute({
      sql: `INSERT INTO bank_transfer_requests
            (user_id, plan_key, amount_usd, item_type, payment_method, lahza_reference, gift_recipient_id, gift_recipient_email)
            VALUES (?, ?, ?, ?, 'lahza', ?, ?, ?)`,
      args: [req.user.id, item_key, item.priceUsd, itemType, reference, giftRecipientId, giftRecipientEmail],
    });

    // Trees/collections land back on the Tree Shop (where the shelf and
    // the request-status badges live); Premium has no dedicated page of
    // its own — it's managed inline in Settings — so that one redirects
    // to the Dashboard instead, which runs the same lahza_ref check.
    const returnPath = itemType === 'premium' ? '/' : '/trees';
    const { authorizationUrl } = await initializeTransaction({
      email: req.user.email,
      amount: item.priceUsd,
      currency: 'USD',
      reference,
      metadata: { userId: req.user.id, itemType, itemKey: item_key },
      callbackUrl: `${CLIENT_URL}${returnPath}?lahza_ref=${encodeURIComponent(reference)}`,
    });

    res.json({ authorization_url: authorizationUrl, reference });
  } catch (err) {
    console.error('POST /lahza/checkout error:', err);
    if (err.code === 'LAHZA_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    res.status(500).json({ error: 'Could not start checkout' });
  }
});

// The client lands back here (via callback_url above) right after
// paying — the fast path that grants access the moment the user is
// actually looking at the screen, without waiting on the webhook (which
// Lahza's dashboard has to be configured to send, and can lag). The
// webhook is the reliable backstop for anyone who closes the tab before
// the redirect completes.
router.get('/verify/:reference', async (req, res) => {
  try {
    if (rateLimit([`lahzaverify:user:${req.user.id}`], { 'lahzaverify:user:': { max: 60, windowMs: 10 * 60 * 1000 } })) {
      return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    }
    const row = (await db.execute({
      sql: `SELECT user_id FROM bank_transfer_requests WHERE lahza_reference = ?`,
      args: [req.params.reference],
    })).rows[0];
    if (!row || row.user_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
    res.json(await completeLahzaPayment(req.params.reference));
  } catch (err) {
    console.error('GET /lahza/verify error:', err);
    res.status(500).json({ error: 'Could not verify payment' });
  }
});

module.exports = router;
module.exports.completeLahzaPayment = completeLahzaPayment;
