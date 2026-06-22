// lib/gamification.js
const { db } = require('../db/connection'); // ← destructure

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
  return new Date().toISOString().slice(0, 10); // pure — no db, stays sync
}

async function getOverallStreak(userId) {
  const result = await db.execute({
    sql:  `SELECT DISTINCT hl.date FROM habit_logs hl
           JOIN habits h ON h.id = hl.habit_id
           WHERE h.user_id = ? ORDER BY hl.date DESC`,
    args: [userId],
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

async function getHabitStreak(habitId) {
  const result = await db.execute({
    sql:  `SELECT date FROM habit_logs WHERE habit_id = ? ORDER BY date DESC`,
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

  // Run unlocks sequentially — each checks DB before inserting
  if (doneTasks >= 1)   await unlock('first_task');
  if (doneTasks >= 100) await unlock('hundred_tasks');
  if (streak >= 7)      await unlock('week_streak');
  if (streak >= 30)     await unlock('no_missed_30');
  if (completedGoals >= 1) await unlock('goal_finisher');

  return newlyUnlocked;
}

module.exports = {
  addXp, getTotalXp, getLevelInfo, getOverallStreak,
  getHabitStreak, getTreeStage, evaluateAchievements, todayIso,
};