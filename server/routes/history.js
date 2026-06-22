const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');

function isoDate(d) { return d.toISOString().slice(0, 10); }

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const pastDays   = Math.min(Number(req.query.pastDays)   || 14, 60);
    const futureDays = Math.min(Number(req.query.futureDays) || 7,  30);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(start.getDate() - pastDays);
    const end   = new Date(today); end.setDate(end.getDate() + futureDays);
    const startStr = isoDate(start), endStr = isoDate(end), todayStr = isoDate(today);

    const [completedTasksResult, completedHabitsResult, upcomingTasksResult] = await Promise.all([
      db.execute({ sql: `SELECT id, title, category, priority, date(completed_at) AS day FROM tasks WHERE user_id = ? AND status = 'done' AND date(completed_at) BETWEEN ? AND ?`, args: [userId, startStr, endStr] }),
      db.execute({ sql: `SELECT hl.date AS day, h.id, h.name, h.color, h.icon FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id WHERE h.user_id = ? AND hl.date BETWEEN ? AND ?`, args: [userId, startStr, endStr] }),
      db.execute({ sql: `SELECT id, title, category, priority, deadline AS day FROM tasks WHERE user_id = ? AND status != 'done' AND deadline BETWEEN ? AND ?`, args: [userId, startStr, endStr] }),
    ]);

    const dayMap = {};
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = isoDate(d);
      dayMap[key] = { date: key, isToday: key === todayStr, isPast: key < todayStr, isFuture: key > todayStr, tasksCompleted: [], habitsCompleted: [], tasksDue: [] };
    }
    completedTasksResult.rows.forEach((t) => { if (dayMap[t.day]) dayMap[t.day].tasksCompleted.push(t); });
    completedHabitsResult.rows.forEach((h) => { if (dayMap[h.day]) dayMap[h.day].habitsCompleted.push(h); });
    upcomingTasksResult.rows.forEach((t) => { if (dayMap[t.day] && t.day >= todayStr) dayMap[t.day].tasksDue.push(t); });

    res.json({ days: Object.values(dayMap).sort((a, b) => a.date < b.date ? -1 : 1), todayStr });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;