const express = require('express');
const router  = express.Router();
const { sendFeedbackEmail } = require('../lib/email.js');

router.post('/', async (req, res) => {
  const { email, message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });
  const userEmail = email || req.user?.email || 'not provided';
  try {
    await sendFeedbackEmail({ userEmail, message: message.trim() });
    res.json({ ok: true });
  } catch (err) {
    console.error('[feedback] failed to send:', err.message);
    // Still log it so nothing is truly lost even if every email path fails
    console.log(`[feedback fallback log] From ${userEmail}: ${message.trim()}`);
    res.status(500).json({ error: 'Could not send feedback right now. Please try again.' });
  }
});

module.exports = router;