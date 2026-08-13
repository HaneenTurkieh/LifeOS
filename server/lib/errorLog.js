const { db } = require('../db/connection');

// Fire-and-forget failure logging — gives Haneen (the app owner) actual
// visibility into when Lumi/AI-backed features fail for a real user,
// instead of relying on someone happening to report it. Never throws:
// a logging failure must never turn into a second error stacked on top
// of the original one, so every failure here is swallowed and just
// printed to the server console as a last resort.
async function logError(userId, source, message) {
  try {
    await db.execute({
      sql:  `INSERT INTO error_logs (user_id, source, message) VALUES (?, ?, ?)`,
      args: [userId || null, source, String(message || '').slice(0, 500)],
    });
  } catch (err) {
    console.error('logError failed (non-fatal):', err.message);
  }
}

module.exports = { logError };
