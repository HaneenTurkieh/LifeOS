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
    const result = await db.execute({ sql: `SELECT * FROM moods WHERE user_id = ? AND date = ?`, args: [req.user.id, todayIso()] });
    res.json(result.rows[0] || null);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/', async (req, res) => {
  try {
    const { mood, note = '', date = todayIso() } = req.body;
    if (!mood || mood < 1 || mood > 5) return res.status(400).json({ error: 'mood must be 1-5' });
    const existingResult = await db.execute({ sql: `SELECT * FROM moods WHERE user_id = ? AND date = ?`, args: [req.user.id, date] });
    if (existingResult.rows[0]) {
      await db.execute({ sql: `UPDATE moods SET mood = ?, note = ? WHERE user_id = ? AND date = ?`, args: [mood, note, req.user.id, date] });
    } else {
      await db.execute({ sql: `INSERT INTO moods (user_id, date, mood, note) VALUES (?, ?, ?, ?)`, args: [req.user.id, date, mood, note] });
    }
    const result = await db.execute({ sql: `SELECT * FROM moods WHERE user_id = ? AND date = ?`, args: [req.user.id, date] });
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;