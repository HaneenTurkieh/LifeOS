// lib/auth.js
// Password hashing + JWT helpers, password-reset token helpers, and the
// Express middleware that protects routes. Centralized here so
// routes/auth.js and index.js both stay simple.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const { db } = require('../db/connection');
const { isDemoEmail } = require('./demo');

// In production, ALWAYS set a real JWT_SECRET environment variable.
//
// This used to fall back to a hardcoded string
// ('dev-only-insecure-secret-change-me') if the env var was ever missing,
// with only a console warning — nothing that actually stopped the server
// from starting. That string is sitting in the public GitHub repo, so if
// JWT_SECRET were ever accidentally unset on Render, anyone who'd read
// the source could forge a valid login token for ANY user account,
// including impersonating the owner. There's no reliable NODE_ENV
// convention set up anywhere in this app to safely distinguish "this is
// definitely production, refuse to start" from "this is definitely local
// dev, a fallback is fine" (npm start and npm run dev both leave NODE_ENV
// unset) — so refusing to start isn't a safe fail-fast here, it risks
// crashing a real deployment over a config-detection guess.
//
// A fresh, unpredictable secret generated once per process instead closes
// the actual hole either way: even if JWT_SECRET is missing in
// production, nobody can forge tokens against it, since nothing in the
// source predicts this value. The only user-visible cost is that
// existing sessions get invalidated on every server restart until
// JWT_SECRET is actually set — a real inconvenience, but a completely
// different class of problem than a forgeable auth token.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const TOKEN_EXPIRY = '7d';

if (process.env.NODE_ENV !== 'test' && !process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET is not set — using a random secret generated for this process only. Everyone will be logged out on the next restart. Set JWT_SECRET in server/.env (or your host\'s environment variables) to fix this permanently.');
}

// ---------- Password strength ----------
// Used by /register, /me/password, and /reset-password so the rule is
// enforced consistently no matter which route sets a password. Kept
// simple on purpose: length + character variety, not a full entropy
// scorer — mirrors what the client-side strength meter checks so the
// server never rejects something the UI showed as "strong".
const PASSWORD_MIN_LENGTH = 8;

// Checking only for the PRESENCE of a letter/digit/special char let
// something like "aaaaaaaa1!" or 8 spaces + "1a!" pass every check above
// while being almost entirely one padded-out repeated character — long,
// but not actually strong. This closes that hole without a full
// entropy/dictionary checker: reject anything that's mostly one repeated
// character run, or has very few distinct characters relative to its
// length. Mirrors getPasswordStrength's hasVariety check in Login.jsx.
function hasPasswordVariety(password) {
  const uniqueChars = new Set(password).size;
  const longestRun = (password.match(/(.)\1*/g) || [])
    .reduce((max, run) => Math.max(max, run.length), 0);
  return longestRun <= 2 && uniqueChars >= Math.ceil(password.length / 2);
}

// Upper bound so nobody can make the server Argon2-hash a huge string on
// every signup / login attempt (cheap CPU-exhaustion attack).
const PASSWORD_MAX_LENGTH = 200;

function validatePassword(password) {
  if (!password || typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  }
  if (!/[a-zA-Z]/.test(password)) {
    return 'Password must include at least one letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number';
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return 'Password must include at least one special character (like ! @ # $ %)';
  }
  if (!hasPasswordVariety(password)) {
    return 'Password is too repetitive (e.g. one character padded out) — please use a more varied password';
  }
  return null; // valid
}

// Switched from bcrypt to Argon2id (the mode the Password Hashing
// Competition recommends for general password storage — resists both
// GPU/ASIC cracking and side-channel timing attacks better than bcrypt).
// bcrypt was never actually broken or a real vulnerability here — this is
// a "best available" upgrade, not a fix for a bug. All NEW hashes use
// Argon2id from here on.
async function hashPassword(plainPassword) {
  return argon2.hash(plainPassword, { type: argon2.argon2id });
}

// Existing accounts still have bcrypt hashes in the DB (bcryptjs hashes
// always start with "$2a$"/"$2b$"/"$2y$"; Argon2 hashes start with
// "$argon2"). Switching hashPassword() above does nothing for THOSE
// accounts on its own — the old hash is what's still sitting in the DB
// until the user's password is rewritten. So comparePassword() checks
// the hash's own prefix and verifies against whichever algorithm
// actually produced it, and routes/auth.js's /login re-hashes with
// Argon2 (via needsRehash() below) the moment someone logs in
// successfully with an old hash — a transparent, gradual migration with
// zero forced resets and no account ever left un-upgradeable.
function comparePassword(plainPassword, hash) {
  if (typeof hash === 'string' && hash.startsWith('$2')) {
    return bcrypt.compare(plainPassword, hash);
  }
  return argon2.verify(hash, plainPassword);
}

// Login for an email that doesn't exist used to return in a couple of
// milliseconds while a real account took a full Argon2 verify — a timing
// difference that lets anyone probe which emails have accounts. Burning a
// real verify against a throwaway hash makes both paths cost the same.
let dummyHash = null;
async function burnPasswordCheck(plainPassword) {
  try {
    if (!dummyHash) dummyHash = await argon2.hash(crypto.randomBytes(16).toString('hex'), { type: argon2.argon2id });
    await argon2.verify(dummyHash, String(plainPassword));
  } catch (_) { /* irrelevant — only the elapsed time matters */ }
}

// True for any hash that isn't already Argon2 — i.e. still needs
// upgrading. Called right after a successful login.
function needsRehash(hash) {
  return !(typeof hash === 'string' && hash.startsWith('$argon2'));
}

// ---------- Session tokens + revocation ----------
// Every token carries:
//   jti — a random id, so ONE token can be revoked on its own (Log out)
//   tv  — the user's token_version at sign time, so ALL of a user's older
//         tokens die at once when it's bumped (password change / reset).
// Tokens issued before this existed have neither; they're treated as
// tv 0 / no jti, so nobody gets signed out by the rollout itself.
const revokedJtis = new Map();   // jti -> exp (seconds) — in-memory mirror of revoked_tokens
const versionCache = new Map();  // userId -> { tv, at } — short cache so auth isn't a DB hit per request
const VERSION_CACHE_MS = 15 * 1000;

function signToken(user, opts = {}) {
  return jwt.sign(
    {
      id: user.id, name: user.name, email: user.email,
      tv: Number(user.token_version || 0),
    },
    JWT_SECRET,
    { expiresIn: opts.expiresIn || TOKEN_EXPIRY, algorithm: 'HS256', jwtid: crypto.randomUUID() }
  );
}

function verifyToken(token) {
  // Pin the algorithm so a token can never pick its own ("alg" confusion).
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }); // throws if invalid/expired
}

// Loads the still-unexpired revocations into memory at boot, then keeps
// both the table and the Map tidy. Called once from index.js after initDb.
async function initAuth() {
  const nowSec = Math.floor(Date.now() / 1000);
  await db.execute({ sql: `DELETE FROM revoked_tokens WHERE expires_at < ?`, args: [nowSec] });
  const rows = (await db.execute(`SELECT jti, expires_at FROM revoked_tokens`)).rows;
  for (const r of rows) revokedJtis.set(r.jti, Number(r.expires_at));

  setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, exp] of revokedJtis.entries()) if (exp < now) revokedJtis.delete(jti);
    db.execute({ sql: `DELETE FROM revoked_tokens WHERE expires_at < ?`, args: [now] }).catch(() => {});
  }, 60 * 60 * 1000).unref();
}

// Revokes ONE token (plain Log out). Tokens minted before jti existed
// can't be singled out, so those fall back to bumping the user's version.
async function revokeToken(payload) {
  if (!payload?.jti) return revokeAllUserTokens(payload.id);
  const exp = Number(payload.exp) || Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
  revokedJtis.set(payload.jti, exp); // takes effect instantly on this instance
  await db.execute({
    sql: `INSERT OR REPLACE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)`,
    args: [payload.jti, exp],
  });
}

// Invalidates EVERY existing token for a user (password change/reset).
async function revokeAllUserTokens(userId) {
  await db.execute({ sql: `UPDATE users SET token_version = token_version + 1 WHERE id = ?`, args: [userId] });
  versionCache.delete(userId);
}

async function currentTokenVersion(userId) {
  const hit = versionCache.get(userId);
  const now = Date.now();
  if (hit && now - hit.at < VERSION_CACHE_MS) return hit.tv;
  const row = (await db.execute({ sql: `SELECT token_version FROM users WHERE id = ?`, args: [userId] })).rows[0];
  const tv = row ? Number(row.token_version || 0) : null; // null = account no longer exists
  versionCache.set(userId, { tv, at: now });
  if (versionCache.size > 20000) versionCache.clear(); // hard ceiling, can never grow unbounded
  return tv;
}

// Express middleware: requires a valid `Authorization: Bearer <token>`
// header. On success it sets req.user = { id, name, email } (plus
// req.tokenPayload with jti/exp for Log out). Also rejects tokens that
// were revoked, were issued before a password change/reset, or belong to
// an account that has since been deleted.
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (payload.jti && revokedJtis.has(payload.jti)) {
    return res.status(401).json({ error: 'Session ended. Please log in again.' });
  }

  try {
    const tv = await currentTokenVersion(payload.id);
    if (tv === null || Number(payload.tv || 0) !== tv) {
      return res.status(401).json({ error: 'Session ended. Please log in again.' });
    }
  } catch (err) {
    // Fail CLOSED: if we can't confirm the session is still valid, don't
    // let the request through.
    console.error('authenticate: session check failed:', err.message);
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
  }

  const isDemo = isDemoEmail(payload.email);
  // The shared demo account is strictly READ-ONLY (see lib/demo.js): it can
  // look at everything but change nothing, and it can always sign out.
  if (isDemo && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
      && req.originalUrl.split('?')[0] !== '/api/auth/logout') {
    return res.status(403).json({
      error: 'Demo mode is read-only. Create a free account to do this.',
      code:  'DEMO_READONLY',
    });
  }

  req.user = { id: payload.id, name: payload.name, email: payload.email, isDemo };
  req.tokenPayload = payload;
  next();
}

// Use AFTER authenticate on routes that move money or reach other people
// (payments, gifts, owner tools). Looks the flag up fresh from the DB so a
// token issued before verification can't carry stale information.
async function requireVerified(req, res, next) {
  try {
    const r = await db.execute({ sql: `SELECT email_verified FROM users WHERE id = ?`, args: [req.user.id] });
    if (!r.rows[0] || !Number(r.rows[0].email_verified)) {
      return res.status(403).json({
        error: 'Please confirm your email first: open the link we emailed you, or tap "Resend email" at the top of the page.',
        code:  'EMAIL_NOT_VERIFIED',
      });
    }
    next();
  } catch (err) {
    console.error('requireVerified:', err.message);
    res.status(503).json({ error: 'Service temporarily unavailable. Please try again.' });
  }
}

// ---------- Password reset tokens ----------
// The raw token goes in the emailed link only. We store a SHA-256 hash
// of it (same principle as never storing plaintext passwords) so a DB
// leak alone can't be used to reset anyone's password.

function generateResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  hashPassword, comparePassword, needsRehash, signToken, verifyToken, authenticate,
  generateResetToken, hashResetToken, timingSafeEqual, validatePassword,
  initAuth, revokeToken, revokeAllUserTokens, burnPasswordCheck, requireVerified,
};