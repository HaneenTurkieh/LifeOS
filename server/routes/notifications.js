const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const { buildDedupeKey } = require('../lib/notificationDedupe');
const { GRACE_PERIOD_DAYS } = require('../lib/usageLimits');

const MOOD_CHECKPOINTS = [12, 15, 18, 21];

// See tasks.remind_offsets_min migration in db/connection.js — a task
// with no custom reminder settings just gets this one, automatically.
const DEFAULT_REMIND_OFFSETS  = [60];
// Don't fire a "due soon" ping for an offset window whose moment has
// already passed by more than this — at that point 'overdue' (above)
// already covers it, and a "15 minutes before" notice arriving a day
// late is just noise.
const REMIND_STALE_FLOOR_MIN  = -1440;

function remindLabel(offsetMin) {
  if (offsetMin >= 1440) {
    const days = Math.round(offsetMin / 1440);
    return days <= 1 ? 'in 1 day' : `in ${days} days`;
  }
  if (offsetMin >= 60) {
    const hours = Math.round(offsetMin / 60);
    return hours <= 1 ? 'in 1 hour' : `in ${hours} hours`;
  }
  if (offsetMin <= 0) return 'now';
  return `in ${offsetMin} minutes`;
}

// Nuvora-authored yearly birthday entry — self-seeds onto the Calendar
// the same way the grace-period notices below self-seed, so the person
// never has to remember to add their own birthday. It's a real task
// row (source = 'nuvora', category = 'Birthday') but the Tasks page
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
        sql: `DELETE FROM tasks WHERE user_id = ? AND source = 'nuvora' AND category = 'Birthday'`,
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
      sql:  `DELETE FROM tasks WHERE user_id = ? AND source = 'nuvora' AND category = 'Birthday' AND (deadline != ? OR title != ?)`,
      args: [userId, deadline, title],
    });

    // Real bug that used to live here: a separate SELECT-then-INSERT is
    // the same check-then-insert race already fixed elsewhere for
    // notifications (via UNIQUE(user_id, dedupe_key) + ON CONFLICT DO
    // NOTHING) but never applied here — two concurrent calls (e.g. two
    // open tabs both loading notifications around the same time) could
    // both pass the "does it already exist" check before either INSERT
    // landed, producing two duplicate birthday task rows. Folding the
    // existence check into the INSERT itself (INSERT ... SELECT ... WHERE
    // NOT EXISTS) makes it one atomic statement instead of two separate
    // round-trips, closing the window entirely.
    await db.execute({
      sql:  `INSERT INTO tasks (user_id, title, description, priority, category, deadline, source, is_birthday)
             SELECT ?, ?, ?, 'low', 'Birthday', ?, 'nuvora', 1
             WHERE NOT EXISTS (
               SELECT 1 FROM tasks WHERE user_id = ? AND source = 'nuvora' AND category = 'Birthday' AND deadline = ? AND title = ?
             )`,
      args: [userId, title, 'Added automatically by Nuvora — happy birthday! 💜', deadline, userId, deadline, title],
    });
  } catch (err) { console.error('ensureBirthdayTask failed (non-fatal):', err.message); }
}

// Manually-added birthdays (is_birthday=1, recurrence='yearly' — see the
// "🎂 Someone's birthday" toggle in Calendar's quick-add) don't
// go through the normal done→advance-recurrence path everything else
// uses (see PUT /tasks/:id below): there's deliberately no "mark done"
// control for a birthday on the client, since a birthday isn't a thing
// you complete. So instead of waiting for a done-toggle that will never
// come, once a birthday's date has passed this rolls the SAME row's
// deadline forward to next year in place — one row per person, not a
// new one spawned annually. Runs on every call to generateNotifications
// (both the in-app bell poll AND the cron-triggered email job), so it
// stays current even for someone who never opens the app.
async function rollForwardBirthdays(userId, today) {
  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const rows = (await db.execute({
    sql:  `SELECT id, deadline FROM tasks
           WHERE user_id=? AND is_birthday=1 AND recurrence='yearly' AND deadline < ?`,
    args: [userId, today],
  })).rows;
  for (const row of rows) {
    const [, m, d] = row.deadline.split('-').map(Number);
    if (!m || !d) continue;
    let year = new Date().getFullYear();
    const dayFor = (y) => (m === 2 && d === 29 && !isLeap(y)) ? 28 : d;
    let next = `${year}-${String(m).padStart(2, '0')}-${String(dayFor(year)).padStart(2, '0')}`;
    if (next < today) {
      year += 1;
      next = `${year}-${String(m).padStart(2, '0')}-${String(dayFor(year)).padStart(2, '0')}`;
    }
    await db.execute({ sql: `UPDATE tasks SET deadline=? WHERE id=?`, args: [next, row.id] });
  }
}

async function generateNotifications(userId, tzOffsetMin = 0) {
  const toCreate = [];
  const today    = new Date().toISOString().slice(0, 10);
  await rollForwardBirthdays(userId, today);
  const [tasks, habits, goals, streak, mood, dueMilestones] = await Promise.all([
    db.execute({
      sql:  `SELECT id, title, deadline FROM tasks
             WHERE user_id=? AND status!='done' AND deadline < ? AND deadline IS NOT NULL
               AND is_birthday=0
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
      data:  { title: task.title, deadline: task.deadline },
    });
  }

  // "Remind before" — tasks only ever got a notification once already
  // overdue (right above). Goals already get a heads-up before their
  // deadline; tasks didn't. Every task with a deadline_time gets the
  // standard 1-hour-before ping automatically — that's DEFAULT_REMIND_
  // OFFSETS, used whenever remind_offsets_min is unset — but a task can
  // ask for extra (or different) lead times too, e.g. [1440, 60, 15] for
  // "1 day, 1 hour, AND 15 minutes before". Each offset is its own
  // dedupe key (the link carries it), so a task with 3 offsets can fire
  // 3 separate reminders as each window is reached, not just one.
  const dueSoonResult = await db.execute({
    sql:  `SELECT id, title, deadline, deadline_time, remind_offsets_min FROM tasks
           WHERE user_id=? AND status!='done' AND deadline IS NOT NULL
             AND deadline >= ? AND deadline <= date(?, '+1 day')
             AND is_birthday=0`,
    args: [userId, today, today],
  });
  const nowMs = Date.now();
  for (const task of dueSoonResult.rows) {
    if (!task.deadline_time) {
      // Date-only deadline — no time-of-day to count "N minutes before"
      // from, so custom offsets don't apply here; just the existing
      // "due today" morning-of nudge.
      if (task.deadline !== today) continue;
      toCreate.push({
        type:  'due_soon',
        title: '⏰ Task due soon',
        body:  `"${task.title}" is due today`,
        link:  `/tasks?task=${task.id}`,
        data:  { title: task.title, deadline: task.deadline },
      });
      continue;
    }

    // deadline/deadline_time are the user's own local wall-clock values
    // with nothing marking which timezone that is — tzOffsetMin (the
    // browser's own getTimezoneOffset(), same convention Flow's forest
    // history already uses) converts that reading into the real UTC
    // instant it represents, the mirror image of how focus.js's
    // localDay() converts a real UTC timestamp back to a local
    // calendar day.
    const wallClockAsUtcMs = new Date(`${task.deadline}T${task.deadline_time}:00Z`).getTime();
    if (Number.isNaN(wallClockAsUtcMs)) continue;
    const dueAtMs = wallClockAsUtcMs + tzOffsetMin * 60000;
    const minutesUntilDue = (dueAtMs - nowMs) / 60000;

    let offsets = DEFAULT_REMIND_OFFSETS;
    if (task.remind_offsets_min) {
      try {
        const parsed = JSON.parse(task.remind_offsets_min);
        if (Array.isArray(parsed) && parsed.length) offsets = parsed;
      } catch (_) { /* malformed — fall back to the default */ }
    }

    for (const offsetMin of offsets) {
      // Window: we've reached this offset's lead time (or are already a
      // bit past it — the check only runs when someone actually polls
      // notifications, not on a fixed clock) but not so far past that
      // it's stale. Dedupe (link encodes the offset) means each one
      // only ever inserts once regardless of how many polls see it true.
      if (minutesUntilDue > offsetMin || minutesUntilDue < REMIND_STALE_FLOOR_MIN) continue;
      toCreate.push({
        type:  'due_soon',
        title: '⏰ Task due soon',
        body:  `"${task.title}" is due ${remindLabel(offsetMin)} (${task.deadline_time})`,
        link:  `/tasks?task=${task.id}&remind=${offsetMin}`,
        data:  { title: task.title, deadline: task.deadline, offsetMin },
      });
    }
  }

  // Gentle anti-procrastination nudge — deliberately NOT tied to a
  // deadline (that's what 'overdue' already covers) and carries no
  // consequence of any kind, just a supportive check-in: a task that's
  // sat untouched (no time logged against it) for a couple of days.
  // Deduped forever per task (same as overdue/deadline above) so it
  // fires once, not a daily nag. Excludes the self-seeded birthday
  // entry, which isn't a real actionable task.
  const stagnantTasks = await db.execute({
    sql:  `SELECT id, title FROM tasks
           WHERE user_id=? AND status='todo' AND source != 'nuvora'
             AND is_birthday=0
             AND COALESCE(time_spent_minutes,0) = 0
             AND date(created_at) <= date(?, '-2 days')
           ORDER BY created_at ASC LIMIT 3`,
    args: [userId, today],
  });
  for (const task of stagnantTasks.rows) {
    toCreate.push({
      type:  'procrastination',
      title: '🌱 Still on your list',
      body:  `"${task.title}" has been sitting a couple days — want Lumi to help you start small?`,
      link:  `/tasks?task=${task.id}`,
      data:  { title: task.title },
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
      data:  {},
    });
  }

  for (const goal of goals.rows) {
    const daysLeft = Math.ceil((new Date(goal.target_date) - new Date(today)) / (1000*60*60*24));
    toCreate.push({
      type:  'deadline',
      title: '🎯 Goal deadline approaching',
      body:  `"${goal.title}" is due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
      link:  `/goals?goal=${goal.id}`,
      data:  { title: goal.title, days: daysLeft },
    });
  }

  for (const m of dueMilestones.rows) {
    toCreate.push({
      type:  'milestone_due',
      title: '📅 Milestone due today',
      body:  `"${m.title}" (from "${m.goal_title}") is scheduled for today`,
      link:  `/goals?goal=${m.goal_id}&milestone=${m.id}`,
      data:  { title: m.title, goal: m.goal_title },
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
      data:  {},
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
          data:  { days: GRACE_PERIOD_DAYS },
        });
      }
      if (ageDays >= GRACE_PERIOD_DAYS - 1 && ageDays < GRACE_PERIOD_DAYS) {
        toCreate.push({
          type:  'grace_ending',
          title: '⏳ Your unlimited period ends soon',
          body:  'Daily limits on exam generation, Deep Think, and Deep Search start tomorrow. Loved having no limits? Go Premium and keep it that way — for good.',
          link:  null,
          data:  {},
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
    data:  {},
  });

  for (const n of toCreate) {
    const dedupeKey = buildDedupeKey(n.type, n.link, today);
    await db.execute({
      sql:  `INSERT INTO notifications (user_id, type, title, body, link, dedupe_key, data)
             VALUES (?,?,?,?,?,?,?)
             ON CONFLICT(user_id, dedupe_key) DO NOTHING`,
      args: [userId, n.type, n.title, n.body, n.link, dedupeKey, JSON.stringify(n.data || {})],
    });
  }
}

router.get('/', async (req, res) => {
  try {
    const tzOffsetMin = Number(req.query.tz_offset) || 0;
    await generateNotifications(req.user.id, tzOffsetMin);
    await ensureBirthdayTask(req.user.id);
    // Piggyback the browser's own tz_offset (sent on every poll already)
    // onto the user row — the cron-triggered email job (lib/emailReminders.js)
    // has no browser to ask, so it reads this instead. Best-effort/fire
    // and forget: a slightly stale offset just means an email fires a
    // little early/late, never a correctness issue worth failing the
    // request over.
    db.execute({ sql: `UPDATE users SET tz_offset_min=? WHERE id=?`, args: [tzOffsetMin, req.user.id] }).catch(() => {});
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
module.exports.generateNotifications = generateNotifications;