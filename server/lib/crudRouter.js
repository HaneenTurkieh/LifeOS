// lib/crudRouter.js
// Async rewrite: better-sqlite3 → @libsql/client (Turso)
const express = require('express');
const { db } = require('../db/connection'); // ← destructure

function buildCrudRouter({ table, fields, orderBy = 'id DESC' }) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const result = await db.execute({
        sql:  `SELECT * FROM ${table} WHERE user_id = ? ORDER BY ${orderBy}`,
        args: [req.user.id],
      });
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const cols = fields.filter((f) => req.body[f] !== undefined);
      if (cols.length === 0) return res.status(400).json({ error: 'No valid fields provided' });

      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((c) => req.body[c]);

      const insertResult = await db.execute({
        sql:  `INSERT INTO ${table} (user_id, ${cols.join(', ')}) VALUES (?, ${placeholders})`,
        args: [req.user.id, ...values],
      });

      const newRow = await db.execute({
        sql:  `SELECT * FROM ${table} WHERE id = ? AND user_id = ?`,
        args: [Number(insertResult.lastInsertRowid), req.user.id], // ← Number() required
      });

      res.status(201).json(newRow.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const existingResult = await db.execute({
        sql:  `SELECT * FROM ${table} WHERE id = ? AND user_id = ?`,
        args: [req.params.id, req.user.id],
      });
      const existing = existingResult.rows[0];
      if (!existing) return res.status(404).json({ error: 'Not found' });

      const merged = { ...existing, ...req.body };
      const setClause = fields.map((f) => `${f} = ?`).join(', ');
      const values = fields.map((f) => merged[f]);

      await db.execute({
        sql:  `UPDATE ${table} SET ${setClause} WHERE id = ? AND user_id = ?`,
        args: [...values, req.params.id, req.user.id],
      });

      const updatedResult = await db.execute({
        sql:  `SELECT * FROM ${table} WHERE id = ? AND user_id = ?`,
        args: [req.params.id, req.user.id],
      });

      res.json(updatedResult.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const result = await db.execute({
        sql:  `DELETE FROM ${table} WHERE id = ? AND user_id = ?`,
        args: [req.params.id, req.user.id],
      });

      if (result.rowsAffected === 0) return res.status(404).json({ error: 'Not found' }); // ← was info.changes
      res.status(204).end();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  return router;
}

module.exports = buildCrudRouter;