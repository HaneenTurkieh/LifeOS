const nodemailer = require('nodemailer');

// ═══════════════════════════════════════════════════════════════
// Aurora email — with full logging so failures are never silent.
//
// Two delivery paths:
//   1. If RESEND_API_KEY is set → Resend HTTP API (most reliable
//      from cloud hosts like Render; SMTP from datacenter IPs is
//      often throttled or silently dropped by Gmail).
//   2. Otherwise → SMTP via nodemailer (Gmail/Brevo/Outlook/etc.)
//
// Every attempt logs a [email] line to the Render console, so
// after triggering a reset you will ALWAYS see either a success
// line with a message id, or the exact error.
// ═══════════════════════════════════════════════════════════════

function createTransporter() {
  const host = process.env.EMAIL_SMTP_HOST || detectHost(process.env.EMAIL_USER);

  return nodemailer.createTransport({
    host,
    port:   Number(process.env.EMAIL_SMTP_PORT) || 587,
    secure: Number(process.env.EMAIL_SMTP_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Fail fast instead of hanging forever — a hung socket looks
    // exactly like "email sends but never arrives".
    connectionTimeout: 10_000,
    greetingTimeout:   10_000,
    socketTimeout:     15_000,
    tls: { rejectUnauthorized: false },
  });
}

function detectHost(email = '') {
  if (email.includes('@gmail'))   return 'smtp.gmail.com';
  if (email.includes('@hotmail') ||
      email.includes('@outlook') ||
      email.includes('@live'))    return 'smtp-mail.outlook.com';
  if (email.includes('@yahoo'))   return 'smtp.mail.yahoo.com';
  if (email.includes('@icloud'))  return 'smtp.mail.me.com';
  return 'smtp.gmail.com';
}

function buildResetHtml({ name, resetUrl }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#F4F3FF;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
        style="background:white;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(124,106,240,0.12)">
        <tr>
          <td style="background:linear-gradient(135deg,#7C6AF0,#5B47E0);padding:40px;text-align:center">
            <div style="font-size:32px;margin-bottom:8px">&#10022;</div>
            <div style="color:white;font-size:22px;font-weight:700">Aurora</div>
            <div style="color:rgba(255,255,255,0.65);font-size:13px;margin-top:4px">Your personal life OS</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827">Reset your password</h1>
            <p style="margin:0 0 24px;font-size:14px;color:#6B7280;line-height:1.6">
              Hi ${name || 'there'} &#128075; We received a request to reset your Aurora password.
              Click below to set a new one.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 32px">
                  <a href="${resetUrl}"
                    style="display:inline-block;background:linear-gradient(135deg,#7C6AF0,#5B47E0);
                           color:white;font-size:15px;font-weight:700;text-decoration:none;
                           padding:14px 36px;border-radius:50px;
                           box-shadow:0 4px 14px rgba(124,106,240,0.40)">
                    Reset my password &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <div style="background:#F9FAFB;border-radius:12px;padding:16px;margin-bottom:24px">
              <p style="margin:0;font-size:13px;color:#6B7280">
                &#9201; This link expires in <strong>30 minutes</strong>.
                If you didn't request this, ignore this email.
              </p>
            </div>
            <p style="margin:0;font-size:12px;color:#9CA3AF">
              Button not working? Paste this link:<br/>
              <a href="${resetUrl}" style="color:#7C6AF0;word-break:break-all">${resetUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #F3F4F6;text-align:center">
            <p style="margin:0;font-size:12px;color:#D1D5DB">
              &copy; ${new Date().getFullYear()} Aurora &middot; Built with &#10022;
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Path 1: Resend HTTP API ────────────────────────────────────
async function sendViaResend({ to, subject, html, text }) {
  const fromName = process.env.EMAIL_FROM_NAME || 'Aurora';
  // With a verified domain on Resend set EMAIL_FROM to e.g.
  // "aurora@yourdomain.com". Without one, onboarding@resend.dev
  // works but ONLY delivers to the Resend account owner's email.
  const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromAddress}>`,
      to: [to],
      subject, html, text,
    }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`Resend API ${r.status}: ${data?.message || JSON.stringify(data)}`);
  }
  console.log(`[email] ✓ sent via Resend to ${to} — id ${data.id}`);
}

// ── Path 2: SMTP via nodemailer ────────────────────────────────
async function sendViaSmtp({ to, subject, html, text }) {
  const fromName    = process.env.EMAIL_FROM_NAME || 'Aurora';
  const fromAddress = process.env.EMAIL_USER;
  const transporter = createTransporter();

  // Verify the connection first — surfaces auth failures
  // (e.g. Gmail rejecting a normal password instead of an
  // App Password) with a clear log line.
  try {
    await transporter.verify();
    console.log('[email] SMTP connection verified');
  } catch (err) {
    console.error('[email] ✗ SMTP verify failed:', err.message);
    throw err;
  }

  const info = await transporter.sendMail({
    from: `"${fromName} ✦" <${fromAddress}>`,
    to, subject, html, text,
  });

  console.log(`[email] ✓ sent via SMTP to ${to} — id ${info.messageId} — server said: ${info.response}`);
  if (info.rejected?.length) {
    console.warn('[email] ⚠ server rejected recipients:', info.rejected);
  }
}

// ── Public API ─────────────────────────────────────────────────
async function sendPasswordResetEmail({ to, name, rawToken }) {
  const resetUrl = `${process.env.APP_URL}/reset-password?token=${rawToken}`;
  const subject  = 'Reset your Aurora password';
  const html     = buildResetHtml({ name, resetUrl });
  const text     = `Hi ${name || 'there'},\n\nReset your Aurora password:\n${resetUrl}\n\nExpires in 30 minutes.`;

  console.log(`[email] preparing password reset for ${to} (via ${process.env.RESEND_API_KEY ? 'Resend' : 'SMTP'})`);

  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend({ to, subject, html, text });
    } else {
      await sendViaSmtp({ to, subject, html, text });
    }
  } catch (err) {
    console.error(`[email] ✗ FAILED to send to ${to}:`, err.message);
    throw err; // let the route decide how to respond
  }
}

module.exports = { sendPasswordResetEmail };