// index.js — Express API entry point
// Run with `npm run dev` (auto-reload) or `npm start` from the server/ folder.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authenticate } = require('./lib/auth');
const { initDb } = require('./db/connection'); // ← CHANGED: destructure initDb

const app = express();
const PORT = process.env.PORT || 4000;

app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'https://life-os-three-xi.vercel.app',
    'https://life-os-git-main-ctrl-alt-elite07.vercel.app',
    'https://nuvora.ps',
    'https://www.nuvora.ps',
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Paddle webhooks must be verified against the exact raw request body
// (HMAC signature), so this route gets express.raw() BEFORE the global
// express.json() below — otherwise the body would already be parsed
// into an object and re-serializing it would break the signature check.
app.use('/api/paddle/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// Public routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/paddle', require('./routes/paddle')); // webhook is unauthenticated; verified via Paddle-Signature instead
app.use('/api/cron', require('./routes/cron')); // no JWT — protected by CRON_SECRET header instead, checked inside

// Protected routes
app.use('/api/tasks',        authenticate, require('./routes/tasks'));
app.use('/api/habits',       authenticate, require('./routes/habits'));
app.use('/api/goals',        authenticate, require('./routes/goals'));
app.use('/api/learning',     authenticate, require('./routes/learning'));
app.use('/api/mood',         authenticate, require('./routes/mood'));
app.use('/api/internships',  authenticate, require('./routes/internships'));
app.use('/api/cv',           authenticate, require('./routes/cv'));
app.use('/api/projects',     authenticate, require('./routes/projects'));
app.use('/api/ai',           authenticate, require('./routes/ai'));
app.use('/api/dashboard',    authenticate, require('./routes/dashboard'));
app.use('/api/gamification', authenticate, require('./routes/gamification'));
app.use('/api/focus', authenticate, require('./routes/focus'));
app.use('/api/analytics',    authenticate, require('./routes/analytics'));
app.use('/api/feedback',     authenticate, require('./routes/feedback'));
app.use('/api/history',      authenticate, require('./routes/history'));
app.use('/api/chat', authenticate, require('./routes/chat'));
app.use('/api/trees', authenticate, require('./routes/trees'));
app.use('/api/notifications', authenticate, require('./routes/notifications'));
app.use('/api/push', authenticate, require('./routes/push'));
app.use('/api/exam', authenticate, require('./routes/exam'));
app.use('/api/admin', authenticate, require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'Personal Life Dashboard API' }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  // Used to send back `detail: err.message` — the one place in the app
  // that leaked a raw internal error string to the client (every
  // hand-written route catch block elsewhere returns a generic message
  // instead). Concretely reachable via multer's file-size-limit error on
  // an oversized upload, which skips every route's own try/catch and
  // lands here directly.
  res.status(500).json({ error: 'Server error' });
});

// Safety net for the exact class of bug that used to crash the whole
// server on a single bad request (see auth.js PATCH /me — a synchronous
// throw outside any try/catch inside an async handler becomes an
// unhandled rejection, which Node terminates the process on by default).
// This can't save the request that caused it (that one still fails), but
// it stops one bad request from taking down every other user's session
// too. The real fix is still "wrap every handler in try/catch" — this is
// the backstop for whichever one gets missed next.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection (server stayed up):', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server stayed up):', err);
});

// ← CHANGED: initDb() runs first, then the server starts listening.
// If the DB connection fails, the process exits loudly instead of
// starting a server that crashes on every request.
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Life Dashboard API running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database init failed, server not started:', err);
    process.exit(1);
  });