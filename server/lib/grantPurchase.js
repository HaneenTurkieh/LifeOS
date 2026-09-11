// lib/grantPurchase.js — the actual "give the user what they paid for"
// logic, extracted from routes/admin.js's reviewBankTransfer so both the
// manual bank-transfer approval path AND the instant Lahza gateway path
// (routes/lahza.js) grant access through the exact same code — one place
// to get tree/collection/premium grants right, instead of two copies
// that can quietly drift apart.
const { db } = require('../db/connection');
const { PLANS } = require('../routes/focus');
const { TREE_COLLECTIONS } = require('../routes/trees');

// itemType: 'premium' | 'tree' | 'collection'
// planKey: the PLANS key, tree key, or collection key respectively
// userId: the id to grant to — already resolved to the gift recipient by
// the caller if this was a gift; this function doesn't know or care who
// actually paid.
async function grantPurchase({ itemType, planKey, userId }) {
  if (itemType === 'tree') {
    await db.execute({
      sql: `INSERT INTO user_trees (user_id, tree_key) VALUES (?, ?) ON CONFLICT(user_id, tree_key) DO NOTHING`,
      args: [userId, planKey],
    });
  } else if (itemType === 'collection') {
    const collection = TREE_COLLECTIONS.find((c) => c.key === planKey);
    if (collection) {
      for (const treeKey of collection.treeKeys) {
        await db.execute({
          sql: `INSERT INTO user_trees (user_id, tree_key) VALUES (?, ?) ON CONFLICT(user_id, tree_key) DO NOTHING`,
          args: [userId, treeKey],
        });
      }
    }
  } else {
    // premium — same stacking logic as before: a fresh purchase extends
    // from whichever is later, the existing expiry (if still active) or
    // right now, so renewing early never costs anyone their leftover days.
    const months = (PLANS.find((p) => p.key === planKey) || {}).months || 1;
    const existing = (await db.execute({
      sql: `SELECT premium_expires_at FROM user_premium WHERE user_id = ?`,
      args: [userId],
    })).rows[0];
    const nowIso = new Date().toISOString();
    const baseIso = (existing?.premium_expires_at && new Date(existing.premium_expires_at) > new Date())
      ? existing.premium_expires_at
      : nowIso;
    const expiresAt = (await db.execute({
      sql: `SELECT datetime(?, '+' || ? || ' months') AS e`,
      args: [baseIso, months],
    })).rows[0].e;

    await db.execute({
      sql: `INSERT INTO user_premium (user_id, is_premium, plan, premium_expires_at) VALUES (?, 1, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET is_premium = 1, plan = excluded.plan, premium_expires_at = excluded.premium_expires_at`,
      args: [userId, planKey, expiresAt],
    });
  }
}

module.exports = { grantPurchase };
