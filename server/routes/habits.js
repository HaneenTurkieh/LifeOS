// routes/habits.js — mounted behind `authenticate`. habit_logs doesn't
// carry its own user_id (it's scoped through the parent habit's
// ownership), so every lookup first confirms the habit belongs to req.user.
const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { addXp, getHabitStreak, evaluateAchievements, todayIso } = require('../lib/gamification');

function withMeta(habit) {
  const streak = getHabitStreak(habit.id);
  const last30 = db.prepare(`
    SELECT date FROM habit_logs WHERE habit_id = ? AND date >= date('now', '-29 days')
  `).all(habit.id).map((r) => r.date);
  const completionRate = Math.round((last30.length / 30) * 100);
  const doneToday = db.prepare(`SELECT 1 FROM habit_logs WHERE habit_id = ? AND date = ?`).get(habit.id, todayIso());
  return { ...habit, streak, completionRate, last30, doneToday: !!doneToday };
}

router.get('/', (req, res) => {
  const habits = db.prepare(`SELECT * FROM habits WHERE user_id = ? ORDER BY id ASC`).all(req.user.id);
  res.json(habits.map(withMeta));
});

router.post('/', (req, res) => {
  const { name, icon = 'Sparkles', color = '#6366F1', target_per_week = 7 } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const info = db.prepare(`INSERT INTO habits (user_id, name, icon, color, target_per_week) VALUES (?, ?, ?, ?, ?)`)
    .run(req.user.id, name.trim(), icon, color, target_per_week);
  const habit = db.prepare(`SELECT * FROM habits WHERE id = ? AND user_id = ?`).get(info.lastInsertRowid, req.user.id);
  res.status(201).json(withMeta(habit));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare(`DELETE FROM habits WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Habit not found' });
  res.status(204).end();
});

// Toggle today's completion for a habit.
router.post('/:id/toggle', (req, res) => {
  const habit = db.prepare(`SELECT * FROM habits WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!habit) return res.status(404).json({ error: 'Habit not found' });
  const date = req.body.date || todayIso();
  const existing = db.prepare(`SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?`).get(habit.id, date);

  let xpAwarded = 0;
  if (existing) {
    db.prepare(`DELETE FROM habit_logs WHERE id = ?`).run(existing.id);
  } else {
    db.prepare(`INSERT INTO habit_logs (habit_id, date, completed) VALUES (?, ?, 1)`).run(habit.id, date);
    addXp(req.user.id, 5, `Completed habit: ${habit.name}`);
    xpAwarded = 5;
  }
  const unlocked = evaluateAchievements(req.user.id);
  res.json({ habit: withMeta(habit), xpAwarded, unlocked });
});

module.exports = router;