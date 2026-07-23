const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const { addXp, evaluateAchievements } = require('../lib/gamification');

// ── Next recurrence date ───────────────────────────────────────
function nextRecurrenceDate(recurrence, fromDate) {
  const base = fromDate ? new Date(fromDate) : new Date();
  base.setHours(0, 0, 0, 0);

  if (recurrence === 'daily') {
    base.setDate(base.getDate() + 1);
  } else if (recurrence === 'weekdays') {
    base.setDate(base.getDate() + 1);
    // Skip Saturday (6) and Sunday (0)
    while (base.getDay() === 0 || base.getDay() === 6) {
      base.setDate(base.getDate() + 1);
    }
  } else if (recurrence === 'weekly') {
    base.setDate(base.getDate() + 7);
  } else if (recurrence === 'monthly') {
    base.setMonth(base.getMonth() + 1);
  }

  return base.toISOString().slice(0, 10);
}

// ── GET /tasks ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const result = await db.execute({
      sql:  `SELECT * FROM tasks WHERE user_id = ? ORDER BY position ASC, created_at DESC`,
      args: [req.user.id],
    });
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── POST /tasks ────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      title, description = '', priority = 'medium',
      category = 'general', deadline = null,
      deadline_time = null, recurrence = null,
    } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const maxPos = await db.execute({
      sql:  `SELECT COALESCE(MAX(position), -1) m FROM tasks WHERE user_id = ? AND status = 'todo'`,
      args: [req.user.id],
    });
    const insert = await db.execute({
      sql:  `INSERT INTO tasks
               (user_id, title, description, priority, category, deadline, deadline_time, recurrence, status, progress, position)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'todo', 0, ?)`,
      args: [
        req.user.id, title.trim(), description, priority, category,
        deadline, deadline_time, recurrence,
        Number(maxPos.rows[0].m) + 1,
      ],
    });
    const task = (await db.execute({
      sql:  `SELECT * FROM tasks WHERE id = ? AND user_id = ?`,
      args: [Number(insert.lastInsertRowid), req.user.id],
    })).rows[0];

    res.status(201).json(task);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── PUT /tasks/:id ─────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const existing = (await db.execute({
      sql:  `SELECT * FROM tasks WHERE id = ? AND user_id = ?`,
      args: [req.params.id, req.user.id],
    })).rows[0];
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const updates    = { ...existing, ...req.body };
    const wasDone    = existing.status === 'done';
    const isNowDone  = updates.status  === 'done';

    if (isNowDone && updates.progress < 100) updates.progress = 100;
    updates.completed_at = isNowDone
      ? (existing.completed_at || new Date().toISOString())
      : null;

    await db.execute({
      sql:  `UPDATE tasks
             SET title=?, description=?, priority=?, category=?,
                 deadline=?, deadline_time=?, recurrence=?,
                 status=?, progress=?, position=?, completed_at=?
             WHERE id = ? AND user_id = ?`,
      args: [
        updates.title, updates.description, updates.priority, updates.category,
        updates.deadline, updates.deadline_time, updates.recurrence,
        updates.status, updates.progress, updates.position, updates.completed_at,
        req.params.id, req.user.id,
      ],
    });

    let xpAwarded   = 0;
    let nextTask     = null;

    if (!wasDone && isNowDone) {
      await addXp(req.user.id, 20, `Completed task: ${updates.title}`);
      xpAwarded = 20;

      // ── Auto-create next occurrence if recurring ───────────────
      if (updates.recurrence) {
        const nextDeadline = nextRecurrenceDate(updates.recurrence, updates.deadline);
        const maxPos = await db.execute({
          sql:  `SELECT COALESCE(MAX(position), -1) m FROM tasks WHERE user_id = ? AND status = 'todo'`,
          args: [req.user.id],
        });
        const nextInsert = await db.execute({
          sql:  `INSERT INTO tasks
                   (user_id, title, description, priority, category, deadline, deadline_time, recurrence, status, progress, position)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'todo', 0, ?)`,
          args: [
            req.user.id,
            updates.title, updates.description, updates.priority, updates.category,
            nextDeadline, updates.deadline_time, updates.recurrence,
            Number(maxPos.rows[0].m) + 1,
          ],
        });
        nextTask = (await db.execute({
          sql:  `SELECT * FROM tasks WHERE id = ?`,
          args: [Number(nextInsert.lastInsertRowid)],
        })).rows[0];
      }
    }

    const unlocked = await evaluateAchievements(req.user.id);
    const task     = (await db.execute({
      sql:  `SELECT * FROM tasks WHERE id = ? AND user_id = ?`,
      args: [req.params.id, req.user.id],
    })).rows[0];

    res.json({ task, xpAwarded, unlocked, nextTask });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── DELETE /tasks/:id ──────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.execute({
      sql:  `DELETE FROM tasks WHERE id = ? AND user_id = ?`,
      args: [req.params.id, req.user.id],
    });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Task not found' });
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// ── POST /tasks/reorder ────────────────────────────────────────
router.post('/reorder', async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) return res.status(400).json({ error: 'tasks array required' });
    await db.batch(
      tasks.map((t) => ({
        sql:  `UPDATE tasks SET status = ?, position = ? WHERE id = ? AND user_id = ?`,
        args: [t.status, t.position, t.id, req.user.id],
      })),
      'write'
    );
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;