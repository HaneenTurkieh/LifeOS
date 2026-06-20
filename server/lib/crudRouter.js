// lib/crudRouter.js
// A tiny factory for straightforward, user-scoped CRUD endpoints (learning
// items, internships, CV entries, project tracker). Every row is filtered
// and tagged by req.user.id, so this MUST be mounted behind the
// `authenticate` middleware (see index.js). Keeps routes/*.js short and
// consistent instead of repeating the same boilerplate five times.

const express = require('express');
const db = require('../db/connection');

function buildCrudRouter({ table, fields, orderBy = 'id DESC' }) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json(db.prepare(`SELECT * FROM ${table} WHERE user_id = ? ORDER BY ${orderBy}`).all(req.user.id));
  });

  router.post('/', (req, res) => {
    const cols = fields.filter((f) => req.body[f] !== undefined);
    const placeholders = cols.map(() => '?').join(', ');
    const values = cols.map((c) => req.body[c]);
    if (cols.length === 0) return res.status(400).json({ error: 'No valid fields provided' });
    const info = db.prepare(`INSERT INTO ${table} (user_id, ${cols.join(', ')}) VALUES (?, ${placeholders})`)
      .run(req.user.id, ...values);
    res.status(201).json(db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(info.lastInsertRowid, req.user.id));
  });

  router.put('/:id', (req, res) => {
    const existing = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const merged = { ...existing, ...req.body };
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => merged[f]);
    db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ? AND user_id = ?`).run(...values, req.params.id, req.user.id);
    res.json(db.prepare(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id));
  });

  router.delete('/:id', (req, res) => {
    const info = db.prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  });

  return router;
}

module.exports = buildCrudRouter;