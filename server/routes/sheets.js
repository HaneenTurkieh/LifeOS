// routes/sheets.js — Google account connect/disconnect for the classroom
// system's Sheets sync. The actual per-channel sync (POST
// /channels/:id/sheets/sync) lives in routes/channels.js, since it needs
// channel-ownership checks that already exist there — this file only
// handles the OAuth connect flow and connection status.
const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const googleSheets = require('../lib/googleSheets');

// Same role-lookup pattern as routes/channels.js — the shared JWT payload
// doesn't carry role (see lib/auth.js signToken), so it's loaded fresh
// here rather than widening that shared shape for every route in the app.
router.use(async (req, res, next) => {
  try {
    const row = (await db.execute({
      sql: `SELECT role FROM users WHERE id = ?`, args: [req.user.id],
    })).rows[0];
    req.user.role = row?.role || 'student';
    next();
  } catch (err) { console.error('sheets role lookup error:', err); res.status(500).json({ error: 'Database error' }); }
});

function requireInstructor(req, res, next) {
  if (req.user.role !== 'instructor') return res.status(403).json({ error: 'Instructor account required' });
  next();
}

// ── GET /auth-url — kicks off the Google consent flow ─────────────
router.get('/auth-url', requireInstructor, (req, res) => {
  if (!googleSheets.configured()) {
    return res.status(503).json({ error: 'Google Sheets is not set up on the server yet.' });
  }
  const state = String(req.query.state || '').slice(0, 200);
  if (!state) return res.status(400).json({ error: 'Missing state' });
  try {
    res.json({ url: googleSheets.buildAuthUrl(state) });
  } catch (err) { console.error('GET /sheets/auth-url error:', err); res.status(500).json({ error: err.message }); }
});

// ── POST /callback — exchanges the code Google sent back ──────────
router.post('/callback', requireInstructor, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const tokens = await googleSheets.exchangeCode(code);
    await googleSheets.saveTokens(req.user.id, tokens);
    res.json({ connected: true });
  } catch (err) {
    console.error('POST /sheets/callback error:', err);
    res.status(500).json({ error: 'Could not connect Google Sheets. Try again.' });
  }
});

// ── GET /status ─────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    res.json({ connected: await googleSheets.isConnected(req.user.id), configured: googleSheets.configured() });
  } catch (err) { console.error('GET /sheets/status error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── DELETE /disconnect ──────────────────────────────────────────
router.delete('/disconnect', requireInstructor, async (req, res) => {
  try {
    await googleSheets.disconnect(req.user.id);
    res.status(204).end();
  } catch (err) { console.error('DELETE /sheets/disconnect error:', err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;
