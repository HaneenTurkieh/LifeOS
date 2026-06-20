// routes/tasks.js — mounted behind `authenticate`; every query is scoped
// to req.user.id so one person never sees another's tasks.
const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { addXp, evaluateAchievements } = require('../lib/gamification');

router.get('/', (req, res) => {
  const tasks = db.prepare(`SELECT * FROM tasks WHERE user_id = ? ORDER BY position ASC, created_at DESC`).all(req.user.id);
  res.json(tasks);
});

router.post('/', (req, res) => {
  const { title, description = '', priority = 'medium', category = 'general', deadline = null } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  const maxPos = db.prepare(`SELECT COALESCE(MAX(position), -1) m FROM tasks WHERE user_id = ? AND status = 'todo'`).get(req.user.id).m;
  const info = db.prepare(`
    INSERT INTO tasks (user_id, title, description, priority, category, deadline, status, progress, position)
    VALUES (?, ?, ?, ?, ?, ?, 'todo', 0, ?)
  `).run(req.user.id, title.trim(), description, priority, category, deadline, maxPos + 1);
  const task = db.prepare(`SELECT * FROM tasks WHERE id = ? AND user_id = ?`).get(info.lastInsertRowid, req.user.id);
  res.status(201).json(task);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM tasks WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const updates = { ...existing, ...req.body };
  const wasDone = existing.status === 'done';
  const isNowDone = updates.status === 'done';

  if (isNowDone && updates.progress < 100) updates.progress = 100;
  updates.completed_at = isNowDone ? (existing.completed_at || new Date().toISOString()) : null;

  db.prepare(`
    UPDATE tasks SET title=?, description=?, priority=?, category=?, deadline=?, status=?, progress=?, position=?, completed_at=?
    WHERE id = ? AND user_id = ?
  `).run(updates.title, updates.description, updates.priority, updates.category, updates.deadline,
         updates.status, updates.progress, updates.position, updates.completed_at, req.params.id, req.user.id);

  let xpAwarded = 0;
  if (!wasDone && isNowDone) {
    addXp(req.user.id, 20, `Completed task: ${updates.title}`);
    xpAwarded = 20;
  }
  const unlocked = evaluateAchievements(req.user.id);

  const task = db.prepare(`SELECT * FROM tasks WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  res.json({ task, xpAwarded, unlocked });
});

router.delete('/:id', (req, res) => {
  const info = db.prepare(`DELETE FROM tasks WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.status(204).end();
});

// Bulk reorder — used by the Kanban drag-and-drop board.
router.post('/reorder', (req, res) => {
  const { tasks } = req.body; // [{id, status, position}, ...]
  if (!Array.isArray(tasks)) return res.status(400).json({ error: 'tasks array required' });
  const update = db.prepare(`UPDATE tasks SET status = ?, position = ? WHERE id = ? AND user_id = ?`);
  const tx = db.transaction((list) => list.forEach((t) => update.run(t.status, t.position, t.id, req.user.id)));
  tx(tasks);
  res.json({ ok: true });
});

module.exports = router;