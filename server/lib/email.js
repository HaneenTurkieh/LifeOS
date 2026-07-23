const nodemailer = require('nodemailer');

// ── Transporter — works with Gmail, Outlook, Yahoo, any SMTP ──
function createTransporter() {
  // Auto-detect provider from EMAIL_USER if no host set
  const host = process.env.EMAIL_SMTP_HOST || detectHost(process.env.EMAIL_USER);
  
  return nodemailer.createTransport({
    host,
    port:   Number(process.env.EMAIL_SMTP_PORT) || 587,
    secure: Number(process.env.EMAIL_SMTP_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
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
  return 'smtp.gmail.com'; // fallback
}

async function sendPasswordResetEmail({ to, name, rawToken }) {
  const resetUrl    = `${process.env.APP_URL}/reset-password?token=${rawToken}`;
  const fromName    = process.env.EMAIL_FROM_NAME || 'Aurora';
  const fromAddress = process.env.EMAIL_USER;

  const transporter = createTransporter();

  await transporter.sendMail({
    from:    `"${fromName} ✦" <${fromAddress}>`,
    to,
    subject: 'Reset your Aurora password',
    html: `
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
            <div style="font-size:32px;margin-bottom:8px">✦</div>
            <div style="color:white;font-size:22px;font-weight:700">Aurora</div>
            <div style="color:rgba(255,255,255,0.65);font-size:13px;margin-top:4px">Your personal life OS</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827">Reset your password</h1>
            <p style="margin:0 0 24px;font-size:14px;color:#6B7280;line-height:1.6">
              Hi ${name || 'there'} 👋 We received a request to reset your Aurora password.
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
                    Reset my password →
                  </a>
                </td>
              </tr>
            </table>
            <div style="background:#F9FAFB;border-radius:12px;padding:16px;margin-bottom:24px">
              <p style="margin:0;font-size:13px;color:#6B7280">
                ⏱ This link expires in <strong>30 minutes</strong>.
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
              © ${new Date().getFullYear()} Aurora · Built with ✦
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `Hi ${name || 'there'},\n\nReset your Aurora password:\n${resetUrl}\n\nExpires in 30 minutes.`,
  });
}

module.exports = { sendPasswordResetEmail };