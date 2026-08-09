// routes/cv.js — CV Builder: profile, experience, education, projects, skills, certifications
const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');
const buildCrudRouter = require('../lib/crudRouter');

router.use('/projects', buildCrudRouter({ table: 'cv_projects', fields: ['title', 'description', 'tech', 'link'] }));
router.use('/skills', buildCrudRouter({ table: 'cv_skills', fields: ['name', 'level', 'category'] }));
router.use('/certifications', buildCrudRouter({ table: 'cv_certifications', fields: ['title', 'issuer', 'date', 'link'] }));
router.use('/experience', buildCrudRouter({
  table: 'cv_experience',
  fields: ['role', 'company', 'location', 'start_date', 'end_date', 'is_current', 'description'],
  orderBy: 'is_current DESC, start_date DESC',
}));
router.use('/education', buildCrudRouter({
  table: 'cv_education',
  fields: ['school', 'degree', 'field', 'start_date', 'end_date', 'description'],
  orderBy: 'start_date DESC',
}));

// Profile is a single row per user (name/email already live on the
// account itself) rather than a repeatable list, so it gets its own
// GET/PUT instead of the list-style CRUD router above.
router.get('/profile', async (req, res) => {
  try {
    const row = (await db.execute({
      sql:  `SELECT cv_summary, cv_headline, cv_phone, cv_location, cv_photo FROM users WHERE id = ?`,
      args: [req.user.id],
    })).rows[0];
    res.json(row || { cv_summary: '', cv_headline: '', cv_phone: '', cv_location: '', cv_photo: '' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.put('/profile', async (req, res) => {
  try {
    const { cv_summary = '', cv_headline = '', cv_phone = '', cv_location = '', cv_photo = '' } = req.body;
    // Same ~300KB cap as the account avatar (routes/auth.js) — a base64
    // JPEG at that size is already a small, low-res headshot; anything
    // bigger is someone accidentally uploading a full-res camera photo.
    if (cv_photo && cv_photo.length > 400000) {
      return res.status(400).json({ error: 'Photo is too large. Use an image under 300KB.' });
    }
    await db.execute({
      sql:  `UPDATE users SET cv_summary = ?, cv_headline = ?, cv_phone = ?, cv_location = ?, cv_photo = ? WHERE id = ?`,
      args: [cv_summary, cv_headline, cv_phone, cv_location, cv_photo, req.user.id],
    });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;