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

// ── Mystic Tree — a one-off, user-designed tree ────────────────
// Not part of the fixed catalogue: instead of unlocking a preset, 1000
// XP buys the *option* to design one — a shape, a fill colour and a
// glow colour, plus a name. Kept visually separate (its own section,
// its own "Mystic" badge) so it doesn't just read as another slot in
// the same row as Bamboo etc.
const MYSTIC_COST = 1000;
const MYSTIC_SHAPES = ['spiral', 'crystal', 'orbs', 'bloom', 'bough'];
const MYSTIC_COLORS = ['#8B5CF6', '#F472B6', '#F59E0B', '#10B981', '#38BDF8', '#6366F1', '#FB7185', '#EAB308'];
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// ── GET /api/trees — catalogue + ownership status ─────────────
router.get('/', async (req, res) => {
  try {
    const [xpResult, ownedResult, equippedResult, mysticResult] = await Promise.all([
      db.execute({ sql: `SELECT COALESCE(SUM(amount),0) total FROM xp_log WHERE user_id=?`, args: [req.user.id] }),
      db.execute({ sql: `SELECT tree_key FROM user_trees WHERE user_id=?`, args: [req.user.id] }),
      db.execute({ sql: `SELECT tree_key FROM user_equipped_tree WHERE user_id=?`, args: [req.user.id] }),
      db.execute({ sql: `SELECT shape_key, color_hex, glow_hex, custom_name FROM user_mystic_tree WHERE user_id=?`, args: [req.user.id] }),
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

    const mysticRow = mysticResult.rows[0] || null;
    const mystic = {
      cost:      MYSTIC_COST,
      shapes:    MYSTIC_SHAPES,
      colors:    MYSTIC_COLORS,
      unlocked:  !!mysticRow,
      equipped:  equipped === 'mystic',
      canAfford: totalXp >= MYSTIC_COST,
      config: mysticRow ? {
        shape_key:   mysticRow.shape_key,
        color_hex:   mysticRow.color_hex,
        glow_hex:    mysticRow.glow_hex,
        custom_name: mysticRow.custom_name,
      } : null,
    };

    res.json({ trees, totalXp, equipped, mystic });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

function validateMysticInput({ shape_key, color_hex, glow_hex, custom_name }) {
  if (!MYSTIC_SHAPES.includes(shape_key)) return 'Unknown shape';
  if (!HEX_RE.test(color_hex)) return 'Invalid colour';
  if (!HEX_RE.test(glow_hex)) return 'Invalid glow colour';
  if (!custom_name || !custom_name.trim() || custom_name.trim().length > 24) return 'Name must be 1-24 characters';
  return null;
}

// ── POST /api/trees/mystic/create — first-time unlock ──────────
router.post('/mystic/create', async (req, res) => {
  const error = validateMysticInput(req.body);
  if (error) return res.status(400).json({ error });
  const { shape_key, color_hex, glow_hex, custom_name } = req.body;

  try {
    const existing = await db.execute({ sql: `SELECT 1 FROM user_mystic_tree WHERE user_id=?`, args: [req.user.id] });
    if (existing.rows[0]) return res.status(400).json({ error: 'Already unlocked — use edit instead' });

    const xpResult = await db.execute({ sql: `SELECT COALESCE(SUM(amount),0) total FROM xp_log WHERE user_id=?`, args: [req.user.id] });
    const totalXp = Number(xpResult.rows[0].total);
    if (totalXp < MYSTIC_COST) return res.status(400).json({ error: 'Not enough XP' });

    await db.batch([
      { sql: `INSERT INTO xp_log (user_id, amount, reason) VALUES (?, ?, ?)`,
        args: [req.user.id, -MYSTIC_COST, `Created a Mystic Tree: ${custom_name.trim()}`] },
      { sql: `INSERT INTO user_mystic_tree (user_id, shape_key, color_hex, glow_hex, custom_name) VALUES (?, ?, ?, ?, ?)`,
        args: [req.user.id, shape_key, color_hex, glow_hex, custom_name.trim()] },
    ], 'write');

    res.json({ success: true, remainingXp: totalXp - MYSTIC_COST });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── PUT /api/trees/mystic — free re-customization once unlocked ─
router.put('/mystic', async (req, res) => {
  const error = validateMysticInput(req.body);
  if (error) return res.status(400).json({ error });
  const { shape_key, color_hex, glow_hex, custom_name } = req.body;

  try {
    const existing = await db.execute({ sql: `SELECT 1 FROM user_mystic_tree WHERE user_id=?`, args: [req.user.id] });
    if (!existing.rows[0]) return res.status(403).json({ error: 'Not unlocked yet' });

    await db.execute({
      sql: `UPDATE user_mystic_tree SET shape_key=?, color_hex=?, glow_hex=?, custom_name=?, updated_at=datetime('now') WHERE user_id=?`,
      args: [shape_key, color_hex, glow_hex, custom_name.trim(), req.user.id],
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
    if (tree_key === 'mystic') {
      const owned = await db.execute({ sql: `SELECT 1 FROM user_mystic_tree WHERE user_id=?`, args: [req.user.id] });
      if (!owned.rows[0]) return res.status(403).json({ error: 'Mystic Tree not created yet' });
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