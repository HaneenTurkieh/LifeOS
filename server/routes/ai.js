// routes/ai.js — mounted behind `authenticate`.
const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const ai = require('../lib/ai');

router.get('/quote', (req, res) => res.json(ai.quoteOfTheDay()));

router.post('/daily-plan', (req, res) => {
  const { availableHours = 4, energy = 'medium' } = req.body;
  const tasks = db.prepare(`SELECT * FROM tasks WHERE user_id = ? AND status != 'done' ORDER BY deadline ASC`).all(req.user.id);
  const plan = ai.buildDailyPlan({ availableHours: Number(availableHours), energy, tasks });
  res.json(plan);
});

router.post('/goal-breakdown', (req, res) => {
  const { title, weeks = 4 } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'A goal title is required' });
  res.json({ title, plan: ai.breakdownGoal({ title, weeks: Number(weeks) }) });
});

router.get('/prioritize', (req, res) => {
  const tasks = db.prepare(`SELECT * FROM tasks WHERE user_id = ? AND status != 'done'`).all(req.user.id);
  res.json(ai.prioritizeTasks(tasks));
});

router.get('/coach', (req, res) => {
  const userId = req.user.id;
  const startOfWeek = `date('now', 'weekday 0', '-6 days')`;
  const tasksDoneThisWeek = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND status='done' AND completed_at >= ${startOfWeek}`).get(userId).c;
  const tasksTotalThisWeek = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND (created_at >= ${startOfWeek} OR status='done')`).get(userId).c;
  const habitLogsThisWeek = db.prepare(`
    SELECT COUNT(*) c FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id WHERE h.user_id = ? AND hl.date >= ${startOfWeek}
  `).get(userId).c;
  const habitCount = db.prepare(`SELECT COUNT(*) c FROM habits WHERE user_id = ?`).get(userId).c;
  const habitCompletionRate = habitCount > 0 ? Math.round((habitLogsThisWeek / (habitCount * 7)) * 100) : 0;
  const { getOverallStreak } = require('../lib/gamification');
  const streak = getOverallStreak(userId);
  const latestMood = db.prepare(`SELECT mood FROM moods WHERE user_id = ? ORDER BY date DESC LIMIT 1`).get(userId);

  const insights = ai.productivityInsights({
    tasksDoneThisWeek, tasksTotalThisWeek, habitCompletionRate, streak,
    mood: latestMood ? latestMood.mood : undefined,
  });
  res.json({ insights, stats: { tasksDoneThisWeek, tasksTotalThisWeek, habitCompletionRate, streak } });
});

router.post('/anti-procrastination', (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'A task title is required' });
  res.json(ai.antiProcrastinationVersions(title));
});

module.exports = router;