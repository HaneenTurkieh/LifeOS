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
const { hashPassword }   = require('../lib/auth');
const googleSheets = require('../lib/googleSheets');

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
    const failed = [];
    for (const to of valid) {
      try {
        await sendChannelInviteEmail({ to, channelName: channel.name, joinCode: channel.join_code, instructorName: req.user.name });
        sent++;
      } catch (e) { console.error(`Channel invite to ${to} failed:`, e.message); failed.push(to); }
    }
    res.json({ sent, total: valid.length, failed });
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
// Also drops a real bell notification for every current member — an
// announcement that only ever showed up if someone happened to reopen
// the channel wasn't actually "announcing" anything.
router.post('/:id/messages', requireInstructor, async (req, res) => {
  const channel = await loadOwnedChannel(req, res);
  if (!channel) return;
  try {
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Message cannot be empty' });
    const eventDate = req.body.event_date || null;
    const eventTime = eventDate ? (req.body.event_time || null) : null; // time only means anything alongside a date
    const insert = await db.execute({
      sql:  `INSERT INTO channel_messages (channel_id, sender_id, body, event_date, event_time) VALUES (?, ?, ?, ?, ?)`,
      args: [channel.id, req.user.id, body.slice(0, 2000), eventDate, eventTime],
    });
    const messageId = Number(insert.lastInsertRowid);
    const message = (await db.execute({
      sql: `SELECT cm.*, u.name AS sender_name FROM channel_messages cm JOIN users u ON u.id = cm.sender_id WHERE cm.id = ?`,
      args: [messageId],
    })).rows[0];

    const members = (await db.execute({
      sql: `SELECT student_id FROM channel_members WHERE channel_id = ?`, args: [channel.id],
    })).rows;
    // dedupe_key includes the message's own id, not just channel+type —
    // reusing buildDedupeKey's generic `${type}:${link}` shape here would
    // collide every subsequent announcement in the same channel onto the
    // first one's key (ON CONFLICT DO NOTHING would silently swallow it).
    const dedupeKey = `channel_announcement:msg${messageId}`;
    for (const { student_id } of members) {
      await db.execute({
        sql:  `INSERT INTO notifications (user_id, type, title, body, link, dedupe_key, data)
               VALUES (?, 'channel_announcement', ?, ?, '/channels', ?, ?)
               ON CONFLICT(user_id, dedupe_key) DO NOTHING`,
        args: [
          student_id, `${channel.name}: new announcement`, body.slice(0, 200), dedupeKey,
          JSON.stringify({ channelName: channel.name, eventDate, eventTime }),
        ],
      });
    }

    res.status(201).json(message);
  } catch (err) { console.error('POST /channels/:id/messages error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── Chat: real two-way messaging, one thread per (channel, student) ──
// Distinct from channel_messages (the read-only broadcast feed) — every
// route below checks the caller is either the channel's own instructor,
// or the exact student the thread belongs to (never any other student).
async function authorizeThread(req, res) {
  const channel = (await db.execute({
    sql: `SELECT * FROM channels WHERE id = ?`, args: [req.params.id],
  })).rows[0];
  if (!channel) { res.status(404).json({ error: 'Channel not found' }); return null; }
  const studentId = Number(req.params.studentId);
  const isOwner = channel.instructor_id === req.user.id;
  const isSelf  = req.user.id === studentId;
  if (!isOwner && !isSelf) { res.status(403).json({ error: 'Not authorized' }); return null; }
  if (isSelf) {
    const member = (await db.execute({
      sql: `SELECT 1 FROM channel_members WHERE channel_id = ? AND student_id = ?`,
      args: [channel.id, studentId],
    })).rows[0];
    if (!member) { res.status(403).json({ error: 'Not a member of this channel' }); return null; }
  }
  return { channel, studentId, isOwner };
}

router.get('/:id/chat/:studentId', async (req, res) => {
  const ctx = await authorizeThread(req, res);
  if (!ctx) return;
  try {
    const rows = (await db.execute({
      sql: `SELECT * FROM channel_chat_messages WHERE channel_id = ? AND student_id = ? ORDER BY created_at ASC LIMIT 300`,
      args: [ctx.channel.id, ctx.studentId],
    })).rows;
    res.json(rows);
  } catch (err) { console.error('GET /channels/:id/chat error:', err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/:id/chat/:studentId', async (req, res) => {
  const ctx = await authorizeThread(req, res);
  if (!ctx) return;
  try {
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Message cannot be empty' });
    const senderRole = ctx.isOwner ? 'instructor' : 'student';
    const insert = await db.execute({
      sql:  `INSERT INTO channel_chat_messages (channel_id, student_id, sender_id, sender_role, body)
             VALUES (?, ?, ?, ?, ?)`,
      args: [ctx.channel.id, ctx.studentId, req.user.id, senderRole, body.slice(0, 2000)],
    });
    // Notify whichever side didn't just send it.
    const notifyUserId = ctx.isOwner ? ctx.studentId : ctx.channel.instructor_id;
    await db.execute({
      sql:  `INSERT INTO notifications (user_id, type, title, body, link, dedupe_key, data)
             VALUES (?, 'channel_chat', ?, ?, '/channels', ?, ?)`,
      args: [
        notifyUserId, `${ctx.channel.name}: new message`, body.slice(0, 200),
        `channel_chat:msg${Number(insert.lastInsertRowid)}`,
        JSON.stringify({ channelName: ctx.channel.name }),
      ],
    });
    const message = (await db.execute({
      sql: `SELECT * FROM channel_chat_messages WHERE id = ?`, args: [Number(insert.lastInsertRowid)],
    })).rows[0];
    res.status(201).json(message);
  } catch (err) { console.error('POST /channels/:id/chat error:', err); res.status(500).json({ error: 'Database error' }); }
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
      const insert = await db.execute({
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
      // Same "instructor did something → student gets a bell + is queued
      // for the next email/push cron tick" treatment as announcements —
      // see channel_announcement above and EMAILABLE_TYPES/PUSHABLE_TYPES.
      await db.execute({
        sql:  `INSERT INTO notifications (user_id, type, title, body, link, dedupe_key, data)
               VALUES (?, 'channel_task_assigned', ?, ?, '/tasks', ?, ?)
               ON CONFLICT(user_id, dedupe_key) DO NOTHING`,
        args: [
          studentId, `${channel.name}: new task assigned`, title.trim().slice(0, 200),
          `channel_task_assigned:task${Number(insert.lastInsertRowid)}`,
          JSON.stringify({ channelName: channel.name, instructorName: req.user.name }),
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
      const insert = await db.execute({
        sql:  `INSERT INTO goals (user_id, title, description, category, target_date, assigned_by, channel_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [studentId, title.trim(), description, category, target_date || null, req.user.id, channel.id],
      });
      await db.execute({
        sql:  `INSERT INTO notifications (user_id, type, title, body, link, dedupe_key, data)
               VALUES (?, 'channel_goal_assigned', ?, ?, '/goals', ?, ?)
               ON CONFLICT(user_id, dedupe_key) DO NOTHING`,
        args: [
          studentId, `${channel.name}: new goal assigned`, title.trim().slice(0, 200),
          `channel_goal_assigned:goal${Number(insert.lastInsertRowid)}`,
          JSON.stringify({ channelName: channel.name, instructorName: req.user.name }),
        ],
      });
    }
    res.status(201).json({ assigned: targetIds.length });
  } catch (err) { console.error('POST /channels/:id/assign-goal error:', err); res.status(500).json({ error: 'Database error' }); }
});

// ── POST /:id/invite-to-room — create a Flow Room and invite members ──
// Haneen's ask: she types a room NAME, the app generates the code (and
// a password, since focus_rooms.password_hash is NOT NULL — see
// db/connection.js) rather than her having to first go create a room on
// /learning by hand and paste its code back in here. The instructor is
// auto-joined as host (same insert POST /focus/rooms itself does), and
// every member gets a notification carrying both the code and the
// plaintext password (never stored anywhere but this one row's `data`
// and `body` — the room table only ever keeps the hash) — that's the
// only place a student can get the password from, since there's no
// "share password" UI anywhere else. Registered in EMAILABLE_TYPES/
// PUSHABLE_TYPES (see lib/emailReminders.js, lib/pushReminders.js) so
// this also reaches mail and web push, not just the in-app bell.
router.post('/:id/invite-to-room', requireInstructor, async (req, res) => {
  const channel = await loadOwnedChannel(req, res);
  if (!channel) return;
  try {
    const roomName = String(req.body.roomName || '').trim().slice(0, 80);
    if (!roomName) return res.status(400).json({ error: 'Room name is required' });

    const code     = randomCode(6);
    const password = randomCode(8);
    const password_hash = await hashPassword(password);
    const roomInsert = await db.execute({
      sql:  `INSERT INTO focus_rooms (name, code, password_hash, host_id) VALUES (?, ?, ?, ?)`,
      args: [roomName, code, password_hash, req.user.id],
    });
    await db.execute({
      sql:  `INSERT INTO focus_room_members (room_id, user_id, display_name) VALUES (?, ?, ?)
             ON CONFLICT(room_id, user_id) DO NOTHING`,
      args: [Number(roomInsert.lastInsertRowid), req.user.id, req.user.name],
    });

    const members = (await db.execute({
      sql: `SELECT u.id AS student_id, u.name AS student_name
            FROM channel_members m JOIN users u ON u.id = m.student_id
            WHERE m.channel_id = ?`,
      args: [channel.id],
    })).rows;
    const link = `/learning?room=${code}`;
    // Keyed on the code, not date+link like the old version — every
    // invite here creates a brand-new room with a brand-new code, so
    // there's nothing to dedupe against; this key just has to be unique
    // per call, which the fresh code already guarantees.
    const dedupeKey = `channel_room_invite:${code}`;
    for (const { student_id, student_name } of members) {
      // Auto-join every invited student the same way the host gets
      // auto-joined above — otherwise "sends them to your students
      // automatically" is a lie: they'd have to dig the password back out
      // of the notification body and manually type it into the join
      // form, and until they do the room never shows up in their "My
      // Rooms" list at all (Haneen hit exactly this: "i cant see the
      // room the instructor created"). The password is still included
      // in the notification body below for anyone who leaves and wants
      // to rejoin, or wants to forward the code to someone outside the
      // channel.
      await db.execute({
        sql:  `INSERT INTO focus_room_members (room_id, user_id, display_name) VALUES (?, ?, ?)
               ON CONFLICT(room_id, user_id) DO NOTHING`,
        args: [Number(roomInsert.lastInsertRowid), student_id, student_name],
      });
      await db.execute({
        sql:  `INSERT INTO notifications (user_id, type, title, body, link, dedupe_key, data)
               VALUES (?, 'channel_room_invite', ?, ?, ?, ?, ?)
               ON CONFLICT(user_id, dedupe_key) DO NOTHING`,
        args: [
          student_id,
          `${req.user.name} invited you to a Flow Room`,
          `Join "${roomName}" for a focus session — code ${code}, password ${password}`,
          link, dedupeKey,
          JSON.stringify({ channelName: channel.name, roomName, code, password, instructorName: req.user.name }),
        ],
      });
    }
    res.json({ notified: members.length, roomName, code, password });
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

// ── POST /:id/sheets/sync — push analytics into a real Google Sheet ──
// First sync for a channel creates a spreadsheet (titled after the
// channel) and remembers its id on channels.sheets_spreadsheet_id;
// every sync after that overwrites the same sheet's data range, so
// re-running it is just "refresh the numbers," not a growing pile of
// duplicate sheets. Falls back cleanly to a clear error if the
// instructor hasn't connected Google yet (see routes/sheets.js) — CSV
// export (GET /:id/export.csv) keeps working regardless either way.
router.post('/:id/sheets/sync', requireInstructor, async (req, res) => {
  const channel = await loadOwnedChannel(req, res);
  if (!channel) return;
  try {
    const accessToken = await googleSheets.getValidAccessToken(req.user.id);
    if (!accessToken) {
      return res.status(400).json({ error: 'Connect Google Sheets first.', code: 'NOT_CONNECTED' });
    }

    const rows = (await db.execute({
      sql: `
        SELECT
          u.name, u.email,
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

    let spreadsheetId = channel.sheets_spreadsheet_id;
    if (!spreadsheetId) {
      spreadsheetId = await googleSheets.createSpreadsheet(accessToken, `Nuvora — ${channel.name}`);
      await db.execute({
        sql: `UPDATE channels SET sheets_spreadsheet_id = ? WHERE id = ?`,
        args: [spreadsheetId, channel.id],
      });
    }

    const header = ['Name', 'Email', 'Tasks assigned', 'Tasks done', 'Goals assigned', 'Goals done', 'Total XP', 'Last synced'];
    const values = [header].concat(rows.map((r) => [
      r.name, r.email, r.tasks_assigned, r.tasks_done, r.goals_assigned, r.goals_done, r.total_xp,
      new Date().toLocaleString(),
    ]));
    await googleSheets.writeValues(accessToken, spreadsheetId, values);

    res.json({ spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` });
  } catch (err) {
    console.error('POST /channels/:id/sheets/sync error:', err);
    res.status(500).json({ error: err.message || 'Sync failed' });
  }
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
