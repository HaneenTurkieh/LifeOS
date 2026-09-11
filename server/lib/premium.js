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
//
// Extended (Sept 2026) to cover premium_expires_at the same way — a
// bank-transfer purchase (routes/admin.js's approve action) is a
// one-time payment with nothing that bills again automatically, so
// without this a $4.99 Monthly transfer left someone Premium forever.
// Both checks run every time; they're mutually exclusive in practice
// (trial_expires_at only ever gets set alongside plan='trial',
// premium_expires_at only by a bank-transfer approval) but there's no
// harm running both unconditionally.
async function expireTrialIfNeeded(userId) {
  const nowIso = new Date().toISOString();
  // Per Haneen's spec: purple/aurora is the standard look for everyone —
  // premium-only accent/background choices belong to premium, so losing
  // premium (trial lapsing or a bank-transfer period running out) resets
  // theme_preset/background_style back to the defaults right alongside
  // is_premium flipping to 0. Without this a lapsed account could keep
  // whatever non-purple accent it had picked while premium, indefinitely.
  // (The birthday pink/blue override is separate — client-side only,
  // applied on top of whatever theme_preset this returns — so it isn't
  // affected by this reset.)
  await db.execute({
    sql: `UPDATE user_premium
          SET is_premium = 0, theme_preset = 'purple', background_style = 'aurora'
          WHERE user_id = ? AND is_premium = 1
            AND trial_expires_at IS NOT NULL
            AND trial_expires_at < ?`,
    args: [userId, nowIso],
  });
  await db.execute({
    sql: `UPDATE user_premium
          SET is_premium = 0, theme_preset = 'purple', background_style = 'aurora'
          WHERE user_id = ? AND is_premium = 1
            AND premium_expires_at IS NOT NULL
            AND premium_expires_at < ?`,
    args: [userId, nowIso],
  });
}

async function getPremium(userId) {
  await expireTrialIfNeeded(userId);
  const row = (await db.execute({
    sql: `SELECT is_premium, freeze_date, theme_preset, background_style, plan, requested_at, trial_used, trial_expires_at, premium_expires_at
          FROM user_premium WHERE user_id = ?`,
    args: [userId],
  })).rows[0];
  const isPremiumNow = Boolean(row?.is_premium);
  // Per Haneen's spec: purple/aurora is the one standard look for every
  // non-premium account — theme_preset/background_style are premium
  // customization, so a non-premium row never gets to show anything else,
  // no matter what's sitting in those columns (a stray value from before
  // this rule existed, a leftover from a lapsed trial, etc). The birthday
  // pink/blue override is separate and client-side (App.jsx), applied on
  // top of whatever this returns, so it isn't affected by this.
  return {
    is_premium:       isPremiumNow,
    freeze_date:       row?.freeze_date || null,
    theme_preset:      isPremiumNow ? (row?.theme_preset || 'purple') : 'purple',
    // Second personalization axis, alongside theme_preset — which
    // background mood (see GlobalBackground.jsx) the app uses. Same
    // shape/defaulting as theme_preset.
    background_style: isPremiumNow ? (row?.background_style || 'aurora') : 'aurora',
    plan:              row?.plan || null,
    requested_at:      row?.requested_at || null,
    trial_used:        Boolean(row?.trial_used),
    trial_expires_at:  row?.trial_expires_at || null,
    // Only ever set for a bank-transfer-paid period (see routes/admin.js)
    // — null for indefinite admin 'manual' comps. Lets the Premium tab
    // show "renews by <date>" instead of leaving a bank-transfer user
    // with no idea when they'll need to pay again.
    premium_expires_at: row?.premium_expires_at || null,
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
