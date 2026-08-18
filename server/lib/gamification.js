// lib/gamification.js
const { db } = require('../db/connection');

// ── Achievement catalogue ──────────────────────────────────────
// Self-seeding: the catalogue is inserted (INSERT OR IGNORE) before
// any unlock, so user_achievements' FOREIGN KEY to achievements(key)
// can never fail on an unseeded database again.
const ACHIEVEMENTS = [
  { key: 'first_task',     title: 'First Steps',   description: 'Complete your first task',        icon: 'CheckCircle' },
  { key: 'hundred_tasks',  title: 'Century Club',  description: 'Complete 100 tasks',              icon: 'Trophy'      },
  { key: 'week_streak',    title: 'Week Warrior',  description: 'Keep a 7-day habit streak',       icon: 'Flame'       },
  { key: 'no_missed_30',   title: 'Unstoppable',   description: 'Keep a 30-day habit streak',      icon: 'Zap'         },
  { key: 'goal_finisher',  title: 'Goal Getter',   description: 'Complete your first goal',        icon: 'Target'      },
];

let catalogueReady = false;
async function ensureCatalogue() {
  if (catalogueReady) return;
  await db.batch(
    ACHIEVEMENTS.map((a) => ({
      sql:  `INSERT OR IGNORE INTO achievements (key, title, description, icon) VALUES (?, ?, ?, ?)`,
      args: [a.key, a.title, a.description, a.icon],
    })),
    'write'
  );
  catalogueReady = true;
}

async function addXp(userId, amount, reason) {
  await db.execute({
    sql:  `INSERT INTO xp_log (user_id, amount, reason) VALUES (?, ?, ?)`,
    args: [userId, amount, reason],
  });
}

async function getTotalXp(userId) {
  const result = await db.execute({
    sql:  `SELECT COALESCE(SUM(amount), 0) as total FROM xp_log WHERE user_id = ?`,
    args: [userId],
  });
  return Number(result.rows[0].total);
}

async function getLevelInfo(userId) {
  const xp = await getTotalXp(userId);
  const level = Math.floor(xp / 100) + 1;
  return { xp, level, xpIntoLevel: xp % 100, xpForNextLevel: 100 };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ── Streak freeze (premium) ────────────────────────────────────
// If the user paused their streak, the frozen date counts as logged.
async function getFreezeDate(userId) {
  try {
    const row = (await db.execute({
      sql:  `SELECT freeze_date FROM user_premium WHERE user_id = ?`,
      args: [userId],
    })).rows[0];
    return row?.freeze_date || null;
  } catch (_) {
    return null; // table may not exist yet — non-fatal
  }
}

async function getOverallStreak(userId) {
  // A day counts toward the streak if the person logged a habit,
  // completed a task, OR finished a Flow/focus session — this is the
  // headline "Streak" stat on the dashboard, so it should reflect
  // general app activity. Previously this only looked at habit_logs and
  // tasks, so anyone whose daily activity was Flow sessions (a whole
  // separate, heavily-used feature) still saw their streak sit at 0 or
  // silently break every day they only did Flow — the exact "streak
  // isn't counting correct" report.
  const [habitResult, taskResult, focusResult] = await Promise.all([
    db.execute({
      sql:  `SELECT DISTINCT hl.date FROM habit_logs hl
             JOIN habits h ON h.id = hl.habit_id
             WHERE h.user_id = ?`,
      args: [userId],
    }),
    db.execute({
      sql:  `SELECT DISTINCT date(completed_at) AS date FROM tasks
             WHERE user_id = ? AND status = 'done' AND completed_at IS NOT NULL`,
      args: [userId],
    }),
    db.execute({
      sql:  `SELECT DISTINCT date(completed_at) AS date FROM focus_sessions
             WHERE user_id = ?`,
      args: [userId],
    }),
  ]);
  const dates = new Set([
    ...habitResult.rows.map((r) => r.date),
    ...taskResult.rows.map((r) => r.date),
    ...focusResult.rows.map((r) => r.date),
  ]);

  // Premium streak freeze — the excused date counts as completed.
  const freeze = await getFreezeDate(userId);
  if (freeze) dates.add(freeze);

  let streak = 0;
  let cursor = new Date();
  if (!dates.has(todayIso())) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (dates.has(iso)) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  return streak;
}

async function getHabitStreak(habitId) {
  // Bounded to ~2 years — the streak-walk below stops at the first gap
  // it finds, so it only ever needs a contiguous recent tail of data, not
  // a habit's entire history. Without this, an account with years of
  // logs re-scans its *whole* habit_logs history on every single chat
  // message (buildSystemPrompt runs this once per habit) and every call
  // to the get_habit_streaks tool. No real streak runs past 2 years, so
  // this changes nothing for any actual user, just the pathological
  // unbounded-growth case for old accounts.
  const result = await db.execute({
    sql:  `SELECT date FROM habit_logs WHERE habit_id = ? AND date >= date('now', '-730 days') ORDER BY date DESC`,
    args: [habitId],
  });
  const dates = new Set(result.rows.map((r) => r.date));
  let streak = 0;
  let cursor = new Date();
  if (!dates.has(todayIso())) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (dates.has(iso)) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  return streak;
}

async function getTreeStage(userId) {
  const streak = await getOverallStreak(userId);
  if (streak >= 21) return 4;
  if (streak >= 14) return 3;
  if (streak >= 7)  return 2;
  if (streak >= 2)  return 1;
  return 0;
}

async function evaluateAchievements(userId) {
  await ensureCatalogue(); // ← guarantees FK targets exist

  const newlyUnlocked = [];
  const unlock = async (key) => {
    const existing = await db.execute({
      sql:  `SELECT 1 FROM user_achievements WHERE user_id = ? AND key = ?`,
      args: [userId, key],
    });
    if (!existing.rows[0]) {
      await db.execute({
        sql:  `INSERT INTO user_achievements (user_id, key) VALUES (?, ?)`,
        args: [userId, key],
      });
      newlyUnlocked.push(key);
    }
  };

  const [doneTasksResult, completedGoalsResult, streak] = await Promise.all([
    db.execute({ sql: `SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND status = 'done'`, args: [userId] }),
    db.execute({ sql: `SELECT COUNT(*) c FROM goals WHERE user_id = ? AND status = 'completed'`, args: [userId] }),
    getOverallStreak(userId),
  ]);
  const doneTasks      = Number(doneTasksResult.rows[0].c);
  const completedGoals = Number(completedGoalsResult.rows[0].c);

  if (doneTasks >= 1)      await unlock('first_task');
  if (doneTasks >= 100)    await unlock('hundred_tasks');
  if (streak >= 7)         await unlock('week_streak');
  if (streak >= 30)        await unlock('no_missed_30');
  if (completedGoals >= 1) await unlock('goal_finisher');

  return newlyUnlocked;
}

module.exports = {
  addXp, getTotalXp, getLevelInfo, getOverallStreak,
  getHabitStreak, getTreeStage, evaluateAchievements, todayIso,
};