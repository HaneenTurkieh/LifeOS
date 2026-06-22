const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');

function lastNDates(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
function weekLabel(daysAgoStart) {
  const d = new Date(); d.setDate(d.getDate() - daysAgoStart);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const weeks = Array.from({ length: 8 }, (_, i) => 7 - i); // [7..0]

    const [tasksPerWeek, habitsPerWeek, studyHoursPerWeek] = await Promise.all([
      Promise.all(weeks.map(async (w) => {
        const s = w * 7 + 6, e = w * 7;
        const r = await db.execute({ sql: `SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND status='done' AND date(completed_at) BETWEEN date('now', '-${s} days') AND date('now', '-${e} days')`, args: [userId] });
        return { week: weekLabel(e), tasks: Number(r.rows[0].c) };
      })),
      Promise.all(weeks.map(async (w) => {
        const s = w * 7 + 6, e = w * 7;
        const r = await db.execute({ sql: `SELECT COUNT(*) c FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id WHERE h.user_id = ? AND hl.date BETWEEN date('now', '-${s} days') AND date('now', '-${e} days')`, args: [userId] });
        return { week: weekLabel(e), habits: Number(r.rows[0].c) };
      })),
      Promise.all(weeks.map(async (w) => {
        const s = w * 7 + 6, e = w * 7;
        const [rL, rS] = await Promise.all([
          db.execute({ sql: `SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND status='done' AND category='Learning' AND date(completed_at) BETWEEN date('now', '-${s} days') AND date('now', '-${e} days')`, args: [userId] }),
          db.execute({ sql: `SELECT COUNT(*) c FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id WHERE h.user_id = ? AND h.name IN ('Reading', 'Coding Practice') AND hl.date BETWEEN date('now', '-${s} days') AND date('now', '-${e} days')`, args: [userId] }),
        ]);
        return { week: weekLabel(e), hours: Math.round((Number(rL.rows[0].c) * 1.5 + Number(rS.rows[0].c) * 0.5) * 10) / 10 };
      })),
    ]);

    const dates = lastNDates(14);
    const totalHabitsResult = await db.execute({ sql: `SELECT COUNT(*) c FROM habits WHERE user_id = ?`, args: [userId] });
    const totalHabits = Number(totalHabitsResult.rows[0].c) || 1;

    const [moodTrend, productivityTrend, tasksByCategory, tasksByPriority] = await Promise.all([
      Promise.all(dates.map(async (date) => {
        const r = await db.execute({ sql: `SELECT mood FROM moods WHERE user_id = ? AND date = ?`, args: [userId, date] });
        return { date: date.slice(5), mood: r.rows[0]?.mood ?? null };
      })),
      Promise.all(dates.map(async (date) => {
        const [rT, rH] = await Promise.all([
          db.execute({ sql: `SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND status='done' AND date(completed_at) = ?`, args: [userId, date] }),
          db.execute({ sql: `SELECT COUNT(*) c FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id WHERE h.user_id = ? AND hl.date = ?`, args: [userId, date] }),
        ]);
        const score = Math.round(Math.min(100, Number(rT.rows[0].c) * 15 + (Number(rH.rows[0].c) / totalHabits) * 50));
        return { date: date.slice(5), score };
      })),
      db.execute({ sql: `SELECT category, COUNT(*) c FROM tasks WHERE user_id = ? AND status='done' GROUP BY category`, args: [userId] }),
      db.execute({ sql: `SELECT priority, COUNT(*) c FROM tasks WHERE user_id = ? GROUP BY priority`, args: [userId] }),
    ]);

    res.json({ tasksPerWeek, habitsPerWeek, studyHoursPerWeek, moodTrend, productivityTrend, tasksByCategory: tasksByCategory.rows, tasksByPriority: tasksByPriority.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;