// routes/history.js — mounted behind `authenticate`.
// Returns a day-by-day timeline: past days show completed tasks/habits,
// future days show what's due. One pass per query (not per day) for speed.
const express = require('express');
const router = express.Router();
const db = require('../db/connection');

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

router.get('/', (req, res) => {
  const userId = req.user.id;
  const pastDays = Math.min(Number(req.query.pastDays) || 14, 60);
  const futureDays = Math.min(Number(req.query.futureDays) || 7, 30);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(start.getDate() - pastDays);
  const end = new Date(today);
  end.setDate(end.getDate() + futureDays);

  const startStr = isoDate(start);
  const endStr = isoDate(end);
  const todayStr = isoDate(today);

  const completedTasks = db.prepare(`
    SELECT id, title, category, priority, date(completed_at) AS day
    FROM tasks
    WHERE user_id = ? AND status = 'done' AND date(completed_at) BETWEEN ? AND ?
  `).all(userId, startStr, endStr);

  const completedHabits = db.prepare(`
    SELECT hl.date AS day, h.id, h.name, h.color, h.icon
    FROM habit_logs hl
    JOIN habits h ON h.id = hl.habit_id
    WHERE h.user_id = ? AND hl.date BETWEEN ? AND ?
  `).all(userId, startStr, endStr);

  const upcomingTasks = db.prepare(`
    SELECT id, title, category, priority, deadline AS day
    FROM tasks
    WHERE user_id = ? AND status != 'done' AND deadline BETWEEN ? AND ?
  `).all(userId, startStr, endStr);

  // Build the full day list, even days with nothing on them, so the
  // frontend can render a continuous, gap-free timeline.
  const dayMap = {};
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = isoDate(d);
    dayMap[key] = {
      date: key,
      isToday: key === todayStr,
      isPast: key < todayStr,
      isFuture: key > todayStr,
      tasksCompleted: [],
      habitsCompleted: [],
      tasksDue: [],
    };
  }

  completedTasks.forEach((t) => { if (dayMap[t.day]) dayMap[t.day].tasksCompleted.push(t); });
  completedHabits.forEach((h) => { if (dayMap[h.day]) dayMap[h.day].habitsCompleted.push(h); });
  upcomingTasks.forEach((t) => { if (dayMap[t.day] && t.day >= todayStr) dayMap[t.day].tasksDue.push(t); });

  const days = Object.values(dayMap).sort((a, b) => (a.date < b.date ? -1 : 1));

  res.json({ days, todayStr });
});

module.exports = router;
