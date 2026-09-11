const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const { PLANS } = require('./focus');
const { PREMIUM_TREES, TREE_COLLECTIONS } = require('./trees');
const { initializeTransaction, verifyTransaction } = require('../lib/lahza');
const { grantPurchase } = require('../lib/grantPurchase');

const CLIENT_URL = process.env.CLIENT_URL || 'https://nuvora.ps';

function resolveItem(itemType, itemKey) {
  if (itemType === 'premium') {
    const plan = PLANS.find((p) => p.key === itemKey);
    return plan ? { priceUsd: plan.price, label: plan.name } : null;
  }
  if (itemType === 'tree') {
    const tree = PREMIUM_TREES.find((t) => t.key === itemKey);
    return tree ? { priceUsd: tree.priceUsd, label: tree.name } : null;
  }
  if (itemType === 'collection') {
    const collection = TREE_COLLECTIONS.find((c) => c.key === itemKey);
    return collection ? { priceUsd: collection.priceUsd, label: collection.name } : null;
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
  if (row.status !== 'pending') return { ok: true, alreadyProcessed: true, status: row.status };

  const verified = await verifyTransaction(reference);
  if (!verified.success) {
    await db.execute({
      sql: `UPDATE bank_transfer_requests SET status = 'rejected', reviewed_at = datetime('now') WHERE id = ?`,
      args: [row.id],
    });
    return { ok: false, reason: 'payment_not_successful', verified };
  }

  // Trust our own recorded price, not whatever the verify call echoes
  // back — the real fraud check here is that /checkout (below) is what
  // told Lahza how much to charge in the first place, using the live
  // catalogue price, not anything the client could have tampered with.
  // This step just confirms Lahza actually collected that amount.
  await db.execute({
    sql: `UPDATE bank_transfer_requests SET status = 'approved', reviewed_at = datetime('now') WHERE id = ?`,
    args: [row.id],
  });

  const grantToUserId = row.gift_recipient_id || row.user_id;
  await grantPurchase({ itemType: row.item_type || 'premium', planKey: row.plan_key, userId: grantToUserId });

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

  return { ok: true, alreadyProcessed: false };
}

// Start a Lahza checkout — mirrors trees.js's POST /bank-transfer input
// shape (item_type/item_key/gift_recipient_email) so the client can
// reuse the same form for "pay by card instantly" as it does for "pay by
// bank transfer and wait for review", just hitting a different endpoint.
router.post('/checkout', async (req, res) => {
  try {
    const { item_type, item_key, gift_recipient_email } = req.body;
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

    const { authorizationUrl } = await initializeTransaction({
      email: req.user.email,
      amount: item.priceUsd,
      currency: 'USD',
      reference,
      metadata: { userId: req.user.id, itemType, itemKey: item_key },
      callbackUrl: `${CLIENT_URL}/trees?lahza_ref=${encodeURIComponent(reference)}`,
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
