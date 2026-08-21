// routes/cron.js — external-trigger endpoints. Render's free tier has
// no built-in scheduler (see lib/email.js's own comment about Render
// blocking outbound SMTP — same "free tier has gaps" theme), so this
// is meant to be pinged periodically by a free external service like
// cron-job.org rather than running on any timer inside the app itself.
// Mounted WITHOUT the normal `authenticate` JWT middleware (an external
// pinger has no user to log in as) — protected instead by a shared
// secret, same spirit as the Paddle webhook's signature check.
const express = require('express');
const router  = express.Router();
const { sendPendingReminderEmails } = require('../lib/emailReminders');

function checkSecret(req, res) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error('[cron] rejected — CRON_SECRET is not set on this server');
    res.status(500).json({ error: 'CRON_SECRET not configured on the server' });
    return false;
  }
  const rawHeader = req.headers.authorization || '';
  const got = rawHeader.replace(/^Bearer\s+/i, '');
  if (got !== expected) {
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
// (sends emails).
router.post('/reminders', async (req, res) => {
  if (!checkSecret(req, res)) return;
  try {
    const result = await sendPendingReminderEmails();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[cron/reminders] failed:', err.message);
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});

module.exports = router;
