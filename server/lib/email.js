// lib/email.js — password reset email delivery
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

// ── Path 1: Brevo transactional HTTP API ──────────────────────
async function sendViaBrevoApi({ to, name, resetUrl }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key':      process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: JSON.stringify({
      sender:      { name: FROM_NAME, email: process.env.EMAIL_FROM || process.env.EMAIL_USER },
      to:          [{ email: to, name: name || to }],
      subject:     'Reset your Aurora password ✦',
      htmlContent: resetEmailHtml({ name, resetUrl }),
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Brevo API ${res.status}: ${body}`);
  console.log(`[email] ✓ sent to ${to} via Brevo API (${res.status})`);
}

// ── Path 2: Resend API ────────────────────────────────────────
async function sendViaResend({ to, name, resetUrl }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    `${FROM_NAME} <onboarding@resend.dev>`,
      to:      [to],
      subject: 'Reset your Aurora password ✦',
      html:    resetEmailHtml({ name, resetUrl }),
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend API ${res.status}: ${body}`);
  console.log(`[email] ✓ sent to ${to} via Resend (${res.status})`);
}

// ── Path 3: SMTP (last resort — often blocked on Render) ──────
async function sendViaSmtp({ to, name, resetUrl }) {
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
    subject: 'Reset your Aurora password ✦',
    html:    resetEmailHtml({ name, resetUrl }),
  });
  console.log(`[email] ✓ sent to ${to} via SMTP (${info.response})`);
}

// ── Public ────────────────────────────────────────────────────
async function sendPasswordResetEmail({ to, name, rawToken }) {
  const resetUrl = `${CLIENT_URL}/reset-password?token=${rawToken}`;

  const method = process.env.BREVO_API_KEY ? 'Brevo API'
               : process.env.RESEND_API_KEY ? 'Resend'
               : 'SMTP';
  console.log(`[email] preparing password reset for ${to} (via ${method})`);

  try {
    if (process.env.BREVO_API_KEY)       await sendViaBrevoApi({ to, name, resetUrl });
    else if (process.env.RESEND_API_KEY) await sendViaResend({ to, name, resetUrl });
    else                                 await sendViaSmtp({ to, name, resetUrl });
  } catch (err) {
    console.error(`[email] ✗ FAILED to send to ${to}: ${err.message}`);
    throw err;
  }
}

module.exports = { sendPasswordResetEmail };