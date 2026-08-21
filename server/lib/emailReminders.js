// lib/emailReminders.js — the actual "you don't always have the app
// open" fix. generateNotifications() (routes/notifications.js) already
// computes + dedupes everything that deserves a ping; it just only ever
// ran when someone was already looking at the bell, which defeats the
// point for anything urgent. This runs the same function for every user
// on a timer (see routes/cron.js for the trigger) and emails whatever
// comes out the other end that hasn't been emailed yet.
const { db } = require('../db/connection');
const { generateNotifications } = require('../routes/notifications');
const { sendReminderEmail } = require('./email');

// Not every notification type deserves an email — mood check-ins and
// the one-time grace-period/feature announcements are fine staying
// in-app-only. This is specifically the "you'll regret not knowing
// about this until you open the app" subset.
const EMAILABLE_TYPES = new Set(['overdue', 'due_soon', 'streak', 'deadline', 'milestone_due']);

async function sendPendingReminderEmails() {
  const users = (await db.execute({
    sql: `SELECT id, email, name, tz_offset_min FROM users`,
  })).rows;

  let sent = 0, failed = 0;
  for (const user of users) {
    try {
      // This both inserts any newly-due notifications AND is a no-op for
      // ones already seen (ON CONFLICT DO NOTHING, keyed on dedupe_key) —
      // exactly the same call GET /notifications makes, just triggered by
      // a clock instead of a page load.
      await generateNotifications(user.id, user.tz_offset_min || 0);

      const pendingTyped = (await db.execute({
        sql: `SELECT id, type, title, body, link FROM notifications
              WHERE user_id=? AND email_sent=0
              ORDER BY created_at ASC LIMIT 10`,
        args: [user.id],
      })).rows.filter((n) => EMAILABLE_TYPES.has(n.type));

      for (const n of pendingTyped) {
        try {
          await sendReminderEmail({ to: user.email, title: n.title, body: n.body, link: n.link });
          await db.execute({ sql: `UPDATE notifications SET email_sent=1 WHERE id=?`, args: [n.id] });
          sent++;
        } catch (err) {
          // One failed send (e.g. transient email API hiccup) shouldn't
          // mark it sent — it'll just get retried on the next cron tick.
          console.error(`[emailReminders] failed to email notification ${n.id} to ${user.email}:`, err.message);
          failed++;
        }
      }
    } catch (err) {
      console.error(`[emailReminders] failed processing user ${user.id}:`, err.message);
    }
  }
  return { usersChecked: users.length, sent, failed };
}

module.exports = { sendPendingReminderEmails };
