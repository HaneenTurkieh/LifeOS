const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');

// ── Generate notifications based on user data ─────────────────
async function generateNotifications(userId) {
  const toCreate = [];
  const today    = new Date().toISOString().slice(0, 10);

  const [tasks, habits, goals, streak, mood] = await Promise.all([
    // Overdue tasks
    db.execute({
      sql:  `SELECT id, title, deadline FROM tasks
             WHERE user_id=? AND status!='done' AND deadline < ? AND deadline IS NOT NULL
             ORDER BY deadline ASC LIMIT 5`,
      args: [userId, today],
    }),
    // Habits not done today
    db.execute({
      sql:  `SELECT h.id, h.name FROM habits h
             WHERE h.user_id=?
             AND NOT EXISTS (
               SELECT 1 FROM habit_logs hl WHERE hl.habit_id=h.id AND hl.date=?
             )`,
      args: [userId, today],
    }),
    // Goals with target date in next 3 days
    db.execute({
      sql:  `SELECT id, title, target_date FROM goals
             WHERE user_id=? AND status='active'
             AND target_date BETWEEN ? AND date(?, '+3 days')`,
      args: [userId, today, today],
    }),
    // Streak at risk — last habit log was yesterday, nothing today
    db.execute({
      sql:  `SELECT COUNT(*) c FROM habit_logs hl
             JOIN habits h ON h.id=hl.habit_id
             WHERE h.user_id=? AND hl.date=date('now','-1 day')`,
      args: [userId],
    }),
    // No mood logged today
    db.execute({
      sql:  `SELECT 1 FROM moods WHERE user_id=? AND date=?`,
      args: [userId, today],
    }),
  ]);

  // Overdue tasks
  for (const task of tasks.rows) {
    toCreate.push({
      type:  'overdue',
      title: '⚠️ Task overdue',
      body:  `"${task.title}" was due on ${task.deadline}`,
      link:  '/tasks',
    });
  }

  // Streak at risk
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

  // Goal deadlines approaching
  for (const goal of goals.rows) {
    const daysLeft = Math.ceil((new Date(goal.target_date) - new Date(today)) / (1000*60*60*24));
    toCreate.push({
      type:  'deadline',
      title: '🎯 Goal deadline approaching',
      body:  `"${goal.title}" is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
      link:  '/goals',
    });
  }

  // No mood today (only after 12pm)
  const hour = new Date().getHours();
  if (!mood.rows[0] && hour >= 12) {
    toCreate.push({
      type:  'mood',
      title: '😊 How are you feeling?',
      body:  'You haven\'t logged your mood today. It only takes a second.',
      link:  '/',
    });
  }

  // Avoid duplicate notifications — check what already exists today
  const existing = await db.execute({
    sql:  `SELECT type, title FROM notifications WHERE user_id=? AND date(created_at)=?`,
    args: [userId, today],
  });
  const existingKeys = new Set(existing.rows.map(r => `${r.type}:${r.title}`));

  for (const n of toCreate) {
    const key = `${n.type}:${n.title}`;
    if (!existingKeys.has(key)) {
      await db.execute({
        sql:  `INSERT INTO notifications (user_id, type, title, body, link) VALUES (?,?,?,?,?)`,
        args: [userId, n.type, n.title, n.body, n.link],
      });
    }
  }
}

// ── GET /api/notifications ─────────────────────────────────────
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

// ── PATCH /api/notifications/:id/read ─────────────────────────
router.patch('/:id/read', async (req, res) => {
  try {
    await db.execute({
      sql:  `UPDATE notifications SET read=1 WHERE id=? AND user_id=?`,
      args: [req.params.id, req.user.id],
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// ── PATCH /api/notifications/read-all ─────────────────────────
router.patch('/read-all', async (req, res) => {
  try {
    await db.execute({
      sql:  `UPDATE notifications SET read=1 WHERE user_id=?`,
      args: [req.user.id],
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// ── DELETE /api/notifications/:id ─────────────────────────────
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