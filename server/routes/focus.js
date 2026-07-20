const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const { hashPassword, comparePassword } = require('../lib/auth');
const crypto  = require('crypto');

// Current week's Sunday (UTC) as YYYY-MM-DD
function getWeekStart() {
  const now  = new Date();
  const day  = now.getUTCDay(); // 0 = Sunday
  const diff = now.getUTCDate() - day;
  const sun  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff));
  return sun.toISOString().slice(0, 10);
}

function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-char e.g. A3F92B
}

// ── Log a completed focus session ─────────────────────────────
router.post('/sessions', async (req, res) => {
  try {
    const { task_name = 'Focus Session', duration_minutes } = req.body;
    if (!duration_minutes || duration_minutes < 1)
      return res.status(400).json({ error: 'Invalid duration' });
    const week_start = getWeekStart();
    await db.execute({
      sql:  `INSERT INTO focus_sessions (user_id, task_name, duration_minutes, week_start) VALUES (?, ?, ?, ?)`,
      args: [req.user.id, task_name, duration_minutes, week_start],
    });
    // Award XP: 2 XP per 5 minutes
    const xpAmount = Math.floor(duration_minutes / 5) * 2;
    if (xpAmount > 0) {
      await db.execute({
        sql:  `INSERT INTO xp_log (user_id, amount, reason) VALUES (?, ?, ?)`,
        args: [req.user.id, xpAmount, `Focus: ${task_name}`],
      });
    }
    res.json({ ok: true, xpAwarded: xpAmount });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── My weekly stats ───────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const result = await db.execute({
      sql:  `SELECT COALESCE(SUM(duration_minutes),0) total_minutes, COUNT(*) sessions
             FROM focus_sessions WHERE user_id = ? AND week_start = ?`,
      args: [req.user.id, getWeekStart()],
    });
    const row = result.rows[0];
    res.json({ total_minutes: Number(row.total_minutes), sessions: Number(row.sessions) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── Weekly leaderboard ────────────────────────────────────────
router.get('/leaderboard', async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT u.id, u.name,
                   COALESCE(SUM(fs.duration_minutes), 0) total_minutes,
                   COUNT(fs.id) session_count
            FROM users u
            LEFT JOIN focus_sessions fs ON fs.user_id = u.id AND fs.week_start = ?
            GROUP BY u.id, u.name
            HAVING total_minutes > 0
            ORDER BY total_minutes DESC
            LIMIT 20`,
      args: [getWeekStart()],
    });
    const leaderboard = result.rows.map((r, i) => ({
      ...r,
      rank:          i + 1,
      total_minutes: Number(r.total_minutes),
      session_count: Number(r.session_count),
    }));
    res.json({ week_start: getWeekStart(), leaderboard });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── Create room ───────────────────────────────────────────────
router.post('/rooms', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name?.trim())     return res.status(400).json({ error: 'Room name is required' });
    if (!password?.trim()) return res.status(400).json({ error: 'Password is required' });
    const code          = generateCode();
    const password_hash = await hashPassword(password);
    await db.execute({
      sql:  `INSERT INTO focus_rooms (name, code, password_hash, host_id) VALUES (?, ?, ?, ?)`,
      args: [name.trim(), code, password_hash, req.user.id],
    });
    const roomRow = (await db.execute({ sql: `SELECT * FROM focus_rooms WHERE code = ?`, args: [code] })).rows[0];
    // Auto-join as host
    await db.execute({
      sql:  `INSERT INTO focus_room_members (room_id, user_id, display_name) VALUES (?, ?, ?)`,
      args: [roomRow.id, req.user.id, req.user.name],
    });
    res.json({ code, name: roomRow.name });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── Join room ─────────────────────────────────────────────────
router.post('/rooms/join', async (req, res) => {
  try {
    const { code, password } = req.body;
    if (!code?.trim())     return res.status(400).json({ error: 'Room code is required' });
    if (!password?.trim()) return res.status(400).json({ error: 'Password is required' });
    const roomRow = (await db.execute({ sql: `SELECT * FROM focus_rooms WHERE code = ?`, args: [code.toUpperCase()] })).rows[0];
    if (!roomRow) return res.status(404).json({ error: 'Room not found' });
    const valid = await comparePassword(password, roomRow.password_hash);
    if (!valid)   return res.status(401).json({ error: 'Incorrect password' });
    await db.execute({
      sql:  `INSERT INTO focus_room_members (room_id, user_id, display_name, last_seen)
             VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(room_id, user_id) DO UPDATE SET last_seen = datetime('now')`,
      args: [roomRow.id, req.user.id, req.user.name],
    });
    res.json({ code: roomRow.code, name: roomRow.name });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── Get room (polling) ────────────────────────────────────────
router.get('/rooms/:code', async (req, res) => {
  try {
    const roomRow = (await db.execute({ sql: `SELECT * FROM focus_rooms WHERE code = ?`, args: [req.params.code.toUpperCase()] })).rows[0];
    if (!roomRow) return res.status(404).json({ error: 'Room not found' });
    const members = (await db.execute({
      sql:  `SELECT user_id, display_name, focus_minutes, is_focusing
             FROM focus_room_members
             WHERE room_id = ? AND last_seen >= datetime('now', '-2 minutes')
             ORDER BY focus_minutes DESC`,
      args: [roomRow.id],
    })).rows.map((r) => ({ ...r, focus_minutes: Number(r.focus_minutes), is_focusing: Boolean(r.is_focusing) }));
    res.json({ code: roomRow.code, name: roomRow.name, members });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── Pulse (keep-alive + update focus state) ───────────────────
router.post('/rooms/:code/pulse', async (req, res) => {
  try {
    const { is_focusing = false, add_minutes = 0 } = req.body;
    const roomRow = (await db.execute({ sql: `SELECT * FROM focus_rooms WHERE code = ?`, args: [req.params.code.toUpperCase()] })).rows[0];
    if (!roomRow) return res.status(404).json({ error: 'Room not found' });
    await db.execute({
      sql:  `UPDATE focus_room_members
             SET last_seen = datetime('now'), is_focusing = ?, focus_minutes = focus_minutes + ?
             WHERE room_id = ? AND user_id = ?`,
      args: [is_focusing ? 1 : 0, add_minutes, roomRow.id, req.user.id],
    });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── Leave room ────────────────────────────────────────────────
router.delete('/rooms/:code/leave', async (req, res) => {
  try {
    const roomRow = (await db.execute({ sql: `SELECT * FROM focus_rooms WHERE code = ?`, args: [req.params.code.toUpperCase()] })).rows[0];
    if (!roomRow) return res.status(404).json({ error: 'Room not found' });
    await db.execute({ sql: `DELETE FROM focus_room_members WHERE room_id = ? AND user_id = ?`, args: [roomRow.id, req.user.id] });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;