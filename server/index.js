// index.js — Express API entry point
// Run with `npm run dev` (auto-reload) or `npm start` from the server/ folder.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authenticate } = require('./lib/auth');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Make sure the DB file + tables exist (and migrations have run) before
// any route touches them.
require('./db/connection');

// Public — no token required. Register/login live here.
app.use('/api/auth', require('./routes/auth'));

// Everything below this line requires a valid `Authorization: Bearer <token>`
// header. The `authenticate` middleware sets req.user = { id, name, email }.
app.use('/api/tasks', authenticate, require('./routes/tasks'));
app.use('/api/habits', authenticate, require('./routes/habits'));
app.use('/api/goals', authenticate, require('./routes/goals'));
app.use('/api/learning', authenticate, require('./routes/learning'));
app.use('/api/mood', authenticate, require('./routes/mood'));
app.use('/api/internships', authenticate, require('./routes/internships'));
app.use('/api/cv', authenticate, require('./routes/cv'));
app.use('/api/projects', authenticate, require('./routes/projects'));
app.use('/api/ai', authenticate, require('./routes/ai'));
app.use('/api/dashboard', authenticate, require('./routes/dashboard'));
app.use('/api/gamification', authenticate, require('./routes/gamification'));
app.use('/api/analytics', authenticate, require('./routes/analytics'));

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'Personal Life Dashboard API' }));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error', detail: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Life Dashboard API running at http://localhost:${PORT}`);
});