const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const { getZodiacSign } = require('../lib/zodiac');

// ── Tree catalogue ────────────────────────────────────────────
const TREES = [
  { key: 'seedling',       name: 'Seedling',       emoji: '🌱', cost: 0,    description: 'Every journey starts here.' },
  { key: 'sprout',         name: 'Sprout',         emoji: '🌿', cost: 100,  description: 'Your first real growth.' },
  { key: 'oak',            name: 'Oak',            emoji: '🌳', cost: 300,  description: 'Strong and steady.' },
  { key: 'cherry_blossom', name: 'Cherry Blossom', emoji: '🌸', cost: 600,  description: 'Beautiful under pressure.' },
  { key: 'coral',          name: 'Coral Tree',     emoji: '🪸', cost: 800,  description: 'Vivid and alive, like a reef beneath the waves.' },
  { key: 'bamboo',         name: 'Bamboo',         emoji: '🎋', cost: 1000, description: 'Flexible, fast, unstoppable.' },
  { key: 'cactus',         name: 'Cactus',         emoji: '🌵', cost: 1200, description: 'Thrives on very little — resilience in its purest form.' },
  { key: 'palm',           name: 'Palm',           emoji: '🌴', cost: 1500, description: 'Thriving in the heat.' },
  { key: 'water',          name: 'Water Tree',     emoji: '💧', cost: 1800, description: 'Fluid, calm, endlessly renewing.' },
  { key: 'maple',          name: 'Maple',          emoji: '🍁', cost: 2200, description: 'Changes color, never loses its roots.' },
  { key: 'pine',           name: 'Pine',           emoji: '🌲', cost: 2500, description: 'Evergreen. Always growing.' },
  { key: 'flamingo',       name: 'Flamingo Tree',  emoji: '🦩', cost: 3200, description: 'Rare, pink, impossible to miss.' },
  { key: 'money',          name: 'Money Tree',     emoji: '💰', cost: 4000, description: 'Grows richer the more you tend it.' },
  { key: 'crystal',        name: 'Crystal Tree',   emoji: '✨', cost: 5000, description: 'Legendary. For the dedicated.' },
];

// ── Premium trees — real money, not XP ───────────────────────────
// The XP catalogue above has a ceiling (Crystal Tree tops it out at
// 5000 XP) — these three sit above that ceiling entirely and can only be
// bought, never earned, same pattern as an "extraordinary" cosmetic tier
// in a live-service game. priceId was meant to hold a Paddle one-time
// Price ID — left null here since this never actually got wired up to a
// real checkout before Paddle was removed entirely (Sept 2026, account
// verification rejected). TreeShop's buy button always shows a "not
// available yet" toast now (see client/src/pages/TreeShop.jsx) rather
// than attempting any checkout — priceId stays here as a marker for
// whichever payment processor eventually replaces Paddle, not because
// anything currently reads it.
const PREMIUM_TREES = [
  { key: 'aurora',  name: 'Aurora Tree',  emoji: '🌌', priceUsd: 2.99, priceId: null, description: 'Lights up like the northern sky, every night.' },
  { key: 'phoenix', name: 'Phoenix Tree', emoji: '🔥', priceUsd: 2.99, priceId: null, description: 'Rises brighter every time you restart.' },
  { key: 'galaxy',  name: 'Galaxy Tree',  emoji: '🌠', priceUsd: 2.99, priceId: null, description: 'A universe of its own, growing in your pocket.' },
  // Second wave — three more, added so the premium tier reads as an
  // actual collection worth browsing instead of a 3-item afterthought.
  { key: 'nebula',  name: 'Nebula Tree',  emoji: '🪐', priceUsd: 2.99, priceId: null, description: 'A cloud of stardust, still taking shape.' },
  { key: 'eclipse', name: 'Eclipse Tree', emoji: '🌑', priceUsd: 2.99, priceId: null, description: 'Dark at the center, gold at every edge.' },
  { key: 'comet',   name: 'Comet Tree',   emoji: '☄️', priceUsd: 2.99, priceId: null, description: 'Blazes past once — and stays remembered forever.' },
];
// Two collections now instead of one — the original sky-themed three,
// and a second pack for the newer additions. Buying either bundle costs
// less than buying its three trees individually ($6.99 vs $8.97) — the
// "buy the whole collection" option your instructor described. Each
// would need its own separate one-time price (not a discount code) so
// it grants all three trees at once — same "not available yet" status
// as the individual trees above until a real checkout exists.
const TREE_COLLECTIONS = [
  { key: 'celestial', name: 'Celestial Collection', treeKeys: ['aurora', 'phoenix', 'galaxy'], priceUsd: 6.99, priceId: null,
    description: 'All three sky trees, together — Aurora, Phoenix, and Galaxy.' },
  { key: 'astral', name: 'Astral Collection', treeKeys: ['nebula', 'eclipse', 'comet'], priceUsd: 6.99, priceId: null,
    description: 'The deep-space trio — Nebula, Eclipse, and Comet.' },
];

// ── Constellation — your own zodiac, star by star ───────────────
// Replaced the old free-form "design any shape" Mystic Tree slots.
// Every account has exactly one zodiac sign (derived from birthday,
// fixed for good — see lib/zodiac.js) with exactly 7 stars to unlock.
// Nothing is spent to claim a star; each one just needs enough
// *lifetime* XP earned (spending it elsewhere doesn't undo progress).
// The cost per star escalates — 1000 XP for the first, 4100 for the
// seventh, 18000 total — so a very active user finishes in roughly
// 2-3 months, not two weeks, and completing the whole constellation
// stays a real achievement instead of a routine drip.
const STAR_COSTS = [1000, 1500, 2100, 2600, 3100, 3600, 4100];
const STAR_THRESHOLDS = STAR_COSTS.reduce((acc, cost) => {
  acc.push((acc[acc.length - 1] || 0) + cost);
  return acc;
}, []); // [1000, 2500, 4600, 7200, 10300, 13900, 18000]
const ZODIAC_STAR_COUNT = STAR_THRESHOLDS.length;
const MYSTIC_COLORS = ['#8B5CF6', '#F472B6', '#F59E0B', '#10B981', '#38BDF8', '#6366F1', '#FB7185', '#EAB308'];
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function starsUnlockedFor(totalEarnedXp) {
  let n = 0;
  for (const threshold of STAR_THRESHOLDS) {
    if (totalEarnedXp >= threshold) n++; else break;
  }
  return n;
}

// ── GET /api/trees — catalogue + ownership status ─────────────
router.get('/', async (req, res) => {
  try {
    const [xpResult, earnedResult, ownedResult, equippedResult, mysticResult, userRow] = await Promise.all([
      db.execute({ sql: `SELECT COALESCE(SUM(amount),0) total FROM xp_log WHERE user_id=?`, args: [req.user.id] }),
      // Lifetime earned — only positive entries, so spending XP on a
      // tree doesn't undo progress toward the next Mystic slot.
      db.execute({ sql: `SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) total FROM xp_log WHERE user_id=?`, args: [req.user.id] }),
      db.execute({ sql: `SELECT tree_key FROM user_trees WHERE user_id=?`, args: [req.user.id] }),
      db.execute({ sql: `SELECT tree_key FROM user_equipped_tree WHERE user_id=?`, args: [req.user.id] }),
      db.execute({ sql: `SELECT id, star_index, color_hex, glow_hex, custom_name FROM user_mystic_tree WHERE user_id=? ORDER BY star_index ASC`, args: [req.user.id] }),
      db.execute({ sql: `SELECT birthday FROM users WHERE id=?`, args: [req.user.id] }),
    ]);

    const totalXp   = Number(xpResult.rows[0].total);
    const owned     = new Set(ownedResult.rows.map(r => r.tree_key));
    const equipped  = equippedResult.rows[0]?.tree_key || 'seedling';

    // Seedling is always owned
    owned.add('seedling');

    const trees = TREES.map(t => ({
      ...t,
      owned:    owned.has(t.key),
      equipped: equipped === t.key,
      canAfford: totalXp >= t.cost,
    }));

    // Same `user_trees` ownership table as the XP catalogue above — a
    // real-money grant (however that eventually gets wired up) and an XP
    // unlock both just end up as a row there, so nothing needs to change
    // downstream (equip, dashboard tree render, etc. don't care how a
    // tree was acquired).
    const premiumTrees = PREMIUM_TREES.map(t => ({
      ...t,
      owned:    owned.has(t.key),
      equipped: equipped === t.key,
    }));
    const collections = TREE_COLLECTIONS.map(c => ({
      ...c,
      owned: c.treeKeys.every((k) => owned.has(k)),
    }));

    const totalEarnedXp = Number(earnedResult.rows[0].total);
    const zodiac = getZodiacSign(userRow.rows[0]?.birthday);
    const unlockedStars = zodiac ? starsUnlockedFor(totalEarnedXp) : 0;
    const mysticTrees = mysticResult.rows.map(r => ({
      id:          r.id,
      star_index:  r.star_index,
      zodiac_key:  zodiac?.key ?? null,
      color_hex:   r.color_hex,
      glow_hex:    r.glow_hex,
      custom_name: r.custom_name,
      equipped:    equipped === `mystic:${r.id}`,
    }));
    const nextThreshold = STAR_THRESHOLDS[mysticTrees.length] ?? null;
    const mystic = {
      needsBirthday:   !zodiac,
      zodiacKey:       zodiac?.key ?? null,
      zodiacGlyph:     zodiac?.glyph ?? null,
      zodiacEmoji:     zodiac?.emoji ?? null,
      starLayout:      zodiac?.stars ?? null,
      starCount:       ZODIAC_STAR_COUNT,
      totalEarnedXp,
      unlockedStars,
      designedCount:   mysticTrees.length,
      pendingSlot:     zodiac ? mysticTrees.length < unlockedStars : false,
      complete:        zodiac ? mysticTrees.length >= ZODIAC_STAR_COUNT : false,
      xpUntilNextStar: nextThreshold != null ? Math.max(0, nextThreshold - totalEarnedXp) : null,
      colors:          MYSTIC_COLORS,
      trees:           mysticTrees,
    };

    res.json({ trees, premiumTrees, collections, totalXp, totalEarnedXp, equipped, mystic });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

function validateMysticInput({ color_hex, glow_hex, custom_name }) {
  if (!HEX_RE.test(color_hex)) return 'Invalid colour';
  if (!HEX_RE.test(glow_hex)) return 'Invalid glow colour';
  if (!custom_name || !custom_name.trim() || custom_name.trim().length > 24) return 'Name must be 1-24 characters';
  return null;
}

// ── POST /api/trees/mystic/create — claim the next star in line ──
// Shape/position is no longer picked — it's whichever star comes next
// in the user's zodiac layout (star_index = however many they already
// have). Only colour, glow, and a name are theirs to choose.
router.post('/mystic/create', async (req, res) => {
  const error = validateMysticInput(req.body);
  if (error) return res.status(400).json({ error });
  const { color_hex, glow_hex, custom_name } = req.body;

  try {
    const [earnedResult, existing, userRow] = await Promise.all([
      db.execute({ sql: `SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) total FROM xp_log WHERE user_id=?`, args: [req.user.id] }),
      db.execute({ sql: `SELECT COUNT(*) c FROM user_mystic_tree WHERE user_id=?`, args: [req.user.id] }),
      db.execute({ sql: `SELECT birthday FROM users WHERE id=?`, args: [req.user.id] }),
    ]);
    const zodiac = getZodiacSign(userRow.rows[0]?.birthday);
    if (!zodiac) return res.status(400).json({ error: 'Add your birthday in Settings to start your constellation' });

    const unlockedStars = starsUnlockedFor(Number(earnedResult.rows[0].total));
    const designedCount = Number(existing.rows[0].c);
    if (designedCount >= ZODIAC_STAR_COUNT) return res.status(400).json({ error: 'Your constellation is already complete' });
    if (designedCount >= unlockedStars) return res.status(400).json({ error: 'No star available yet — keep earning XP' });

    const insert = await db.execute({
      sql: `INSERT INTO user_mystic_tree (user_id, shape_key, zodiac_key, star_index, color_hex, glow_hex, custom_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [req.user.id, zodiac.key, zodiac.key, designedCount, color_hex, glow_hex, custom_name.trim()],
    });

    res.json({ success: true, id: Number(insert.lastInsertRowid) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── PUT /api/trees/mystic/:id — recolor/rename a star you already
//    unlocked (its zodiac + position are permanent, only cosmetic) ──
router.put('/mystic/:id', async (req, res) => {
  const error = validateMysticInput(req.body);
  if (error) return res.status(400).json({ error });
  const { color_hex, glow_hex, custom_name } = req.body;

  try {
    const existing = await db.execute({
      sql: `SELECT 1 FROM user_mystic_tree WHERE id=? AND user_id=?`,
      args: [req.params.id, req.user.id],
    });
    if (!existing.rows[0]) return res.status(404).json({ error: 'Star not found' });

    await db.execute({
      sql: `UPDATE user_mystic_tree SET color_hex=?, glow_hex=?, custom_name=?, updated_at=datetime('now') WHERE id=? AND user_id=?`,
      args: [color_hex, glow_hex, custom_name.trim(), req.params.id, req.user.id],
    });

    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── POST /api/trees/unlock ────────────────────────────────────
router.post('/unlock', async (req, res) => {
  const { tree_key } = req.body;
  const tree = TREES.find(t => t.key === tree_key);
  if (!tree) return res.status(400).json({ error: 'Unknown tree' });
  if (tree.cost === 0) return res.status(400).json({ error: 'This tree is free' });

  try {
    const xpResult = await db.execute({
      sql: `SELECT COALESCE(SUM(amount),0) total FROM xp_log WHERE user_id=?`,
      args: [req.user.id],
    });
    const totalXp = Number(xpResult.rows[0].total);
    if (totalXp < tree.cost) return res.status(400).json({ error: 'Not enough XP' });

    // Check not already owned
    const owned = await db.execute({
      sql: `SELECT 1 FROM user_trees WHERE user_id=? AND tree_key=?`,
      args: [req.user.id, tree_key],
    });
    if (owned.rows[0]) return res.status(400).json({ error: 'Already owned' });

    // Deduct XP + unlock
    await db.batch([
      { sql: `INSERT INTO xp_log (user_id, amount, reason) VALUES (?, ?, ?)`,
        args: [req.user.id, -tree.cost, `Unlocked tree: ${tree.name}`] },
      { sql: `INSERT INTO user_trees (user_id, tree_key) VALUES (?, ?)`,
        args: [req.user.id, tree_key] },
    ], 'write');

    res.json({ success: true, tree, remainingXp: totalXp - tree.cost });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── POST /api/trees/equip ─────────────────────────────────────
router.post('/equip', async (req, res) => {
  const { tree_key } = req.body;

  try {
    if (typeof tree_key === 'string' && tree_key.startsWith('mystic:')) {
      const mysticId = tree_key.slice('mystic:'.length);
      const owned = await db.execute({
        sql: `SELECT 1 FROM user_mystic_tree WHERE id=? AND user_id=?`,
        args: [mysticId, req.user.id],
      });
      if (!owned.rows[0]) return res.status(403).json({ error: 'Mystic Tree not found' });
    } else {
      // Premium trees aren't in the XP catalogue at all — check both so
      // equipping a purchased Aurora/Phoenix/Galaxy tree doesn't 400 as
      // "unknown" just because it's not one of the earnable ones.
      const tree = TREES.find(t => t.key === tree_key) || PREMIUM_TREES.find(t => t.key === tree_key);
      if (!tree) return res.status(400).json({ error: 'Unknown tree' });
      if (tree.cost > 0 || tree.priceUsd) {
        const owned = await db.execute({
          sql: `SELECT 1 FROM user_trees WHERE user_id=? AND tree_key=?`,
          args: [req.user.id, tree_key],
        });
        if (!owned.rows[0]) return res.status(403).json({ error: 'Tree not owned' });
      }
    }

    await db.execute({
      sql: `INSERT INTO user_equipped_tree (user_id, tree_key) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET tree_key=excluded.tree_key`,
      args: [req.user.id, tree_key],
    });

    res.json({ success: true, equipped: tree_key });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── Bank transfer — premium trees/collections, same honor-system queue
// as Premium plans (POST /focus/premium/bank-transfer). There's still no
// real payment gateway (Paddle removed, nothing replaced it — see the
// PREMIUM_TREES comment above), so this creates a 'pending' row and
// emails Haneen the same way; she checks her bank app herself and
// approves/rejects from Settings → Stats → Bank transfers, which now
// grants a user_trees row instead of flipping is_premium when the
// request's item_type is 'tree'/'collection' (see routes/admin.js).
router.post('/bank-transfer', async (req, res) => {
  const { item_type, item_key, reference_note, gift_recipient_email } = req.body;
  let item, priceUsd, label;
  if (item_type === 'tree') {
    item = PREMIUM_TREES.find((t) => t.key === item_key);
    if (!item) return res.status(400).json({ error: 'Unknown tree' });
    priceUsd = item.priceUsd;
    label = item.name;
  } else if (item_type === 'collection') {
    item = TREE_COLLECTIONS.find((c) => c.key === item_key);
    if (!item) return res.status(400).json({ error: 'Unknown collection' });
    priceUsd = item.priceUsd;
    label = item.name;
  } else {
    return res.status(400).json({ error: "item_type must be 'tree' or 'collection'" });
  }

  try {
    // Gifting — buyer pays, but the tree/collection lands on someone
    // ELSE's shelf once Haneen approves (see routes/admin.js's
    // reviewBankTransfer). Resolved to a real account up front, not left
    // as a bare email string, so approval never has to guess who "the
    // recipient" was from free text.
    let giftRecipientId = null;
    let giftRecipientEmail = null;
    let giftRecipientName = null;
    const giftEmailInput = String(gift_recipient_email || '').trim();
    if (giftEmailInput) {
      const recipient = (await db.execute({
        sql: `SELECT id, name, email FROM users WHERE lower(email) = lower(?)`,
        args: [giftEmailInput],
      })).rows[0];
      if (!recipient) {
        return res.status(400).json({ error: 'No Nuvora account found with that email.' });
      }
      if (recipient.id === req.user.id) {
        return res.status(400).json({ error: "You can't gift a tree to yourself — just buy it directly." });
      }
      giftRecipientId    = recipient.id;
      giftRecipientEmail = recipient.email;
      giftRecipientName  = recipient.name;
    }

    // Blocks a duplicate submission for the SAME item only (not one
    // pending request across the whole shop) — unlike Premium, which is
    // a single account-wide subscription, trees/collections are
    // independent purchases, so someone with a Phoenix Tree request
    // under review shouldn't be locked out of also buying the Astral
    // Collection while they wait. Still keeps Haneen's queue free of
    // "did I already send this" duplicates for the one item that
    // actually matters: the same tree/collection twice.
    const existing = (await db.execute({
      sql: `SELECT id FROM bank_transfer_requests WHERE user_id = ? AND status = 'pending' AND item_type = ? AND plan_key = ?`,
      args: [req.user.id, item_type, item_key],
    })).rows[0];
    if (existing) {
      return res.status(400).json({ error: 'You already have a request for this pending review.' });
    }

    const note = String(reference_note || '').trim().slice(0, 500) || null;
    const result = await db.execute({
      sql: `INSERT INTO bank_transfer_requests (user_id, plan_key, amount_usd, reference_note, item_type, gift_recipient_id, gift_recipient_email)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [req.user.id, item_key, priceUsd, note, item_type, giftRecipientId, giftRecipientEmail],
    });

    try {
      const { sendBankTransferRequestEmail } = require('../lib/email');
      await sendBankTransferRequestEmail({
        userEmail: req.user.email,
        userName:  req.user.name,
        planLabel: label,
        amountLabel: `$${priceUsd.toFixed(2)}`,
        referenceNote: note,
        itemNoun: item_type === 'collection' ? 'collection' : 'tree',
        giftRecipientLabel: giftRecipientId ? (giftRecipientName || giftRecipientEmail) : null,
      });
    } catch (e) {
      console.error('sendBankTransferRequestEmail failed (non-fatal):', e.message);
    }

    res.json({
      id: Number(result.lastInsertRowid), status: 'pending', item_type, item_key, amount_usd: priceUsd,
      gift_recipient_email: giftRecipientEmail,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// Every one of this user's Tree Shop requests (not just the latest, the
// way Premium's /mine works) — the shop shows more than one item at
// once, so each tree/collection card needs to know its OWN status, not
// just whichever request happened to be submitted most recently.
router.get('/bank-transfer/mine', async (req, res) => {
  try {
    const rows = (await db.execute({
      sql: `SELECT plan_key AS item_key, item_type, amount_usd, status, created_at, reviewed_at, gift_recipient_email
            FROM bank_transfer_requests
            WHERE user_id = ? AND item_type IN ('tree','collection')
            ORDER BY created_at DESC`,
      args: [req.user.id],
    })).rows;
    res.json({ requests: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── GET /equipped-summary — just the current equipped tree_key ──────
// Powers the "Tree Aura" background tint (ThemeContext.jsx polls this
// every 5s, same tick as its existing premium/theme sync) — when a
// premium tree is equipped, GlobalBackground.jsx tints the whole app
// with that tree's own color, everywhere, not just on this page. That's
// the actual payoff for buying one: it changes how using Nuvora feels,
// not just what one card on the Shelf looks like. Deliberately NOT
// reusing GET / here, which builds the entire catalogue + XP totals —
// wasteful to hit that every few seconds just for one column.
router.get('/equipped-summary', async (req, res) => {
  try {
    const row = (await db.execute({
      sql: `SELECT tree_key FROM user_equipped_tree WHERE user_id = ?`,
      args: [req.user.id],
    })).rows[0];
    res.json({ tree_key: row?.tree_key || 'seedling' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// Exported so a future payment processor's webhook/checkout handler can
// grant the right tree(s) for a completed one-time purchase without
// re-hardcoding the catalogue a second time (routes/paddle.js used to be
// that consumer — removed Sept 2026, see routes/paddle.js for details).
module.exports = router;
module.exports.PREMIUM_TREES = PREMIUM_TREES;
module.exports.TREE_COLLECTIONS = TREE_COLLECTIONS;