// routes/goals.js — mounted behind `authenticate`. milestones don't carry
// their own user_id (scoped through the parent goal's ownership), so
// milestone routes confirm the goal belongs to req.user first.
const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { addXp, evaluateAchievements } = require('../lib/gamification');

function withMilestones(goal) {
  const milestones = db.prepare(`SELECT * FROM milestones WHERE goal_id = ? ORDER BY position ASC`).all(goal.id);
  const total = milestones.length;
  const done = milestones.filter((m) => m.done).length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  return { ...goal, milestones, progress };
}

router.get('/', (req, res) => {
  const goals = db.prepare(`SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC`).all(req.user.id);
  res.json(goals.map(withMilestones));
});

router.post('/', (req, res) => {
  const { title, description = '', category = 'personal', target_date = null, milestones = [] } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  const info = db.prepare(`INSERT INTO goals (user_id, title, description, category, target_date) VALUES (?, ?, ?, ?, ?)`)
    .run(req.user.id, title.trim(), description, category, target_date);
  const goalId = info.lastInsertRowid;
  const insertM = db.prepare(`INSERT INTO milestones (goal_id, title, position) VALUES (?, ?, ?)`);
  milestones.forEach((m, idx) => insertM.run(goalId, m, idx));
  const goal = db.prepare(`SELECT * FROM goals WHERE id = ? AND user_id = ?`).get(goalId, req.user.id);
  res.status(201).json(withMilestones(goal));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare(`SELECT * FROM goals WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Goal not found' });
  const updates = { ...existing, ...req.body };
  const wasCompleted = existing.status === 'completed';

  db.prepare(`UPDATE goals SET title=?, description=?, category=?, target_date=?, status=? WHERE id=? AND user_id=?`)
    .run(updates.title, updates.description, updates.category, updates.target_date, updates.status, req.params.id, req.user.id);

  let xpAwarded = 0;
  if (!wasCompleted && updates.status === 'completed') {
    addXp(req.user.id, 100, `Finished goal: ${updates.title}`);
    xpAwarded = 100;
  }
  const unlocked = evaluateAchievements(req.user.id);
  const goal = db.prepare(`SELECT * FROM goals WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  res.json({ goal: withMilestones(goal), xpAwarded, unlocked });
});

router.delete('/:id', (req, res) => {
  const info = db.prepare(`DELETE FROM goals WHERE id = ? AND user_id = ?`).run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Goal not found' });
  res.status(204).end();
});

router.post('/:id/milestones', (req, res) => {
  const goal = db.prepare(`SELECT * FROM goals WHERE id = ? AND user_id = ?`).get(req.params.id, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  const maxPos = db.prepare(`SELECT COALESCE(MAX(position), -1) m FROM milestones WHERE goal_id = ?`).get(goal.id).m;
  db.prepare(`INSERT INTO milestones (goal_id, title, position) VALUES (?, ?, ?)`).run(goal.id, req.body.title, maxPos + 1);
  res.status(201).json(withMilestones(goal));
});

router.put('/:goalId/milestones/:milestoneId', (req, res) => {
  const goal = db.prepare(`SELECT * FROM goals WHERE id = ? AND user_id = ?`).get(req.params.goalId, req.user.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  const milestone = db.prepare(`SELECT * FROM milestones WHERE id = ? AND goal_id = ?`).get(req.params.milestoneId, goal.id);
  if (!milestone) return res.status(404).json({ error: 'Milestone not found' });
  const done = req.body.done ? 1 : 0;
  db.prepare(`UPDATE milestones SET done = ? WHERE id = ?`).run(done, milestone.id);
  res.json(withMilestones(goal));
});

module.exports = router;