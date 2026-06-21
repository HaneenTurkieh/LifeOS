// lib/auth.js
// Password hashing + JWT helpers, password-reset token helpers, and the
// Express middleware that protects routes. Centralized here so
// routes/auth.js and index.js both stay simple.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// In production, ALWAYS set a real JWT_SECRET environment variable.
// This fallback only exists so the app still runs out of the box in dev.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me';
const TOKEN_EXPIRY = '7d';

if (process.env.NODE_ENV !== 'test' && !process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET is not set — using an insecure development default. Set JWT_SECRET in server/.env before deploying.');
}

async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET); // throws if invalid/expired
}

// Express middleware: requires a valid `Authorization: Bearer <token>`
// header. On success it sets req.user = { id, name, email }.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
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
  hashPassword, comparePassword, signToken, verifyToken, authenticate,
  generateResetToken, hashResetToken, timingSafeEqual,
};