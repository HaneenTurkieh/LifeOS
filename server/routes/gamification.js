const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');
const { getLevelInfo, getOverallStreak, getTreeStage, evaluateAchievements, addXp } = require('../lib/gamification');
const { isTodayBirthday } = require('../lib/birthday');

const BIRTHDAY_XP = 100;

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    await evaluateAchievements(userId); // needs gamification.js migrated
    const result = await db.execute({
      sql: `SELECT a.key, a.title, a.description, a.icon, ua.unlocked_at
            FROM achievements a
            LEFT JOIN user_achievements ua ON ua.key = a.key AND ua.user_id = ?
            ORDER BY (ua.unlocked_at IS NULL), ua.unlocked_at DESC`,
      args: [userId],
    });
    res.json({
      ...await getLevelInfo(userId),
      streak:    await getOverallStreak(userId),
      treeStage: await getTreeStage(userId),
      achievements: result.rows,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── POST /gamification/birthday-claim ──────────────────────────
// One-time (per calendar year) 100 XP gift, claimed by the client the
// moment the birthday popup shows. Dedup lives in xp_log itself — the
// reason string is stamped with the year, so a second claim attempt
// (another tab, a refresh, next year) is either a safe no-op or a
// legitimate fresh gift.
router.post('/birthday-claim', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRow = (await db.execute({
      sql: `SELECT birthday FROM users WHERE id = ?`, args: [userId],
    })).rows[0];
    const birthday   = userRow?.birthday;
    const clientDate = req.body?.client_date;
    if (!birthday) return res.status(400).json({ error: 'No birthday on file' });
    if (!isTodayBirthday(birthday, clientDate)) {
      return res.status(400).json({ error: "It's not your birthday today" });
    }

    // Real bug that used to live here: `year` was taken straight from the
    // client-supplied `client_date` and used as the dedupe key below — so
    // a request with a fabricated client_date (real month/day, made-up
    // year) passed the isTodayBirthday check AND looked like a brand new,
    // never-claimed year every time, farming +100 XP with no real limit.
    // client_date is only trustworthy for the month/day comparison above
    // (that's the whole point of it — a browser a few hours ahead of this
    // server near midnight); which *year* it is is never something the
    // client needs to tell the server, so the dedupe key always uses the
    // server's own clock, unattacker-controlled.
    const year   = new Date().getFullYear();
    const reason = `Birthday gift ${year}`;
    const already = (await db.execute({
      sql: `SELECT 1 FROM xp_log WHERE user_id = ? AND reason = ?`, args: [userId, reason],
    })).rows[0];
    if (already) {
      return res.json({ claimed: false, alreadyClaimed: true, xpAwarded: 0, ...await getLevelInfo(userId) });
    }

    await addXp(userId, BIRTHDAY_XP, reason);
    res.json({ claimed: true, alreadyClaimed: false, xpAwarded: BIRTHDAY_XP, ...await getLevelInfo(userId) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;