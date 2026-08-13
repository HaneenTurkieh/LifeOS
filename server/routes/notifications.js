const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const { buildDedupeKey } = require('../lib/notificationDedupe');
const { GRACE_PERIOD_DAYS } = require('../lib/usageLimits');

const MOOD_CHECKPOINTS = [12, 15, 18, 21];

// Nuvora-authored yearly birthday entry — self-seeds onto the Calendar
// the same way the grace-period notices below self-seed, so the person
// never has to remember to add their own birthday. It's a real task
// row (source = 'aurora', category = 'Birthday') but the Tasks page
// filters that combination out client-side, so it only ever shows up
// on the Calendar. Keeps exactly one: if the birthday or name changes,
// or the year rolls over, the stale copy is deleted and a fresh one is
// inserted for the current date — never duplicates on a refresh, never
// lingers after an edit.
async function ensureBirthdayTask(userId) {
  try {
    const userRow = (await db.execute({
      sql: `SELECT birthday, name FROM users WHERE id = ?`, args: [userId],
    })).rows[0];
    if (!userRow?.birthday) {
      // Birthday was cleared — remove any leftover entry rather than
      // leaving it pointing at a birthday that no longer exists.
      await db.execute({
        sql: `DELETE FROM tasks WHERE user_id = ? AND source = 'aurora' AND category = 'Birthday'`,
        args: [userId],
      });
      return;
    }
    const [, m, d] = userRow.birthday.split('-');
    const month = Number(m), day = Number(d);
    if (!month || !day) return;

    const year    = new Date().getFullYear();
    const isLeap  = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    // Feb 29 birthdays on a non-leap year land on the 28th instead —
    // there's no real Feb 29 to put the task on.
    const safeDay = (month === 2 && day === 29 && !isLeap(year)) ? 28 : day;
    const deadline  = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
    const firstName = (userRow.name || '').split(' ')[0] || 'You';
    const title     = `🎂 ${firstName}'s Birthday!`;

    // Clear out any stale copy first — wrong deadline (birthday
    // changed, or it's a new year) or wrong title (display name
    // changed) both mean this isn't the current correct entry anymore.
    await db.execute({
      sql:  `DELETE FROM tasks WHERE user_id = ? AND source = 'aurora' AND category = 'Birthday' AND (deadline != ? OR title != ?)`,
      args: [userId, deadline, title],
    });

    const existing = (await db.execute({
      sql:  `SELECT id FROM tasks WHERE user_id = ? AND source = 'aurora' AND category = 'Birthday' AND deadline = ? AND title = ?`,
      args: [userId, deadline, title],
    })).rows[0];
    if (existing) return;

    await db.execute({
      sql:  `INSERT INTO tasks (user_id, title, description, priority, category, deadline, source)
             VALUES (?, ?, ?, 'low', 'Birthday', ?, 'aurora')`,
      args: [userId, title, 'Added automatically by Nuvora — happy birthday! 💜', deadline],
    });
  } catch (err) { console.error('ensureBirthdayTask failed (non-fatal):', err.message); }
}

async function generateNotifications(userId) {
  const toCreate = [];
  const today    = new Date().toISOString().slice(0, 10);
  const [tasks, habits, goals, streak, mood, dueMilestones] = await Promise.all([
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
    // Milestones the person scheduled (via the goal day-planner) for
    // today, via goals.js's PUT .../milestones/:id/schedule. Joined
    // through goals since milestones don't carry user_id themselves.
    db.execute({
      sql:  `SELECT m.id, m.title, g.id AS goal_id, g.title AS goal_title
             FROM milestones m
             JOIN goals g ON g.id = m.goal_id
             WHERE g.user_id=? AND m.scheduled_date=? AND m.done=0`,
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

  for (const m of dueMilestones.rows) {
    toCreate.push({
      type:  'milestone_due',
      title: '📅 Milestone due today',
      body:  `"${m.title}" (from "${m.goal_title}") is scheduled for today`,
      link:  `/goals?goal=${m.goal_id}&milestone=${m.id}`,
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

  // Grace period — new accounts get GRACE_PERIOD_DAYS with no caps on
  // exam/slide generation, Deep Think, or Deep Search (see lib/usageLimits.js).
  // Two one-time notices, both deduped forever by their static link (so
  // each fires exactly once regardless of how many times this function
  // re-evaluates): a welcome right when it's active, and a heads-up on
  // the last day before real limits start — paired with an actual reason
  // to go Premium instead of just waiting it out.
  const userRow = (await db.execute({ sql: `SELECT created_at FROM users WHERE id=?`, args: [userId] })).rows[0];
  if (userRow?.created_at) {
    const createdAt = new Date(userRow.created_at.replace(' ', 'T') + 'Z');
    if (!Number.isNaN(createdAt.getTime())) {
      const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays < GRACE_PERIOD_DAYS) {
        toCreate.push({
          type:  'grace_welcome',
          title: '✨ Your first days are unlimited',
          body:  `No daily limits for your first ${GRACE_PERIOD_DAYS} days — explore exam/slide generation, Deep Think, and Deep Search freely. After that, free accounts get a generous daily allowance, and Premium removes limits for good.`,
          link:  null,
        });
      }
      if (ageDays >= GRACE_PERIOD_DAYS - 1 && ageDays < GRACE_PERIOD_DAYS) {
        toCreate.push({
          type:  'grace_ending',
          title: '⏳ Your unlimited period ends soon',
          body:  'Daily limits on exam generation, Deep Think, and Deep Search start tomorrow. Loved having no limits? Go Premium and keep it that way — for good.',
          link:  null,
        });
      }
    }
  }

  // One-time announcement for the new grace-passes perk (added right
  // after it shipped) — deduped forever by its static link, same trick
  // as grace_welcome/grace_ending above, so it fires exactly once per
  // account regardless of premium status. Sent to everyone (not just
  // current Premium users) since it's also a reason for free users to
  // consider upgrading.
  toCreate.push({
    type:  'grace_passes_announcement',
    title: '🌳 New: Grace passes',
    body:  "Premium now gets 3 grace passes a week — miss the 10s pause window and one auto-saves your tree instead of losing it. Check Settings → Premium to see how many you have left.",
    link:  null,
  });

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
    await ensureBirthdayTask(req.user.id);
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