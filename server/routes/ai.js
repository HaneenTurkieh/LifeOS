const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');
const ai = require('../lib/ai');

router.get('/quote', (req, res) => res.json(ai.quoteOfTheDay()));

router.post('/daily-plan', async (req, res) => {
  try {
    const { availableHours = 4, energy = 'medium' } = req.body;
    const result = await db.execute({
      sql: `SELECT * FROM tasks WHERE user_id = ? AND status != 'done' ORDER BY deadline ASC`,
      args: [req.user.id],
    });
    res.json(ai.buildDailyPlan({ availableHours: Number(availableHours), energy, tasks: result.rows }));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/goal-breakdown', (req, res) => {
  const { title, weeks = 4 } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'A goal title is required' });
  res.json({ title, plan: ai.breakdownGoal({ title, weeks: Number(weeks) }) });
});

router.get('/prioritize', async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT * FROM tasks WHERE user_id = ? AND status != 'done'`,
      args: [req.user.id],
    });
    res.json(ai.prioritizeTasks(result.rows));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.get('/coach', async (req, res) => {
  try {
    const userId = req.user.id;
    const sow = `date('now', 'weekday 0', '-6 days')`;
    const [r1, r2, r3, r4, r5] = await Promise.all([
      db.execute({ sql: `SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND status='done' AND completed_at >= ${sow}`, args: [userId] }),
      db.execute({ sql: `SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND (created_at >= ${sow} OR status='done')`, args: [userId] }),
      db.execute({ sql: `SELECT COUNT(*) c FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id WHERE h.user_id = ? AND hl.date >= ${sow}`, args: [userId] }),
      db.execute({ sql: `SELECT COUNT(*) c FROM habits WHERE user_id = ?`, args: [userId] }),
      db.execute({ sql: `SELECT mood FROM moods WHERE user_id = ? ORDER BY date DESC LIMIT 1`, args: [userId] }),
    ]);
    const tasksDoneThisWeek = Number(r1.rows[0].c);
    const tasksTotalThisWeek = Number(r2.rows[0].c);
    const habitLogsThisWeek = Number(r3.rows[0].c);
    const habitCount = Number(r4.rows[0].c);
    const habitCompletionRate = habitCount > 0 ? Math.round((habitLogsThisWeek / (habitCount * 7)) * 100) : 0;
    const latestMood = r5.rows[0];
    const { getOverallStreak } = require('../lib/gamification');
    const streak = await getOverallStreak(userId); // needs gamification.js migrated
    const insights = ai.productivityInsights({ tasksDoneThisWeek, tasksTotalThisWeek, habitCompletionRate, streak, mood: latestMood?.mood });
    res.json({ insights, stats: { tasksDoneThisWeek, tasksTotalThisWeek, habitCompletionRate, streak } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/anti-procrastination', (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'A task title is required' });
  res.json(ai.antiProcrastinationVersions(title));
});

module.exports = router;