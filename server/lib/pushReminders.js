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
// milestone due-dates — PLUS focus_complete, which is push-only (not in
// emailReminders.js's EMAILABLE_TYPES): a finished 25-minute Pomodoro
// isn't "email me" material, but it IS the one thing worth a push even
// though the app's own in-app popup already covers it for anyone who
// left the tab open — this is specifically for "closed Nuvora entirely
// mid-session" (see cron.js's notifyFinishedFocusSessions).
// Mood/streak/procrastination/announcements stay in-app-only, same
// reasoning as the email side.
const PUSHABLE_TYPES = new Set(['overdue', 'due_soon', 'deadline', 'milestone_due', 'focus_complete']);

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
        // Claim BEFORE sending, not after — this was the actual bug
        // behind "repetitive notifications" reports. The old order was
        // send-then-mark-sent: if a cron tick ran long (Render's free
        // tier can take a while to wake from sleep) and cron-job.org's
        // own timeout fired a retry, or two ticks simply overlapped,
        // both invocations could SELECT the same still-push_sent=0 row
        // before either had gotten around to marking it sent — so both
        // sent it, to the same device, for the same event. Flipping to
        // claim-first (atomic UPDATE ... WHERE push_sent=0, only send if
        // this row was the one that actually flipped it) closes that
        // window: whichever tick gets here first wins the claim, the
        // other sees rowsAffected===0 and skips it entirely. Worst case
        // now is the rare opposite failure mode — claimed but the send
        // itself then fails — a silently missed push, not a duplicate
        // one, which is the far safer direction to err in.
        const claim = await db.execute({
          sql: `UPDATE notifications SET push_sent=1 WHERE id=? AND push_sent=0`,
          args: [n.id],
        });
        if (claim.rowsAffected === 0) continue; // another tick already claimed this one

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
        if (anySucceeded) sent++;
        else failed++;
      }
    } catch (err) {
      console.error(`[pushReminders] failed processing user ${user.id}:`, err.message);
    }
  }
  return { usersChecked: users.length, sent, failed, pruned };
}

module.exports = { sendPendingPushNotifications };
