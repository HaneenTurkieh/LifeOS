const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const {
  hashPassword,
  comparePassword,
  signToken,
  authenticate,
  generateResetToken,
  hashResetToken,
} = require('../lib/auth');
const { sendPasswordResetEmail } = require('../lib/email');
const { rateLimit }              = require('../lib/rateLimit');

const EMAIL_RE               = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_TOKEN_TTL_MINUTES = 30;

// ── Public user shape ─────────────────────────────────────────
function publicUser(row) {
  return {
    id:       row.id,
    name:     row.name,
    email:    row.email,
    avatar:   row.avatar   || null,
    gender:   row.gender   || null,
    birthday: row.birthday || null,
    bio:      row.bio      || null,
  };
}

// ── POST /register ────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim())                   return res.status(400).json({ error: 'Name is required' });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName     = name.trim();

  try {
    const existing = await db.execute({
      sql:  `SELECT id FROM users WHERE email = ? COLLATE NOCASE`,
      args: [normalizedEmail],
    });
    if (existing.rows[0]) return res.status(409).json({ error: 'An account with that email already exists' });

    const password_hash = await hashPassword(password);
    const insert = await db.execute({
      sql:  `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`,
      args: [trimmedName, normalizedEmail, password_hash],
    });
    const user = (await db.execute({
      sql:  `SELECT * FROM users WHERE id = ?`,
      args: [Number(insert.lastInsertRowid)],
    })).rows[0];

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── POST /login ───────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const result = await db.execute({
      sql:  `SELECT * FROM users WHERE email = ? COLLATE NOCASE`,
      args: [email.trim().toLowerCase()],
    });
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /me ───────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.execute({
      sql:  `SELECT * FROM users WHERE id = ?`,
      args: [req.user.id],
    });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /me — update profile ────────────────────────────────
router.patch('/me', authenticate, async (req, res) => {
  const { name, gender, birthday, bio, avatar } = req.body;

  // Limit avatar to ~300KB base64
  if (avatar && avatar.length > 400000) {
    return res.status(400).json({ error: 'Avatar image is too large. Use an image under 300KB.' });
  }

  const setClauses = [];
  const args       = [];

  if (name     !== undefined) { setClauses.push('name = ?');     args.push(name.trim()); }
  if (gender   !== undefined) { setClauses.push('gender = ?');   args.push(gender);      }
  if (birthday !== undefined) { setClauses.push('birthday = ?'); args.push(birthday);    }
  if (bio      !== undefined) { setClauses.push('bio = ?');      args.push(bio);         }
  if (avatar   !== undefined) { setClauses.push('avatar = ?');   args.push(avatar);      }

  if (!setClauses.length) return res.status(400).json({ error: 'Nothing to update' });

  try {
    args.push(req.user.id);
    await db.execute({
      sql:  `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
      args,
    });
    const result = await db.execute({
      sql:  `SELECT * FROM users WHERE id = ?`,
      args: [req.user.id],
    });
    res.json({ user: publicUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /me/password — change password ───────────────────────
router.post('/me/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both fields are required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  try {
    const result = await db.execute({
      sql:  `SELECT * FROM users WHERE id = ?`,
      args: [req.user.id],
    });
    const user  = result.rows[0];
    const valid = await comparePassword(currentPassword, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const password_hash = await hashPassword(newPassword);
    await db.execute({
      sql:  `UPDATE users SET password_hash = ? WHERE id = ?`,
      args: [password_hash, req.user.id],
    });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /forgot-password ─────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });

  const normalizedEmail = email.trim().toLowerCase();
  const limited = rateLimit(
    [`forgot:ip:${req.ip}`, `forgot:email:${normalizedEmail}`],
    {
      'forgot:ip:':    { max: 10, windowMs: 60 * 60 * 1000 },
      'forgot:email:': { max: 3,  windowMs: 60 * 60 * 1000 },
    }
  );
  if (limited) return res.status(429).json({ error: 'Too many requests. Please try again later.' });

  const generic = { message: 'If an account with that email exists, a password reset link has been sent.' };

  try {
    const result = await db.execute({
      sql:  `SELECT * FROM users WHERE email = ? COLLATE NOCASE`,
      args: [normalizedEmail],
    });
    const user = result.rows[0];
    if (!user) return res.json(generic);

    const { rawToken, tokenHash } = generateResetToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
    await db.execute({
      sql:  `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
      args: [user.id, tokenHash, expiresAt],
    });

    try { await sendPasswordResetEmail({ to: user.email, name: user.name, rawToken }); }
    catch (e) { console.error('Email send failed:', e); }

    res.json(generic);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /reset-password/:token ────────────────────────────────
router.get('/reset-password/:token', async (req, res) => {
  try {
    const tokenHash = hashResetToken(req.params.token);
    const result    = await db.execute({
      sql:  `SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`,
      args: [tokenHash],
    });
    res.json({ valid: !!result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /reset-password ──────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token)   return res.status(400).json({ error: 'Reset token is required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const tokenHash  = hashResetToken(token);
    const resetResult = await db.execute({
      sql:  `SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`,
      args: [tokenHash],
    });
    const resetRow = resetResult.rows[0];
    if (!resetRow) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });

    const password_hash = await hashPassword(password);
    await db.batch([
      { sql: `UPDATE users SET password_hash = ? WHERE id = ?`,
        args: [password_hash, resetRow.user_id] },
      { sql: `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?`,
        args: [resetRow.id] },
      { sql: `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL AND id != ?`,
        args: [resetRow.user_id, resetRow.id] },
    ], 'write');

    res.json({ message: 'Your password has been reset. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /me ────────────────────────────────────────────────
router.delete('/me', authenticate, async (req, res) => {
  try {
    const result = await db.execute({
      sql:  `DELETE FROM users WHERE id = ?`,
      args: [req.user.id],
    });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'User not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;