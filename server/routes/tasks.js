const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');
const { addXp, evaluateAchievements } = require('../lib/gamification');

router.get('/', async (req, res) => {
  try {
    const result = await db.execute({ sql: `SELECT * FROM tasks WHERE user_id = ? ORDER BY position ASC, created_at DESC`, args: [req.user.id] });
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/', async (req, res) => {
  try {
    const { title, description = '', priority = 'medium', category = 'general', deadline = null, deadline_time = null } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    const maxPosResult = await db.execute({ sql: `SELECT COALESCE(MAX(position), -1) m FROM tasks WHERE user_id = ? AND status = 'todo'`, args: [req.user.id] });
    const insertResult = await db.execute({ sql: `INSERT INTO tasks (user_id, title, description, priority, category, deadline, deadline_time, status, progress, position) VALUES (?, ?, ?, ?, ?, ?, ?, 'todo', 0, ?)`, args: [req.user.id, title.trim(), description, priority, category, deadline, deadline_time, Number(maxPosResult.rows[0].m) + 1] });
    const taskResult = await db.execute({ sql: `SELECT * FROM tasks WHERE id = ? AND user_id = ?`, args: [Number(insertResult.lastInsertRowid), req.user.id] });
    res.status(201).json(taskResult.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.put('/:id', async (req, res) => {
  try {
    const existingResult = await db.execute({ sql: `SELECT * FROM tasks WHERE id = ? AND user_id = ?`, args: [req.params.id, req.user.id] });
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    const updates = { ...existing, ...req.body };
    const wasDone   = existing.status === 'done';
    const isNowDone = updates.status  === 'done';
    if (isNowDone && updates.progress < 100) updates.progress = 100;
    updates.completed_at = isNowDone ? (existing.completed_at || new Date().toISOString()) : null;
    await db.execute({ sql: `UPDATE tasks SET title=?, description=?, priority=?, category=?, deadline=?, deadline_time=?, status=?, progress=?, position=?, completed_at=? WHERE id = ? AND user_id = ?`, args: [updates.title, updates.description, updates.priority, updates.category, updates.deadline, updates.deadline_time, updates.status, updates.progress, updates.position, updates.completed_at, req.params.id, req.user.id] });
    let xpAwarded = 0;
    if (!wasDone && isNowDone) {
      await addXp(req.user.id, 20, `Completed task: ${updates.title}`); // needs gamification.js migrated
      xpAwarded = 20;
    }
    const unlocked = await evaluateAchievements(req.user.id);
    const taskResult = await db.execute({ sql: `SELECT * FROM tasks WHERE id = ? AND user_id = ?`, args: [req.params.id, req.user.id] });
    res.json({ task: taskResult.rows[0], xpAwarded, unlocked });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await db.execute({ sql: `DELETE FROM tasks WHERE id = ? AND user_id = ?`, args: [req.params.id, req.user.id] });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Task not found' });
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/reorder', async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) return res.status(400).json({ error: 'tasks array required' });
    await db.batch(
      tasks.map((t) => ({ sql: `UPDATE tasks SET status = ?, position = ? WHERE id = ? AND user_id = ?`, args: [t.status, t.position, t.id, req.user.id] })),
      'write'
    );
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;