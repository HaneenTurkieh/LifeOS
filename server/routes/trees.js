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

    res.json({ trees, totalXp, totalEarnedXp, equipped, mystic });
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
      const tree = TREES.find(t => t.key === tree_key);
      if (!tree) return res.status(400).json({ error: 'Unknown tree' });
      if (tree.cost > 0) {
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

module.exports = router;