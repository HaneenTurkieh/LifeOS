// lib/push.js — Web Push wrapper. Free protocol, no paid service: the
// actual delivery is handled by the browser vendor's own push service
// (Google/Mozilla/Apple), the same way email delivery needed Brevo/
// Resend/SMTP but push needs nothing but a VAPID key pair (see
// VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY below — generated once, not
// purchased from anyone).
const webPush = require('web-push');

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not configured — push disabled');
    return false;
  }
  webPush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:support@nuvora.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
  configured = true;
  return true;
}

// Returns { ok: true } or { ok: false, gone: true } (subscription is
// dead — caller should delete the row) or { ok: false, error } for
// anything else (transient, worth retrying next tick).
async function sendPush(subscription, payload) {
  if (!ensureConfigured()) return { ok: false, error: 'not configured' };
  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (err) {
    // 404/410 = the browser's push service says this subscription no
    // longer exists (user revoked permission, uninstalled, cleared
    // site data, etc.) — permanent, not worth retrying.
    const gone = err.statusCode === 404 || err.statusCode === 410;
    if (!gone) console.error('[push] send failed:', err.statusCode, err.body || err.message);
    return { ok: false, gone, error: err.message };
  }
}

module.exports = { sendPush };
