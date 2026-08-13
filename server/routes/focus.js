const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const { hashPassword, comparePassword } = require('../lib/auth');
const { getPremium } = require('../lib/premium');
const { getLevelInfo } = require('../lib/gamification');
const { GRACE_PERIOD_DAYS } = require('../lib/usageLimits');
const { isTodayBirthday } = require('../lib/birthday');
const crypto  = require('crypto');

function getWeekStart() {
  const now  = new Date();
  const day  = now.getUTCDay();
  const diff = now.getUTCDate() - day;
  const sun  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff));
  return sun.toISOString().slice(0, 10);
}
function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}
async function getEquippedTree(userId) {
  try {
    const row = (await db.execute({
      sql: `SELECT tree_key FROM user_equipped_tree WHERE user_id = ?`, args: [userId],
    })).rows[0];
    return row?.tree_key || 'seedling';
  } catch (_) { return 'seedling'; }
}

// Birthday tree — exclusive to the day itself, not something anyone
// can buy or equip from the shop. Whatever's actually equipped gets
// swapped out for a Christmas tree just for today's sessions, then
// reverts on its own the moment the date rolls over — nothing to
// remember to switch back. Used everywhere a tree gets planted
// (solo sessions, abandoned sessions, room sessions).
async function getPlantTreeKey(userId, clientDate) {
  try {
    const row = (await db.execute({
      sql: `SELECT birthday FROM users WHERE id = ?`, args: [userId],
    })).rows[0];
    if (isTodayBirthday(row?.birthday, clientDate)) return 'christmas';
  } catch (_) {}
  return getEquippedTree(userId);
}

// Any member of a room, not just the host — a shared session becomes a
// birthday session if anyone in it is celebrating today.
async function roomHasBirthdayToday(roomId, clientDate) {
  try {
    const members = (await db.execute({
      sql: `SELECT u.birthday FROM focus_room_members frm
            JOIN users u ON u.id = frm.user_id
            WHERE frm.room_id = ?`,
      args: [roomId],
    })).rows;
    return members.some((m) => isTodayBirthday(m.birthday, clientDate));
  } catch (_) { return false; }
}

// A member's personal timer normally self-reports its own completion
// (via the pulse call below, which is how they land on the site-wide
// weekly leaderboard). But that only fires if their own device is still
// open when the countdown hits zero — a backgrounded/closed tab never
// gets the chance, so they'd silently miss out on minutes, XP, and a
// planted tree despite genuinely finishing the room's session.
//
// This is the fallback: called opportunistically from any room
// endpoint, it checks whether the room's shared timer has naturally run
// out (not stopped early — that path already kills the shared tree and
// shouldn't also hand out rewards) and, for anyone still marked
// `is_focusing` who hasn't already self-reported for *this* session
// (tracked via credited_started_at), credits them exactly the same way
// a normal solo completion would.
async function reconcileRoomSession(roomId) {
  try {
    const t = (await db.execute({
      sql: `SELECT started_at, duration_seconds, mode, running FROM focus_room_timer WHERE room_id = ?`,
      args: [roomId],
    })).rows[0];
    if (!t || t.mode !== 'focus' || !Number(t.running)) return;

    const elapsed   = Math.floor((Date.now() - new Date(t.started_at.replace(' ', 'T') + 'Z').getTime()) / 1000);
    const remaining = Number(t.duration_seconds) - elapsed;
    if (remaining > 0) return; // still in progress — nothing to reconcile yet

    const durationMinutes = Math.round(Number(t.duration_seconds) / 60);
    if (durationMinutes < 1) return;

    const stragglers = (await db.execute({
      sql: `SELECT user_id FROM focus_room_members
            WHERE room_id = ? AND is_focusing = 1
              AND (credited_started_at IS NULL OR credited_started_at != ?)`,
      args: [roomId, t.started_at],
    })).rows;

    // One check for the whole room, not per straggler — if anyone in
    // here is celebrating today, this was a birthday session for
    // everyone in it.
    const roomBday = await roomHasBirthdayToday(roomId);

    for (const m of stragglers) {
      try {
        await db.execute({
          sql:  `INSERT INTO focus_sessions (user_id, task_name, duration_minutes, week_start, task_id) VALUES (?, ?, ?, ?, NULL)`,
          args: [m.user_id, 'Room session', durationMinutes, getWeekStart()],
        });
        const xpAmount = Math.floor(durationMinutes / 5) * 2;
        if (xpAmount > 0) {
          await db.execute({
            sql:  `INSERT INTO xp_log (user_id, amount, reason) VALUES (?, ?, ?)`,
            args: [m.user_id, xpAmount, 'Focus: Room session'],
          });
        }
        const treeKey = roomBday ? 'christmas' : await getEquippedTree(m.user_id);
        await db.execute({
          sql:  `INSERT INTO planted_trees (user_id, tree_key, status, task_name, duration_minutes)
                 VALUES (?, ?, 'alive', 'Room session', ?)`,
          args: [m.user_id, treeKey, durationMinutes],
        });
        // Same reset-then-increment as the pulse handler — a straggler
        // can get credited here on the first request of a new week,
        // before the lazy-reset UPDATE in GET /rooms/:code runs, so this
        // has to carry its own week check rather than assume a fresh row.
        const weekStart = getWeekStart();
        await db.execute({
          sql:  `UPDATE focus_room_members
                 SET is_focusing = 0,
                     focus_minutes = CASE WHEN week_start = ? THEN focus_minutes + ? ELSE ? END,
                     week_start = ?, credited_started_at = ?
                 WHERE room_id = ? AND user_id = ?`,
          args: [weekStart, durationMinutes, durationMinutes, weekStart, t.started_at, roomId, m.user_id],
        });
      } catch (e) { console.error('reconcileRoomSession: member credit failed (non-fatal):', m.user_id, e.message); }
    }
  } catch (e) { console.error('reconcileRoomSession failed (non-fatal):', e.message); }
}

// ═══════════════════════════════════════════════════════════════
// Solo focus timer — server-authoritative, syncs across every
// device on the account. Mirrors the shared room timer's design:
// remaining_seconds is the exact snapshot at started_at; devices
// compute live timeLeft as remaining_seconds - elapsed while running.
// A version counter lets pollers detect remote changes cheaply
// without re-adopting their own just-pushed state.
// ═══════════════════════════════════════════════════════════════
router.get('/timer', async (req, res) => {
  try {
    const row = (await db.execute({
      sql: `SELECT * FROM focus_solo_timer WHERE user_id = ?`, args: [req.user.id],
    })).rows[0];
    if (!row) return res.json({ exists: false, version: 0 });
    res.json({
      exists:            true,
      mode:              row.mode,
      custom_min:        JSON.parse(row.custom_min || '{"focus":25,"short":5,"long":15}'),
      duration_seconds:  Number(row.duration_seconds),
      remaining_seconds: Number(row.remaining_seconds),
      started_at:        row.started_at,
      running:           Boolean(row.running),
      task_name:         row.task_name || '',
      task_id:           row.task_id != null ? Number(row.task_id) : null,
      dots:              Number(row.dots || 0),
      version:           Number(row.version),
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});
router.post('/timer/sync', async (req, res) => {
  try {
    const {
      mode = 'focus', custom_min, duration_seconds, remaining_seconds,
      started_at, running, task_name = '', task_id = null, dots = 0,
    } = req.body;
    const customMinJson = JSON.stringify(custom_min || { focus: 25, short: 5, long: 15 });
    await db.execute({
      sql: `INSERT INTO focus_solo_timer
              (user_id, mode, custom_min, duration_seconds, remaining_seconds, started_at, running, task_name, task_id, dots, version, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
            ON CONFLICT(user_id) DO UPDATE SET
              mode = excluded.mode, custom_min = excluded.custom_min,
              duration_seconds = excluded.duration_seconds, remaining_seconds = excluded.remaining_seconds,
              started_at = excluded.started_at, running = excluded.running,
              task_name = excluded.task_name, task_id = excluded.task_id, dots = excluded.dots,
              version = focus_solo_timer.version + 1, updated_at = datetime('now')`,
      args: [
        req.user.id, mode, customMinJson,
        Math.round(duration_seconds || 1500), Math.round(remaining_seconds || 0),
        started_at || null, running ? 1 : 0, task_name,
        task_id != null ? Number(task_id) : null, Math.round(dots || 0),
      ],
    });
    const row = (await db.execute({
      sql: `SELECT version FROM focus_solo_timer WHERE user_id = ?`, args: [req.user.id],
    })).rows[0];
    res.json({ ok: true, version: Number(row.version) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── Theme mode (light/dark/system) — synced like accent color,
//    but not premium-gated; every account gets this. ──────────
router.get('/theme-mode', async (req, res) => {
  try {
    const row = (await db.execute({
      sql: `SELECT theme_mode FROM user_premium WHERE user_id = ?`, args: [req.user.id],
    })).rows[0];
    res.json({ theme_mode: row?.theme_mode || 'system' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});
router.put('/theme-mode', async (req, res) => {
  try {
    const { theme_mode } = req.body;
    if (!['light', 'dark', 'system'].includes(theme_mode))
      return res.status(400).json({ error: 'Invalid theme mode' });
    await db.execute({
      sql: `INSERT INTO user_premium (user_id, theme_mode) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET theme_mode = excluded.theme_mode`,
      args: [req.user.id, theme_mode],
    });
    res.json({ ok: true, theme_mode });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});
const FONT_SCALES = ['small', 'default', 'large', 'xlarge', 'xxlarge'];
router.get('/font-scale', async (req, res) => {
  try {
    const row = (await db.execute({
      sql: `SELECT font_scale FROM user_premium WHERE user_id = ?`, args: [req.user.id],
    })).rows[0];
    res.json({ font_scale: row?.font_scale || 'default' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});
router.put('/font-scale', async (req, res) => {
  try {
    const { font_scale } = req.body;
    if (!FONT_SCALES.includes(font_scale))
      return res.status(400).json({ error: 'Invalid font scale' });
    await db.execute({
      sql: `INSERT INTO user_premium (user_id, font_scale) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET font_scale = excluded.font_scale`,
      args: [req.user.id, font_scale],
    });
    res.json({ ok: true, font_scale });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});
// Links a focus session to a real task (if task_id is given): verifies
// ownership, adds the minutes to the task's running time total, and
// returns the fresh task row so the client can show "Xm total on this
// task" and offer a one-tap "mark as done" in the completion modal.
async function logMinutesOnTask(userId, taskId, minutes) {
  if (!taskId || minutes <= 0) return null;
  const id = Number(taskId);
  if (!Number.isFinite(id)) return null;
  const existing = (await db.execute({
    sql: `SELECT id FROM tasks WHERE id = ? AND user_id = ?`, args: [id, userId],
  })).rows[0];
  if (!existing) return null; // not this user's task — ignore silently
  await db.execute({
    sql:  `UPDATE tasks SET time_spent_minutes = COALESCE(time_spent_minutes, 0) + ? WHERE id = ? AND user_id = ?`,
    args: [Math.max(0, Math.floor(minutes)), id, userId],
  });
  const row = (await db.execute({
    sql: `SELECT id, title, status, progress, time_spent_minutes FROM tasks WHERE id = ? AND user_id = ?`,
    args: [id, userId],
  })).rows[0];
  return row ? { ...row, time_spent_minutes: Number(row.time_spent_minutes) } : null;
}

router.post('/sessions', async (req, res) => {
  try {
    const { task_name = 'Focus Session', duration_minutes, task_id = null, room_code = null, client_date = null } = req.body;
    if (!duration_minutes || duration_minutes < 1)
      return res.status(400).json({ error: 'Invalid duration' });
    const week_start = getWeekStart();
    await db.execute({
      sql:  `INSERT INTO focus_sessions (user_id, task_name, duration_minutes, week_start, task_id) VALUES (?, ?, ?, ?, ?)`,
      args: [req.user.id, task_name, duration_minutes, week_start, task_id != null ? Number(task_id) : null],
    });
    const xpAmount = Math.floor(duration_minutes / 5) * 2;
    if (xpAmount > 0) {
      await db.execute({
        sql:  `INSERT INTO xp_log (user_id, amount, reason) VALUES (?, ?, ?)`,
        args: [req.user.id, xpAmount, `Focus: ${task_name}`],
      });
    }
    let treePlanted = null;
    try {
      // A room session completing on this device's own countdown lands
      // here too (not just reconcileRoomSession's straggler sweep) —
      // room_code lets it get the same "anyone in the room celebrating
      // today" treatment as the shared room tree, instead of only
      // checking this one person's own birthday.
      let treeKey = null;
      if (room_code) {
        const roomRow = (await db.execute({
          sql: `SELECT id FROM focus_rooms WHERE code = ?`, args: [String(room_code).toUpperCase()],
        })).rows[0];
        if (roomRow && await roomHasBirthdayToday(roomRow.id, client_date)) treeKey = 'christmas';
      }
      if (!treeKey) treeKey = await getPlantTreeKey(req.user.id, client_date);
      await db.execute({
        sql:  `INSERT INTO planted_trees (user_id, tree_key, status, task_name, duration_minutes, task_id)
               VALUES (?, ?, 'alive', ?, ?, ?)`,
        args: [req.user.id, treeKey, task_name, duration_minutes, task_id != null ? Number(task_id) : null],
      });
      treePlanted = treeKey;
    } catch (e) { console.error('plant tree failed (non-fatal):', e.message); }

    let task = null;
    try { task = await logMinutesOnTask(req.user.id, task_id, duration_minutes); }
    catch (e) { console.error('logMinutesOnTask failed (non-fatal):', e.message); }

    res.json({ ok: true, xpAwarded: xpAmount, treePlanted, task });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/sessions/abandon', async (req, res) => {
  try {
    const { task_name = 'Focus Session', duration_minutes = 0, task_id = null, client_date = null } = req.body;
    const treeKey = await getPlantTreeKey(req.user.id, client_date);
    await db.execute({
      sql:  `INSERT INTO planted_trees (user_id, tree_key, status, task_name, duration_minutes, task_id)
             VALUES (?, ?, 'dead', ?, ?, ?)`,
      args: [req.user.id, treeKey, task_name, Math.max(0, Math.floor(duration_minutes)), task_id != null ? Number(task_id) : null],
    });
    let task = null;
    try { task = await logMinutesOnTask(req.user.id, task_id, duration_minutes); }
    catch (e) { console.error('logMinutesOnTask failed (non-fatal):', e.message); }
    res.json({ ok: true, treeDied: treeKey, task });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.get('/forest', async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT tree_key, status, task_name, duration_minutes, planted_at
            FROM planted_trees WHERE user_id = ?
            ORDER BY planted_at DESC LIMIT 300`,
      args: [req.user.id],
    });
    // planted_at is stored via SQLite's datetime('now') — UTC. Bucketing
    // straight off date(planted_at) (UTC calendar day) meant anything
    // planted right after local midnight, in any timezone ahead of UTC,
    // still landed on UTC's previous day and showed up under "yesterday"
    // in the forest history. Shift each timestamp by the client's own
    // offset (same value JS's Date.getTimezoneOffset() reports) before
    // bucketing, so a "day" here means the same local calendar day as
    // everywhere else in the app (Dashboard, Mood, Habits).
    const offsetMin = Number(req.query.tz_offset) || 0;
    const localDay = (utcStr) => {
      const utcMs = new Date(String(utcStr).replace(' ', 'T') + 'Z').getTime();
      return new Date(utcMs - offsetMin * 60000).toISOString().slice(0, 10);
    };
    const days = [];
    const byDay = {};
    for (const r of result.rows) {
      const day = localDay(r.planted_at);
      if (!byDay[day]) { byDay[day] = []; days.push(day); }
      byDay[day].push({
        tree_key: r.tree_key, status: r.status,
        task_name: r.task_name, duration_minutes: Number(r.duration_minutes),
      });
    }
    const alive = result.rows.filter(r => r.status === 'alive').length;
    const dead  = result.rows.filter(r => r.status === 'dead').length;
    const today = new Date(Date.now() - offsetMin * 60000).toISOString().slice(0, 10);
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

router.get('/leaderboard', async (req, res) => {
  try {
    const weekStart = getWeekStart();
    const [boardResult, consistentResult, longestResult] = await Promise.all([
      db.execute({
        sql: `SELECT u.id, u.name,
                     COALESCE(SUM(fs.duration_minutes), 0) total_minutes,
                     COUNT(fs.id) session_count
              FROM users u
              LEFT JOIN focus_sessions fs ON fs.user_id = u.id AND fs.week_start = ?
              GROUP BY u.id, u.name
              HAVING total_minutes > 0
              ORDER BY total_minutes DESC
              LIMIT 20`,
        args: [weekStart],
      }),
      // Most sessions this week — a separate spotlight from raw total
      // minutes, so someone who shows up every day in short bursts gets
      // recognized too, not just whoever logged the most total time.
      db.execute({
        sql: `SELECT u.id, u.name, COUNT(fs.id) session_count
              FROM focus_sessions fs JOIN users u ON u.id = fs.user_id
              WHERE fs.week_start = ?
              GROUP BY u.id, u.name
              ORDER BY session_count DESC
              LIMIT 1`,
        args: [weekStart],
      }),
      // Longest single sitting this week.
      db.execute({
        sql: `SELECT u.id, u.name, fs.duration_minutes
              FROM focus_sessions fs JOIN users u ON u.id = fs.user_id
              WHERE fs.week_start = ?
              ORDER BY fs.duration_minutes DESC
              LIMIT 1`,
        args: [weekStart],
      }),
    ]);

    const leaderboard = boardResult.rows.map((r, i) => ({
      ...r,
      rank:          i + 1,
      total_minutes: Number(r.total_minutes),
      session_count: Number(r.session_count),
    }));

    // Multiple categories rather than one crowned "winner" — keeps this
    // encouraging for more than just whoever has the most total minutes.
    const spotlights = {
      star: leaderboard[0]
        ? { id: leaderboard[0].id, name: leaderboard[0].name, total_minutes: leaderboard[0].total_minutes }
        : null,
      consistent: consistentResult.rows[0]
        ? { id: consistentResult.rows[0].id, name: consistentResult.rows[0].name, session_count: Number(consistentResult.rows[0].session_count) }
        : null,
      longest: longestResult.rows[0]
        ? { id: longestResult.rows[0].id, name: longestResult.rows[0].name, duration_minutes: Number(longestResult.rows[0].duration_minutes) }
        : null,
    };

    res.json({ week_start: weekStart, leaderboard, spotlights });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

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

router.post('/rooms/join', async (req, res) => {
  try {
    const { code, password } = req.body;
    if (!code?.trim())     return res.status(400).json({ error: 'Room code is required' });
    if (!password?.trim()) return res.status(400).json({ error: 'Password is required' });
    const roomRow = (await db.execute({ sql: `SELECT * FROM focus_rooms WHERE code = ?`, args: [code.toUpperCase()] })).rows[0];
    if (!roomRow) return res.status(404).json({ error: 'Room not found' });
    const valid = await comparePassword(password, roomRow.password_hash);
    // 401 is reserved for "your login session is invalid" — the client's
    // global fetch wrapper treats ANY 401 from ANY endpoint as exactly
    // that, clears the account's auth token, and forces a full re-login.
    // A wrong ROOM password is a completely different kind of failure
    // (nothing wrong with her account) — 403 makes that distinction so
    // mistyping a room password no longer logs her out of the whole app.
    if (!valid)   return res.status(403).json({ error: 'Incorrect password' });
    await db.execute({
      sql:  `INSERT INTO focus_room_members (room_id, user_id, display_name, last_seen)
             VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(room_id, user_id) DO UPDATE SET last_seen = datetime('now')`,
      args: [roomRow.id, req.user.id, req.user.name],
    });
    res.json({ code: roomRow.code, name: roomRow.name });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.get('/rooms/mine', async (req, res) => {
  try {
    const row = (await db.execute({
      sql: `SELECT r.code FROM focus_room_members m
            JOIN focus_rooms r ON r.id = m.room_id
            WHERE m.user_id = ? AND m.last_seen >= datetime('now', '-1 day')
            ORDER BY m.last_seen DESC LIMIT 1`,
      args: [req.user.id],
    })).rows[0];
    res.json({ code: row?.code || null });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// Every room the user has ever created or joined — the DB never enforced
// "one room at a time" (only UNIQUE(room_id, user_id) to stop duplicate
// membership in the *same* room), that was purely a client-side limit
// where a single `room` variable got overwritten. This backs a room
// switcher so members can belong to more than one and pick which is
// active without leaving the others.
router.get('/rooms/mine-list', async (req, res) => {
  try {
    const rows = (await db.execute({
      sql: `SELECT r.code, r.name, r.host_id, m.last_seen
            FROM focus_room_members m
            JOIN focus_rooms r ON r.id = m.room_id
            WHERE m.user_id = ?
            ORDER BY m.last_seen DESC
            LIMIT 20`,
      args: [req.user.id],
    })).rows;
    res.json({
      rooms: rows.map((r) => ({
        code: r.code, name: r.name,
        isHost: Number(r.host_id) === Number(req.user.id),
      })),
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.get('/rooms/:code', async (req, res) => {
  try {
    const roomRow = (await db.execute({ sql: `SELECT * FROM focus_rooms WHERE code = ?`, args: [req.params.code.toUpperCase()] })).rows[0];
    if (!roomRow) return res.status(404).json({ error: 'Room not found' });
    await reconcileRoomSession(roomRow.id); // catch anyone whose room session just finished but never self-reported
    // Same weekly reset as the leaderboard/spotlights — lazily zero out
    // anyone whose focus_minutes are still tagged to a previous week,
    // the first time this room is loaded after Sunday rolls over.
    await db.execute({
      sql:  `UPDATE focus_room_members SET focus_minutes = 0, week_start = ?
             WHERE room_id = ? AND (week_start IS NULL OR week_start != ?)`,
      args: [getWeekStart(), roomRow.id, getWeekStart()],
    });
    // Membership is only ever changed by an explicit DELETE from the
    // /leave route below — being idle, backgrounded, or offline for a
    // while must never make someone disappear from this list. The old
    // "last_seen >= -N minutes" filter here didn't remove anyone from
    // the room either, but it did hide them from view, which looked and
    // felt exactly like being kicked out. is_focusing already reflects
    // real-time activity (it only stays true while a pulse says they're
    // actively running a timer), so that alone is enough to show who's
    // active right now without dropping anyone from the roster.
    const members = (await db.execute({
      sql:  `SELECT user_id, display_name, focus_minutes, is_focusing
             FROM focus_room_members
             WHERE room_id = ?
             ORDER BY focus_minutes DESC`,
      args: [roomRow.id],
    })).rows.map((r) => ({ ...r, focus_minutes: Number(r.focus_minutes), is_focusing: Boolean(r.is_focusing) }));

    let timer = null;
    let remainingSeconds = null;
    try {
      const t = (await db.execute({
        sql: `SELECT started_at, duration_seconds, mode, running FROM focus_room_timer WHERE room_id = ?`,
        args: [roomRow.id],
      })).rows[0];
      if (t) {
        const elapsed   = Math.floor((Date.now() - new Date(t.started_at.replace(' ', 'T') + 'Z').getTime()) / 1000);
        const remaining = Number(t.duration_seconds) - elapsed;
        remainingSeconds = Math.max(0, remaining);
        timer = {
          running:            Boolean(t.running) && remaining > 0,
          started_at:         t.started_at,
          duration_seconds:   Number(t.duration_seconds),
          remaining_seconds:  remainingSeconds,
          mode:               t.mode,
        };
      }
    } catch (_) {}

    let tree = null;
    try {
      const tr = (await db.execute({
        sql: `SELECT tree_key, status, died_by_name, died_reason FROM focus_room_tree WHERE room_id = ?`,
        args: [roomRow.id],
      })).rows[0];
      if (tr) {
        if (tr.status === 'alive' && remainingSeconds !== null && remainingSeconds <= 0) {
          await db.execute({
            sql: `UPDATE focus_room_tree SET status = 'completed', updated_at = datetime('now') WHERE room_id = ?`,
            args: [roomRow.id],
          });
          tr.status = 'completed';
        }
        tree = { tree_key: tr.tree_key, status: tr.status, died_by_name: tr.died_by_name || null, died_reason: tr.died_reason || null };
        // The room's tree can belong to any member (whoever's equipped
        // tree it was when the shared session started) — a Mystic Tree
        // design only lives in *that* member's own user_mystic_tree rows,
        // so every other viewer needs the actual shape/color handed to
        // them directly. Without this, everyone but the tree's owner just
        // sees the generic 🔮 fallback instead of the real design.
        if (tr.tree_key && tr.tree_key.startsWith('mystic:')) {
          const mysticId = Number(tr.tree_key.slice('mystic:'.length));
          const design = (await db.execute({
            sql: `SELECT shape_key, color_hex, glow_hex FROM user_mystic_tree WHERE id = ?`,
            args: [mysticId],
          })).rows[0];
          if (design) {
            tree.shape_key = design.shape_key;
            tree.color_hex = design.color_hex;
            tree.glow_hex  = design.glow_hex;
          }
        }
      }
    } catch (_) {}

    res.json({ code: roomRow.code, name: roomRow.name, host_id: Number(roomRow.host_id), members, timer, tree });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/rooms/:code/timer/start', async (req, res) => {
  try {
    const { duration_minutes = 25, mode = 'focus', client_date = null } = req.body;
    const roomRow = (await db.execute({ sql: `SELECT * FROM focus_rooms WHERE code = ?`, args: [req.params.code.toUpperCase()] })).rows[0];
    if (!roomRow) return res.status(404).json({ error: 'Room not found' });
    if (Number(roomRow.host_id) !== Number(req.user.id))
      return res.status(403).json({ error: 'Only the host can start the shared timer' });
    await reconcileRoomSession(roomRow.id); // sweep the previous session before this row gets overwritten
    await db.execute({
      sql: `INSERT INTO focus_room_timer (room_id, started_at, duration_seconds, mode, running)
            VALUES (?, datetime('now'), ?, ?, 1)
            ON CONFLICT(room_id) DO UPDATE SET
              started_at = datetime('now'), duration_seconds = excluded.duration_seconds,
              mode = excluded.mode, running = 1`,
      args: [roomRow.id, Math.round(duration_minutes * 60), mode],
    });
    if (mode === 'focus') {
      try {
        // Anyone in the room, not just the host who happened to hit
        // start — a shared session is a birthday session for the whole
        // group if any member is celebrating today.
        const treeKey = (await roomHasBirthdayToday(roomRow.id, client_date))
          ? 'christmas'
          : await getEquippedTree(req.user.id);
        await db.execute({
          sql: `INSERT INTO focus_room_tree (room_id, tree_key, status, died_by_name, died_reason, started_at, updated_at)
                VALUES (?, ?, 'alive', NULL, 'left', datetime('now'), datetime('now'))
                ON CONFLICT(room_id) DO UPDATE SET
                  tree_key = excluded.tree_key, status = 'alive', died_by_name = NULL, died_reason = 'left',
                  started_at = datetime('now'), updated_at = datetime('now')`,
          args: [roomRow.id, treeKey],
        });
      } catch (e) { console.error('plant room tree failed (non-fatal):', e.message); }
    }
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/rooms/:code/timer/stop', async (req, res) => {
  try {
    const roomRow = (await db.execute({ sql: `SELECT * FROM focus_rooms WHERE code = ?`, args: [req.params.code.toUpperCase()] })).rows[0];
    if (!roomRow) return res.status(404).json({ error: 'Room not found' });
    if (Number(roomRow.host_id) !== Number(req.user.id))
      return res.status(403).json({ error: 'Only the host can stop the shared timer' });

    let stoppedEarly = false;
    try {
      const t = (await db.execute({
        sql: `SELECT started_at, duration_seconds, running FROM focus_room_timer WHERE room_id = ?`,
        args: [roomRow.id],
      })).rows[0];
      if (t && Boolean(t.running)) {
        const elapsed = Math.floor((Date.now() - new Date(t.started_at.replace(' ', 'T') + 'Z').getTime()) / 1000);
        stoppedEarly = (Number(t.duration_seconds) - elapsed) > 0;
      }
    } catch (_) {}

    // If the session had already run its full course by the time stop
    // was pressed (host just tidying up / about to start a new round —
    // not actually cutting anyone off), this is the last chance to
    // credit anyone whose device never self-reported: reconcileRoomSession
    // refuses to do anything once running flips to 0 below, so a
    // straggler who hadn't been swept by a poll yet would otherwise lose
    // their session, XP, and planted tree permanently — nothing else
    // ever revisits this timer row once it's stopped.
    if (!stoppedEarly) {
      await reconcileRoomSession(roomRow.id);
    }

    await db.execute({ sql: `UPDATE focus_room_timer SET running = 0 WHERE room_id = ?`, args: [roomRow.id] });

    if (stoppedEarly) {
      try {
        const tr = (await db.execute({
          sql: `SELECT status FROM focus_room_tree WHERE room_id = ?`, args: [roomRow.id],
        })).rows[0];
        if (tr && tr.status === 'alive') {
          await db.execute({
            sql: `UPDATE focus_room_tree SET status = 'dead', died_by_name = ?, died_reason = 'host_stopped', updated_at = datetime('now') WHERE room_id = ?`,
            args: [req.user.name, roomRow.id],
          });
          // The shared room tree dying was never mirrored into each
          // member's own Forest history — reconcileRoomSession (above)
          // writes a personal `planted_trees` row per member on a
          // *successful* completion, but this early-stop path only ever
          // touched the one shared focus_room_tree row, so a session that
          // died here simply vanished for everyone instead of showing up
          // as a wilted tree on their personal Forest tab. Mirror it the
          // same way, with 'dead' status and partial (elapsed) duration.
          try {
            const timerRow = (await db.execute({
              sql: `SELECT started_at FROM focus_room_timer WHERE room_id = ?`, args: [roomRow.id],
            })).rows[0];
            const elapsedMinutes = timerRow
              ? Math.max(0, Math.floor((Date.now() - new Date(timerRow.started_at.replace(' ', 'T') + 'Z').getTime()) / 60000))
              : 0;
            const focusingMembers = (await db.execute({
              sql: `SELECT user_id FROM focus_room_members WHERE room_id = ? AND is_focusing = 1`,
              args: [roomRow.id],
            })).rows;
            for (const m of focusingMembers) {
              try {
                const treeKey = await getEquippedTree(m.user_id);
                await db.execute({
                  sql:  `INSERT INTO planted_trees (user_id, tree_key, status, task_name, duration_minutes)
                         VALUES (?, ?, 'dead', 'Room session', ?)`,
                  args: [m.user_id, treeKey, elapsedMinutes],
                });
              } catch (e) { console.error('room-death planted_trees insert failed (non-fatal):', m.user_id, e.message); }
            }
            await db.execute({
              sql:  `UPDATE focus_room_members SET is_focusing = 0 WHERE room_id = ? AND is_focusing = 1`,
              args: [roomRow.id],
            });
          } catch (e) { console.error('room-death member sweep failed (non-fatal):', e.message); }
        }
      } catch (_) {}
    }

    res.json({ ok: true, stoppedEarly });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/rooms/:code/pulse', async (req, res) => {
  try {
    const { is_focusing = false, add_minutes = 0 } = req.body;
    const roomRow = (await db.execute({ sql: `SELECT * FROM focus_rooms WHERE code = ?`, args: [req.params.code.toUpperCase()] })).rows[0];
    if (!roomRow) return res.status(404).json({ error: 'Room not found' });

    if (add_minutes > 0) {
      // This member's own device just self-reported a completed
      // session (already logged to /focus/sessions on their end) —
      // stamp which room-timer session that credit belongs to so
      // reconcileRoomSession never re-credits them for the same one.
      const t = (await db.execute({
        sql: `SELECT started_at FROM focus_room_timer WHERE room_id = ?`, args: [roomRow.id],
      })).rows[0];
      const weekStart = getWeekStart();
      await db.execute({
        sql:  `UPDATE focus_room_members
               SET last_seen = datetime('now'), is_focusing = ?,
                   focus_minutes = CASE WHEN week_start = ? THEN focus_minutes + ? ELSE ? END,
                   week_start = ?, credited_started_at = ?
               WHERE room_id = ? AND user_id = ?`,
        args: [
          is_focusing ? 1 : 0, weekStart, add_minutes, add_minutes,
          weekStart, t?.started_at || null, roomRow.id, req.user.id,
        ],
      });
    } else {
      await db.execute({
        sql:  `UPDATE focus_room_members
               SET last_seen = datetime('now'), is_focusing = ?
               WHERE room_id = ? AND user_id = ?`,
        args: [is_focusing ? 1 : 0, roomRow.id, req.user.id],
      });
    }
    await reconcileRoomSession(roomRow.id); // catch any other member whose session ended without self-reporting
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.delete('/rooms/:code/leave', async (req, res) => {
  try {
    const roomRow = (await db.execute({ sql: `SELECT * FROM focus_rooms WHERE code = ?`, args: [req.params.code.toUpperCase()] })).rows[0];
    if (!roomRow) return res.status(404).json({ error: 'Room not found' });

    try {
      const t = (await db.execute({
        sql: `SELECT started_at, duration_seconds, running FROM focus_room_timer WHERE room_id = ?`,
        args: [roomRow.id],
      })).rows[0];
      if (t && Boolean(t.running)) {
        const elapsed   = Math.floor((Date.now() - new Date(t.started_at.replace(' ', 'T') + 'Z').getTime()) / 1000);
        const remaining = Number(t.duration_seconds) - elapsed;
        if (remaining > 0) {
          return res.status(403).json({ error: 'Cannot leave while a session is running — wait for the host to stop it, or for it to finish.' });
        }
      }
    } catch (_) {}

    await db.execute({ sql: `DELETE FROM focus_room_members WHERE room_id = ? AND user_id = ?`, args: [roomRow.id, req.user.id] });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── Plan catalogue ──────────────────────────────────────────────
// Semester is the headline (students budget in semesters, not
// years), with monthly as a low-commitment entry point and annual
// as the max-savings option — each tier's discount grows with the
// length of commitment so the pricing reads as consistent, not
// arbitrary. priceId maps to the real Paddle Price for real checkout via
// Paddle.js on the client — actual granting happens in routes/paddle.js
// once the subscription webhook confirms payment, not here.
const PLANS = [
  { key: 'monthly',  name: 'Monthly',  months: 1,  price: 10, currency: 'NIS', discountPct: 0,  badge: null,      priceId: 'pri_01kzrz0epxcy9v8qhe5md6qmbd' },
  { key: 'semester', name: 'Semester', months: 4,  price: 34, currency: 'NIS', discountPct: 15, badge: 'popular', priceId: 'pri_01kzrz863vxsrjcjnkrnk1pzya' },
  { key: 'annual',   name: 'Annual',   months: 12, price: 96, currency: 'NIS', discountPct: 20, badge: 'value',   priceId: 'pri_01kzrz9dxpyt5pwyb4kkb26gb6' },
];
router.get('/premium/plans', (req, res) => res.json({ plans: PLANS }));

// ── Level-milestone free trial — reaching TRIAL_LEVEL unlocks a
// one-time free trial of Premium, no payment involved. Framed as a
// reward for engagement rather than a permanent discount, since anyone
// who reaches this level is already proven-engaged and a trial (not a
// price cut) is what actually moves conversion for that segment.
const TRIAL_LEVEL = 5;
const TRIAL_DAYS  = 7;

router.get('/premium/trial-eligibility', async (req, res) => {
  try {
    const [current, level, userRow] = await Promise.all([
      getPremium(req.user.id),
      getLevelInfo(req.user.id),
      db.execute({ sql: `SELECT created_at FROM users WHERE id = ?`, args: [req.user.id] }).then(r => r.rows[0]),
    ]);

    // Same GRACE_PERIOD_DAYS window that lib/usageLimits.js actually
    // enforces — surfaced here so the Premium tab can tell someone
    // exactly where they stand instead of them finding out by hitting a
    // limit unannounced.
    let graceDaysLeft = 0;
    if (userRow?.created_at) {
      const createdAt = new Date(userRow.created_at.replace(' ', 'T') + 'Z');
      if (!Number.isNaN(createdAt.getTime())) {
        const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        graceDaysLeft = Math.max(0, Math.ceil(GRACE_PERIOD_DAYS - ageDays));
      }
    }

    res.json({
      eligible:      !current.is_premium && !current.trial_used && level.level >= TRIAL_LEVEL,
      trialActive:   current.is_premium && current.plan === 'trial' && !!current.trial_expires_at,
      trialExpiresAt: current.plan === 'trial' ? current.trial_expires_at : null,
      trialUsed:     current.trial_used,
      level:         level.level,
      requiredLevel: TRIAL_LEVEL,
      trialDays:     TRIAL_DAYS,
      inGracePeriod: !current.is_premium && graceDaysLeft > 0,
      graceDaysLeft,
      gracePeriodDays: GRACE_PERIOD_DAYS,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});
router.post('/premium/start-trial', async (req, res) => {
  try {
    const [current, level] = await Promise.all([getPremium(req.user.id), getLevelInfo(req.user.id)]);
    if (current.is_premium)  return res.status(400).json({ error: 'Already premium' });
    if (current.trial_used)  return res.status(400).json({ error: 'Trial already used' });
    if (level.level < TRIAL_LEVEL)
      return res.status(403).json({ error: `Reach level ${TRIAL_LEVEL} to unlock a free trial` });

    const expiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await db.execute({
      sql: `INSERT INTO user_premium (user_id, is_premium, plan, trial_used, trial_expires_at)
            VALUES (?, 1, 'trial', 1, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              is_premium = 1, plan = 'trial', trial_used = 1, trial_expires_at = excluded.trial_expires_at`,
      args: [req.user.id, expiresAt],
    });
    res.json(await getPremium(req.user.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.get('/premium/status', async (req, res) => {
  try { res.json(await getPremium(req.user.id)); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});
router.post('/premium/toggle', async (req, res) => {
  try {
    const current = await getPremium(req.user.id);
    const next = current.is_premium ? 0 : 1;
    if (next === 0) {
      await db.execute({
        sql: `INSERT INTO user_premium (user_id, is_premium, theme_preset, plan) VALUES (?, 0, 'purple', NULL)
              ON CONFLICT(user_id) DO UPDATE SET is_premium = 0, theme_preset = 'purple', plan = NULL`,
        args: [req.user.id],
      });
    } else {
      await db.execute({
        sql: `INSERT INTO user_premium (user_id, is_premium) VALUES (?, ?)
              ON CONFLICT(user_id) DO UPDATE SET is_premium = excluded.is_premium`,
        args: [req.user.id, next],
      });
    }
    res.json(await getPremium(req.user.id));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});
// ── POST /premium/request — fallback contact path ───────────────
// Real purchases now go through Paddle checkout (client calls
// Paddle.Checkout.open() with a plan's priceId) and Premium is granted
// by routes/paddle.js only once a verified subscription webhook confirms
// payment actually happened. This route no longer flips is_premium
// itself — it's kept as a lightweight "email the dev" fallback for
// someone who can't complete checkout (no card, wants another payment
// method, etc.), so there's still a record to follow up on manually.
router.post('/premium/request', async (req, res) => {
  const { plan_key } = req.body;
  const plan = PLANS.find(p => p.key === plan_key);
  if (!plan) return res.status(400).json({ error: 'Unknown plan' });

  try {
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO user_premium (user_id, requested_at) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET requested_at = excluded.requested_at`,
      args: [req.user.id, now],
    });

    try {
      const { sendPremiumRequestEmail } = require('../lib/email');
      await sendPremiumRequestEmail({
        userEmail:  req.user.email,
        userName:   req.user.name,
        planLabel:  plan.name,
        priceLabel: `${plan.price} ${plan.currency} / ${plan.months === 1 ? 'month' : plan.months === 4 ? 'semester' : 'year'}`,
      });
    } catch (e) {
      console.error('sendPremiumRequestEmail failed (non-fatal):', e.message);
    }

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

// ── Grace passes (Premium) ───────────────────────────────────────
// Duolingo-streak-freeze-style leniency: everyone keeps the normal 10s
// pause-grace window on the focus timer, but Premium gets a weekly
// allowance of passes that auto-save the tree if that window runs out
// instead of letting it die. Deliberately NOT gating the base 10s
// window itself — that's basic fairness (don't punish an accidental
// pause), not a paid perk. This is the actual upgrade-worthy layer on
// top of it.
const WEEKLY_GRACE_PASSES = 3;

router.get('/grace-passes', async (req, res) => {
  try {
    const current = await getPremium(req.user.id);
    if (!current.is_premium) {
      return res.json({ is_premium: false, total: 0, used: 0, remaining: 0 });
    }
    const weekStart = getWeekStart();
    const row = (await db.execute({
      sql: `SELECT grace_passes_used, grace_passes_week_start FROM user_premium WHERE user_id = ?`,
      args: [req.user.id],
    })).rows[0];
    // Lazy weekly reset (same pattern as focus_room_members.week_start
    // elsewhere) — if the stored week doesn't match the current one,
    // treat it as a fresh allowance without needing a cron job.
    const used = (row?.grace_passes_week_start === weekStart) ? Number(row.grace_passes_used || 0) : 0;
    res.json({
      is_premium: true,
      total:     WEEKLY_GRACE_PASSES,
      used,
      remaining: Math.max(0, WEEKLY_GRACE_PASSES - used),
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// Called automatically by the client the instant a Premium user's 10s
// pause-grace window is about to expire — silently saves the tree if a
// pass is left this week. The client falls back to the normal kill
// whenever this comes back ok:false (no passes left, or not Premium).
router.post('/grace-passes/use', async (req, res) => {
  try {
    const current = await getPremium(req.user.id);
    if (!current.is_premium)
      return res.status(403).json({ error: 'Grace passes are a Premium feature', remaining: 0 });

    const weekStart = getWeekStart();
    const row = (await db.execute({
      sql: `SELECT grace_passes_used, grace_passes_week_start FROM user_premium WHERE user_id = ?`,
      args: [req.user.id],
    })).rows[0];
    const usedSoFar = (row?.grace_passes_week_start === weekStart) ? Number(row.grace_passes_used || 0) : 0;

    if (usedSoFar >= WEEKLY_GRACE_PASSES) {
      return res.json({ ok: false, remaining: 0 });
    }

    const nextUsed = usedSoFar + 1;
    await db.execute({
      sql: `INSERT INTO user_premium (user_id, is_premium, grace_passes_used, grace_passes_week_start)
            VALUES (?, 1, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              grace_passes_used = excluded.grace_passes_used,
              grace_passes_week_start = excluded.grace_passes_week_start`,
      args: [req.user.id, nextUsed, weekStart],
    });
    res.json({ ok: true, remaining: WEEKLY_GRACE_PASSES - nextUsed });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

const ALLOWED_THEMES = ['purple', 'orange', 'pink', 'blue'];
router.post('/premium/theme', async (req, res) => {
  try {
    const current = await getPremium(req.user.id);
    if (!current.is_premium)
      return res.status(403).json({ error: 'Custom themes are a Premium feature' });
    const { theme_preset } = req.body;
    if (!ALLOWED_THEMES.includes(theme_preset))
      return res.status(400).json({ error: 'Invalid theme preset' });
    await db.execute({
      sql: `INSERT INTO user_premium (user_id, is_premium, theme_preset) VALUES (?, 1, ?)
            ON CONFLICT(user_id) DO UPDATE SET theme_preset = excluded.theme_preset`,
      args: [req.user.id, theme_preset],
    });
    res.json({ ok: true, theme_preset });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── POST /premium/gender-theme ──────────────────────────────────
// The free, non-Premium sibling of the route above — sets a sensible
// default accent (blue/pink) the moment someone sets their gender in
// Settings. Deliberately its own route rather than reusing
// /premium/theme: that one is gated behind is_premium (it's the paid
// customization picker), and gating this too meant setting your
// gender only ever *looked* like it worked — the client's optimistic
// setAccent() would flash the color, then the periodic
// /premium/status poll would silently revert it a few seconds later
// once it read back the theme_preset that never actually got saved.
// Deliberately restricted to just blue/pink so it can't be used as a
// backdoor to the full paid palette.
router.post('/premium/gender-theme', async (req, res) => {
  try {
    const { theme_preset } = req.body;
    if (theme_preset !== 'blue' && theme_preset !== 'pink')
      return res.status(400).json({ error: 'Invalid theme preset' });
    await db.execute({
      sql: `INSERT INTO user_premium (user_id, theme_preset) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET theme_preset = excluded.theme_preset`,
      args: [req.user.id, theme_preset],
    });
    res.json({ ok: true, theme_preset });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;