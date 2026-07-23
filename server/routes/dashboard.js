const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');
const { getLevelInfo, getOverallStreak, getTreeStage, todayIso } = require('../lib/gamification');
const { quoteOfTheDay } = require('../lib/ai');

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
// In the dashboard route, accept date from query
const today = req.query.date || new Date().toISOString().slice(0, 10);
    const [todaysTasksResult, habitsResult, upcomingResult, moodResult, tasksDoneResult, totalTasksResult] = await Promise.all([
      db.execute({ sql: `SELECT * FROM tasks WHERE user_id = ? AND status != 'done' AND (deadline = ? OR deadline IS NULL) ORDER BY priority DESC LIMIT 6`, args: [userId, today] }),
      db.execute({ sql: `SELECT * FROM habits WHERE user_id = ?`, args: [userId] }),
      db.execute({ sql: `SELECT * FROM tasks WHERE user_id = ? AND status != 'done' AND deadline IS NOT NULL AND deadline >= ? ORDER BY deadline ASC LIMIT 5`, args: [userId, today] }),
      db.execute({ sql: `SELECT * FROM moods WHERE user_id = ? AND date = ?`, args: [userId, today] }),
      db.execute({ sql: `SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND status='done' AND date(completed_at) = ?`, args: [userId, today] }),
      db.execute({ sql: `SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND deadline = ?`, args: [userId, today] }),
    ]);

    const habits = habitsResult.rows;
    const todaysHabits = await Promise.all(habits.map(async (h) => {
      const r = await db.execute({ sql: `SELECT 1 FROM habit_logs WHERE habit_id = ? AND date = ?`, args: [h.id, today] });
      return { ...h, doneToday: !!r.rows[0] };
    }));

    const tasksDoneToday = Number(tasksDoneResult.rows[0].c);
    const totalTasksToday = Number(totalTasksResult.rows[0].c);
    const habitsDoneToday = todaysHabits.filter((h) => h.doneToday).length;
    const totalHabitsToday = habits.length;

    let productivityScore;
    if (totalTasksToday === 0 && totalHabitsToday === 0) {
      productivityScore = 0;
    } else {
      const taskScore  = totalTasksToday  > 0 ? tasksDoneToday  / totalTasksToday  : 0;
      const habitScore = totalHabitsToday > 0 ? habitsDoneToday / totalHabitsToday : 0;
      productivityScore = Math.round((taskScore * 0.6 + habitScore * 0.4) * 100);
    }

    res.json({
      todaysTasks:       todaysTasksResult.rows,
      todaysHabits,
      upcomingDeadlines: upcomingResult.rows,
      mood:              moodResult.rows[0] || null,
      quote:             quoteOfTheDay(),
      productivityScore,
      streak:    await getOverallStreak(userId),  // needs gamification.js migrated
      treeStage: await getTreeStage(userId),
      level:     await getLevelInfo(userId),
      counts: { tasksDoneToday, totalTasksToday, habitsDoneToday, totalHabits: habits.length },
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;