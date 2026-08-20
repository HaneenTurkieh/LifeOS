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

// A Mystic Tree design (shape_key/color_hex/glow_hex) lives in whoever
// designed it's own user_mystic_tree rows, keyed by id — but the tree_key
// itself ('mystic:<id>') can end up planted in someone ELSE's land (a
// room session now plants the host's tree into every member's land, see
// the room-session paths below), and only that design's actual owner's
// own /trees response would ever resolve it locally on the client.
// Anywhere a tree_key might be shown to someone other than its designer
// needs the real shape/color handed to them directly, or they just see
// the generic 🔮 fallback instead of the actual design. Returns null for
// non-mystic keys or if the design row is gone (e.g. deleted).
async function resolveMysticDesign(treeKey) {
  if (!treeKey || !treeKey.startsWith('mystic:')) return null;
  try {
    const id = Number(treeKey.slice('mystic:'.length));
    const design = (await db.execute({
      sql: `SELECT shape_key, color_hex, glow_hex FROM user_mystic_tree WHERE id = ?`,
      args: [id],
    })).rows[0];
    return design || null;
  } catch (_) { return null; }
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

    // The tree planted in EVERY member's own land for this session is
    // the room's one shared tree (whoever's equipped design it was when
    // the host started the round) — not each individual member's own
    // equipped tree. It's the same tree everyone just watched grow
    // together, so that's what should land in everyone's personal forest
    // as the record of it, not a silently-substituted personal design.
    // Reads the already-recorded focus_room_tree row directly (rather
    // than re-deriving "the host's current equipped tree") so this
    // matches exactly what was actually displayed growing, even if the
    // host has since changed their equipped tree.
    let roomTreeKey = roomBday ? 'christmas' : null;
    if (!roomTreeKey) {
      const rt = (await db.execute({
        sql: `SELECT tree_key FROM focus_room_tree WHERE room_id = ?`, args: [roomId],
      })).rows[0];
      roomTreeKey = rt?.tree_key || 'seedling';
    }

    for (const m of stragglers) {
      try {
        // Real race that used to live here: this loop used to INSERT the
        // session/XP/tree credit first and only stamp credited_started_at
        // at the very end. reconcileRoomSession is called from four
        // different, unsynchronized places (this member's own poll, any
        // OTHER member's poll via GET /rooms/:code, /pulse, timer
        // start/stop) — if two of those landed for the same room around
        // the same moment, both could run this loop, both would still see
        // this member as an uncredited straggler (nothing had stamped
        // credited_started_at yet), and both would credit them: double
        // XP, double tree, double session row for one real round. The
        // claim itself now happens FIRST, as a single atomic UPDATE
        // guarded by the same "not already credited for this exact
        // started_at" condition — only one concurrent caller can ever see
        // rowsAffected > 0 for a given (member, started_at) pair, since
        // SQLite serializes the UPDATE. Anyone who loses the race just
        // skips this member entirely instead of crediting them again.
        const weekStart = getWeekStart();
        const claim = await db.execute({
          sql:  `UPDATE focus_room_members
                 SET is_focusing = 0, credited_started_at = ?,
                     focus_minutes = CASE WHEN week_start = ? THEN focus_minutes + ? ELSE ? END,
                     week_start = ?
                 WHERE room_id = ? AND user_id = ?
                   AND (credited_started_at IS NULL OR credited_started_at != ?)`,
          args: [t.started_at, weekStart, durationMinutes, durationMinutes, weekStart, roomId, m.user_id, t.started_at],
        });
        if (claim.rowsAffected === 0) continue; // lost the race — someone else already credited this member for this round

        await db.execute({
          sql:  `INSERT INTO focus_sessions (user_id, task_name, duration_minutes, week_start, task_id) VALUES (?, ?, ?, ?, NULL)`,
          args: [m.user_id, 'Room session', durationMinutes, weekStart],
        });
        const xpAmount = Math.floor(durationMinutes / 5) * 2;
        if (xpAmount > 0) {
          await db.execute({
            sql:  `INSERT INTO xp_log (user_id, amount, reason) VALUES (?, ?, ?)`,
            args: [m.user_id, xpAmount, 'Focus: Room session'],
          });
        }
        await db.execute({
          sql:  `INSERT INTO planted_trees (user_id, tree_key, status, task_name, duration_minutes)
                 VALUES (?, ?, 'alive', 'Room session', ?)`,
          args: [m.user_id, roomTreeKey, durationMinutes],
        });
      } catch (e) { console.error('reconcileRoomSession: member credit failed (non-fatal):', m.user_id, e.message); }
    }
  } catch (e) { console.error('reconcileRoomSession failed (non-fatal):', e.message); }
}

// Real bug this fixes: the SOLO timer's completion (XP, planted tree,
// task minutes) only ever happened one way — the browser tab's own
// setInterval counting down to zero and calling POST /focus/sessions
// itself. The room timer already had a fallback for exactly this class
// of failure (see reconcileRoomSession above, written specifically
// because "that only fires if their own device is still open when the
// countdown hits zero"), but the solo path never got the equivalent —
// so a phone locking, the tab getting backgrounded/suspended by iOS, or
// the page being closed at the wrong moment meant that JS interval
// simply never got the chance to fire, and the round just silently
// evaporated: no session logged, no XP, no tree, with nothing left
// showing anything had gone wrong beyond a countdown stuck at 0:00.
// Mirrors reconcileRoomSession's approach: called from GET /timer
// (polled every 5s, plus on every tab-visibility change) before the row
// is returned, so ANY device checking in after the round's real end
// time completes and credits it server-side, the same as if the
// original tab had actually fired the completion itself. Guarded by
// the same focus_session_credits idempotency table the client's own
// self-report uses (keyed on user_id + started_at), so whichever path
// gets there first — this reconciliation or the tab's own report if it
// does come back — the other is a safe no-op, never a double-credit.
async function reconcileSoloTimer(userId) {
  try {
    const row = (await db.execute({
      sql: `SELECT * FROM focus_solo_timer WHERE user_id = ?`, args: [userId],
    })).rows[0];
    if (!row || !Number(row.running) || row.mode !== 'focus' || !row.started_at) return;

    // started_at here is a client-supplied ISO string (see POST
    // /timer/sync — unlike focus_room_timer's started_at, which is a
    // server-generated SQL datetime('now')), so it parses directly —
    // no space/UTC-suffix massaging needed.
    //
    // Anchor is remaining_seconds, NOT duration_seconds — this was the
    // actual bug in the first version of this function. remaining_seconds
    // is the snapshot of time-left AT started_at (same convention
    // computeFromServer.mjs already uses client-side); duration_seconds
    // is just the total length for the progress ring. They're equal on a
    // fresh start, which is why quick tests looked fine — but the
    // pause/resume path in toggleTimer() re-anchors started_at to "now"
    // while only sending the partial remaining_seconds, leaving
    // duration_seconds pointing at the *original* full length server-side.
    // Using duration_seconds there made the server think a full-length
    // round had just begun instead of a partial one, so it kept waiting
    // long after the client had already finished — which is exactly what
    // "still not catching it" looked like.
    const elapsed   = Math.floor((Date.now() - new Date(row.started_at).getTime()) / 1000);
    const remaining = Number(row.remaining_seconds) - elapsed;
    // TEMP diagnostic — remove once confirmed fixed. Only fires while a
    // focus round is actively running, so this is at most one line per
    // ~5s poll during a session, not a standing cost.
    console.log(`reconcileSoloTimer check: user=${userId} started_at=${row.started_at} remaining_seconds=${row.remaining_seconds} duration_seconds=${row.duration_seconds} elapsed=${elapsed}s computedRemaining=${remaining}s`);
    if (remaining > 0) return; // genuinely still running — nothing to do

    const durationMinutes = Math.round(Number(row.duration_seconds) / 60);
    if (durationMinutes < 1) {
      await db.execute({ sql: `UPDATE focus_solo_timer SET running = 0 WHERE user_id = ?`, args: [userId] });
      return;
    }

    const claim = await db.execute({
      sql: `INSERT INTO focus_session_credits (user_id, started_at) VALUES (?, ?) ON CONFLICT (user_id, started_at) DO NOTHING`,
      args: [userId, row.started_at],
    });
    if (claim.rowsAffected === 0) {
      // Already credited — most likely the owning tab actually did self-
      // report right around the same time this ran. Just make sure the
      // row isn't left stuck showing "running" if it somehow still is.
      await db.execute({ sql: `UPDATE focus_solo_timer SET running = 0 WHERE user_id = ? AND running = 1`, args: [userId] });
      return;
    }

    const weekStart = getWeekStart();
    const taskName  = row.task_name || 'Flow Session';
    await db.execute({
      sql: `INSERT INTO focus_sessions (user_id, task_name, duration_minutes, week_start, task_id) VALUES (?, ?, ?, ?, ?)`,
      args: [userId, taskName, durationMinutes, weekStart, row.task_id != null ? Number(row.task_id) : null],
    });
    const xpAmount = Math.floor(durationMinutes / 5) * 2;
    if (xpAmount > 0) {
      await db.execute({
        sql: `INSERT INTO xp_log (user_id, amount, reason) VALUES (?, ?, ?)`,
        args: [userId, xpAmount, `Focus: ${taskName}`],
      });
    }
    const treeKey = await getPlantTreeKey(userId, null);
    await db.execute({
      sql: `INSERT INTO planted_trees (user_id, tree_key, status, task_name, duration_minutes, task_id)
            VALUES (?, ?, 'alive', ?, ?, ?)`,
      args: [userId, treeKey, taskName, durationMinutes, row.task_id != null ? Number(row.task_id) : null],
    });
    let task = null;
    try { task = await logMinutesOnTask(userId, row.task_id, durationMinutes); } catch (_) {}

    // Advance the server row to the next break, same 4-session rhythm
    // the client itself uses, so whichever device checks in next picks
    // up "it's break time" instead of a stale finished focus round.
    const customMin = JSON.parse(row.custom_min || '{"focus":25,"short":5,"long":15}');
    const newDots    = Number(row.dots || 0) + 1;
    const nextMode   = newDots % 4 === 0 ? 'long' : 'short';
    const breakSec   = Math.round((customMin[nextMode] || (nextMode === 'long' ? 15 : 5)) * 60);
    await db.execute({
      sql: `UPDATE focus_solo_timer SET
              mode = ?, duration_seconds = ?, remaining_seconds = ?, started_at = NULL, running = 0,
              dots = ?, version = version + 1, updated_at = datetime('now')
            WHERE user_id = ?`,
      args: [nextMode, breakSec, breakSec, newDots, userId],
    });

    // Handed back to GET /timer so it can tell the client a round was
    // just credited server-side — without this, the only way to see
    // this ever happened was noticing the tree count went up. The
    // "tree planted!" popup only ever fired from the tab's own local
    // handleComplete(); a round caught here (tab backgrounded/reloaded
    // right at the end) planted the tree and awarded XP just fine, but
    // silently, with no popup at all.
    return {
      xpAwarded: xpAmount, treePlanted: treeKey,
      treePlantedDesign: await resolveMysticDesign(treeKey),
      minutes: durationMinutes, task,
      nextBreak: { type: nextMode, minutes: breakSec / 60 },
    };
  } catch (e) { console.error('reconcileSoloTimer failed (non-fatal):', e.message); }
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
    const justCompleted = await reconcileSoloTimer(req.user.id);
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
      // Only present on the one poll that actually catches a completed
      // round server-side — see reconcileSoloTimer. Lets the client show
      // the same "tree planted!" popup it would have shown if its own
      // tab had finished the countdown itself.
      just_completed:    justCompleted || null,
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
    const { task_name = 'Focus Session', duration_minutes, task_id = null, room_code = null, client_date = null, session_started_at = null } = req.body;
    if (!duration_minutes || duration_minutes < 1)
      return res.status(400).json({ error: 'Invalid duration' });
    // Real bug that used to live here: the solo timer is explicitly
    // server-synced across every device/tab on an account, so two open
    // tabs both noticing the same countdown hit zero could each call this
    // route for what's really one completed round — double XP, double
    // tree planted, double minutes logged on the linked task. When the
    // client sends session_started_at (the started_at of the specific
    // round it's reporting — a fresh value every time the timer is
    // started or resumed), only the first report of that exact round is
    // allowed through; a second report of the same round is a no-op.
    // Older clients that don't send it yet fall back to the old
    // ungated behavior rather than being blocked outright.
    if (session_started_at) {
      const claimed = await db.execute({
        sql:  `INSERT INTO focus_session_credits (user_id, started_at) VALUES (?, ?) ON CONFLICT (user_id, started_at) DO NOTHING`,
        args: [req.user.id, session_started_at],
      });
      if (claimed.rowsAffected === 0) {
        return res.json({ ok: true, duplicate: true, xpAwarded: 0, treePlanted: null, treePlantedDesign: null, task: null });
      }
    }
    // Real race that used to live here: this same completion also fires
    // POST /rooms/:code/pulse afterward (fire-and-forget, not awaited —
    // see FocusContext.jsx) to stamp focus_room_members.credited_started_at
    // for THIS member, which is what stops reconcileRoomSession's
    // straggler sweep from crediting them a second time. In the window
    // between this request finishing and that later /pulse call actually
    // landing, credited_started_at was still stale — so if ANOTHER
    // member's poll triggered reconcileRoomSession during that window, it
    // could see this member as an uncredited straggler and credit them
    // again for the same round. The claim now happens right here, in the
    // same request that's about to award XP/tree, instead of being
    // deferred to a later, unawaited call — closing the window entirely.
    // /pulse's own credited_started_at update is now guarded the same way
    // reconcileRoomSession's is, so it becomes a safe no-op once this has
    // already claimed the round.
    if (room_code) {
      const roomRowForClaim = (await db.execute({
        sql: `SELECT id FROM focus_rooms WHERE code = ?`, args: [String(room_code).toUpperCase()],
      })).rows[0];
      if (roomRowForClaim) {
        const timerRow = (await db.execute({
          sql: `SELECT started_at FROM focus_room_timer WHERE room_id = ?`, args: [roomRowForClaim.id],
        })).rows[0];
        if (timerRow?.started_at) {
          const weekStartClaim = getWeekStart();
          const roomClaim = await db.execute({
            sql:  `UPDATE focus_room_members
                   SET is_focusing = 0, credited_started_at = ?,
                       focus_minutes = CASE WHEN week_start = ? THEN focus_minutes + ? ELSE ? END,
                       week_start = ?, last_seen = datetime('now')
                   WHERE room_id = ? AND user_id = ?
                     AND (credited_started_at IS NULL OR credited_started_at != ?)`,
            args: [timerRow.started_at, weekStartClaim, duration_minutes, duration_minutes, weekStartClaim, roomRowForClaim.id, req.user.id, timerRow.started_at],
          });
          if (roomClaim.rowsAffected === 0) {
            return res.json({ ok: true, duplicate: true, xpAwarded: 0, treePlanted: null, treePlantedDesign: null, task: null });
          }
        }
      }
    }
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
    let treePlantedDesign = null;
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
        if (roomRow) {
          if (await roomHasBirthdayToday(roomRow.id, client_date)) {
            treeKey = 'christmas';
          } else {
            // The tree planted in THIS member's land is the room's one
            // shared tree (whoever's equipped design it was when the host
            // started the round), not this member's own equipped tree —
            // same fix as reconcileRoomSession's straggler path below,
            // so a room session credits everyone with the same tree
            // regardless of which path (self-report vs. straggler sweep)
            // ends up crediting them.
            const rt = (await db.execute({
              sql: `SELECT tree_key FROM focus_room_tree WHERE room_id = ?`, args: [roomRow.id],
            })).rows[0];
            if (rt?.tree_key) treeKey = rt.tree_key;
          }
        }
      }
      if (!treeKey) treeKey = await getPlantTreeKey(req.user.id, client_date);
      await db.execute({
        sql:  `INSERT INTO planted_trees (user_id, tree_key, status, task_name, duration_minutes, task_id)
               VALUES (?, ?, 'alive', ?, ?, ?)`,
        args: [req.user.id, treeKey, task_name, duration_minutes, task_id != null ? Number(task_id) : null],
      });
      treePlanted = treeKey;
      // Lets the "tree planted!" popup render the real shape/color even
      // when it's a Mystic Tree design that belongs to someone else in
      // the room (the host) rather than this device's own account —
      // without this it falls back to the generic 🔮 placeholder.
      treePlantedDesign = await resolveMysticDesign(treeKey);
    } catch (e) { console.error('plant tree failed (non-fatal):', e.message); }

    let task = null;
    try { task = await logMinutesOnTask(req.user.id, task_id, duration_minutes); }
    catch (e) { console.error('logMinutesOnTask failed (non-fatal):', e.message); }

    res.json({ ok: true, xpAwarded: xpAmount, treePlanted, treePlantedDesign, task });
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
    // Room sessions now plant the room's shared (often the host's) tree
    // into every member's own land, not just their own equipped design —
    // so this account's forest history can contain Mystic Tree keys this
    // account didn't design. Resolve every distinct one up front (one
    // batched query, not N+1) so the client can render the real
    // shape/color instead of falling back to the generic 🔮 placeholder
    // for anything it doesn't personally own.
    const mysticIds = [...new Set(
      result.rows
        .map((r) => r.tree_key)
        .filter((k) => k && k.startsWith('mystic:'))
        .map((k) => Number(k.slice('mystic:'.length)))
    )];
    let designById = {};
    if (mysticIds.length) {
      const placeholders = mysticIds.map(() => '?').join(',');
      const rows = (await db.execute({
        sql: `SELECT id, shape_key, color_hex, glow_hex FROM user_mystic_tree WHERE id IN (${placeholders})`,
        args: mysticIds,
      })).rows;
      designById = Object.fromEntries(rows.map((d) => [d.id, d]));
    }
    const days = [];
    const byDay = {};
    for (const r of result.rows) {
      const day = localDay(r.planted_at);
      if (!byDay[day]) { byDay[day] = []; days.push(day); }
      const entry = {
        tree_key: r.tree_key, status: r.status,
        task_name: r.task_name, duration_minutes: Number(r.duration_minutes),
      };
      if (r.tree_key && r.tree_key.startsWith('mystic:')) {
        const design = designById[Number(r.tree_key.slice('mystic:'.length))];
        if (design) { entry.shape_key = design.shape_key; entry.color_hex = design.color_hex; entry.glow_hex = design.glow_hex; }
      }
      byDay[day].push(entry);
    }
    // Real bug this fixes: "trees planted" undercounting. total_alive/
    // total_dead/total_minutes used to be computed straight from
    // `result.rows` above — but that query is LIMIT 300, meant for the
    // day-by-day history view, not a lifetime total. Once an account
    // actually planted more than 300 trees (reachable after months of
    // daily Flow use), these "totals" silently capped at whatever fit in
    // the most recent 300 instead of the real count. Pulled from a
    // separate, unlimited aggregate query instead of reusing the capped
    // display rows — today_planted is unaffected by the cap (today's
    // trees are always among the most recent 300 short of planting 300+
    // in a single day) so it still reads off result.rows.
    const totalsResult = await db.execute({
      sql: `SELECT
              SUM(CASE WHEN status = 'alive' THEN 1 ELSE 0 END) alive,
              SUM(CASE WHEN status = 'dead'  THEN 1 ELSE 0 END) dead,
              COALESCE(SUM(duration_minutes), 0) total_minutes
            FROM planted_trees WHERE user_id = ?`,
      args: [req.user.id],
    });
    const totalsRow = totalsResult.rows[0] || {};
    const today = new Date(Date.now() - offsetMin * 60000).toISOString().slice(0, 10);
    res.json({
      days: days.map(d => ({ date: d, trees: byDay[d] })),
      stats: {
        total_alive:    Number(totalsRow.alive || 0),
        total_dead:     Number(totalsRow.dead || 0),
        // "planted today" counts planting *events*, not current survival —
        // a tree that was planted today and later died in the same day is
        // still a tree you planted today. Filtering to status === 'alive'
        // here made this number quietly drop below what the Land history
        // list and plot show for the same day (a died-today tree still
        // shows up there), which read as the two disagreeing.
        today_planted:  (byDay[today] || []).length,
        total_minutes:  Number(totalsRow.total_minutes || 0),
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
    // Real bug that used to live here: this only checked the room code
    // existed, never that the requester was actually in it. Room codes
    // are only 6 characters — any authenticated user who knew or guessed
    // one could view full room state (every member's name and focus
    // minutes, live timer, tree status) and even trigger the
    // side-effecting reconcileRoomSession call below, without ever having
    // joined. /rooms/join is the only place that inserts into
    // focus_room_members, so checking membership there is the same check
    // every other room mutation route in this file already makes.
    const membership = (await db.execute({
      sql: `SELECT 1 FROM focus_room_members WHERE room_id = ? AND user_id = ?`,
      args: [roomRow.id, req.user.id],
    })).rows[0];
    if (!membership) return res.status(403).json({ error: 'You are not a member of this room' });
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
    // felt exactly like being kicked out. So membership itself still
    // never filters on last_seen.
    //
    // is_focusing is a different story, though — it's just a flag the
    // client pulses every 30s while its own local timer is running
    // (FocusContext.jsx). If someone's tab/app disappears mid-session
    // (closed, phone died, wifi dropped) without ever sending a final
    // "stopped" pulse, the flag stays true forever — a real bug (user
    // report: a friend's tree kept showing as running when they weren't
    // actively focusing). Trusting the raw stored flag isn't safe; it's
    // only meaningful if a pulse actually arrived recently. STALE_MS
    // gives one full missed pulse interval (30s) plus generous slack
    // for network jitter/backgrounding before treating someone as no
    // longer active — long enough to not flicker false on a slow
    // connection, short enough that a real disconnect clears within a
    // minute or two instead of lingering indefinitely.
    const STALE_MS = 90 * 1000;
    const members = (await db.execute({
      sql:  `SELECT user_id, display_name, focus_minutes, is_focusing, last_seen
             FROM focus_room_members
             WHERE room_id = ?
             ORDER BY focus_minutes DESC`,
      args: [roomRow.id],
    })).rows.map((r) => {
      const lastSeenMs = r.last_seen ? new Date(r.last_seen.replace(' ', 'T') + 'Z').getTime() : 0;
      const fresh = lastSeenMs > 0 && (Date.now() - lastSeenMs) < STALE_MS;
      return {
        user_id: r.user_id, display_name: r.display_name,
        focus_minutes: Number(r.focus_minutes),
        is_focusing: Boolean(r.is_focusing) && fresh,
      };
    });

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
        {
          const design = await resolveMysticDesign(tr.tree_key);
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
          sql: `SELECT status, tree_key FROM focus_room_tree WHERE room_id = ?`, args: [roomRow.id],
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
            // Same tree-ownership fix as reconcileRoomSession and
            // POST /focus/sessions: the tree that just died was the
            // room's one shared tree (tr.tree_key, whoever's equipped
            // design it was when the host started the round), not each
            // individual member's own currently-equipped tree. This path
            // was the one sibling spot that still called getEquippedTree
            // per member — everyone else in the room would have seen the
            // real shared tree wilt, but a straggler's own Forest history
            // got a mirror of THEIR OWN unrelated tree dying instead.
            const roomTreeKey = tr.tree_key || 'seedling';
            for (const m of focusingMembers) {
              try {
                await db.execute({
                  sql:  `INSERT INTO planted_trees (user_id, tree_key, status, task_name, duration_minutes)
                         VALUES (?, ?, 'dead', 'Room session', ?)`,
                  args: [m.user_id, roomTreeKey, elapsedMinutes],
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
      // POST /focus/sessions (called just before this, on completion) now
      // claims credited_started_at itself, atomically, in the same
      // request that awards XP/tree — that's the fix for the real
      // double-credit race that used to exist here (see its comment for
      // the full explanation). This call used to be the ONLY place that
      // stamped credited_started_at, deferred and unawaited, which left a
      // window where a concurrent reconcileRoomSession could double-credit
      // this member. It's now guarded the same way reconcileRoomSession's
      // own claim is, so if /focus/sessions (or reconcile) already
      // claimed this round, this UPDATE's WHERE just won't match and it
      // safely no-ops instead of adding the minutes a second time.
      const t = (await db.execute({
        sql: `SELECT started_at FROM focus_room_timer WHERE room_id = ?`, args: [roomRow.id],
      })).rows[0];
      const weekStart = getWeekStart();
      await db.execute({
        sql:  `UPDATE focus_room_members
               SET focus_minutes = CASE WHEN week_start = ? THEN focus_minutes + ? ELSE ? END,
                   week_start = ?, credited_started_at = ?
               WHERE room_id = ? AND user_id = ?
                 AND (credited_started_at IS NULL OR credited_started_at != ?)`,
        args: [
          weekStart, add_minutes, add_minutes,
          weekStart, t?.started_at || null, roomRow.id, req.user.id, t?.started_at || null,
        ],
      });
      await db.execute({
        sql:  `UPDATE focus_room_members SET last_seen = datetime('now'), is_focusing = ? WHERE room_id = ? AND user_id = ?`,
        args: [is_focusing ? 1 : 0, roomRow.id, req.user.id],
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
// Despite the name, this is a one-way "back to Free" action, not a real
// toggle — the client only ever calls it from the button shown when
// status.is_premium is ALREADY true (SettingsModal.jsx's PremiumTab), for
// someone who wants to voluntarily drop back to Free. It used to also
// flip Free → Premium when called with is_premium already false, with
// nothing checking who was calling it or why — a real, serious bug: any
// logged-in user could grant themselves Premium forever with a single
// unauthenticated-by-anything-but-login API call, completely bypassing
// Paddle. Real Premium grants must only ever come from a verified Paddle
// webhook (routes/paddle.js) or the owner's own admin action — never
// from this route. Now hard-blocked to the one direction the UI actually
// uses.
router.post('/premium/toggle', async (req, res) => {
  try {
    const current = await getPremium(req.user.id);
    if (!current.is_premium) {
      return res.status(403).json({ error: 'Premium can only be granted through a real purchase.' });
    }
    await db.execute({
      sql: `INSERT INTO user_premium (user_id, is_premium, theme_preset, plan) VALUES (?, 0, 'purple', NULL)
            ON CONFLICT(user_id) DO UPDATE SET is_premium = 0, theme_preset = 'purple', plan = NULL`,
      args: [req.user.id],
    });
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