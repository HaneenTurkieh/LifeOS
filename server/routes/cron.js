// routes/cron.js — external-trigger endpoints. Render's free tier has
// no built-in scheduler (see lib/email.js's own comment about Render
// blocking outbound SMTP — same "free tier has gaps" theme), so this
// is meant to be pinged periodically by a free external service like
// cron-job.org rather than running on any timer inside the app itself.
// Mounted WITHOUT the normal `authenticate` JWT middleware (an external
// pinger has no user to log in as) — protected instead by a shared
// secret, same spirit as the Paddle webhook's signature check.
const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const { db }  = require('../db/connection');
const { sendPendingReminderEmails } = require('../lib/emailReminders');
const { sendPendingPushNotifications } = require('../lib/pushReminders');
const { reconcileSoloTimer } = require('./focus');

// Catches a Focus tree that finished growing while Nuvora was fully
// closed — no tab open means nobody's GET /focus/timer poll was ever
// going to reconcile it (that path only runs while a client is actually
// there), so without this the session still gets credited eventually
// (whenever she next opens the app), just silently — no bell, no push,
// nothing, until she happens to notice the tree count went up. This
// runs the exact same reconcileSoloTimer() a live poll would've, so it's
// safe even if a tab WAS open and already caught it first (idempotent
// via focus_session_credits — reconcileSoloTimer just returns nothing
// the second time).
async function notifyFinishedFocusSessions() {
  let notified = 0;
  const rows = (await db.execute(`SELECT DISTINCT user_id FROM focus_solo_timer WHERE running = 1`)).rows;
  for (const row of rows) {
    try {
      const result = await reconcileSoloTimer(row.user_id);
      if (!result) continue; // still running, or a tab already caught it first
      // link is where clicking the notification actually goes (the real
      // forest view) — deliberately NOT run through buildDedupeKey's
      // default "${type}:${link}" formula, since that link is the same
      // for every session and would let only the very first-ever
      // completed session generate a notification, forever. The session's
      // own startedAt is what has to vary per-session for the dedupe key.
      const link      = '/focus?tab=forest';
      const dedupeKey = `focus_complete:${result.startedAt || Date.now()}`;
      await db.execute({
        sql: `INSERT INTO notifications (user_id, type, title, body, link, dedupe_key, data)
              VALUES (?, 'focus_complete', ?, ?, ?, ?, ?)
              ON CONFLICT(user_id, dedupe_key) DO NOTHING`,
        args: [
          row.user_id,
          '🌳 Your tree finished growing!',
          `${result.minutes} min focus session complete — +${result.xpAwarded} XP.`,
          link,
          dedupeKey,
          JSON.stringify({ minutes: result.minutes, xp: result.xpAwarded }),
        ],
      });
      notified++;
    } catch (err) {
      console.error(`[cron] notifyFinishedFocusSessions failed for user ${row.user_id}:`, err.message);
    }
  }
  return { checked: rows.length, notified };
}

// Plain string !== leaks timing information (how many leading characters
// matched) that could theoretically help a remote guesser narrow down
// the secret one byte at a time. Low real-world risk for a personal
// app's cron endpoint, but timingSafeEqual costs nothing to use instead.
// It throws on mismatched buffer lengths rather than just returning
// false, so length is checked explicitly first.
function secretsMatch(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkSecret(req, res) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error('[cron] rejected — CRON_SECRET is not set on this server');
    res.status(500).json({ error: 'CRON_SECRET not configured on the server' });
    return false;
  }
  const rawHeader = req.headers.authorization || '';
  const got = rawHeader.replace(/^Bearer\s+/i, '');
  if (!secretsMatch(got, expected)) {
    // Never log the actual secret values (even though this is a private
    // log, no reason to put it in plaintext) — but log enough shape
    // info to tell "header never arrived" apart from "wrong value" apart
    // from "right value, stray whitespace from a copy-paste" at a glance.
    console.warn('[cron] auth failed —', {
      headerPresent: Boolean(rawHeader),
      hadBearerPrefix: /^Bearer\s+/i.test(rawHeader),
      gotLength: got.length,
      expectedLength: expected.length,
      trimMatches: got.trim() === expected.trim(),
    });
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// POST (not GET) so it can't be triggered by, say, a browser prefetch
// or a link-preview bot hitting the URL — this has a real side effect
// (sends emails and push notifications).
router.post('/reminders', async (req, res) => {
  if (!checkSecret(req, res)) return;
  try {
    // Independent try/catches — push not being configured yet (no VAPID
    // keys set) shouldn't take email down with it, and vice versa.
    let email = null, push = null, focus = null;
    try { focus = await notifyFinishedFocusSessions(); }
    catch (err) { console.error('[cron/reminders] focus step failed:', err.message); }
    try { email = await sendPendingReminderEmails(); }
    catch (err) { console.error('[cron/reminders] email step failed:', err.message); }
    try { push = await sendPendingPushNotifications(); }
    catch (err) { console.error('[cron/reminders] push step failed:', err.message); }
    res.json({ ok: true, email, push, focus });
  } catch (err) {
    console.error('[cron/reminders] failed:', err.message);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});

module.exports = router;
