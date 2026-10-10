const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { db }  = require('../db/connection');
const {
  hashPassword,
  comparePassword,
  needsRehash,
  signToken,
  authenticate,
  generateResetToken,
  hashResetToken,
  validatePassword,
  revokeToken,
  revokeAllUserTokens,
  burnPasswordCheck,
} = require('../lib/auth');
const { sendPasswordResetEmail, sendInstructorCredentialsEmail, sendVerificationEmail } = require('../lib/email');
const { DEMO_EMAIL, DEMO_SESSION_MINUTES, isDemoEmail } = require('../lib/demo');
const { rateLimit }              = require('../lib/rateLimit');
const { addXp }                  = require('../lib/gamification');
const { isOwnerEmail }           = require('../lib/ownerEmails');

const EMAIL_RE               = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_TOKEN_TTL_MINUTES = 30;
const WELCOME_XP              = 100;

// Only actually verifies tokens if GOOGLE_CLIENT_ID is set — same
// "off until configured" approach as everything else that depends on an
// optional env var in this app (Resend emails, etc.). audience is left
// undefined below when unset, but the route itself checks first and
// refuses before ever reaching that point.
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || undefined);

// Same shape of 429 used by every limiter below.
function tooMany(res, msg = 'Too many requests. Please try again later.') {
  return res.status(429).json({ error: msg });
}

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
    // Owner powers need a VERIFIED email, so nobody can get them just by
    // signing up with the owner's address.
    isOwner:  isOwnerEmail(row.email) && !!Number(row.email_verified),
    emailVerified: !!Number(row.email_verified),
    isDemo:   isDemoEmail(row.email),
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
  const hex = crypto.randomBytes(9).toString('hex'); // 18 hex chars = 72 bits of randomness
  const sym = '!#$%*'[crypto.randomInt(0, 5)];
  return `Nv${hex}${sym}`;
}

// ── Email verification helpers ─────────────────────────────────
// Stores only a SHA-256 hash of the emailed token (like password reset).
const VERIFY_TTL_HOURS = 24;
async function issueVerification(user) {
  const rawToken  = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await db.execute({
    sql:  `UPDATE users SET verify_token_hash = ?, verify_expires = datetime('now', '+${VERIFY_TTL_HOURS} hours') WHERE id = ?`,
    args: [tokenHash, user.id],
  });
  await sendVerificationEmail({ to: user.email, name: user.name, rawToken });
}
// Never let a mail problem break sign-up — the account works either way and
// the user can resend from Settings.
function sendVerificationSafely(user) {
  issueVerification(user).catch((e) => console.error('Verification email failed:', e.message));
}

// ── POST /register ────────────────────────────────────────────
router.post('/register', async (req, res) => {
  // Nothing used to limit signups: a script could mint unlimited accounts
  // (and burn Argon2 CPU doing it). 40/hour/IP leaves plenty of room for a
  // whole classroom signing up from one campus Wi-Fi address.
  if (rateLimit([`register:ip:${req.ip}`], { 'register:ip:': { max: 40, windowMs: 60 * 60 * 1000 } })) {
    return tooMany(res, 'Too many sign-ups from this network. Please try again later.');
  }
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (name.trim().length > 100)        return res.status(400).json({ error: 'Name is too long' });
  if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'A valid email is required' });
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

    sendVerificationSafely(user);
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
  const { name, email } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (name.trim().length > 100)        return res.status(400).json({ error: 'Name is too long' });
  if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'A valid email is required' });

  // This endpoint EMAILS a password to whatever address is typed in, with
  // no login required — so without limits it doubles as a way to spam
  // anyone's inbox. Tight per-IP cap, plus a per-target-address cap so one
  // victim address can't be hit repeatedly from many IPs.
  if (rateLimit(
    [`reginst:ip:${req.ip}`, `reginst:email:${email.trim().toLowerCase()}`],
    {
      'reginst:ip:':    { max: 10, windowMs: 60 * 60 * 1000 },
      'reginst:email:': { max: 2,  windowMs: 24 * 60 * 60 * 1000 },
    }
  )) {
    return tooMany(res);
  }

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

    sendVerificationSafely(user);
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
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (email.length > 254 || password.length > 1000) return res.status(400).json({ error: 'Invalid email or password' });

    const loginEmail = email.trim().toLowerCase();

    // The shared demo account has no usable password — visitors use the
    // "Try the demo" button (POST /demo), which gives a short read-only session.
    if (isDemoEmail(loginEmail)) {
      return res.status(403).json({ error: 'Use the "Try the demo" button to explore the demo account.' });
    }

    // Nothing previously stopped unlimited password guesses against a
    // known email — per-IP catches a single attacker hammering many
    // accounts, per-email catches many attempts (e.g. a botnet) against
    // one target account. Same two-key pattern as /forgot-password below.
    const limited = rateLimit(
      [`login:ip:${req.ip}`, `login:email:${loginEmail}`],
      {
        // Was 20. Now that req.ip is the REAL client address (see
        // `trust proxy` in index.js) this bucket is per-network, and a
        // campus/classroom shares one public IP — 20 would lock out a lecture
        // hall logging in together. The per-email cap below is what
        // actually stops password guessing against one account.
        'login:ip:':    { max: 100, windowMs: 15 * 60 * 1000 },
        'login:email:': { max: 8,  windowMs: 15 * 60 * 1000 },
      }
    );
    if (limited) return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });

    const result = await db.execute({
      sql:  `SELECT * FROM users WHERE email = ? COLLATE NOCASE`,
      args: [loginEmail],
    });
    const user = result.rows[0];
    if (!user) {
      await burnPasswordCheck(password); // same cost as a real account — see lib/auth.js
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    // Transparent bcrypt → Argon2id migration: the only moment we ever
    // have the real plaintext password in memory is right here, right
    // after it's been verified — so this is the one safe place to
    // re-hash it with the new algorithm and quietly upgrade the stored
    // hash. No forced reset, no user-visible change, and every account
    // upgrades itself the next time its owner logs in. Non-fatal if it
    // fails for some reason — login already succeeded either way.
    if (needsRehash(user.password_hash)) {
      try {
        const upgraded = await hashPassword(password);
        await db.execute({
          sql:  `UPDATE users SET password_hash = ? WHERE id = ?`,
          args: [upgraded, user.id],
        });
      } catch (e) {
        console.error('Password hash upgrade failed (non-fatal):', e.message);
      }
    }

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
//
// `role` ('student' | 'instructor', optional) mirrors Login.jsx's signup
// role picker and only matters for brand-new accounts created with
// intent 'signup' — see the wantsInstructor check below.
router.post('/google', async (req, res) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: 'Google sign-in is not configured yet.' });
    }
    if (rateLimit([`google:ip:${req.ip}`], { 'google:ip:': { max: 120, windowMs: 15 * 60 * 1000 } })) {
      return tooMany(res);
    }
    const { credential, intent, role } = req.body || {};
    if (typeof credential !== 'string' || !credential) return res.status(400).json({ error: 'Missing Google credential' });

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

    // Pre-registration takeover defence: if someone signed up with this
    // address by password but never proved they own it, and the real owner
    // now signs in with Google (which DOES prove it), the earlier password
    // sign-up must not keep working. Mark it verified, replace its password
    // with a random one and end any sessions it had.
    if (user && !Number(user.email_verified) && !isDemoEmail(user.email)) {
      const lockedHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
      await db.execute({
        sql:  `UPDATE users SET email_verified = 1, password_hash = ?, verify_token_hash = NULL, verify_expires = NULL WHERE id = ?`,
        args: [lockedHash, user.id],
      });
      await revokeAllUserTokens(user.id);
      user = (await db.execute({ sql: `SELECT * FROM users WHERE id = ?`, args: [user.id] })).rows[0];
    }

    let welcomeXpAwarded = 0;
    if (!user) {
      const trimmedName   = (payload.name || normalizedEmail.split('@')[0]).trim();
      const password_hash = await hashPassword(crypto.randomBytes(32).toString('hex'));
      // Real bug this fixes: Login.jsx's role picker (student/instructor,
      // shown on the signup screen) was never actually wired to the
      // Google button — every brand-new Google account was created as a
      // plain student no matter which one was selected, silently
      // discarding the choice. Only trusted on 'signup' (an existing
      // account found above keeps whatever role it already has — signing
      // back in can never change it), and only 'instructor' is a
      // meaningful value here; anything else falls back to the normal
      // student default. This isn't a new privilege — POST
      // /register-instructor already lets anyone self-serve an instructor
      // account with just a name + email, no approval step; this just
      // lets the same free choice happen through the Google button too.
      const wantsInstructor = intent === 'signup' && role === 'instructor';
      const insert = await db.execute({
        sql: wantsInstructor
          ? `INSERT INTO users (name, email, password_hash, role, email_verified) VALUES (?, ?, ?, 'instructor', 1)`
          : `INSERT INTO users (name, email, password_hash, email_verified) VALUES (?, ?, ?, 1)`,
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

    // Everything below used to be stored exactly as sent — no type or length
    // checks at all (only avatar had a size cap). Besides bloating rows,
    // `avatar` is rendered as an <img src> on OTHER users' screens
    // (leaderboards, channels, rooms), so an arbitrary URL there would let
    // someone log the IP of everyone who views their profile. The app only
    // ever produces a data:image/jpeg URL from its own cropper, so that's
    // all that's accepted now.
    const strField = (v, max) => v === null || v === '' || (typeof v === 'string' && v.length <= max);
    if (name !== undefined && (!name.trim() || name.trim().length > 100)) {
      return res.status(400).json({ error: 'Name must be between 1 and 100 characters.' });
    }
    if (gender   !== undefined && !strField(gender, 30))    return res.status(400).json({ error: 'Invalid gender value.' });
    if (birthday !== undefined && !strField(birthday, 10))  return res.status(400).json({ error: 'Invalid birthday.' });
    if (bio      !== undefined && !strField(bio, 1000))     return res.status(400).json({ error: 'Bio is too long (1000 characters max).' });
    if (avatar !== undefined && avatar !== null && avatar !== '') {
      if (typeof avatar !== 'string' || !/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(avatar)) {
        return res.status(400).json({ error: 'Avatar must be an uploaded image.' });
      }
      // Limit avatar to ~300KB base64
      if (avatar.length > 400000) {
        return res.status(400).json({ error: 'Avatar image is too large. Use an image under 300KB.' });
      }
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
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both fields are required' });
  }
  // A stolen token alone shouldn't be enough to brute-force the current
  // password here either.
  if (rateLimit([`pwchange:user:${req.user.id}`], { 'pwchange:user:': { max: 10, windowMs: 15 * 60 * 1000 } })) {
    return tooMany(res);
  }
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
    // Changing a password has to end every OTHER session — the whole point
    // of changing it after a suspected leak is that anyone already holding a
    // token gets thrown out. This device gets a fresh token back so the
    // person who just changed it isn't logged out themselves.
    await revokeAllUserTokens(req.user.id);
    const fresh = (await db.execute({ sql: `SELECT * FROM users WHERE id = ?`, args: [req.user.id] })).rows[0];
    res.json({ message: 'Password updated successfully', token: signToken(fresh) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /forgot-password ─────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: 'A valid email is required' });

  const normalizedEmail = email.trim().toLowerCase();
  const limited = rateLimit(
    [`forgot:ip:${req.ip}`, `forgot:email:${normalizedEmail}`],
    {
      'forgot:ip:':    { max: 30, windowMs: 60 * 60 * 1000 },
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
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || !token) return res.status(400).json({ error: 'Reset token is required' });
  if (rateLimit([`reset:ip:${req.ip}`], { 'reset:ip:': { max: 30, windowMs: 60 * 60 * 1000 } })) return tooMany(res);
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
      // Opening the emailed reset link proves the person controls this inbox.
      { sql: `UPDATE users SET password_hash = ?, email_verified = 1 WHERE id = ?`,
        args: [password_hash, resetRow.user_id] },
      { sql: `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?`,
        args: [resetRow.id] },
      { sql: `UPDATE password_reset_tokens SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL AND id != ?`,
        args: [resetRow.user_id, resetRow.id] },
    ], 'write');

    // A reset is account RECOVERY — assume whoever already had a session
    // may be the reason it was needed, and end all of them.
    await revokeAllUserTokens(resetRow.user_id);

    res.json({ message: 'Your password has been reset. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /verify-email — open the emailed link ──────────────────
// POST (not GET) so mail scanners that pre-open links can't use up the
// token, and so a link can't be triggered by simply visiting a URL.
router.post('/verify-email', async (req, res) => {
  const { token } = req.body || {};
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ error: 'This confirmation link is invalid or has expired.' });
  }
  if (rateLimit([`verify:ip:${req.ip}`], { 'verify:ip:': { max: 40, windowMs: 60 * 60 * 1000 } })) return tooMany(res);
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const row = (await db.execute({
      sql:  `SELECT id FROM users WHERE verify_token_hash = ? AND verify_expires > datetime('now')`,
      args: [tokenHash],
    })).rows[0];
    if (!row) return res.status(400).json({ error: 'This confirmation link is invalid or has expired.' });
    await db.execute({
      sql:  `UPDATE users SET email_verified = 1, verify_token_hash = NULL, verify_expires = NULL WHERE id = ?`,
      args: [row.id],
    });
    res.json({ message: 'Your email is confirmed. Thank you!', verified: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /resend-verification — send the link again ─────────────
router.post('/resend-verification', authenticate, async (req, res) => {
  try {
    if (req.user.isDemo) return res.status(403).json({ error: 'Not available in demo mode.' });
    if (rateLimit([`resendverify:user:${req.user.id}`], { 'resendverify:user:': { max: 4, windowMs: 60 * 60 * 1000 } })) {
      return tooMany(res, 'Too many emails requested. Please wait a while and try again.');
    }
    const user = (await db.execute({ sql: `SELECT * FROM users WHERE id = ?`, args: [req.user.id] })).rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (Number(user.email_verified)) return res.json({ message: 'Your email is already confirmed.', verified: true });
    await issueVerification(user);
    res.json({ message: 'Confirmation email sent. Check your inbox (and spam folder).' });
  } catch (err) {
    console.error('Resend verification error:', err.message);
    res.status(500).json({ error: 'Could not send the email right now. Please try again later.' });
  }
});

// ── POST /demo — start a short, READ-ONLY demo session ──────────
router.post('/demo', async (req, res) => {
  if (rateLimit([`demo:ip:${req.ip}`], { 'demo:ip:': { max: 60, windowMs: 60 * 60 * 1000 } })) return tooMany(res);
  try {
    const user = (await db.execute({ sql: `SELECT * FROM users WHERE email = ? COLLATE NOCASE`, args: [DEMO_EMAIL] })).rows[0];
    if (!user) return res.status(404).json({ error: 'The demo is not available right now.' });
    res.json({
      token: signToken(user, { expiresIn: `${DEMO_SESSION_MINUTES}m` }),
      user:  publicUser(user),
      demoMinutes: DEMO_SESSION_MINUTES,
    });
  } catch (err) {
    console.error('Demo error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /logout — actually END this session server-side ──────────
// Before this, "Log out" only deleted the token from the browser; the
// token itself stayed valid until its 7-day expiry, so anyone who had
// copied it (or replayed it later) was still logged in. This revokes just
// THIS token, so the user's other devices stay signed in. The shared demo
// account is the one exception: everyone trying the demo is signed into
// the same user, and one visitor logging out must not boot the rest.
router.post('/logout', authenticate, async (req, res) => {
  try {
    if ((req.user.email || '').toLowerCase() !== 'demo@nuvora.app') {
      await revokeToken(req.tokenPayload);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('logout error:', err);
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