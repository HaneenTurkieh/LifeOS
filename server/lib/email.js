// lib/email.js — password reset + feedback email delivery
// Priority: Brevo HTTP API (port 443, never firewalled) → Resend API → SMTP.
// Render times out outbound SMTP connections (ETIMEDOUT on CONN), so the
// HTTP API path is the reliable one in production.
const nodemailer = require('nodemailer');
const CLIENT_URL = process.env.CLIENT_URL || 'https://nuvora.ps';
const FROM_NAME  = 'Nuvora';

// feedbackEmailHtml/premiumRequestEmailHtml used to drop userEmail/userName
// straight into the HTML unescaped — the feedback form (routes/feedback.js)
// lets any client send an arbitrary `email` string, so a "feedback"
// submission could inject markup/links into the email that lands in your
// own inbox. Only `message` was ever escaped before; this covers the rest.
function esc(s) { return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function resetEmailHtml({ name, resetUrl }) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <img src="${CLIENT_URL}/icon-192.png" width="48" height="48" alt="Nuvora" style="border-radius:14px;display:inline-block;" />
    </div>
    <h2 style="color:#1E2233;text-align:center;margin:0 0 8px;">Reset your password</h2>
    <p style="color:#5A5F73;font-size:14px;line-height:1.6;text-align:center;">
      Hi ${name || 'there'}, we received a request to reset your Nuvora password.
      This link expires in 30 minutes.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${resetUrl}"
        style="display:inline-block;background:linear-gradient(135deg,#7C6AF0,#5B47E0);color:#fff;text-decoration:none;padding:13px 32px;border-radius:14px;font-weight:600;font-size:14px;">
        Reset password
      </a>
    </div>
    <p style="color:#9AA0B5;font-size:12px;line-height:1.6;text-align:center;">
      If you didn't request this, you can safely ignore this email.<br/>
      Or paste this link in your browser:<br/>
      <span style="word-break:break-all;color:#7C6AF0;">${resetUrl}</span>
    </p>
  </div>`;
}

function feedbackEmailHtml({ userEmail, message }) {
  const safe = String(message).replace(/</g, '&lt;').replace(/\n/g, '<br/>');
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <img src="${CLIENT_URL}/icon-192.png" width="48" height="48" alt="Nuvora" style="border-radius:14px;display:inline-block;" />
    </div>
    <h2 style="color:#1E2233;text-align:center;margin:0 0 8px;">New Nuvora feedback</h2>
    <p style="color:#5A5F73;font-size:13px;text-align:center;margin:0 0 20px;">
      From: <strong>${esc(userEmail) || 'not provided'}</strong>
    </p>
    <div style="background:#F4F3FF;border:1px solid #EBE8FF;border-radius:14px;padding:20px;color:#1E2233;font-size:14px;line-height:1.6;">
      ${safe}
    </div>
  </div>`;
}

function premiumRequestEmailHtml({ userEmail, userName, planLabel, priceLabel }) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-flex;width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#FFB84D,#7C6AF0);color:#fff;font-size:22px;line-height:48px;text-align:center;">👑</div>
    </div>
    <h2 style="color:#1E2233;text-align:center;margin:0 0 8px;">New Premium request</h2>
    <p style="color:#5A5F73;font-size:13px;text-align:center;margin:0 0 20px;">
      From: <strong>${esc(userName) || 'A user'}</strong> (${esc(userEmail) || 'not provided'})
    </p>
    <div style="background:#F4F3FF;border:1px solid #EBE8FF;border-radius:14px;padding:20px;color:#1E2233;font-size:14px;line-height:1.6;text-align:center;">
      Wants the <strong>${esc(planLabel)}</strong> plan — ${esc(priceLabel)}.<br/>
      No payment has been collected yet — reach out to arrange it.
    </div>
  </div>`;
}

// One email per user per cron run, listing everything pending — not
// one email per item. Five things due in the same 10-minute window is
// one email with five rows, not five separate emails.
function reminderDigestEmailHtml({ items }) {
  const esc = (s) => String(s).replace(/</g, '&lt;');
  const rows = items.map((n) => {
    const url = n.link ? `${CLIENT_URL}${n.link}` : CLIENT_URL;
    return `
      <a href="${url}" style="display:block;text-decoration:none;background:#F4F3FF;border:1px solid #EBE8FF;border-radius:14px;padding:14px 16px;margin-bottom:10px;">
        <div style="color:#1E2233;font-size:14px;font-weight:600;margin-bottom:3px;">${esc(n.title)}</div>
        <div style="color:#5A5F73;font-size:13px;line-height:1.5;">${esc(n.body)}</div>
      </a>`;
  }).join('');
  const heading = items.length === 1 ? '1 thing needs your attention' : `${items.length} things need your attention`;
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:20px;">
      <img src="${CLIENT_URL}/icon-192.png" width="48" height="48" alt="Nuvora" style="border-radius:14px;display:inline-block;" />
    </div>
    <h2 style="color:#1E2233;text-align:center;margin:0 0 20px;font-size:19px;">${heading}</h2>
    ${rows}
    <p style="color:#9AA0B5;font-size:11px;line-height:1.6;text-align:center;margin-top:24px;">
      You're getting this because these have reminders on in Nuvora. Tap any item above to open it.
    </p>
  </div>`;
}

function instructorCredentialsEmailHtml({ name, email, tempPassword }) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <img src="${CLIENT_URL}/icon-192.png" width="48" height="48" alt="Nuvora" style="border-radius:14px;display:inline-block;" />
    </div>
    <h2 style="color:#1E2233;text-align:center;margin:0 0 8px;">Your instructor account is ready</h2>
    <p style="color:#5A5F73;font-size:14px;line-height:1.6;text-align:center;">
      Hi ${esc(name) || 'there'}, welcome to Nuvora. Here are your login details — keep them safe.
    </p>
    <div style="background:#F4F3FF;border:1px solid #EBE8FF;border-radius:14px;padding:20px;color:#1E2233;font-size:14px;line-height:2;text-align:center;">
      <div>Login email: <strong>${esc(email)}</strong></div>
      <div>Password: <strong style="font-family:monospace;letter-spacing:0.5px;">${esc(tempPassword)}</strong></div>
    </div>
    <div style="text-align:center;margin:24px 0 8px;">
      <a href="${CLIENT_URL}/login"
        style="display:inline-block;background:linear-gradient(135deg,#7C6AF0,#5B47E0);color:#fff;text-decoration:none;padding:13px 32px;border-radius:14px;font-weight:600;font-size:14px;">
        Sign in to Nuvora
      </a>
    </div>
    <p style="color:#9AA0B5;font-size:12px;line-height:1.6;text-align:center;">
      You can change your password any time from Settings once you're signed in.
    </p>
  </div>`;
}

function channelInviteEmailHtml({ channelName, joinCode, instructorName }) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <img src="${CLIENT_URL}/icon-192.png" width="48" height="48" alt="Nuvora" style="border-radius:14px;display:inline-block;" />
    </div>
    <h2 style="color:#1E2233;text-align:center;margin:0 0 8px;">You're invited to a Nuvora channel</h2>
    <p style="color:#5A5F73;font-size:14px;line-height:1.6;text-align:center;">
      ${esc(instructorName) || 'Your instructor'} invited you to join <strong>${esc(channelName)}</strong> on Nuvora.
    </p>
    <div style="background:#F4F3FF;border:1px solid #EBE8FF;border-radius:14px;padding:20px;color:#1E2233;font-size:13px;line-height:1.6;text-align:center;">
      Join code
      <div style="font-family:monospace;font-size:22px;font-weight:700;letter-spacing:3px;margin-top:6px;color:#5B47E0;">${esc(joinCode)}</div>
    </div>
    <div style="text-align:center;margin:24px 0 8px;">
      <a href="${CLIENT_URL}/channels"
        style="display:inline-block;background:linear-gradient(135deg,#7C6AF0,#5B47E0);color:#fff;text-decoration:none;padding:13px 32px;border-radius:14px;font-weight:600;font-size:14px;">
        Open Nuvora → Channels
      </a>
    </div>
    <p style="color:#9AA0B5;font-size:12px;line-height:1.6;text-align:center;">
      Sign in (or create a free student account), go to Channels, and enter the code above to join.
    </p>
  </div>`;
}

// ── Path 1: Brevo transactional HTTP API ──────────────────────
async function sendViaBrevoApi({ to, subject, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key':      process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: JSON.stringify({
      sender:      { name: FROM_NAME, email: process.env.EMAIL_FROM || process.env.EMAIL_USER },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Brevo API ${res.status}: ${body}`);
  console.log(`[email] ✓ sent to ${to} via Brevo API (${res.status})`);
}
// ── Path 2: Resend API ────────────────────────────────────────
async function sendViaResend({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      // onboarding@resend.dev is Resend's own shared testing domain —
      // fine for confirming the API call works, but real recipients'
      // mail providers see it as an unfamiliar shared sender with zero
      // reputation and are more likely to spam-fold it, especially once
      // this starts sending regularly instead of the rare password
      // reset. Falls back to it only if EMAIL_FROM was never set — set
      // EMAIL_FROM to an address on a domain verified in the Resend
      // dashboard (SPF/DKIM records added) once one exists.
      from:    `${FROM_NAME} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
      to:      [to],
      subject,
      html,
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend API ${res.status}: ${body}`);
  console.log(`[email] ✓ sent to ${to} via Resend (${res.status})`);
}
// ── Path 3: SMTP (last resort — often blocked on Render) ──────
async function sendViaSmtp({ to, subject, html }) {
  const port = Number(process.env.EMAIL_SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout:   10000,
    socketTimeout:     15000,
  });
  const info = await transporter.sendMail({
    from:    `"${FROM_NAME}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
  console.log(`[email] ✓ sent to ${to} via SMTP (${info.response})`);
}

// ── Shared dispatcher — tries Brevo, then Resend, then SMTP ────
async function dispatch({ to, subject, html, label }) {
  const method = process.env.BREVO_API_KEY ? 'Brevo API'
               : process.env.RESEND_API_KEY ? 'Resend'
               : 'SMTP';
  console.log(`[email] preparing ${label} for ${to} (via ${method})`);
  try {
    if (process.env.BREVO_API_KEY)       await sendViaBrevoApi({ to, subject, html });
    else if (process.env.RESEND_API_KEY) await sendViaResend({ to, subject, html });
    else                                 await sendViaSmtp({ to, subject, html });
  } catch (err) {
    console.error(`[email] ✗ FAILED to send ${label} to ${to}: ${err.message}`);
    throw err;
  }
}

// ── Public: password reset ──────────────────────────────────────
async function sendPasswordResetEmail({ to, name, rawToken }) {
  const resetUrl = `${CLIENT_URL}/reset-password?token=${rawToken}`;
  await dispatch({
    to, label: 'password reset',
    subject: 'Reset your Nuvora password ✦',
    html: resetEmailHtml({ name, resetUrl }),
  });
}

// ── Public: feedback — now reuses the same working Brevo-first
// chain as password reset, instead of feedback.js's old standalone
// Resend-only call (which silently no-op'd whenever RESEND_API_KEY
// wasn't set, which is the case since you removed it earlier). ────
async function sendFeedbackEmail({ userEmail, message }) {
  await dispatch({
    to: 'haneenturkieh@hotmail.com',
    label: 'feedback',
    subject: 'Nuvora feedback',
    html: feedbackEmailHtml({ userEmail, message }),
  });
}

// ── Public: premium plan request — there's no payment gateway wired
// up yet (blocked on confirming Arab Bank's merchant terms), so
// "going premium" today means this: a request lands in the dev's
// inbox and the account gets flagged premium right away, same
// bootstrap approach used before any real billing exists. ──────
async function sendPremiumRequestEmail({ userEmail, userName, planLabel, priceLabel }) {
  await dispatch({
    to: 'haneenturkieh@hotmail.com',
    label: 'premium request',
    subject: `Premium request: ${planLabel}`,
    html: premiumRequestEmailHtml({ userEmail, userName, planLabel, priceLabel }),
  });
}

// ── Public: reminder digest — the "you don't always have the app open"
// gap. Fired from the cron-triggered job in lib/emailReminders.js, one
// email per user per run bundling everything pending (never one email
// per item — see emailReminders.js), items never resent once sent —
// see the notifications.email_sent migration in db/connection.js. ────
async function sendReminderDigestEmail({ to, items }) {
  if (!items.length) return;
  const subject = items.length === 1
    ? items[0].title.replace(/^[^\w]+/, '').trim()
    : `${items.length} things need your attention`;
  await dispatch({
    to, label: 'reminder digest',
    subject: subject || 'Nuvora reminders',
    html: reminderDigestEmailHtml({ items }),
  });
}

// ── Public: instructor account credentials (classroom system) ──
async function sendInstructorCredentialsEmail({ to, name, tempPassword }) {
  await dispatch({
    to, label: 'instructor credentials',
    subject: 'Your Nuvora instructor account ✦',
    html: instructorCredentialsEmailHtml({ name, email: to, tempPassword }),
  });
}

// ── Public: channel join-code invite (classroom system) ────────
async function sendChannelInviteEmail({ to, channelName, joinCode, instructorName }) {
  await dispatch({
    to, label: 'channel invite',
    subject: `Join "${channelName}" on Nuvora`,
    html: channelInviteEmailHtml({ channelName, joinCode, instructorName }),
  });
}

module.exports = {
  sendPasswordResetEmail, sendFeedbackEmail, sendPremiumRequestEmail, sendReminderDigestEmail,
  sendInstructorCredentialsEmail, sendChannelInviteEmail,
};