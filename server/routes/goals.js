const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');
const { addXp, evaluateAchievements } = require('../lib/gamification');

async function withMilestones(goal) {
  const result = await db.execute({ sql: `SELECT * FROM milestones WHERE goal_id = ? ORDER BY position ASC`, args: [goal.id] });
  const milestones = result.rows;
  const total = milestones.length;
  const done  = milestones.filter((m) => m.done).length;
  return { ...goal, milestones, progress: total > 0 ? Math.round((done / total) * 100) : 0 };
}

router.get('/', async (req, res) => {
  try {
    const result = await db.execute({ sql: `SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC`, args: [req.user.id] });
    res.json(await Promise.all(result.rows.map(withMilestones)));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/', async (req, res) => {
  try {
    const { title, description = '', category = 'personal', target_date = null, milestones = [] } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    const insertResult = await db.execute({ sql: `INSERT INTO goals (user_id, title, description, category, target_date) VALUES (?, ?, ?, ?, ?)`, args: [req.user.id, title.trim(), description, category, target_date] });
    const goalId = Number(insertResult.lastInsertRowid);
    if (milestones.length > 0) {
      await db.batch(milestones.map((m, idx) => ({ sql: `INSERT INTO milestones (goal_id, title, position) VALUES (?, ?, ?)`, args: [goalId, m, idx] })), 'write');
    }
    const goalResult = await db.execute({ sql: `SELECT * FROM goals WHERE id = ? AND user_id = ?`, args: [goalId, req.user.id] });
    res.status(201).json(await withMilestones(goalResult.rows[0]));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.put('/:id', async (req, res) => {
  try {
    const existingResult = await db.execute({ sql: `SELECT * FROM goals WHERE id = ? AND user_id = ?`, args: [req.params.id, req.user.id] });
    const existing = existingResult.rows[0];
    if (!existing) return res.status(404).json({ error: 'Goal not found' });
    const updates = { ...existing, ...req.body };
    const wasCompleted = existing.status === 'completed';
    await db.execute({ sql: `UPDATE goals SET title=?, description=?, category=?, target_date=?, status=? WHERE id=? AND user_id=?`, args: [updates.title, updates.description, updates.category, updates.target_date, updates.status, req.params.id, req.user.id] });
    let xpAwarded = 0;
    if (!wasCompleted && updates.status === 'completed') {
      await addXp(req.user.id, 100, `Finished goal: ${updates.title}`); // needs gamification.js migrated
      xpAwarded = 100;
    }
    const unlocked = await evaluateAchievements(req.user.id);
    const goalResult = await db.execute({ sql: `SELECT * FROM goals WHERE id = ? AND user_id = ?`, args: [req.params.id, req.user.id] });
    res.json({ goal: await withMilestones(goalResult.rows[0]), xpAwarded, unlocked });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await db.execute({ sql: `DELETE FROM goals WHERE id = ? AND user_id = ?`, args: [req.params.id, req.user.id] });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Goal not found' });
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/:id/milestones', async (req, res) => {
  try {
    const goalResult = await db.execute({ sql: `SELECT * FROM goals WHERE id = ? AND user_id = ?`, args: [req.params.id, req.user.id] });
    const goal = goalResult.rows[0];
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    const maxPosResult = await db.execute({ sql: `SELECT COALESCE(MAX(position), -1) m FROM milestones WHERE goal_id = ?`, args: [goal.id] });
    await db.execute({ sql: `INSERT INTO milestones (goal_id, title, position) VALUES (?, ?, ?)`, args: [goal.id, req.body.title, Number(maxPosResult.rows[0].m) + 1] });
    res.status(201).json(await withMilestones(goal));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.put('/:goalId/milestones/:milestoneId', async (req, res) => {
  try {
    const goalResult = await db.execute({ sql: `SELECT * FROM goals WHERE id = ? AND user_id = ?`, args: [req.params.goalId, req.user.id] });
    const goal = goalResult.rows[0];
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    const msResult = await db.execute({ sql: `SELECT * FROM milestones WHERE id = ? AND goal_id = ?`, args: [req.params.milestoneId, goal.id] });
    if (!msResult.rows[0]) return res.status(404).json({ error: 'Milestone not found' });
    await db.execute({ sql: `UPDATE milestones SET done = ? WHERE id = ?`, args: [req.body.done ? 1 : 0, req.params.milestoneId] });
    res.json(await withMilestones(goal));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

module.exports = router;