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

// ── GET /api/trees — catalogue + ownership status ─────────────
router.get('/', async (req, res) => {
  try {
    const [xpResult, ownedResult, equippedResult] = await Promise.all([
      db.execute({ sql: `SELECT COALESCE(SUM(amount),0) total FROM xp_log WHERE user_id=?`, args: [req.user.id] }),
      db.execute({ sql: `SELECT tree_key FROM user_trees WHERE user_id=?`, args: [req.user.id] }),
      db.execute({ sql: `SELECT tree_key FROM user_equipped_tree WHERE user_id=?`, args: [req.user.id] }),
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

    res.json({ trees, totalXp, equipped });
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
  const tree = TREES.find(t => t.key === tree_key);
  if (!tree) return res.status(400).json({ error: 'Unknown tree' });

  try {
    // Must own it
    if (tree.cost > 0) {
      const owned = await db.execute({
        sql: `SELECT 1 FROM user_trees WHERE user_id=? AND tree_key=?`,
        args: [req.user.id, tree_key],
      });
      if (!owned.rows[0]) return res.status(403).json({ error: 'Tree not owned' });
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