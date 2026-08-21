// lib/emailReminders.js — the actual "you don't always have the app
// open" fix. generateNotifications() (routes/notifications.js) already
// computes + dedupes everything that deserves a ping; it just only ever
// ran when someone was already looking at the bell, which defeats the
// point for anything urgent. This runs the same function for every user
// on a timer (see routes/cron.js for the trigger) and emails whatever
// comes out the other end that hasn't been emailed yet.
//
// One email per user per run, not one per item — if 5 things go due in
// the same 10-minute window, that's 1 email listing 5 things, not 5
// separate emails landing back-to-back (annoying, and a bad look for a
// sender identity that hasn't built up reputation yet).
const { db } = require('../db/connection');
const { generateNotifications } = require('../routes/notifications');
const { sendReminderDigestEmail } = require('./email');

// Deliberately narrow: tasks (overdue/due-soon), goal deadlines, and
// milestone due-dates. Everything else (mood check-ins, streak nudges,
// the procrastination nudge, one-time feature announcements) stays an
// in-app-only "normal" notification — those aren't urgent enough to be
// worth training people to half-ignore their email from Nuvora.
const EMAILABLE_TYPES = new Set(['overdue', 'due_soon', 'deadline', 'milestone_due']);

async function sendPendingReminderEmails() {
  const users = (await db.execute({
    sql: `SELECT id, email, name, tz_offset_min FROM users`,
  })).rows;

  let usersEmailed = 0, itemsSent = 0, failed = 0;
  for (const user of users) {
    try {
      // This both inserts any newly-due notifications AND is a no-op for
      // ones already seen (ON CONFLICT DO NOTHING, keyed on dedupe_key) —
      // exactly the same call GET /notifications makes, just triggered by
      // a clock instead of a page load.
      await generateNotifications(user.id, user.tz_offset_min || 0);

      const pending = (await db.execute({
        sql: `SELECT id, type, title, body, link FROM notifications
              WHERE user_id=? AND email_sent=0
              ORDER BY created_at ASC LIMIT 20`,
        args: [user.id],
      })).rows.filter((n) => EMAILABLE_TYPES.has(n.type));

      if (!pending.length) continue;

      try {
        await sendReminderDigestEmail({ to: user.email, items: pending });
        await db.execute({
          sql: `UPDATE notifications SET email_sent=1 WHERE id IN (${pending.map(() => '?').join(',')})`,
          args: pending.map((n) => n.id),
        });
        usersEmailed++;
        itemsSent += pending.length;
      } catch (err) {
        // Didn't mark any as sent — the whole batch retries next tick
        // rather than risking half-marked-sent/half-not on a partial
        // failure mid-send.
        console.error(`[emailReminders] failed to email digest to ${user.email}:`, err.message);
        failed++;
      }
    } catch (err) {
      console.error(`[emailReminders] failed processing user ${user.id}:`, err.message);
    }
  }
  return { usersChecked: users.length, usersEmailed, itemsSent, failed };
}

module.exports = { sendPendingReminderEmails };
