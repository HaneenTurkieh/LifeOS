// routes/analytics.js — mounted behind `authenticate`.
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

function lastNDates(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function weekLabel(daysAgoStart) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgoStart);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

router.get('/', (req, res) => {
  const userId = req.user.id;

  // Tasks completed per week (last 8 weeks)
  const tasksPerWeek = [];
  for (let w = 7; w >= 0; w--) {
    const start = w * 7 + 6;
    const end = w * 7;
    const count = db.prepare(`
      SELECT COUNT(*) c FROM tasks
      WHERE user_id = ? AND status='done' AND date(completed_at) BETWEEN date('now', '-${start} days') AND date('now', '-${end} days')
    `).get(userId).c;
    tasksPerWeek.push({ week: weekLabel(end), tasks: count });
  }

  // Habits completed per week (last 8 weeks)
  const habitsPerWeek = [];
  for (let w = 7; w >= 0; w--) {
    const start = w * 7 + 6;
    const end = w * 7;
    const count = db.prepare(`
      SELECT COUNT(*) c FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id
      WHERE h.user_id = ? AND hl.date BETWEEN date('now', '-${start} days') AND date('now', '-${end} days')
    `).get(userId).c;
    habitsPerWeek.push({ week: weekLabel(end), habits: count });
  }

  // Study hours proxy: 1.5h per completed "Learning" task + 0.5h per habit log on Reading/Coding habits
  const studyHoursPerWeek = [];
  for (let w = 7; w >= 0; w--) {
    const start = w * 7 + 6;
    const end = w * 7;
    const learningTasks = db.prepare(`
      SELECT COUNT(*) c FROM tasks
      WHERE user_id = ? AND status='done' AND category='Learning' AND date(completed_at) BETWEEN date('now', '-${start} days') AND date('now', '-${end} days')
    `).get(userId).c;
    const studyHabitLogs = db.prepare(`
      SELECT COUNT(*) c FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id
      WHERE h.user_id = ? AND h.name IN ('Reading', 'Coding Practice') AND hl.date BETWEEN date('now', '-${start} days') AND date('now', '-${end} days')
    `).get(userId).c;
    studyHoursPerWeek.push({ week: weekLabel(end), hours: Math.round((learningTasks * 1.5 + studyHabitLogs * 0.5) * 10) / 10 });
  }

  // Mood trend, last 14 days
  const dates = lastNDates(14);
  const moodTrend = dates.map((date) => {
    const row = db.prepare(`SELECT mood FROM moods WHERE user_id = ? AND date = ?`).get(userId, date);
    return { date: date.slice(5), mood: row ? row.mood : null };
  });

  // Productivity trend (composite), last 14 days
  const totalHabits = db.prepare(`SELECT COUNT(*) c FROM habits WHERE user_id = ?`).get(userId).c || 1;
  const productivityTrend = dates.map((date) => {
    const tasksDone = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND status='done' AND date(completed_at) = ?`).get(userId, date).c;
    const habitsDone = db.prepare(`
      SELECT COUNT(*) c FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id WHERE h.user_id = ? AND hl.date = ?
    `).get(userId, date).c;
    const score = Math.round(Math.min(100, (tasksDone * 15) + (habitsDone / totalHabits) * 50));
    return { date: date.slice(5), score };
  });

  const tasksByCategory = db.prepare(`
    SELECT category, COUNT(*) c FROM tasks WHERE user_id = ? AND status='done' GROUP BY category
  `).all(userId);

  const tasksByPriority = db.prepare(`
    SELECT priority, COUNT(*) c FROM tasks WHERE user_id = ? GROUP BY priority
  `).all(userId);

  res.json({ tasksPerWeek, habitsPerWeek, studyHoursPerWeek, moodTrend, productivityTrend, tasksByCategory, tasksByPriority });
});

module.exports = router;