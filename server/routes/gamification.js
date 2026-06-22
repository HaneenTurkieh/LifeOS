const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');
const { getLevelInfo, getOverallStreak, getTreeStage, evaluateAchievements } = require('../lib/gamification');

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    await evaluateAchievements(userId); // needs gamification.js migrated
    const result = await db.execute({
      sql: `SELECT a.key, a.title, a.description, a.icon, ua.unlocked_at
            FROM achievements a
            LEFT JOIN user_achievements ua ON ua.key = a.key AND ua.user_id = ?
            ORDER BY (ua.unlocked_at IS NULL), ua.unlocked_at DESC`,
      args: [userId],
    });
    res.json({
      ...await getLevelInfo(userId),
      streak:    await getOverallStreak(userId),
      treeStage: await getTreeStage(userId),
      achievements: result.rows,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;