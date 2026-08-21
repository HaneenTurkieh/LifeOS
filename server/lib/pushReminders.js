// lib/pushReminders.js — the actual "phone buzzes even with the app
// closed" feature. Same generateNotifications() source of truth as
// emailReminders.js, triggered by the same cron tick (see routes/cron.js),
// but sent one push per item instead of batched into a digest: a native
// notification is a glanceable, individually-dismissible OS-level thing
// (like a text message), not an inbox — stacking several into one payload
// with a cramped body is the wrong shape for this channel, unlike email
// where one email per item would be spammy. So this intentionally does
// NOT batch, even though emailReminders.js does.
const { db } = require('../db/connection');
const { generateNotifications } = require('../routes/notifications');
const { sendPush } = require('./push');

// Same scope as email — tasks (overdue/due-soon), goal deadlines,
// milestone due-dates. Mood/streak/procrastination/announcements stay
// in-app-only, same reasoning as the email side.
const PUSHABLE_TYPES = new Set(['overdue', 'due_soon', 'deadline', 'milestone_due']);

async function sendPendingPushNotifications() {
  const users = (await db.execute({
    sql: `SELECT id, tz_offset_min FROM users`,
  })).rows;

  let sent = 0, failed = 0, pruned = 0;
  for (const user of users) {
    try {
      // Same idempotent call emailReminders.js and the bell both make —
      // inserts anything newly due, no-ops for what's already there.
      await generateNotifications(user.id, user.tz_offset_min || 0);

      const subs = (await db.execute({
        sql: `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=?`,
        args: [user.id],
      })).rows;
      if (!subs.length) continue; // never enabled push, or unsubscribed everywhere

      const pushableTypesArr = [...PUSHABLE_TYPES];
      const pending = (await db.execute({
        sql: `SELECT id, type, title, body, link FROM notifications
              WHERE user_id=? AND push_sent=0 AND type IN (${pushableTypesArr.map(() => '?').join(',')})
              ORDER BY created_at ASC LIMIT 20`,
        args: [user.id, ...pushableTypesArr],
      })).rows;
      if (!pending.length) continue;

      for (const n of pending) {
        let anySucceeded = false;
        for (const sub of subs) {
          const result = await sendPush(sub, { title: n.title, body: n.body, link: n.link });
          if (result.ok) {
            anySucceeded = true;
          } else if (result.gone) {
            // Dead subscription (revoked/uninstalled/site data cleared)
            // — prune it so future ticks don't keep re-trying a device
            // that's never coming back.
            await db.execute({ sql: `DELETE FROM push_subscriptions WHERE id=?`, args: [sub.id] });
            pruned++;
          }
        }
        // Marked sent if it reached at least one of the person's
        // devices — a person with a phone + laptop subscribed
        // shouldn't get this re-tried forever just because one of the
        // two failed.
        if (anySucceeded) {
          await db.execute({ sql: `UPDATE notifications SET push_sent=1 WHERE id=?`, args: [n.id] });
          sent++;
        } else {
          failed++;
        }
      }
    } catch (err) {
      console.error(`[pushReminders] failed processing user ${user.id}:`, err.message);
    }
  }
  return { usersChecked: users.length, sent, failed, pruned };
}

module.exports = { sendPendingPushNotifications };
