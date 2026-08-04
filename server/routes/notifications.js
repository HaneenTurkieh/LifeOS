const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const { buildDedupeKey } = require('../lib/notificationDedupe');

const MOOD_CHECKPOINTS = [12, 15, 18, 21];

async function generateNotifications(userId) {
  const toCreate = [];
  const today    = new Date().toISOString().slice(0, 10);
  const [tasks, habits, goals, streak, mood] = await Promise.all([
    db.execute({
      sql:  `SELECT id, title, deadline FROM tasks
             WHERE user_id=? AND status!='done' AND deadline < ? AND deadline IS NOT NULL
             ORDER BY deadline ASC LIMIT 5`,
      args: [userId, today],
    }),
    db.execute({
      sql:  `SELECT h.id, h.name FROM habits h
             WHERE h.user_id=?
             AND NOT EXISTS (
               SELECT 1 FROM habit_logs hl WHERE hl.habit_id=h.id AND hl.date=?
             )`,
      args: [userId, today],
    }),
    db.execute({
      sql:  `SELECT id, title, target_date FROM goals
             WHERE user_id=? AND status='active'
             AND target_date BETWEEN ? AND date(?, '+3 days')`,
      args: [userId, today, today],
    }),
    db.execute({
      sql:  `SELECT COUNT(*) c FROM habit_logs hl
             JOIN habits h ON h.id=hl.habit_id
             WHERE h.user_id=? AND hl.date=date('now','-1 day')`,
      args: [userId],
    }),
    db.execute({
      sql:  `SELECT 1 FROM moods WHERE user_id=? AND date=?`,
      args: [userId, today],
    }),
  ]);

  for (const task of tasks.rows) {
    toCreate.push({
      type:  'overdue',
      title: '⚠️ Task overdue',
      body:  `"${task.title}" was due on ${task.deadline}`,
      link:  `/tasks?task=${task.id}`,
    });
  }

  const streakCount = Number(streak.rows[0]?.c || 0);
  const habitsDoneToday = await db.execute({
    sql:  `SELECT COUNT(*) c FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id WHERE h.user_id=? AND hl.date=?`,
    args: [userId, today],
  });
  if (streakCount > 0 && Number(habitsDoneToday.rows[0]?.c || 0) === 0) {
    toCreate.push({
      type:  'streak',
      title: '🔥 Streak at risk',
      body:  'You haven\'t logged any habits today. Keep your streak alive!',
      link:  '/goals',
    });
  }

  for (const goal of goals.rows) {
    const daysLeft = Math.ceil((new Date(goal.target_date) - new Date(today)) / (1000*60*60*24));
    toCreate.push({
      type:  'deadline',
      title: '🎯 Goal deadline approaching',
      body:  `"${goal.title}" is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
      link:  `/goals?goal=${goal.id}`,
    });
  }

  const hour = new Date().getHours();
  const currentCheckpoint = [...MOOD_CHECKPOINTS].reverse().find((h) => hour >= h);
  if (!mood.rows[0] && currentCheckpoint) {
    toCreate.push({
      type:  'mood',
      title: '😊 How are you feeling?',
      body:  'You haven\'t logged your mood today. It only takes a second.',
      link:  `/?moodcheck=${currentCheckpoint}`,
    });
  }

  for (const n of toCreate) {
    const dedupeKey = buildDedupeKey(n.type, n.link, today);
    await db.execute({
      sql:  `INSERT INTO notifications (user_id, type, title, body, link, dedupe_key)
             VALUES (?,?,?,?,?,?)
             ON CONFLICT(user_id, dedupe_key) DO NOTHING`,
      args: [userId, n.type, n.title, n.body, n.link, dedupeKey],
    });
  }
}

router.get('/', async (req, res) => {
  try {
    await generateNotifications(req.user.id);
    const result = await db.execute({
      sql:  `SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30`,
      args: [req.user.id],
    });
    const notifications = result.rows.map(n => ({ ...n, read: Boolean(n.read) }));
    const unread        = notifications.filter(n => !n.read).length;
    res.json({ notifications, unread });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.patch('/:id/read', async (req, res) => {
  try {
    await db.execute({
      sql:  `UPDATE notifications SET read=1 WHERE id=? AND user_id=?`,
      args: [req.params.id, req.user.id],
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

router.patch('/read-all', async (req, res) => {
  try {
    await db.execute({
      sql:  `UPDATE notifications SET read=1 WHERE user_id=?`,
      args: [req.user.id],
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.execute({
      sql:  `DELETE FROM notifications WHERE id=? AND user_id=?`,
      args: [req.params.id, req.user.id],
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;