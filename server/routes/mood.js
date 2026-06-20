// routes/mood.js — mounted behind `authenticate`.
const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { todayIso } = require('../lib/gamification');

router.get('/', (req, res) => {
  res.json(db.prepare(`SELECT * FROM moods WHERE user_id = ? ORDER BY date DESC LIMIT 90`).all(req.user.id));
});

router.get('/today', (req, res) => {
  const mood = db.prepare(`SELECT * FROM moods WHERE user_id = ? AND date = ?`).get(req.user.id, todayIso());
  res.json(mood || null);
});

// Upsert today's mood (or any explicit date passed in).
router.post('/', (req, res) => {
  const { mood, note = '', date = todayIso() } = req.body;
  if (!mood || mood < 1 || mood > 5) return res.status(400).json({ error: 'mood must be 1-5' });
  const existing = db.prepare(`SELECT * FROM moods WHERE user_id = ? AND date = ?`).get(req.user.id, date);
  if (existing) {
    db.prepare(`UPDATE moods SET mood = ?, note = ? WHERE user_id = ? AND date = ?`).run(mood, note, req.user.id, date);
  } else {
    db.prepare(`INSERT INTO moods (user_id, date, mood, note) VALUES (?, ?, ?, ?)`).run(req.user.id, date, mood, note);
  }
  res.json(db.prepare(`SELECT * FROM moods WHERE user_id = ? AND date = ?`).get(req.user.id, date));
});

module.exports = router;