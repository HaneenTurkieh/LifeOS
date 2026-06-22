const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');
const { addXp, getHabitStreak, evaluateAchievements, todayIso } = require('../lib/gamification');

async function withMeta(habit) {
  const [logsResult, doneTodayResult] = await Promise.all([
    db.execute({ sql: `SELECT date FROM habit_logs WHERE habit_id = ? AND date >= date('now', '-29 days')`, args: [habit.id] }),
    db.execute({ sql: `SELECT 1 FROM habit_logs WHERE habit_id = ? AND date = ?`, args: [habit.id, todayIso()] }),
  ]);
  const last30 = logsResult.rows.map((r) => r.date);
  return {
    ...habit,
    streak:         await getHabitStreak(habit.id), // needs gamification.js migrated
    completionRate: Math.round((last30.length / 30) * 100),
    last30,
    doneToday: !!doneTodayResult.rows[0],
  };
}

router.get('/', async (req, res) => {
  try {
    const result = await db.execute({ sql: `SELECT * FROM habits WHERE user_id = ? ORDER BY id ASC`, args: [req.user.id] });
    res.json(await Promise.all(result.rows.map(withMeta)));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, icon = 'Sparkles', color = '#6366F1', target_per_week = 7 } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const insertResult = await db.execute({ sql: `INSERT INTO habits (user_id, name, icon, color, target_per_week) VALUES (?, ?, ?, ?, ?)`, args: [req.user.id, name.trim(), icon, color, target_per_week] });
    const habitResult = await db.execute({ sql: `SELECT * FROM habits WHERE id = ? AND user_id = ?`, args: [Number(insertResult.lastInsertRowid), req.user.id] });
    res.status(201).json(await withMeta(habitResult.rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await db.execute({ sql: `DELETE FROM habits WHERE id = ? AND user_id = ?`, args: [req.params.id, req.user.id] });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Habit not found' });
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/:id/toggle', async (req, res) => {
  try {
    const habitResult = await db.execute({ sql: `SELECT * FROM habits WHERE id = ? AND user_id = ?`, args: [req.params.id, req.user.id] });
    const habit = habitResult.rows[0];
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    const date = req.body.date || todayIso();
    const existingResult = await db.execute({ sql: `SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?`, args: [habit.id, date] });
    const existing = existingResult.rows[0];
    let xpAwarded = 0;
    if (existing) {
      await db.execute({ sql: `DELETE FROM habit_logs WHERE id = ?`, args: [existing.id] });
    } else {
      await db.execute({ sql: `INSERT INTO habit_logs (habit_id, date, completed) VALUES (?, ?, 1)`, args: [habit.id, date] });
      await addXp(req.user.id, 5, `Completed habit: ${habit.name}`); // needs gamification.js migrated
      xpAwarded = 5;
    }
    const unlocked = await evaluateAchievements(req.user.id);
    res.json({ habit: await withMeta(habit), xpAwarded, unlocked });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;