// lib/channelPoints.js — per-channel scoreboard, deliberately separate
// from the app-wide xp_log (see gamification.js) and from the Flow/
// focus-session rankings shown at /rankings. A student's global XP
// keeps working exactly as before; this is an independent "class
// points" total that only ever exists inside one channel.
//
// Two sources feed channel_points_log (see db/schema.sql):
//   - auto-award: routes/tasks.js and routes/goals.js award points here,
//     alongside (not instead of) the normal addXp() call, whenever the
//     task/goal being completed has a channel_id (i.e. it was assigned
//     by an instructor through that channel). awarded_by is NULL.
//   - manual award: POST /channels/:id/points/award lets the instructor
//     hand out (or deduct) an arbitrary amount with a reason — praise,
//     participation, whatever isn't captured by task/goal completion.
//     awarded_by is the instructor's user id.
const { db } = require('../db/connection');

// Mirrors the global XP amounts (see routes/tasks.js/goals.js addXp calls)
// purely so the numbers feel familiar — the two systems don't share a
// ledger and never need to reconcile.
const CHANNEL_TASK_POINTS = 20;
const CHANNEL_GOAL_POINTS = 100;

async function awardChannelPoints(channelId, studentId, amount, reason, awardedBy = null) {
  const insert = await db.execute({
    sql:  `INSERT INTO channel_points_log (channel_id, student_id, amount, reason, awarded_by) VALUES (?, ?, ?, ?, ?)`,
    args: [channelId, studentId, amount, reason, awardedBy],
  });
  return Number(insert.lastInsertRowid);
}

async function getChannelPointsForStudent(channelId, studentId) {
  const result = await db.execute({
    sql:  `SELECT COALESCE(SUM(amount), 0) AS total FROM channel_points_log WHERE channel_id = ? AND student_id = ?`,
    args: [channelId, studentId],
  });
  return Number(result.rows[0].total);
}

// Every current member, ranked highest-first — members with zero awards
// still appear (LEFT JOIN), just at 0 points, so a fresh channel shows
// the full roster rather than an empty leaderboard.
async function getChannelLeaderboard(channelId) {
  const rows = (await db.execute({
    sql: `
      SELECT u.id, u.name, COALESCE(SUM(cpl.amount), 0) AS points
      FROM channel_members m
      JOIN users u ON u.id = m.student_id
      LEFT JOIN channel_points_log cpl
        ON cpl.channel_id = m.channel_id AND cpl.student_id = m.student_id
      WHERE m.channel_id = ?
      GROUP BY u.id, u.name
      ORDER BY points DESC, u.name COLLATE NOCASE ASC`,
    args: [channelId],
  })).rows;
  return rows.map((r, i) => ({ id: r.id, name: r.name, points: Number(r.points), rank: i + 1 }));
}

module.exports = {
  CHANNEL_TASK_POINTS,
  CHANNEL_GOAL_POINTS,
  awardChannelPoints,
  getChannelPointsForStudent,
  getChannelLeaderboard,
};
