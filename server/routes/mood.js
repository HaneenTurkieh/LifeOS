const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');
const { todayIso } = require('../lib/gamification');

router.get('/', async (req, res) => {
  try {
    const result = await db.execute({ sql: `SELECT * FROM moods WHERE user_id = ? ORDER BY date DESC LIMIT 90`, args: [req.user.id] });
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.get('/today', async (req, res) => {
  try {
    // Accepts an optional client-supplied local date (?date=YYYY-MM-DD),
    // same pattern as GET /dashboard. Without it this fell back to the
    // server's UTC day, which disagrees with "today" for any user east
    // of UTC for the first few hours after their local midnight — the
    // corner buddy would then show yesterday's mood as if it were
    // today's. Falls back to server UTC date only if the client didn't
    // send one (e.g. a direct API call).
    const today = req.query.date || todayIso();
    const result = await db.execute({ sql: `SELECT * FROM moods WHERE user_id = ? AND date = ?`, args: [req.user.id, today] });
    res.json(result.rows[0] || null);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/', async (req, res) => {
  try {
    const { mood, note = '', date } = req.body;
    // Use client-sent date if provided, fall back to UTC
    const today = date || new Date().toISOString().slice(0, 10);
    await db.execute({
      sql:  `INSERT INTO moods (user_id, date, mood, note)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(user_id, date)
             DO UPDATE SET mood=excluded.mood, note=excluded.note`,
      args: [req.user.id, today, mood, note],
    });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;