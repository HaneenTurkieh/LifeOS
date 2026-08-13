const express = require('express');
const router = express.Router();
const { db } = require('../db/connection');
const ai = require('../lib/ai');
const { callOpenRouter } = require('../lib/openrouter');

router.get('/quote', (req, res) => res.json(ai.quoteOfTheDay()));

router.post('/daily-plan', async (req, res) => {
  try {
    const { availableHours = 4, energy = 'medium' } = req.body;
    const result = await db.execute({
      sql: `SELECT * FROM tasks WHERE user_id = ? AND status != 'done' ORDER BY deadline ASC`,
      args: [req.user.id],
    });
    res.json(ai.buildDailyPlan({ availableHours: Number(availableHours), energy, tasks: result.rows }));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.post('/goal-breakdown', (req, res) => {
  const { title, weeks = 4 } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'A goal title is required' });
  res.json({ title, plan: ai.breakdownGoal({ title, weeks: Number(weeks) }) });
});

router.get('/prioritize', async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT * FROM tasks WHERE user_id = ? AND status != 'done'`,
      args: [req.user.id],
    });
    res.json(ai.prioritizeTasks(result.rows));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

router.get('/coach', async (req, res) => {
  try {
    const userId = req.user.id;
    const sow = `date('now', 'weekday 0', '-6 days')`;
    const [r1, r2, r3, r4, r5] = await Promise.all([
      db.execute({ sql: `SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND status='done' AND completed_at >= ${sow}`, args: [userId] }),
      db.execute({ sql: `SELECT COUNT(*) c FROM tasks WHERE user_id = ? AND (created_at >= ${sow} OR status='done')`, args: [userId] }),
      db.execute({ sql: `SELECT COUNT(*) c FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id WHERE h.user_id = ? AND hl.date >= ${sow}`, args: [userId] }),
      db.execute({ sql: `SELECT COUNT(*) c FROM habits WHERE user_id = ?`, args: [userId] }),
      db.execute({ sql: `SELECT mood FROM moods WHERE user_id = ? ORDER BY date DESC LIMIT 1`, args: [userId] }),
    ]);
    const tasksDoneThisWeek = Number(r1.rows[0].c);
    const tasksTotalThisWeek = Number(r2.rows[0].c);
    const habitLogsThisWeek = Number(r3.rows[0].c);
    const habitCount = Number(r4.rows[0].c);
    const habitCompletionRate = habitCount > 0 ? Math.round((habitLogsThisWeek / (habitCount * 7)) * 100) : 0;
    const latestMood = r5.rows[0];
    const { getOverallStreak } = require('../lib/gamification');
    const streak = await getOverallStreak(userId); // needs gamification.js migrated
    const insights = ai.productivityInsights({ tasksDoneThisWeek, tasksTotalThisWeek, habitCompletionRate, streak, mood: latestMood?.mood });
    res.json({ insights, stats: { tasksDoneThisWeek, tasksTotalThisWeek, habitCompletionRate, streak } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Database error' }); }
});

// Used to be pure string templates — every task got the exact same three
// generic sentences with just the title swapped in ("Spend just 5 minutes
// opening 'X'..."), which wasn't actually helpful for a task that's
// genuinely different from another. Now a real (small, cheap) model call
// that reads the actual task — and description, if there is one — and
// proposes on-ramps specific to that task. Triggered only when the user
// explicitly clicks "feeling stuck?" on one task, so this is naturally
// low-volume (nothing like every-message chat cost) — no forced extended
// reasoning needed either, this is a short creative-practical suggestion,
// not a hard logic problem. Falls back to the old templates if the model
// call fails, so the feature never just breaks.
router.post('/anti-procrastination', async (req, res) => {
  const { title, description = '' } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'A task title is required' });
  try {
    const data = await callOpenRouter({
      messages: [{
        role: 'user',
        content: `The user is stuck/avoiding this task and needs a gentle, genuinely useful nudge to start — not generic filler. Task: "${title}"${description ? `\nMore context: ${description}` : ''}

Give three concrete, specific on-ramps sized differently, each actually tailored to what THIS task involves (not a template that would fit any task):
- five_minute: the smallest possible real first move, doable in 5 minutes
- fifteen_minute: a slightly bigger chunk of visible progress, doable in 15 minutes
- one_hour: a focused hour that meaningfully advances it

Return ONLY a JSON object with exactly these three keys (five_minute, fifteen_minute, one_hour), each a string of 1-2 sentences. No markdown, no explanation, just the JSON object.`,
      }],
      reasoningEffort: null,
      max_tokens: 400,
      temperature: 0.8,
    });
    const raw = data.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (!parsed.five_minute || !parsed.fifteen_minute || !parsed.one_hour) throw new Error('Incomplete response');
    res.json(parsed);
  } catch (err) {
    console.error('anti-procrastination model call failed, using fallback:', err.message);
    res.json(ai.antiProcrastinationVersions(title));
  }
});

module.exports = router;