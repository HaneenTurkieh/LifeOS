// lib/email.js — password reset + feedback email delivery
// Priority: Brevo HTTP API (port 443, never firewalled) → Resend API → SMTP.
// Render times out outbound SMTP connections (ETIMEDOUT on CONN), so the
// HTTP API path is the reliable one in production.
const nodemailer = require('nodemailer');
const CLIENT_URL = process.env.CLIENT_URL || 'https://life-os-three-xi.vercel.app';
const FROM_NAME  = 'Aurora';

function resetEmailHtml({ name, resetUrl }) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-flex;width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#7C6AF0,#5B47E0);color:#fff;font-size:24px;line-height:48px;text-align:center;">✦</div>
    </div>
    <h2 style="color:#1E2233;text-align:center;margin:0 0 8px;">Reset your password</h2>
    <p style="color:#5A5F73;font-size:14px;line-height:1.6;text-align:center;">
      Hi ${name || 'there'}, we received a request to reset your Aurora password.
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
      <div style="display:inline-flex;width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#7C6AF0,#5B47E0);color:#fff;font-size:24px;line-height:48px;text-align:center;">✦</div>
    </div>
    <h2 style="color:#1E2233;text-align:center;margin:0 0 8px;">New Aurora feedback</h2>
    <p style="color:#5A5F73;font-size:13px;text-align:center;margin:0 0 20px;">
      From: <strong>${userEmail || 'not provided'}</strong>
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
      From: <strong>${userName || 'A user'}</strong> (${userEmail || 'not provided'})
    </p>
    <div style="background:#F4F3FF;border:1px solid #EBE8FF;border-radius:14px;padding:20px;color:#1E2233;font-size:14px;line-height:1.6;text-align:center;">
      Wants the <strong>${planLabel}</strong> plan — ${priceLabel}.<br/>
      No payment has been collected yet — reach out to arrange it.
    </div>
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
      from:    `${FROM_NAME} <onboarding@resend.dev>`,
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
    subject: 'Reset your Aurora password ✦',
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
    subject: 'Aurora feedback',
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

module.exports = { sendPasswordResetEmail, sendFeedbackEmail, sendPremiumRequestEmail };