const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');

// ── Tree catalogue ────────────────────────────────────────────
const TREES = [
  { key: 'seedling',       name: 'Seedling',       emoji: '🌱', cost: 0,    description: 'Every journey starts here.' },
  { key: 'sprout',         name: 'Sprout',         emoji: '🌿', cost: 100,  description: 'Your first real growth.' },
  { key: 'oak',            name: 'Oak',            emoji: '🌳', cost: 300,  description: 'Strong and steady.' },
  { key: 'cherry_blossom', name: 'Cherry Blossom', emoji: '🌸', cost: 600,  description: 'Beautiful under pressure.' },
  { key: 'bamboo',         name: 'Bamboo',         emoji: '🎋', cost: 1000, description: 'Flexible, fast, unstoppable.' },
  { key: 'palm',           name: 'Palm',           emoji: '🌴', cost: 1500, description: 'Thriving in the heat.' },
  { key: 'pine',           name: 'Pine',           emoji: '🌲', cost: 2500, description: 'Evergreen. Always growing.' },
  { key: 'crystal',        name: 'Crystal Tree',   emoji: '✨', cost: 5000, description: 'Legendary. For the dedicated.' },
];

// ── Mystic Trees — user-designed, one new slot per 1000 XP ─────
// Not part of the fixed catalogue: every 1000 XP earned (lifetime
// total, unaffected by spending it elsewhere) unlocks a *slot* you can
// design — a shape, a fill colour, a glow colour, and a name. Nothing
// is spent to fill a slot; the XP threshold itself is the unlock.
// Collectible — earn 5000 XP and you'll have unlocked 5 slots to fill.
const XP_PER_MYSTIC_SLOT = 1000;
const MYSTIC_SHAPES = ['spiral', 'crystal', 'orbs', 'bloom', 'bough'];
const MYSTIC_COLORS = ['#8B5CF6', '#F472B6', '#F59E0B', '#10B981', '#38BDF8', '#6366F1', '#FB7185', '#EAB308'];
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// ── GET /api/trees — catalogue + ownership status ─────────────
router.get('/', async (req, res) => {
  try {
    const [xpResult, earnedResult, ownedResult, equippedResult, mysticResult] = await Promise.all([
      db.execute({ sql: `SELECT COALESCE(SUM(amount),0) total FROM xp_log WHERE user_id=?`, args: [req.user.id] }),
      // Lifetime earned — only positive entries, so spending XP on a
      // tree doesn't undo progress toward the next Mystic slot.
      db.execute({ sql: `SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) total FROM xp_log WHERE user_id=?`, args: [req.user.id] }),
      db.execute({ sql: `SELECT tree_key FROM user_trees WHERE user_id=?`, args: [req.user.id] }),
      db.execute({ sql: `SELECT tree_key FROM user_equipped_tree WHERE user_id=?`, args: [req.user.id] }),
      db.execute({ sql: `SELECT id, shape_key, color_hex, glow_hex, custom_name FROM user_mystic_tree WHERE user_id=? ORDER BY created_at ASC`, args: [req.user.id] }),
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
    const unlockedSlots = Math.floor(totalEarnedXp / XP_PER_MYSTIC_SLOT);
    const mysticTrees = mysticResult.rows.map(r => ({
      id:          r.id,
      shape_key:   r.shape_key,
      color_hex:   r.color_hex,
      glow_hex:    r.glow_hex,
      custom_name: r.custom_name,
      equipped:    equipped === `mystic:${r.id}`,
    }));
    const mystic = {
      xpPerSlot:       XP_PER_MYSTIC_SLOT,
      totalEarnedXp,
      unlockedSlots,
      designedCount:   mysticTrees.length,
      pendingSlot:     mysticTrees.length < unlockedSlots,
      xpUntilNextSlot: XP_PER_MYSTIC_SLOT - (totalEarnedXp % XP_PER_MYSTIC_SLOT),
      shapes:          MYSTIC_SHAPES,
      colors:          MYSTIC_COLORS,
      trees:           mysticTrees,
    };

    res.json({ trees, totalXp, totalEarnedXp, equipped, mystic });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

function validateMysticInput({ shape_key, color_hex, glow_hex, custom_name }) {
  if (!MYSTIC_SHAPES.includes(shape_key)) return 'Unknown shape';
  if (!HEX_RE.test(color_hex)) return 'Invalid colour';
  if (!HEX_RE.test(glow_hex)) return 'Invalid glow colour';
  if (!custom_name || !custom_name.trim() || custom_name.trim().length > 24) return 'Name must be 1-24 characters';
  return null;
}

// ── POST /api/trees/mystic/create — fill a newly unlocked slot ──
router.post('/mystic/create', async (req, res) => {
  const error = validateMysticInput(req.body);
  if (error) return res.status(400).json({ error });
  const { shape_key, color_hex, glow_hex, custom_name } = req.body;

  try {
    const [earnedResult, existing] = await Promise.all([
      db.execute({ sql: `SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) total FROM xp_log WHERE user_id=?`, args: [req.user.id] }),
      db.execute({ sql: `SELECT COUNT(*) c FROM user_mystic_tree WHERE user_id=?`, args: [req.user.id] }),
    ]);
    const unlockedSlots = Math.floor(Number(earnedResult.rows[0].total) / XP_PER_MYSTIC_SLOT);
    const designedCount = Number(existing.rows[0].c);
    if (designedCount >= unlockedSlots) return res.status(400).json({ error: 'No slot available yet — keep earning XP' });

    const insert = await db.execute({
      sql: `INSERT INTO user_mystic_tree (user_id, shape_key, color_hex, glow_hex, custom_name) VALUES (?, ?, ?, ?, ?)`,
      args: [req.user.id, shape_key, color_hex, glow_hex, custom_name.trim()],
    });

    res.json({ success: true, id: Number(insert.lastInsertRowid) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── PUT /api/trees/mystic/:id — free re-customization ───────────
router.put('/mystic/:id', async (req, res) => {
  const error = validateMysticInput(req.body);
  if (error) return res.status(400).json({ error });
  const { shape_key, color_hex, glow_hex, custom_name } = req.body;

  try {
    const existing = await db.execute({
      sql: `SELECT 1 FROM user_mystic_tree WHERE id=? AND user_id=?`,
      args: [req.params.id, req.user.id],
    });
    if (!existing.rows[0]) return res.status(404).json({ error: 'Mystic Tree not found' });

    await db.execute({
      sql: `UPDATE user_mystic_tree SET shape_key=?, color_hex=?, glow_hex=?, custom_name=?, updated_at=datetime('now') WHERE id=? AND user_id=?`,
      args: [shape_key, color_hex, glow_hex, custom_name.trim(), req.params.id, req.user.id],
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