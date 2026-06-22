const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');
const { hashPassword, comparePassword, signToken, authenticate, generateResetToken, hashResetToken } = require('../lib/auth');
const { sendPasswordResetEmail } = require('../lib/email');
const { rateLimit } = require('../lib/rateLimit');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_TOKEN_TTL_MINUTES = 30;

function publicUser(row) { return { id: row.id, name: row.name, email: row.email }; }

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  try {
    const password_hash = await hashPassword(password);

    // Check then insert — race condition still caught by unique index below
    const existingResult = await db.execute({ sql: `SELECT id FROM users WHERE email = ? COLLATE NOCASE`, args: [normalizedEmail] });
    if (existingResult.rows[0]) return res.status(409).json({ error: 'An account with that email already exists' });

    const insertResult = await db.execute({ sql: `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`, args: [trimmedName, normalizedEmail, password_hash] });
    const userResult = await db.execute({ sql: `SELECT * FROM users WHERE id = ?`, args: [Number(insertResult.lastInsertRowid)] });
    const user = userResult.rows[0];

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    if (err.statusCode === 409 || err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Something went wrong creating your account. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const result = await db.execute({ sql: `SELECT * FROM users WHERE email = ? COLLATE NOCASE`, args: [email.trim().toLowerCase()] });
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.execute({ sql: `SELECT * FROM users WHERE id = ?`, args: [req.user.id] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(user) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  const normalizedEmail = email.trim().toLowerCase();
  const limited = rateLimit([`forgot:ip:${req.ip}`, `forgot:email:${normalizedEmail}`], {
    'forgot:ip:':    { max: 10, windowMs: 60 * 60 * 1000 },
    'forgot:email:': { max: 3,  windowMs: 60 * 60 * 1000 },
  });
  if (limited) return res.status(429).json({ error: 'Too many requests. Please try again later.' });

  const genericResponse = { message: 'If an account with that email exists, a password reset link has been sent.' };
  try {
    const result = await db.execute({ sql: `SELECT * FROM users WHERE email = ? COLLATE NOCASE`, args: [normalizedEmail] });
    const user = result.rows[0];
    if (!user) return res.json(genericResponse);

    const { rawToken, tokenHash } = generateResetToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
    await db.execute({ sql: `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`, args: [user.id, tokenHash, expiresAt] });

    try { await sendPasswordResetEmail({ to: user.email, name: user.name, rawToken }); }
    catch (err) { console.error('Failed to send password reset email:', err); }

    res.json(genericResponse);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/reset-password/:token', async (req, res) => {
  try {
    const tokenHash = hashResetToken(req.params.token);
    const result = await db.execute({
      sql: `SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`,
      args: [tokenHash],
    });
    res.json({ valid: !!result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token) return res.status(400).json({ error: 'Reset token is required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  try {
    const tokenHash = hashResetToken(token);
    const resetResult = await db.execute({
      sql: `SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`,
      args: [tokenHash],
    });
    const resetRow = resetResult.rows[0];
    if (!resetRow) return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });

    const password_hash = await hashPassword(password);
    await db.batch([
      { sql: `UPDATE users SET password_hash = ? WHERE id = ?`, args: [password_hash, resetRow.user_id] },
      { sql: `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?`, args: [resetRow.id] },
      { sql: `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL AND id != ?`, args: [resetRow.user_id, resetRow.id] },
    ], 'write');

    res.json({ message: 'Your password has been reset. You can now log in with your new password.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/me', authenticate, async (req, res) => {
  try {
    const result = await db.execute({ sql: `DELETE FROM users WHERE id = ?`, args: [req.user.id] });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'User not found' });
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;