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

      // Filtering to EMAILABLE_TYPES in SQL (not after fetching) matters:
      // filtering in JS after a LIMIT would let non-emailable rows
      // (mood/streak/procrastination/announcements — never marked
      // email_sent since they're filtered out before that UPDATE below)
      // permanently occupy the LIMIT window ahead of real reminders,
      // eventually starving a user of reminder emails entirely with no
      // error anywhere to notice it by.
      const emailableTypesArr = [...EMAILABLE_TYPES];
      const pending = (await db.execute({
        sql: `SELECT id, type, title, body, link FROM notifications
              WHERE user_id=? AND email_sent=0 AND type IN (${emailableTypesArr.map(() => '?').join(',')})
              ORDER BY created_at ASC LIMIT 20`,
        args: [user.id, ...emailableTypesArr],
      })).rows;

      if (!pending.length) continue;

      // Claim each row BEFORE emailing it, not after — same race this
      // digest used to share with pushReminders.js's per-item send: a
      // slow tick (Render waking from sleep) plus cron-job.org's own
      // retry-on-timeout, or two ticks simply overlapping, could both
      // SELECT the same still-email_sent=0 rows before either one had
      // marked them sent, so both sent the SAME digest to the SAME
      // inbox. Claiming one row at a time (atomic UPDATE ... WHERE
      // email_sent=0, keep only the ones that actually flip) means
      // whichever tick gets here first wins each row; the other tick's
      // digest simply comes up empty for anything already claimed.
      const claimed = [];
      for (const n of pending) {
        const claim = await db.execute({
          sql: `UPDATE notifications SET email_sent=1 WHERE id=? AND email_sent=0`,
          args: [n.id],
        });
        if (claim.rowsAffected > 0) claimed.push(n);
      }
      if (!claimed.length) continue; // another tick already claimed all of these

      try {
        await sendReminderDigestEmail({ to: user.email, items: claimed });
        usersEmailed++;
        itemsSent += claimed.length;
      } catch (err) {
        // These rows are already claimed (email_sent=1) at this point,
        // so a send failure here means this digest is lost rather than
        // retried next tick — the deliberate trade-off made above:
        // "rarely misses one on a genuine send failure" beats "reliably
        // duplicates on any cron overlap," and a send failure here is
        // otherwise rare (SendGrid/Resend being down, not just a slow
        // Render wake-up).
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
