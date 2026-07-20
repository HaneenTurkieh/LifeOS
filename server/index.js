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

app.use(express.json());

// Public routes
app.use('/api/auth', require('./routes/auth'));

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

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'Personal Life Dashboard API' }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error', detail: err.message });
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