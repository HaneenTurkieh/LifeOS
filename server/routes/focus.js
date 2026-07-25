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

async function getEquippedTree(userId) {
  try {
    const row = (await db.execute({
      sql: `SELECT tree_key FROM user_equipped_tree WHERE user_id = ?`, args: [userId],
    })).rows[0];
    return row?.tree_key || 'seedling';
  } catch (_) { return 'seedling'; }
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

    // Plant a living tree in the user's forest 🌳 (non-fatal)
    let treePlanted = null;
    try {
      const treeKey = await getEquippedTree(req.user.id);
      await db.execute({
        sql:  `INSERT INTO planted_trees (user_id, tree_key, status, task_name, duration_minutes)
               VALUES (?, ?, 'alive', ?, ?)`,
        args: [req.user.id, treeKey, task_name, duration_minutes],
      });
      treePlanted = treeKey;
    } catch (e) { console.error('plant tree failed (non-fatal):', e.message); }

    res.json({ ok: true, xpAwarded: xpAmount, treePlanted });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── Abandon a running session — the tree dies 🥀 ──────────────
router.post('/sessions/abandon', async (req, res) => {
  try {
    const { task_name = 'Focus Session', duration_minutes = 0 } = req.body;
    const treeKey = await getEquippedTree(req.user.id);
    await db.execute({
      sql:  `INSERT INTO planted_trees (user_id, tree_key, status, task_name, duration_minutes)
             VALUES (?, ?, 'dead', ?, ?)`,
      args: [req.user.id, treeKey, task_name, Math.max(0, Math.floor(duration_minutes))],
    });
    res.json({ ok: true, treeDied: treeKey });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── My forest — trees planted day by day ──────────────────────
router.get('/forest', async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT tree_key, status, task_name, duration_minutes,
                   date(planted_at) day, planted_at
            FROM planted_trees WHERE user_id = ?
            ORDER BY planted_at DESC LIMIT 300`,
      args: [req.user.id],
    });

    const days = [];
    const byDay = {};
    for (const r of result.rows) {
      if (!byDay[r.day]) { byDay[r.day] = []; days.push(r.day); }
      byDay[r.day].push({
        tree_key: r.tree_key, status: r.status,
        task_name: r.task_name, duration_minutes: Number(r.duration_minutes),
      });
    }

    const alive = result.rows.filter(r => r.status === 'alive').length;
    const dead  = result.rows.filter(r => r.status === 'dead').length;
    const today = new Date().toISOString().slice(0, 10);

    res.json({
      days: days.map(d => ({ date: d, trees: byDay[d] })),
      stats: {
        total_alive: alive, total_dead: dead,
        today_planted: (byDay[today] || []).filter(t => t.status === 'alive').length,
        total_minutes: result.rows.reduce((s, r) => s + Number(r.duration_minutes), 0),
      },
    });
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

// ── Get room (polling) — now includes host + shared timer ─────
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

    // Shared timer state (Forest-style synced pomodoro)
    let timer = null;
    try {
      const t = (await db.execute({
        sql: `SELECT started_at, duration_seconds, mode, running FROM focus_room_timer WHERE room_id = ?`,
        args: [roomRow.id],
      })).rows[0];
      if (t) {
        const elapsed = Math.floor((Date.now() - new Date(t.started_at.replace(' ', 'T') + 'Z').getTime()) / 1000);
        const remaining = Number(t.duration_seconds) - elapsed;
        timer = {
          running:          Boolean(t.running) && remaining > 0,
          started_at:       t.started_at,
          duration_seconds: Number(t.duration_seconds),
          remaining_seconds: Math.max(0, remaining),
          mode:             t.mode,
        };
      }
    } catch (_) { /* focus_room_timer may not exist yet */ }

    res.json({ code: roomRow.code, name: roomRow.name, host_id: Number(roomRow.host_id), members, timer });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── Start the shared timer (host only) ────────────────────────
router.post('/rooms/:code/timer/start', async (req, res) => {
  try {
    const { duration_minutes = 25, mode = 'focus' } = req.body;
    const roomRow = (await db.execute({ sql: `SELECT * FROM focus_rooms WHERE code = ?`, args: [req.params.code.toUpperCase()] })).rows[0];
    if (!roomRow) return res.status(404).json({ error: 'Room not found' });
    if (Number(roomRow.host_id) !== Number(req.user.id))
      return res.status(403).json({ error: 'Only the host can start the shared timer' });

    await db.execute({
      sql: `INSERT INTO focus_room_timer (room_id, started_at, duration_seconds, mode, running)
            VALUES (?, datetime('now'), ?, ?, 1)
            ON CONFLICT(room_id) DO UPDATE SET
              started_at = datetime('now'), duration_seconds = excluded.duration_seconds,
              mode = excluded.mode, running = 1`,
      args: [roomRow.id, Math.round(duration_minutes * 60), mode],
    });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── Stop the shared timer (host only) ─────────────────────────
router.post('/rooms/:code/timer/stop', async (req, res) => {
  try {
    const roomRow = (await db.execute({ sql: `SELECT * FROM focus_rooms WHERE code = ?`, args: [req.params.code.toUpperCase()] })).rows[0];
    if (!roomRow) return res.status(404).json({ error: 'Room not found' });
    if (Number(roomRow.host_id) !== Number(req.user.id))
      return res.status(403).json({ error: 'Only the host can stop the shared timer' });

    await db.execute({ sql: `UPDATE focus_room_timer SET running = 0 WHERE room_id = ?`, args: [roomRow.id] });
    res.json({ ok: true });
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

// ═══════════════════════════════════════════════════════════════
// Premium — UI-only tier for now (no payments). Backend flag +
// Duolingo-style streak freeze. Requires user_premium table.
// ═══════════════════════════════════════════════════════════════

async function getPremium(userId) {
  const row = (await db.execute({
    sql: `SELECT is_premium, freeze_date FROM user_premium WHERE user_id = ?`, args: [userId],
  })).rows[0];
  return { is_premium: Boolean(row?.is_premium), freeze_date: row?.freeze_date || null };
}

router.get('/premium/status', async (req, res) => {
  try { res.json(await getPremium(req.user.id)); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/premium/toggle', async (req, res) => {
  try {
    const current = await getPremium(req.user.id);
    const next = current.is_premium ? 0 : 1;
    await db.execute({
      sql: `INSERT INTO user_premium (user_id, is_premium) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET is_premium = excluded.is_premium`,
      args: [req.user.id, next],
    });
    res.json(await getPremium(req.user.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/premium/pause', async (req, res) => {
  try {
    const current = await getPremium(req.user.id);
    if (!current.is_premium)
      return res.status(403).json({ error: 'Streak pause is a Premium feature' });

    const today = new Date().toISOString().slice(0, 10);
    await db.execute({
      sql: `INSERT INTO user_premium (user_id, is_premium, freeze_date) VALUES (?, 1, ?)
            ON CONFLICT(user_id) DO UPDATE SET freeze_date = excluded.freeze_date`,
      args: [req.user.id, today],
    });
    res.json({ ok: true, freeze_date: today });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;