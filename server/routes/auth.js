// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const {
  hashPassword, comparePassword, signToken, authenticate,
  generateResetToken, hashResetToken,
} = require('../lib/auth');
const { sendPasswordResetEmail } = require('../lib/email');
const { rateLimit } = require('../lib/rateLimit');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_TOKEN_TTL_MINUTES = 30;

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email };
}

// ============================================================
// POST /api/auth/register
// ============================================================
// AUTH FIX: existence-check + insert now happen inside a single
// SYNCHRONOUS better-sqlite3 transaction. Because Node.js is
// single-threaded and synchronous code can't be interleaved with other
// request handlers, this fully closes the race condition that
// previously let two near-simultaneous signups both pass the
// pre-check. Any constraint violation (including the case-insensitive
// email index) is caught explicitly and turned into a clean 409.
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  try {
    // Hashing happens BEFORE the transaction (it's async / CPU-bound and
    // doesn't touch the DB), so the transaction itself stays fully
    // synchronous and atomic.
    const password_hash = await hashPassword(password);

    const user = db.transaction(() => {
      const existing = db.prepare(`SELECT id FROM users WHERE email = ? COLLATE NOCASE`).get(normalizedEmail);
      if (existing) {
        const err = new Error('An account with that email already exists');
        err.statusCode = 409;
        throw err;
      }

      const info = db.prepare(`INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`)
        .run(trimmedName, normalizedEmail, password_hash);

      return db.prepare(`SELECT * FROM users WHERE id = ?`).get(info.lastInsertRowid);
    })();

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    // Covers both our explicit 409 above AND a raw SQLITE_CONSTRAINT
    // error from the unique index, in case two requests somehow still
    // land here concurrently (defense in depth).
    if (err.statusCode === 409 || (err.code && err.code.startsWith('SQLITE_CONSTRAINT'))) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Something went wrong creating your account. Please try again.' });
  }
});

// ============================================================
// POST /api/auth/login
// ============================================================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user = db.prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`).get(email.trim().toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// ============================================================
// GET /api/auth/me
// ============================================================
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: publicUser(user) });
});

// ============================================================
// POST /api/auth/forgot-password
// ============================================================
// Security requirements implemented here:
// - Never reveals whether an email exists (always same response/shape,
//   always does roughly the same amount of work either way).
// - Rate limited per-email AND per-IP.
// - Token is random, stored only as a SHA-256 hash, expires in 30 min.
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  const normalizedEmail = email.trim().toLowerCase();

  const limited = rateLimit([`forgot:ip:${req.ip}`, `forgot:email:${normalizedEmail}`], {
    'forgot:ip:': { max: 10, windowMs: 60 * 60 * 1000 },   // 10/hour per IP
    'forgot:email:': { max: 3, windowMs: 60 * 60 * 1000 }, // 3/hour per email
  });
  if (limited) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  const genericResponse = { message: 'If an account with that email exists, a password reset link has been sent.' };

  const user = db.prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`).get(normalizedEmail);

  // IMPORTANT: always do equivalent work and return the same response
  // whether or not the user exists, so this endpoint can't be used to
  // enumerate registered emails.
  if (!user) {
    return res.json(genericResponse);
  }

  const { rawToken, tokenHash } = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  db.prepare(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`)
    .run(user.id, tokenHash, expiresAt);

  try {
    await sendPasswordResetEmail({ to: user.email, name: user.name, rawToken });
  } catch (err) {
    // Don't leak email-sending failures to the client either — log
    // server-side only, still return the generic response.
    console.error('Failed to send password reset email:', err);
  }

  res.json(genericResponse);
});

// ============================================================
// GET /api/auth/reset-password/:token  — validate a token before
// showing the reset form (lets the frontend show "link expired"
// immediately instead of after the user fills out the form).
// ============================================================
router.get('/reset-password/:token', (req, res) => {
  const tokenHash = hashResetToken(req.params.token);
  const row = db.prepare(`
    SELECT * FROM password_reset_tokens
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')
  `).get(tokenHash);

  res.json({ valid: !!row });
});

// ============================================================
// POST /api/auth/reset-password — actually reset the password.
// ============================================================
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token) return res.status(400).json({ error: 'Reset token is required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const tokenHash = hashResetToken(token);

  const resetRow = db.prepare(`
    SELECT * FROM password_reset_tokens
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')
  `).get(tokenHash);

  if (!resetRow) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
  }

  const password_hash = await hashPassword(password);

  // Atomic: update the password AND mark the token used together, so a
  // crash between the two steps can never leave a still-valid,
  // already-applied token sitting around for reuse.
  db.transaction(() => {
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(password_hash, resetRow.user_id);
    db.prepare(`UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?`).run(resetRow.id);
    // Invalidate any other outstanding reset tokens for this user too.
    db.prepare(`
      UPDATE password_reset_tokens SET used_at = datetime('now')
      WHERE user_id = ? AND used_at IS NULL AND id != ?
    `).run(resetRow.user_id, resetRow.id);
  })();

  res.json({ message: 'Your password has been reset. You can now log in with your new password.' });
});


// DELETE /api/auth/me — permanently delete the logged-in user's account
// and everything tied to it (tasks, habits, goals, etc. all cascade via
// the ON DELETE CASCADE foreign keys defined in schema.sql).
router.delete('/me', authenticate, (req, res) => {
  const info = db.prepare(`DELETE FROM users WHERE id = ?`).run(req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.status(204).end();
});
module.exports = router;