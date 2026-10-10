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
    const { cv_summary = '', cv_headline = '', cv_phone = '', cv_location = '', cv_photo = '' } = req.body || {};
    // None of these had any type or length checks, and cv_photo goes
    // straight into an <img src> in the CV preview/print window — it may
    // only ever be an uploaded image (data URL), never an arbitrary string.
    const limits = { cv_summary: 3000, cv_headline: 200, cv_phone: 40, cv_location: 200 };
    for (const [field, max] of Object.entries(limits)) {
      const v = { cv_summary, cv_headline, cv_phone, cv_location }[field];
      if (typeof v !== 'string' || v.length > max) return res.status(400).json({ error: `${field} is invalid or too long.` });
    }
    if (typeof cv_photo !== 'string' || (cv_photo && !/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(cv_photo))) {
      return res.status(400).json({ error: 'Photo must be an uploaded image.' });
    }
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