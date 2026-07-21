const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');

const MODEL = 'claude-haiku-4-5-20251001';

// ── Tool definitions ──────────────────────────────────────────
const TOOLS = [
  {
    name: 'create_task',
    description: 'Create a new task for the user in Aurora.',
    input_schema: {
      type: 'object',
      properties: {
        title:       { type: 'string',  description: 'Task title' },
        description: { type: 'string',  description: 'Optional description' },
        priority:    { type: 'string',  enum: ['low','medium','high'] },
        deadline:    { type: 'string',  description: 'Due date YYYY-MM-DD' },
        category:    { type: 'string',  description: 'Category label' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Retrieve the user\'s tasks.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['todo','doing','done','all'] },
        limit:  { type: 'number' },
      },
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as done by its ID or a title fragment.',
    input_schema: {
      type: 'object',
      properties: {
        task_id:    { type: 'number' },
        task_title: { type: 'string' },
      },
    },
  },
  {
    name: 'create_goal',
    description: 'Create a new goal with optional milestones.',
    input_schema: {
      type: 'object',
      properties: {
        title:       { type: 'string' },
        description: { type: 'string' },
        category:    { type: 'string' },
        target_date: { type: 'string', description: 'YYYY-MM-DD' },
        milestones:  { type: 'array', items: { type: 'string' } },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_goals',
    description: 'Get the user\'s goals.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active','completed','all'] },
      },
    },
  },
  {
    name: 'get_productivity_summary',
    description: 'Get a productivity summary for a time period.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today','week','month'] },
      },
    },
  },
  {
    name: 'get_focus_stats',
    description: 'Get focus/flow session stats for the user.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'generate_daily_plan',
    description: 'Generate a prioritized daily plan based on tasks and available hours.',
    input_schema: {
      type: 'object',
      properties: {
        available_hours: { type: 'number' },
        energy:          { type: 'string', enum: ['low','medium','high'] },
      },
    },
  },
];

// ── Tool execution ────────────────────────────────────────────
async function executeTool(name, input, userId) {
  switch (name) {

    case 'create_task': {
      const maxPos = await db.execute({
        sql:  `SELECT COALESCE(MAX(position),-1) m FROM tasks WHERE user_id=? AND status='todo'`,
        args: [userId],
      });
      const res = await db.execute({
        sql:  `INSERT INTO tasks (user_id,title,description,priority,category,deadline,status,progress,position) VALUES (?,?,?,?,?,?,'todo',0,?)`,
        args: [userId, input.title, input.description||'', input.priority||'medium', input.category||'General', input.deadline||null, Number(maxPos.rows[0].m)+1],
      });
      return { success: true, task_id: Number(res.lastInsertRowid), title: input.title, priority: input.priority||'medium', deadline: input.deadline||null };
    }

    case 'list_tasks': {
      const status = input.status || 'all';
      const limit  = input.limit  || 15;
      let sql  = `SELECT id,title,priority,status,deadline,category FROM tasks WHERE user_id=?`;
      const args = [userId];
      if (status !== 'all') { sql += ` AND status=?`; args.push(status); }
      sql += ` ORDER BY position ASC, created_at DESC LIMIT ?`;
      args.push(limit);
      const res = await db.execute({ sql, args });
      return { tasks: res.rows };
    }

    case 'complete_task': {
      let id = input.task_id;
      if (!id && input.task_title) {
        const found = await db.execute({
          sql:  `SELECT id,title FROM tasks WHERE user_id=? AND title LIKE ? AND status!='done' LIMIT 1`,
          args: [userId, `%${input.task_title}%`],
        });
        if (found.rows[0]) { id = found.rows[0].id; }
      }
      if (!id) return { success: false, message: 'Task not found' };
      const task = await db.execute({ sql: `SELECT title FROM tasks WHERE id=?`, args: [id] });
      await db.execute({
        sql:  `UPDATE tasks SET status='done',progress=100,completed_at=datetime('now') WHERE id=? AND user_id=?`,
        args: [id, userId],
      });
      await db.execute({ sql: `INSERT INTO xp_log (user_id,amount,reason) VALUES (?,20,?)`, args: [userId, `Task completed via Lumi`] });
      return { success: true, title: task.rows[0]?.title || 'Task', message: 'Marked as complete ✓' };
    }

    case 'create_goal': {
      const res = await db.execute({
        sql:  `INSERT INTO goals (user_id,title,description,category,target_date) VALUES (?,?,?,?,?)`,
        args: [userId, input.title, input.description||'', input.category||'Personal', input.target_date||null],
      });
      const goalId = Number(res.lastInsertRowid);
      if (input.milestones?.length) {
        for (let i = 0; i < input.milestones.length; i++) {
          await db.execute({ sql: `INSERT INTO milestones (goal_id,title,position) VALUES (?,?,?)`, args: [goalId, input.milestones[i], i] });
        }
      }
      return { success: true, goal_id: goalId, title: input.title, milestones: input.milestones?.length || 0 };
    }

    case 'list_goals': {
      const status = input.status || 'all';
      let sql  = `SELECT id,title,description,category,status,target_date FROM goals WHERE user_id=?`;
      const args = [userId];
      if (status === 'active')    { sql += ` AND status='active'`; }
      if (status === 'completed') { sql += ` AND status='completed'`; }
      const res = await db.execute({ sql, args });
      return { goals: res.rows };
    }

    case 'get_productivity_summary': {
      const period = input.period || 'week';
      const filter = period === 'today' ? `date('now')` : period === 'week' ? `date('now','-7 days')` : `date('now','-30 days')`;
      const [t, h, m, f] = await Promise.all([
        db.execute({ sql: `SELECT COUNT(*) c FROM tasks WHERE user_id=? AND status='done' AND date(completed_at)>=${filter}`, args: [userId] }),
        db.execute({ sql: `SELECT COUNT(*) c FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id WHERE h.user_id=? AND hl.date>=${filter}`, args: [userId] }),
        db.execute({ sql: `SELECT ROUND(AVG(mood),1) avg FROM moods WHERE user_id=? AND date>=${filter}`, args: [userId] }),
        db.execute({ sql: `SELECT COALESCE(SUM(duration_minutes),0) total FROM focus_sessions WHERE user_id=? AND date(completed_at)>=${filter}`, args: [userId] }),
      ]);
      return { period, tasks_completed: Number(t.rows[0].c), habit_logs: Number(h.rows[0].c), avg_mood: m.rows[0].avg, focus_minutes: Number(f.rows[0].total) };
    }

    case 'get_focus_stats': {
      const res = await db.execute({
        sql:  `SELECT COALESCE(SUM(duration_minutes),0) total, COUNT(*) sessions FROM focus_sessions WHERE user_id=?`,
        args: [userId],
      });
      return { total_minutes: Number(res.rows[0].total), total_sessions: Number(res.rows[0].sessions) };
    }

    case 'generate_daily_plan': {
      const tasks = await db.execute({
        sql:  `SELECT title,priority,deadline FROM tasks WHERE user_id=? AND status!='done' ORDER BY deadline ASC LIMIT 10`,
        args: [userId],
      });
      const hours  = input.available_hours || 4;
      const energy = input.energy || 'medium';
      const sorted = tasks.rows.sort((a, b) => {
        const p = { high: 0, medium: 1, low: 2 };
        return (p[a.priority]||1) - (p[b.priority]||1);
      });
      const plan = sorted.slice(0, Math.min(Math.floor(hours * 1.5), sorted.length)).map((t, i) => ({
        slot: i + 1, title: t.title, priority: t.priority, estimated: t.priority === 'high' ? '60-90 min' : '30-45 min',
      }));
      return { available_hours: hours, energy, plan };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── System prompt with live user context ─────────────────────
async function buildSystemPrompt(userId) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [tasks, goals, habits, mood, focus, xp] = await Promise.all([
      db.execute({ sql: `SELECT title,priority,deadline FROM tasks WHERE user_id=? AND status!='done' ORDER BY deadline ASC LIMIT 8`, args: [userId] }),
      db.execute({ sql: `SELECT title,status,category FROM goals WHERE user_id=? LIMIT 5`, args: [userId] }),
      db.execute({ sql: `SELECT name,streak FROM habits WHERE user_id=? LIMIT 6`, args: [userId] }),
      db.execute({ sql: `SELECT mood FROM moods WHERE user_id=? AND date=?`, args: [userId, today] }),
      db.execute({ sql: `SELECT COALESCE(SUM(duration_minutes),0) w FROM focus_sessions WHERE user_id=? AND week_start>=date('now','weekday 0','-6 days')`, args: [userId] }),
      db.execute({ sql: `SELECT COALESCE(SUM(amount),0) t FROM xp_log WHERE user_id=?`, args: [userId] }),
    ]);

    const taskList  = tasks.rows.map(t => `• ${t.title} [${t.priority}${t.deadline ? ` · due ${t.deadline}` : ''}]`).join('\n') || 'None';
    const goalList  = goals.rows.map(g => `• ${g.title} [${g.status}]`).join('\n') || 'None';
    const habitList = habits.rows.map(h => `• ${h.name} (${h.streak}d streak)`).join('\n') || 'None';

    return `You are Lumi, the intelligent productivity assistant built into Aurora — a personal life OS.

Today: ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}

USER WORKSPACE SNAPSHOT:
Active tasks:
${taskList}

Goals:
${goalList}

Recurring tasks:
${habitList}

Today's mood: ${mood.rows[0] ? `${mood.rows[0].mood}/5` : 'Not logged yet'}
Focus time this week: ${Number(focus.rows[0]?.w||0)} minutes
Total XP: ${Number(xp.rows[0]?.t||0)}

INSTRUCTIONS:
- You are concise, warm, and action-oriented. Never verbose.
- When a user asks you to create a task, goal, or take any action — use the tool immediately, don't just describe it.
- Reference the user's actual data when relevant. Never fabricate numbers.
- After taking an action, briefly confirm what you did in 1-2 sentences.
- For productivity questions, use get_productivity_summary before answering.
- Suggest a focus session when the user has many high-priority tasks.
- Keep responses short unless the user asks for detail.`;
  } catch (_) {
    return `You are Lumi, Aurora's productivity assistant. Be concise, warm, and action-oriented. Today is ${new Date().toLocaleDateString()}.`;
  }
}

// ── Main chat endpoint ────────────────────────────────────────
router.post('/', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server.' });

  const { messages } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  try {
    const system = await buildSystemPrompt(req.user.id);
    let currentMessages = [...messages];
    let finalText = '';
    const actions = []; // tool calls to surface to frontend

    for (let i = 0; i < 6; i++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key': key, 'anthropic-version':'2023-06-01' },
        body:    JSON.stringify({ model: MODEL, max_tokens: 1024, system, tools: TOOLS, messages: currentMessages }),
      });
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: data.error?.message || 'AI error' });

      const toolUses = data.content.filter(c => c.type === 'tool_use');

      if (!toolUses.length) {
        finalText = data.content.filter(c => c.type === 'text').map(c => c.text).join('');
        break;
      }

      const toolResults = [];
      for (const tu of toolUses) {
        const result = await executeTool(tu.name, tu.input, req.user.id);
        actions.push({ tool: tu.name, input: tu.input, result });
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) });
      }

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: data.content },
        { role: 'user',      content: toolResults },
      ];
    }

    res.json({ text: finalText || "Done! Let me know if you need anything else.", actions });
  } catch (err) {
    console.error('Lumi error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;