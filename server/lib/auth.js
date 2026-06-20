// lib/auth.js
// Password hashing + JWT helpers, and the Express middleware that
// protects routes. Centralized here so routes/auth.js and index.js
// both stay simple.

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
  // Keep the payload small — id is all most routes need; name/email are
  // convenient for the frontend to read without an extra request.
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

module.exports = { hashPassword, comparePassword, signToken, verifyToken, authenticate };