// lib/reviewBankTransfer.js
// The actual work of approving/rejecting one pending bank_transfer_requests
// row — status flip, grant, bell/push notification, gift email. Extracted
// out of routes/admin.js (where it used to live inline) so a second
// caller could reuse it without duplicating all four steps: routes/
// bankSms.js's webhook (an iPhone Shortcut forwarding Haneen's incoming
// Reflect/Arab Bank SMS, auto-matched by amount) now approves a request
// through the exact same path a manual click in the admin queue does.
// Returns a plain result object rather than touching req/res — callers
// own the HTTP (or non-HTTP, for the webhook) side of things.
const { db } = require('../db/connection');
const { grantPurchase } = require('./grantPurchase');
const { PREMIUM_TREES, TREE_COLLECTIONS } = require('../routes/trees');
const { PLANS } = require('../routes/focus');

function itemLabel(itemType, planKey) {
  if (itemType === 'tree')       return PREMIUM_TREES.find((t) => t.key === planKey)?.name || planKey;
  if (itemType === 'collection') return TREE_COLLECTIONS.find((c) => c.key === planKey)?.name || planKey;
  return PLANS.find((p) => p.key === planKey)?.name || planKey;
}

async function reviewBankTransfer(id, { approve }) {
  const row = (await db.execute({
    sql: `SELECT id, user_id, plan_key, status, item_type, gift_recipient_id, gift_recipient_email
          FROM bank_transfer_requests WHERE id = ?`,
    args: [id],
  })).rows[0];
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.status !== 'pending') return { ok: false, reason: 'already_reviewed', status: row.status };

  await db.execute({
    sql: `UPDATE bank_transfer_requests SET status = ?, reviewed_at = datetime('now') WHERE id = ?`,
    args: [approve ? 'approved' : 'rejected', id],
  });

  const itemType = row.item_type || 'premium';
  // Gifting only ever applies to tree/collection requests (trees.js is
  // the only place that ever sets gift_recipient_id) — grant to whoever's
  // actually supposed to end up with it, which is the payer themselves
  // unless this was a gift.
  const grantToUserId = row.gift_recipient_id || row.user_id;

  // Same grant logic the instant Lahza gateway path uses (routes/
  // lahza.js) — extracted to lib/grantPurchase.js so a manual approval,
  // an SMS-auto-match, and an automatic card payment can never drift
  // apart on what a purchase actually grants.
  if (approve) {
    await grantPurchase({ itemType, planKey: row.plan_key, userId: grantToUserId });
  }

  // Instant bell + push the moment this request is reviewed — whether
  // that review was Haneen's own click or the SMS webhook auto-matching
  // it. Goes to the PAYER regardless of gift status: they submitted this
  // request and are waiting on an answer either way, separate from the
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

  // Tell the RECIPIENT, not the payer — the payer already sees their own
  // request's status flip (and now the notification above), but a gift
  // recipient never submitted anything and has no other way to learn a
  // tree just landed on their Shelf. Only on approval — rejecting a gift
  // isn't news anyone but the payer needs.
  if (approve && row.gift_recipient_id && (itemType === 'tree' || itemType === 'collection')) {
    try {
      const { sendTreeGiftGrantedEmail } = require('./email');
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

  return { ok: true, status: approve ? 'approved' : 'rejected' };
}

module.exports = { reviewBankTransfer };
