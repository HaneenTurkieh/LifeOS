const { db } = require('../db/connection');

// Shared premium-status logic, used by both the exam routes (isPremium
// gate for session limits) and the focus routes (full premium settings
// panel). Previously each file had its own copy of this query — now
// centralized so the trial-expiry check below only has to live in one
// place instead of being duplicated (and inevitably drifting).

// A trial-granted premium period silently lapses once trial_expires_at
// passes — this runs as a lazy check right before any read, same pattern
// used elsewhere in this app for weekly resets: no cron job needed, the
// next person who touches the row corrects it.
async function expireTrialIfNeeded(userId) {
  await db.execute({
    sql: `UPDATE user_premium
          SET is_premium = 0
          WHERE user_id = ? AND is_premium = 1
            AND trial_expires_at IS NOT NULL
            AND trial_expires_at < ?`,
    args: [userId, new Date().toISOString()],
  });
}

async function getPremium(userId) {
  await expireTrialIfNeeded(userId);
  const row = (await db.execute({
    sql: `SELECT is_premium, freeze_date, theme_preset, plan, requested_at, trial_used, trial_expires_at
          FROM user_premium WHERE user_id = ?`,
    args: [userId],
  })).rows[0];
  return {
    is_premium:       Boolean(row?.is_premium),
    freeze_date:       row?.freeze_date || null,
    theme_preset:      row?.theme_preset || 'purple',
    plan:              row?.plan || null,
    requested_at:      row?.requested_at || null,
    trial_used:        Boolean(row?.trial_used),
    trial_expires_at:  row?.trial_expires_at || null,
  };
}

async function isPremium(userId) {
  try {
    await expireTrialIfNeeded(userId);
    const row = (await db.execute({
      sql: `SELECT is_premium FROM user_premium WHERE user_id = ?`, args: [userId],
    })).rows[0];
    return Boolean(row?.is_premium);
  } catch (_) { return false; }
}

module.exports = { getPremium, isPremium, expireTrialIfNeeded };
