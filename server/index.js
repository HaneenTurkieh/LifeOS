// index.js — Express API entry point
// Run with `npm run dev` (auto-reload) or `npm start` from the server/ folder.
require('dotenv').config();
const express = require('express');
const { authenticate, initAuth } = require('./lib/auth');
const { limiter } = require('./lib/rateLimit');
const { initDb } = require('./db/connection'); // ← CHANGED: destructure initDb

const app = express();
const PORT = process.env.PORT || 4000;

// ── Behind a proxy (Render) ───────────────────────────────────────
// Without this, req.ip is the address of Render's load balancer — the SAME
// for every visitor — so every per-IP rate limit (login, signup, reset…)
// was really ONE shared bucket for the entire app: 20 logins in 15
// minutes from ALL users combined would have locked everyone out, and it
// would have limited no individual attacker at all. `1` = trust exactly
// one proxy hop. Verify in production with GET /api/admin/whoami-ip
// (owner only): `ip` should be your own public address.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ── Security headers for every API response ───────────────────────
// This server only ever returns JSON, so the CSP can be the strictest
// possible (nothing may load or frame anything from it).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Authenticated JSON must never be stored by a shared cache / proxy.
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Broad per-IP ceiling (pre-auth). Generous on purpose — a campus shares
// one public IP — it only exists to stop a single address flooding the
// server. Per-user limits below are the finer-grained ones.
app.use(limiter({ name: 'ip', max: 1500, windowMs: 60 * 1000, key: (req) => req.ip }));

app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'https://life-os-three-xi.vercel.app',
    'https://life-os-git-main-ctrl-alt-elite07.vercel.app',
    // Vercel's stable "production alias" domain for this project — was
    // missing here, which is why signing in from
    // life-os-ctrl-alt-elite07.vercel.app (used to sanity-check a
    // deploy directly, bypassing nuvora.ps/DNS/CDN caching) failed with
    // a CORS-driven "Network error" even though the deployment itself
    // was healthy.
    'https://life-os-ctrl-alt-elite07.vercel.app',
    'https://nuvora.ps',
    'https://www.nuvora.ps',
  ];
  const origin = req.headers.origin;
  // Vary: Origin so a cache can never serve one origin's CORS headers to another.
  res.setHeader('Vary', 'Origin');
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(allowedOrigins.includes(origin) ? 204 : 403);
  }
  next();
});

// Paddle's webhook used to be mounted here, before express.json(), for
// exactly the reason this one is: a signature check needs the exact raw
// body, and express.json() below would have already parsed it into an
// object by the time a route saw it. Lahza (routes/lahzaWebhook.js) is
// that same real card processor coming back — see lib/lahza.js.
app.use('/api/lahza/webhook', express.raw({ type: 'application/json' }), require('./routes/lahzaWebhook'));

app.use(express.json());

// Public routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cron', require('./routes/cron')); // no JWT — protected by CRON_SECRET header instead, checked inside
// iPhone Shortcut → this, whenever Haneen's Reflect/Arab Bank SMS
// arrives — no logged-in user on that end, so no JWT here either;
// protected by BANK_SMS_WEBHOOK_SECRET (checked inside) instead, same
// pattern as cron above. See routes/bankSms.js for the full story.
app.use('/api/bank-sms', require('./routes/bankSms'));

// Every protected route = a valid, non-revoked session + a per-USER request
// ceiling (keyed on the account, not the IP, so a shared campus address
// doesn't throttle everyone at once). The AI routes cost real money per
// call, so they get a much tighter ceiling on top.
const perUser = limiter({ name: 'user', max: 900, windowMs: 60 * 1000, key: (req) => req.user.id });
const aiBurst = limiter({ name: 'ai',   max: 40,  windowMs: 60 * 1000, key: (req) => req.user.id });
const protect = [authenticate, perUser];
const protectAi = [authenticate, perUser, aiBurst];

// Protected routes
app.use('/api/tasks',        protect, require('./routes/tasks'));
app.use('/api/habits',       protect, require('./routes/habits'));
app.use('/api/goals',        protect, require('./routes/goals'));
app.use('/api/learning',     protect, require('./routes/learning'));
app.use('/api/mood',         protect, require('./routes/mood'));
app.use('/api/internships',  protect, require('./routes/internships'));
app.use('/api/cv',           protect, require('./routes/cv'));
app.use('/api/projects',     protect, require('./routes/projects'));
app.use('/api/ai',           protectAi, require('./routes/ai'));
app.use('/api/dashboard',    protect, require('./routes/dashboard'));
app.use('/api/gamification', protect, require('./routes/gamification'));
app.use('/api/focus', protect, require('./routes/focus'));
app.use('/api/analytics',    protect, require('./routes/analytics'));
app.use('/api/feedback',     protect, require('./routes/feedback'));
app.use('/api/history',      protect, require('./routes/history'));
app.use('/api/chat', protectAi, require('./routes/chat'));
app.use('/api/trees', protect, require('./routes/trees'));
app.use('/api/lahza', protect, require('./routes/lahza'));
app.use('/api/notifications', protect, require('./routes/notifications'));
app.use('/api/push', protect, require('./routes/push'));
app.use('/api/exam', protectAi, require('./routes/exam'));
app.use('/api/admin', protect, require('./routes/admin'));
app.use('/api/channels', protect, require('./routes/channels'));
app.use('/api/sheets', protect, require('./routes/sheets'));

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
  // Client mistakes surfaced by body-parser / multer (malformed JSON, body
  // too large, bad upload) are 4xx, not 500 — keep the status but never
  // echo the raw error text back.
  const status = Number.isInteger(err && err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  const msg = status === 413 ? 'Request too large'
            : status === 400 ? 'Bad request'
            : status < 500   ? 'Request rejected'
            : 'Server error';
  res.status(status).json({ error: msg });
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
  .then(() => initAuth()) // load session revocations into memory before accepting traffic
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Life Dashboard API running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database init failed, server not started:', err);
    process.exit(1);
  });