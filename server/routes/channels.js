// routes/channels.js — Instructor/Student classroom system.
//
// A channel is one instructor's "class". Students join with a short
// join_code (shared directly or emailed via POST /:id/invite). The
// channel is read-only for students: only the owning instructor can
// post to channel_messages (POST /:id/messages) or assign work
// (POST /:id/assign-task, /:id/assign-goal) — every route that writes
// checks `channel.instructor_id === req.user.id` before doing anything,
// and channel_id in the URL is always joined against that ownership
// check, never trusted on its own.
//
// Assigned tasks/goals are plain rows in the existing tasks/goals
// tables (see assigned_by/channel_id columns, added via migration in
// db/connection.js) — they show up in a student's normal Tasks/
// Calendar/Goals pages automatically, no separate "assignments" UI
// needed on the student side beyond the channel's own announcement feed.
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { db }             = require('../db/connection');
const { sendChannelInviteEmail } = require('../lib/email');
const { buildDedupeKey } = require('../lib/notificationDedupe');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Unambiguous alphabet — no 0/O/1/I — since this gets typed in by hand.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode(len = 6) {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return out;
}
async function generateUniqueCode() {
  for (let i = 0; i < 20; i++) {
    const code = randomCode();
    const existing = await db.execute({ sql: `SELECT id FROM channels WHERE join_code = ?`, args: [code] });
    if (!existing.rows[0]) return code;
  }
  throw new Error('Could not generate a unique join code');
}

// The shared JWT payload (see lib/auth.js signToken) only ever carried
// {id, name, email} — role wasn't a concept when that was written, and
// changing that shared shape would touch every other authenticated
// route in the app. Loading it fresh here, scoped to just this router,
// is a one-extra-query cost on an infrequently-hit set of routes rather
// than a change with app-wide blast radius.
router.use(async (req, res, next) => {
  try {
    const row = (await db.execute({
      sql: `SELECT role FROM users WHERE id = ?`, args: [req.user.id],
    })).rows[0];
    req.user.role = row?.role || 'student';
    next();
  } catch (err) { console.error('channels role lookup error:', err); res.status(500).json({ error: 'Database error' }); }
});

function requireInstructor(req, res, next) {
  if (req.user.role !== 'instructor') return res.status(403).json({ error: 'Instructor account required' });
  next();
}

// Loads a channel and 403s unless the caller is its owning instructor.
// Used by every write route below.
async function loadOwnedChannel(req, res) {
  const channel = (await db.execute({
    sql: `SELECT * FROM channels WHERE id = ?`, args: [req.params.id],
  })).rows[0];
  if (!channel) { res.status(404).json({ error: 'Channel not found' }); return null; }
  if (channel.instructor_id !== req.user.id) { res.status(403).json({ error: 'Not your channel' }); return null; }
  return channel;
}

// ── POST / — create a channel (instructor only) ────────────────
router.post('/', requireInstructor, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Channel name is required' });
    const join_code = await generateUniqueCode();
    const insert = await db.execute({
      sql:  `INSERT INTO channels (instructor_id, name, join_code) VALUES (?, ?, ?)`,
      args: [req.user.id, name.trim().slice(0, 120), join_code],
    });
    const channel = (await db.execute({
      sql: `SELECT * FROM channels WHERE id = ?`, args: [Number(insert.lastInsertRowid)],
    })).rows[0];
    res.status(201).json(channel);
  } catch (err) { console.error('POST /channels error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── GET /mine — role-aware list ─────────────────────────────────
router.get('/mine', async (req, res) => {
  try {
    if (req.user.role === 'instructor') {
      const rows = (await db.execute({
        sql:  `SELECT c.*, (SELECT COUNT(*) FROM channel_members m WHERE m.channel_id = c.id) AS member_count
               FROM channels c WHERE c.instructor_id = ? ORDER BY c.created_at DESC`,
        args: [req.user.id],
      })).rows;
      return res.json(rows);
    }
    const rows = (await db.execute({
      sql:  `SELECT c.*, u.name AS instructor_name
             FROM channels c
             JOIN channel_members m ON m.channel_id = c.id
             JOIN users u ON u.id = c.instructor_id
             WHERE m.student_id = ? ORDER BY m.joined_at DESC`,
      args: [req.user.id],
    })).rows;
    res.json(rows);
  } catch (err) { console.error('GET /channels/mine error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── POST /join — student enters a code ──────────────────────────
router.post('/join', async (req, res) => {
  try {
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Join code is required' });
    const channel = (await db.execute({
      sql: `SELECT * FROM channels WHERE join_code = ?`, args: [code],
    })).rows[0];
    if (!channel) return res.status(404).json({ error: 'Invalid or expired join code' });
    if (channel.instructor_id === req.user.id) return res.status(400).json({ error: "You can't join your own channel" });
    await db.execute({
      sql:  `INSERT INTO channel_members (channel_id, student_id) VALUES (?, ?)
             ON CONFLICT(channel_id, student_id) DO NOTHING`,
      args: [channel.id, req.user.id],
    });
    res.status(201).json(channel);
  } catch (err) { console.error('POST /channels/join error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── GET /:id — detail (owner OR member) ─────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const channel = (await db.execute({
      sql: `SELECT * FROM channels WHERE id = ?`, args: [req.params.id],
    })).rows[0];
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const isOwner = channel.instructor_id === req.user.id;
    if (!isOwner) {
      const member = (await db.execute({
        sql: `SELECT 1 FROM channel_members WHERE channel_id = ? AND student_id = ?`,
        args: [channel.id, req.user.id],
      })).rows[0];
      if (!member) return res.status(403).json({ error: 'Not a member of this channel' });
    }
    let members = [];
    if (isOwner) {
      members = (await db.execute({
        sql:  `SELECT u.id, u.name, u.email, m.joined_at FROM channel_members m
               JOIN users u ON u.id = m.student_id
               WHERE m.channel_id = ? ORDER BY m.joined_at ASC`,
        args: [channel.id],
      })).rows;
    }
    res.json({ ...channel, isOwner, members });
  } catch (err) { console.error('GET /channels/:id error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── DELETE /:id — instructor only ────────────────────────────────
router.delete('/:id', requireInstructor, async (req, res) => {
  const channel = await loadOwnedChannel(req, res);
  if (!channel) return;
  try {
    await db.execute({ sql: `DELETE FROM channels WHERE id = ?`, args: [channel.id] });
    res.status(204).end();
  } catch (err) { console.error('DELETE /channels/:id error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── DELETE /:id/members/:studentId — remove a student ────────────
router.delete('/:id/members/:studentId', requireInstructor, async (req, res) => {
  const channel = await loadOwnedChannel(req, res);
  if (!channel) return;
  try {
    await db.execute({
      sql:  `DELETE FROM channel_members WHERE channel_id = ? AND student_id = ?`,
      args: [channel.id, req.params.studentId],
    });
    res.status(204).end();
  } catch (err) { console.error('DELETE /channels/:id/members error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── POST /:id/invite — email join code to a list of addresses ────
router.post('/:id/invite', requireInstructor, async (req, res) => {
  const channel = await loadOwnedChannel(req, res);
  if (!channel) return;
  try {
    const emails = Array.isArray(req.body.emails) ? req.body.emails : [];
    const valid  = emails.map((e) => String(e).trim()).filter((e) => EMAIL_RE.test(e)).slice(0, 100);
    if (!valid.length) return res.status(400).json({ error: 'At least one valid email is required' });

    let sent = 0;
    for (const to of valid) {
      try {
        await sendChannelInviteEmail({ to, channelName: channel.name, joinCode: channel.join_code, instructorName: req.user.name });
        sent++;
      } catch (e) { console.error(`Channel invite to ${to} failed:`, e.message); }
    }
    res.json({ sent, total: valid.length });
  } catch (err) { console.error('POST /channels/:id/invite error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── GET /:id/messages — owner OR member ───────────────────────────
router.get('/:id/messages', async (req, res) => {
  try {
    const channel = (await db.execute({
      sql: `SELECT * FROM channels WHERE id = ?`, args: [req.params.id],
    })).rows[0];
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const isOwner = channel.instructor_id === req.user.id;
    if (!isOwner) {
      const member = (await db.execute({
        sql: `SELECT 1 FROM channel_members WHERE channel_id = ? AND student_id = ?`,
        args: [channel.id, req.user.id],
      })).rows[0];
      if (!member) return res.status(403).json({ error: 'Not a member of this channel' });
    }
    const rows = (await db.execute({
      sql:  `SELECT cm.*, u.name AS sender_name FROM channel_messages cm
             JOIN users u ON u.id = cm.sender_id
             WHERE cm.channel_id = ? ORDER BY cm.created_at DESC LIMIT 100`,
      args: [channel.id],
    })).rows;
    res.json(rows);
  } catch (err) { console.error('GET /channels/:id/messages error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── POST /:id/messages — instructor only (read-only channel) ─────
router.post('/:id/messages', requireInstructor, async (req, res) => {
  const channel = await loadOwnedChannel(req, res);
  if (!channel) return;
  try {
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Message cannot be empty' });
    const insert = await db.execute({
      sql:  `INSERT INTO channel_messages (channel_id, sender_id, body) VALUES (?, ?, ?)`,
      args: [channel.id, req.user.id, body.slice(0, 2000)],
    });
    const message = (await db.execute({
      sql: `SELECT cm.*, u.name AS sender_name FROM channel_messages cm JOIN users u ON u.id = cm.sender_id WHERE cm.id = ?`,
      args: [Number(insert.lastInsertRowid)],
    })).rows[0];
    res.status(201).json(message);
  } catch (err) { console.error('POST /channels/:id/messages error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── POST /:id/assign-task — fan out a task to channel members ────
router.post('/:id/assign-task', requireInstructor, async (req, res) => {
  const channel = await loadOwnedChannel(req, res);
  if (!channel) return;
  try {
    const {
      title, description = '', priority = 'medium', category = 'assigned',
      deadline = null, deadline_time = null, targetStudentIds = null,
    } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const members = (await db.execute({
      sql: `SELECT student_id FROM channel_members WHERE channel_id = ?`, args: [channel.id],
    })).rows;
    const targetIds = Array.isArray(targetStudentIds) && targetStudentIds.length
      ? members.map((m) => m.student_id).filter((id) => targetStudentIds.includes(id))
      : members.map((m) => m.student_id);
    if (!targetIds.length) return res.status(400).json({ error: 'This channel has no students to assign to yet' });

    for (const studentId of targetIds) {
      const maxPos = await db.execute({
        sql:  `SELECT COALESCE(MAX(position), -1) m FROM tasks WHERE user_id = ? AND status = 'todo'`,
        args: [studentId],
      });
      await db.execute({
        sql:  `INSERT INTO tasks
                 (user_id, title, description, priority, category, deadline, deadline_time,
                  status, progress, position, assigned_by, channel_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'todo', 0, ?, ?, ?)`,
        args: [
          studentId, title.trim(), description, priority, category,
          deadline || null, deadline_time || null,
          Number(maxPos.rows[0].m) + 1, req.user.id, channel.id,
        ],
      });
    }
    res.status(201).json({ assigned: targetIds.length });
  } catch (err) { console.error('POST /channels/:id/assign-task error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── POST /:id/assign-goal — fan out a goal to channel members ────
router.post('/:id/assign-goal', requireInstructor, async (req, res) => {
  const channel = await loadOwnedChannel(req, res);
  if (!channel) return;
  try {
    const { title, description = '', category = 'assigned', target_date = null, targetStudentIds = null } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const members = (await db.execute({
      sql: `SELECT student_id FROM channel_members WHERE channel_id = ?`, args: [channel.id],
    })).rows;
    const targetIds = Array.isArray(targetStudentIds) && targetStudentIds.length
      ? members.map((m) => m.student_id).filter((id) => targetStudentIds.includes(id))
      : members.map((m) => m.student_id);
    if (!targetIds.length) return res.status(400).json({ error: 'This channel has no students to assign to yet' });

    for (const studentId of targetIds) {
      await db.execute({
        sql:  `INSERT INTO goals (user_id, title, description, category, target_date, assigned_by, channel_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [studentId, title.trim(), description, category, target_date || null, req.user.id, channel.id],
      });
    }
    res.status(201).json({ assigned: targetIds.length });
  } catch (err) { console.error('POST /channels/:id/assign-goal error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── POST /:id/invite-to-room — notify members about a Flow Room ──
// Doesn't touch the realtime Focus Room system at all — a student still
// joins the room the normal way (types the code on /learning). This
// just puts a notification in front of every channel member with the
// code already in hand, and drops each of their own rankings on the
// room's existing leaderboard once they do (no separate "channel
// rankings" concept needed — the room's own member list already is one).
router.post('/:id/invite-to-room', requireInstructor, async (req, res) => {
  const channel = await loadOwnedChannel(req, res);
  if (!channel) return;
  try {
    const roomCode = String(req.body.roomCode || '').trim().toUpperCase();
    if (!roomCode) return res.status(400).json({ error: 'Flow Room code is required' });

    const members = (await db.execute({
      sql: `SELECT student_id FROM channel_members WHERE channel_id = ?`, args: [channel.id],
    })).rows;
    const link = `/learning?room=${roomCode}`;
    const dedupeKey = buildDedupeKey('channel_room_invite', link, new Date().toISOString().slice(0, 10));
    for (const { student_id } of members) {
      await db.execute({
        sql:  `INSERT INTO notifications (user_id, type, title, body, link, dedupe_key, data)
               VALUES (?, 'channel_room_invite', ?, ?, ?, ?, ?)
               ON CONFLICT(user_id, dedupe_key) DO NOTHING`,
        args: [
          student_id,
          `${req.user.name} invited you to a Flow Room`,
          `Join "${channel.name}" for a focus session — room code ${roomCode}`,
          link, dedupeKey,
          JSON.stringify({ channelName: channel.name, roomCode, instructorName: req.user.name }),
        ],
      });
    }
    res.json({ notified: members.length, roomCode });
  } catch (err) { console.error('POST /channels/:id/invite-to-room error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── GET /:id/analytics — per-student task/goal/XP summary ────────
router.get('/:id/analytics', requireInstructor, async (req, res) => {
  const channel = await loadOwnedChannel(req, res);
  if (!channel) return;
  try {
    const rows = (await db.execute({
      sql: `
        SELECT
          u.id, u.name, u.email,
          (SELECT COUNT(*) FROM tasks t WHERE t.user_id = u.id AND t.channel_id = ?) AS tasks_assigned,
          (SELECT COUNT(*) FROM tasks t WHERE t.user_id = u.id AND t.channel_id = ? AND t.status = 'done') AS tasks_done,
          (SELECT COUNT(*) FROM goals g WHERE g.user_id = u.id AND g.channel_id = ?) AS goals_assigned,
          (SELECT COUNT(*) FROM goals g WHERE g.user_id = u.id AND g.channel_id = ? AND g.status = 'completed') AS goals_done,
          (SELECT COALESCE(SUM(amount), 0) FROM xp_log x WHERE x.user_id = u.id) AS total_xp
        FROM channel_members m
        JOIN users u ON u.id = m.student_id
        WHERE m.channel_id = ?
        ORDER BY u.name COLLATE NOCASE ASC`,
      args: [channel.id, channel.id, channel.id, channel.id, channel.id],
    })).rows;
    res.json(rows);
  } catch (err) { console.error('GET /channels/:id/analytics error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── GET /:id/export.csv — CSV fallback for the analytics table ───
// Stands in for the Google Sheets sync until real OAuth is wired up
// (see the Google Cloud Console steps Haneen was given separately) —
// same data as GET /:id/analytics, just as a downloadable file so it
// can be pasted/imported into Sheets or Excel by hand today.
router.get('/:id/export.csv', requireInstructor, async (req, res) => {
  const channel = await loadOwnedChannel(req, res);
  if (!channel) return;
  try {
    const rows = (await db.execute({
      sql: `
        SELECT
          u.name, u.email,
          (SELECT COUNT(*) FROM tasks t WHERE t.user_id = u.id AND t.channel_id = ?) AS tasks_assigned,
          (SELECT COUNT(*) FROM tasks t WHERE t.user_id = u.id AND t.channel_id = ? AND t.status = 'done') AS tasks_done,
          (SELECT COUNT(*) FROM goals g WHERE g.user_id = u.id AND g.channel_id = ?) AS goals_assigned,
          (SELECT COUNT(*) FROM goals g WHERE g.user_id = u.id AND g.channel_id = ? AND g.status = 'completed') AS goals_done
        FROM channel_members m
        JOIN users u ON u.id = m.student_id
        WHERE m.channel_id = ?
        ORDER BY u.name COLLATE NOCASE ASC`,
      args: [channel.id, channel.id, channel.id, channel.id, channel.id],
    })).rows;
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Name', 'Email', 'Tasks assigned', 'Tasks done', 'Goals assigned', 'Goals done'];
    const lines = [header.join(',')].concat(
      rows.map((r) => [r.name, r.email, r.tasks_assigned, r.tasks_done, r.goals_assigned, r.goals_done].map(esc).join(','))
    );
    const safeName = channel.name.replace(/[^a-z0-9]+/gi, '_').slice(0, 40) || 'channel';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_analytics.csv"`);
    res.send(lines.join('\n'));
  } catch (err) { console.error('GET /channels/:id/export.csv error:', err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;
