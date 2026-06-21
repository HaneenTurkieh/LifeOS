// lib/email.js
// Wraps the Resend API for transactional email. Requires RESEND_API_KEY,
// EMAIL_FROM, and APP_URL in server/.env (see .env.example).

const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function resetPasswordHtml({ name, resetUrl }) {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6fb;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 32px rgba(76,70,150,0.12);">
            <tr>
              <td style="background:linear-gradient(135deg,#7C6AF0,#5B47E0);padding:32px 40px;text-align:center;">
                <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:16px;background:rgba(255,255,255,0.2);margin-bottom:12px;">
                  <span style="font-size:28px;">🌳</span>
                </div>
                <p style="margin:0;color:#ffffff;font-weight:700;letter-spacing:3px;font-size:14px;">AURORA</p>
              </td>
            </tr>
            <tr>
              <td style="padding:40px;">
                <h1 style="margin:0 0 8px;font-size:20px;color:#1E2233;">Reset your password</h1>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5b5f70;">
                  Hi ${name ? escapeHtml(name) : 'there'}, we received a request to reset the password for your Aurora account.
                  This link will expire in <strong>30 minutes</strong>.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                  <tr>
                    <td style="border-radius:16px;background:linear-gradient(135deg,#7C6AF0,#5B47E0);">
                      <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:16px;">
                        Reset Password
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#9499a8;">
                  If the button doesn't work, copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 24px;font-size:12px;line-height:1.6;color:#7C6AF0;word-break:break-all;">
                  ${resetUrl}
                </p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#9499a8;">
                  Didn't request this? You can safely ignore this email — your password won't be changed.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;font-size:11px;color:#9499a8;">© ${new Date().getFullYear()} Aurora. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function sendPasswordResetEmail({ to, name, rawToken }) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

  if (!resend) {
    // Dev fallback: no RESEND_API_KEY set — log the link instead of
    // sending, so local development still works end-to-end.
    console.log(`\n📧 [DEV] Password reset link for ${to}:\n   ${resetUrl}\n`);
    return;
  }

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Aurora <no-reply@aurora.app>',
    to,
    subject: 'Reset your Aurora password',
    html: resetPasswordHtml({ name, resetUrl }),
  });
}

module.exports = { sendPasswordResetEmail };