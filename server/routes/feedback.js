const express = require('express');
const router = express.Router();
const { Resend } = require('resend');
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

router.post('/', async (req, res) => {
  const { email, message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });
  const userEmail = email || req.user?.email || 'not provided';

  if (!resend) {
    console.log(`[DEV] Feedback from ${userEmail}: ${message}`);
    return res.json({ ok: true });
  }
  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Aurora <no-reply@aurora.app>',
    to: 'haneenturkieh@hotmail.com',
    subject: 'Aurora feedback',
    html: `<p><strong>From:</strong> ${userEmail}</p><p>${message.replace(/</g, '&lt;')}</p>`,
  });
  res.json({ ok: true });
});

module.exports = router;