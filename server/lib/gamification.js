// lib/gamification.js
// Small, dependency-free helpers shared by several routes.
// Every function is scoped to a single user via a required userId param —
// centralizing this logic keeps XP/streak rules consistent across the app.

const db = require('../db/connection');

function addXp(userId, amount, reason) {
  db.prepare(`INSERT INTO xp_log (user_id, amount, reason) VALUES (?, ?, ?)`).run(userId, amount, reason);
}

function getTotalXp(userId) {
  const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM xp_log WHERE user_id = ?`).get(userId);
  return row.total;
}

// Simple level curve: level N requires N*100 cumulative XP (level 1 = 0-99xp).
function getLevelInfo(userId) {
  const xp = getTotalXp(userId);
  const level = Math.floor(xp / 100) + 1;
  const xpIntoLevel = xp % 100;
  return { xp, level, xpIntoLevel, xpForNextLevel: 100 };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Longest current streak of consecutive days (any habit logged that day),
// used for the dashboard "streak" stat and the productivity tree stage.
function getOverallStreak(userId) {
  const rows = db.prepare(`
    SELECT DISTINCT hl.date FROM habit_logs hl
    JOIN habits h ON h.id = hl.habit_id
    WHERE h.user_id = ?
    ORDER BY hl.date DESC
  `).all(userId);
  const dates = new Set(rows.map((r) => r.date));
  let streak = 0;
  let cursor = new Date();
  // allow today to be "not yet logged" without breaking the streak
  if (!dates.has(todayIso())) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (dates.has(iso)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

function getHabitStreak(habitId) {
  const rows = db.prepare(`SELECT date FROM habit_logs WHERE habit_id = ? ORDER BY date DESC`).all(habitId);
  const dates = new Set(rows.map((r) => r.date));
  let streak = 0;
  let cursor = new Date();
  if (!dates.has(todayIso())) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (dates.has(iso)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

// Productivity tree grows in stages based on the overall streak.
// 0: seed, 1: sprout, 2: sapling, 3: young tree, 4: full bloom
function getTreeStage(userId) {
  const streak = getOverallStreak(userId);
  if (streak >= 21) return 4;
  if (streak >= 14) return 3;
  if (streak >= 7) return 2;
  if (streak >= 2) return 1;
  return 0;
}

// Checks achievement conditions for one user and unlocks any newly-earned
// ones into user_achievements. Returns the list of keys unlocked just now
// (for toast notifications).
function evaluateAchievements(userId) {
  const newlyUnlocked = [];
  const unlock = (key) => {
    const already = db.prepare(`SELECT 1 FROM user_achievements WHERE user_id = ? AND key = ?`).get(userId, key);
    if (!already) {
      db.prepare(`INSERT INTO user_achievements (user_id, key) VALUES (?, ?)`).run(userId, key);
      newlyUnlocked.push(key);
    }
  };

  const doneTasks = db.prepare(`SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND status = 'done'`).get(userId).c;
  if (doneTasks >= 1) unlock('first_task');
  if (doneTasks >= 100) unlock('hundred_tasks');

  if (getOverallStreak(userId) >= 7) unlock('week_streak');
  if (getOverallStreak(userId) >= 30) unlock('no_missed_30');

  const completedGoals = db.prepare(`SELECT COUNT(*) c FROM goals WHERE user_id = ? AND status = 'completed'`).get(userId).c;
  if (completedGoals >= 1) unlock('goal_finisher');

  return newlyUnlocked;
}

module.exports = {
  addXp, getTotalXp, getLevelInfo, getOverallStreak, getHabitStreak,
  getTreeStage, evaluateAchievements, todayIso,
};