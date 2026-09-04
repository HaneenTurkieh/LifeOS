const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { db }  = require('../db/connection');
const {
  hashPassword,
  comparePassword,
  signToken,
  authenticate,
  generateResetToken,
  hashResetToken,
  validatePassword,
} = require('../lib/auth');
const { sendPasswordResetEmail, sendInstructorCredentialsEmail } = require('../lib/email');
const { rateLimit }              = require('../lib/rateLimit');
const { addXp }                  = require('../lib/gamification');
const { isOwnerEmail }           = require('../lib/ownerEmails');

const EMAIL_RE               = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_TOKEN_TTL_MINUTES = 30;
const WELCOME_XP              = 100;

// Only actually verifies tokens if GOOGLE_CLIENT_ID is set — same
// "off until configured" approach as everything else that depends on an
// optional env var in this app (Resend emails, Paddle, etc.). audience is
// left undefined below when unset, but the route itself checks first and
// refuses before ever reaching that point.
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || undefined);

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
    // Lets the client show/hide the owner-only Stats tab without keeping
    // its own separate copy of the owner allowlist (see
    // lib/ownerEmails.js) — the server is the only place that ever
    // decides this now.
    isOwner:  isOwnerEmail(row.email),
    // 'student' | 'instructor' — see server/db/schema.sql / connection.js
    // migration. Drives the restricted instructor nav + the Channels
    // page's instructor-vs-student view on the client.
    role:     row.role || 'student',
  };
}

// A short, guaranteed-valid (per validatePassword's own rules: 8+ chars,
// a letter, a digit, a symbol) random password for instructor accounts,
// which never type their own password in — see POST /register-instructor
// below. Not meant to be memorable; it's emailed once and can be changed
// from Settings after first login.
function generateTempPassword() {
  const hex = crypto.randomBytes(4).toString('hex'); // 8 hex chars, letters+digits
  const sym = '!#$%*'[Math.floor(Math.random() * 5)];
  return `Nv${hex}${sym}`;
}

// ── POST /register ────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim())                   return res.status(400).json({ error: 'Name is required' });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

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

    // Welcome gift — one-time, brand new account only. addXp writes to
    // xp_log itself, so there's nothing to dedup here (a user only ever
    // registers once for a given row).
    //
    // Real bug that used to live here: the response always reported
    // welcomeXp: WELCOME_XP regardless of whether the grant above actually
    // succeeded — so a silent addXp failure told a brand-new user they'd
    // gotten 100 XP for a welcome gift they never actually received,
    // right at the very first moment of using the app.
    let welcomeXpAwarded = 0;
    try { await addXp(user.id, WELCOME_XP, 'Welcome gift'); welcomeXpAwarded = WELCOME_XP; }
    catch (e) { console.error('Welcome XP grant failed:', e); }

    res.status(201).json({ token: signToken(user), user: publicUser(user), welcomeXp: welcomeXpAwarded });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── POST /register-instructor ──────────────────────────────────
// Instructor signup path (Login.jsx's role picker): unlike /register,
// there's no password field on this form — per the spec, an instructor
// only types their name + email, Nuvora generates the password itself
// and emails it to them, and they're logged straight in on top of that
// (so the flow isn't blocked on them going to check their inbox first).
router.post('/register-instructor', async (req, res) => {
  const { name, email } = req.body;
  if (!name?.trim())                   return res.status(400).json({ error: 'Name is required' });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName     = name.trim();

  try {
    const existing = await db.execute({
      sql:  `SELECT id FROM users WHERE email = ? COLLATE NOCASE`,
      args: [normalizedEmail],
    });
    if (existing.rows[0]) return res.status(409).json({ error: 'An account with that email already exists' });

    const tempPassword  = generateTempPassword();
    const password_hash = await hashPassword(tempPassword);
    const insert = await db.execute({
      sql:  `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'instructor')`,
      args: [trimmedName, normalizedEmail, password_hash],
    });
    const user = (await db.execute({
      sql:  `SELECT * FROM users WHERE id = ?`,
      args: [Number(insert.lastInsertRowid)],
    })).rows[0];

    let welcomeXpAwarded = 0;
    try { await addXp(user.id, WELCOME_XP, 'Welcome gift'); welcomeXpAwarded = WELCOME_XP; }
    catch (e) { console.error('Welcome XP grant failed:', e); }

    // Credentials are emailed for the person's own record — the account
    // is also usable immediately via the token returned below, so a
    // failed/delayed email never blocks them from getting in right now.
    let emailSent = false;
    try {
      await sendInstructorCredentialsEmail({ to: normalizedEmail, name: trimmedName, tempPassword });
      emailSent = true;
    } catch (e) { console.error('Instructor credentials email failed:', e); }

    res.status(201).json({
      token: signToken(user), user: publicUser(user),
      welcomeXp: welcomeXpAwarded, emailSent,
    });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error('Instructor register error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── POST /login ───────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const loginEmail = email.trim().toLowerCase();

    // Nothing previously stopped unlimited password guesses against a
    // known email — per-IP catches a single attacker hammering many
    // accounts, per-email catches many attempts (e.g. a botnet) against
    // one target account. Same two-key pattern as /forgot-password below.
    const limited = rateLimit(
      [`login:ip:${req.ip}`, `login:email:${loginEmail}`],
      {
        'login:ip:':    { max: 20, windowMs: 15 * 60 * 1000 },
        'login:email:': { max: 8,  windowMs: 15 * 60 * 1000 },
      }
    );
    if (limited) return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });

    const result = await db.execute({
      sql:  `SELECT * FROM users WHERE email = ? COLLATE NOCASE`,
      args: [loginEmail],
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

// ── POST /google — "Continue with Google" ───────────────────────
// Verifies the ID token Google's client-side library hands back, then
// finds-or-creates a user by that token's (Google-verified) email — same
// account, whichever way someone signs in with a given address. New
// accounts get a random, never-usable password hash (there's no password
// login path for a Google-only account, but password_hash is NOT NULL)
// and the same one-time welcome XP as a normal registration.
//
// `intent` ('login' | 'signup') comes from which screen the button was
// clicked on (see Login.jsx). Sign Up keeps the find-or-create behavior
// above unconditionally — that's the normal "oh you already have an
// account, logging you in" courtesy. Sign In does NOT create an account:
// if the email has never signed up, it's rejected with a clear message
// instead of silently registering someone who only meant to log in.
// Missing/unrecognized intent falls back to the original find-or-create
// behavior, so this stays backward-compatible with any caller that
// doesn't send it.
router.post('/google', async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: 'Google sign-in is not configured yet.' });
    }
    const { credential, intent } = req.body;
    if (!credential) return res.status(400).json({ error: 'Missing Google credential' });

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken:  credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid Google credential' });
    }
    if (!payload?.email) return res.status(401).json({ error: 'Invalid Google credential' });
    if (!payload.email_verified) return res.status(401).json({ error: 'Google email is not verified' });

    const normalizedEmail = payload.email.trim().toLowerCase();
    let user = (await db.execute({
      sql:  `SELECT * FROM users WHERE email = ? COLLATE NOCASE`,
      args: [normalizedEmail],
    })).rows[0];

    if (!user && intent === 'login') {
      return res.status(404).json({ error: 'No Nuvora account found for this Google email yet. Sign up first.', code: 'NO_ACCOUNT' });
    }

    let welcomeXpAwarded = 0;
    if (!user) {
      const trimmedName   = (payload.name || normalizedEmail.split('@')[0]).trim();
      const password_hash = await hashPassword(crypto.randomBytes(32).toString('hex'));
      const insert = await db.execute({
        sql:  `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`,
        args: [trimmedName, normalizedEmail, password_hash],
      });
      user = (await db.execute({
        sql:  `SELECT * FROM users WHERE id = ?`,
        args: [Number(insert.lastInsertRowid)],
      })).rows[0];
      try { await addXp(user.id, WELCOME_XP, 'Welcome gift'); welcomeXpAwarded = WELCOME_XP; }
      catch (e) { console.error('Welcome XP grant failed:', e); }
    }

    res.json({ token: signToken(user), user: publicUser(user), welcomeXp: welcomeXpAwarded });
  } catch (err) {
    console.error('Google sign-in error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
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
  try {
    const { name, gender, birthday, bio, avatar } = req.body;

    // Real bug that used to live here: `name !== undefined` is true for
    // `name: null` (a client sending `{"name": null}` — a malformed
    // request, or an attempt to clear the field), and `null.trim()`
    // throws SYNCHRONOUSLY. That used to happen entirely outside any
    // try/catch, so it became an unhandled promise rejection — which
    // Node terminates the whole process on by default, not just the one
    // request. A single bad request could crash the server for every
    // user. Everything now runs inside this try block, and `name`
    // specifically is type-checked before `.trim()` ever touches it.
    if (name !== undefined && typeof name !== 'string') {
      return res.status(400).json({ error: 'Name must be text.' });
    }

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
  const pwError = validatePassword(newPassword);
  if (pwError) return res.status(400).json({ error: pwError });

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
    // Real bug this fixes: this used to be a plain .toISOString() —
    // "2026-08-20T18:45:00.000Z" — stored as expires_at and then compared
    // against SQLite's own `datetime('now')`, which produces the zone-less
    // "2026-08-20 18:45:00" (space, no millis, no Z). Both rows below
    // check `expires_at > datetime('now')` as a plain SQL string
    // comparison, so as long as the two strings shared the same calendar
    // day, character 11 alone ('T' vs ' ', and 'T' > ' ') decided the
    // result — meaning expires_at was JUDGED greater (token still valid)
    // regardless of what the actual time was, right up until UTC
    // midnight. A reset link meant to die after 30 minutes was actually
    // usable for however many hours were left in that UTC day — same
    // format mismatch already fixed elsewhere in this app (see
    // timerSync.mjs, NotificationBell), just in the opposite direction:
    // this is the write side generating a mismatched format, not a read
    // side failing to correct for one. Formatting to match
    // datetime('now')'s own shape makes the SQL string comparison
    // actually correct.
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000)
      .toISOString().slice(0, 19).replace('T', ' ');
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
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ error: pwError });

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