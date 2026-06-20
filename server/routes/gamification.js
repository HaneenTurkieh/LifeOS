// routes/gamification.js — mounted behind `authenticate`.
const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { getLevelInfo, getOverallStreak, getTreeStage, evaluateAchievements } = require('../lib/gamification');

router.get('/', (req, res) => {
  const userId = req.user.id;
  evaluateAchievements(userId);

  // Join the static achievement catalogue against this user's unlocked rows.
  const achievements = db.prepare(`
    SELECT a.key, a.title, a.description, a.icon, ua.unlocked_at
    FROM achievements a
    LEFT JOIN user_achievements ua ON ua.key = a.key AND ua.user_id = ?
    ORDER BY (ua.unlocked_at IS NULL), ua.unlocked_at DESC
  `).all(userId);

  res.json({
    ...getLevelInfo(userId),
    streak: getOverallStreak(userId),
    treeStage: getTreeStage(userId),
    achievements,
  });
});

module.exports = router;