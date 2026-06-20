// routes/dashboard.js — mounted behind `authenticate`.
const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { getLevelInfo, getOverallStreak, getTreeStage, todayIso } = require('../lib/gamification');
const { quoteOfTheDay } = require('../lib/ai');

router.get('/', (req, res) => {
  const userId = req.user.id;
  const today = todayIso();

  const todaysTasks = db.prepare(`
    SELECT * FROM tasks WHERE user_id = ? AND status != 'done' AND (deadline = ? OR deadline IS NULL) ORDER BY priority DESC LIMIT 6
  `).all(userId, today);

  const habits = db.prepare(`SELECT * FROM habits WHERE user_id = ?`).all(userId);
  const todaysHabits = habits.map((h) => {
    const doneToday = db.prepare(`SELECT 1 FROM habit_logs WHERE habit_id = ? AND date = ?`).get(h.id, today);
    return { ...h, doneToday: !!doneToday };
  });

  const upcomingDeadlines = db.prepare(`
    SELECT * FROM tasks WHERE user_id = ? AND status != 'done' AND deadline IS NOT NULL AND deadline >= ? ORDER BY deadline ASC LIMIT 5
  `).all(userId, today);

  const mood = db.prepare(`SELECT * FROM moods WHERE user_id = ? AND date = ?`).get(userId, today) || null;

  const tasksDoneToday = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND status='done' AND date(completed_at) = ?`).get(userId, today).c;
  const totalTasksToday = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND deadline = ?`).get(userId, today).c;
  const habitsDoneToday = todaysHabits.filter((h) => h.doneToday).length;
  const totalHabitsToday = habits.length;

  // --- FIX (was: 0 tasks + 0 habits silently defaulted to a 0.3 "placeholder"
  // task score, producing a fake 18% score). Now: no tasks due AND no habits
  // tracked at all => strictly 0, no fallback.
  let productivityScore;
  if (totalTasksToday === 0 && totalHabitsToday === 0) {
    productivityScore = 0;
  } else {
    const taskScore = totalTasksToday > 0 ? (tasksDoneToday / totalTasksToday) : 0;
    const habitScore = totalHabitsToday > 0 ? (habitsDoneToday / totalHabitsToday) : 0;
    productivityScore = Math.round((taskScore * 0.6 + habitScore * 0.4) * 100);
  }

  res.json({
    todaysTasks,
    todaysHabits,
    upcomingDeadlines,
    mood,
    quote: quoteOfTheDay(),
    productivityScore,
    streak: getOverallStreak(userId),
    treeStage: getTreeStage(userId),
    level: getLevelInfo(userId),
    counts: { tasksDoneToday, totalTasksToday, habitsDoneToday, totalHabits: habits.length },
  });
});

module.exports = router;