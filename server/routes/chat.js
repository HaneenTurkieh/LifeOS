const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');

const MODEL = 'claude-haiku-4-5-20251001';

// ── Tool definitions ───────────────────────────────────────────
const TOOLS = [
  {
    name: 'create_task',
    description: 'Create a new task for the user in Aurora.',
    input_schema: {
      type: 'object',
      properties: {
        title:       { type: 'string' },
        description: { type: 'string' },
        priority:    { type: 'string', enum: ['low','medium','high'] },
        deadline:    { type: 'string', description: 'YYYY-MM-DD' },
        category:    { type: 'string' },
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
    description: 'Mark a task as done by ID or title fragment.',
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
        target_date: { type: 'string' },
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
    description: 'Get productivity summary for a time period.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today','week','month'] },
      },
    },
  },
  {
    name: 'get_focus_stats',
    description: 'Get focus session stats.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'generate_daily_plan',
    description: 'Generate a prioritized daily plan.',
    input_schema: {
      type: 'object',
      properties: {
        available_hours: { type: 'number' },
        energy:          { type: 'string', enum: ['low','medium','high'] },
      },
    },
  },
  {
    name: 'get_focus_history',
    description: 'Analyze focus session history — best days, times, patterns, insights.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['week','month','all'] },
      },
    },
  },
  {
    name: 'save_memory',
    description: 'Save an important fact about the user for future conversations.',
    input_schema: {
      type: 'object',
      properties: {
        key:   { type: 'string' },
        value: { type: 'string' },
      },
      required: ['key','value'],
    },
  },
  {
    name: 'forget_memory',
    description: 'Delete a previously saved memory by key.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string' },
      },
      required: ['key'],
    },
  },
];

// ── Tool execution ─────────────────────────────────────────────
async function executeTool(name, input, userId) {
  switch (name) {

    case 'create_task': {
      const maxPos = await db.execute({
        sql:  `SELECT COALESCE(MAX(position),-1) m FROM tasks WHERE user_id=? AND status='todo'`,
        args: [userId],
      });
      const res = await db.execute({
        sql:  `INSERT INTO tasks (user_id,title,description,priority,category,deadline,status,progress,position)
               VALUES (?,?,?,?,?,?,'todo',0,?)`,
        args: [userId, input.title, input.description||'', input.priority||'medium',
               input.category||'General', input.deadline||null, Number(maxPos.rows[0].m)+1],
      });
      return { success: true, task_id: Number(res.lastInsertRowid), title: input.title, priority: input.priority||'medium' };
    }

    case 'list_tasks': {
      const status = input.status || 'all';
      const limit  = input.limit  || 15;
      let sql  = `SELECT id,title,priority,status,deadline,category FROM tasks WHERE user_id=?`;
      const args = [userId];
      if (status !== 'all') { sql += ` AND status=?`; args.push(status); }
      sql += ` ORDER BY position ASC, created_at DESC LIMIT ?`; args.push(limit);
      const res = await db.execute({ sql, args });
      return { tasks: res.rows };
    }

    case 'complete_task': {
      let id = input.task_id;
      if (!id && input.task_title) {
        const found = await db.execute({
          sql:  `SELECT id FROM tasks WHERE user_id=? AND title LIKE ? AND status!='done' LIMIT 1`,
          args: [userId, `%${input.task_title}%`],
        });
        if (found.rows[0]) id = found.rows[0].id;
      }
      if (!id) return { success: false, message: 'Task not found' };
      const task = await db.execute({ sql: `SELECT title FROM tasks WHERE id=?`, args: [id] });
      await db.execute({
        sql:  `UPDATE tasks SET status='done',progress=100,completed_at=datetime('now') WHERE id=? AND user_id=?`,
        args: [id, userId],
      });
      await db.execute({
        sql:  `INSERT INTO xp_log (user_id,amount,reason) VALUES (?,20,'Task completed via Lumi')`,
        args: [userId],
      });
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
          await db.execute({
            sql:  `INSERT INTO milestones (goal_id,title,position) VALUES (?,?,?)`,
            args: [goalId, input.milestones[i], i],
          });
        }
      }
      return { success: true, goal_id: goalId, title: input.title, milestones: input.milestones?.length || 0 };
    }

    case 'list_goals': {
      const status = input.status || 'all';
      let sql  = `SELECT id,title,category,status,target_date FROM goals WHERE user_id=?`;
      const args = [userId];
      if (status === 'active')    sql += ` AND status='active'`;
      if (status === 'completed') sql += ` AND status='completed'`;
      const res = await db.execute({ sql, args });
      return { goals: res.rows };
    }

    case 'get_productivity_summary': {
      const period = input.period || 'week';
      const filter = period === 'today'
        ? `date('now')`
        : period === 'week'
        ? `date('now','-7 days')`
        : `date('now','-30 days')`;
      const [t, h, m, f] = await Promise.all([
        db.execute({ sql: `SELECT COUNT(*) c FROM tasks WHERE user_id=? AND status='done' AND date(completed_at)>=${filter}`, args: [userId] }),
        db.execute({ sql: `SELECT COUNT(*) c FROM habit_logs hl JOIN habits h ON h.id=hl.habit_id WHERE h.user_id=? AND hl.date>=${filter}`, args: [userId] }),
        db.execute({ sql: `SELECT ROUND(AVG(mood),1) avg FROM moods WHERE user_id=? AND date>=${filter}`, args: [userId] }),
        db.execute({ sql: `SELECT COALESCE(SUM(duration_minutes),0) total FROM focus_sessions WHERE user_id=? AND date(completed_at)>=${filter}`, args: [userId] }),
      ]);
      return {
        period,
        tasks_completed: Number(t.rows[0].c),
        habit_logs:      Number(h.rows[0].c),
        avg_mood:        m.rows[0].avg,
        focus_minutes:   Number(f.rows[0].total),
      };
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
      const sorted = tasks.rows.sort((a, b) =>
        ({ high:0, medium:1, low:2 }[a.priority]||1) - ({ high:0, medium:1, low:2 }[b.priority]||1)
      );
      const plan = sorted.slice(0, Math.min(Math.floor(hours * 1.5), sorted.length)).map((t, i) => ({
        slot: i+1, title: t.title, priority: t.priority,
        estimated: t.priority === 'high' ? '60-90 min' : '30-45 min',
      }));
      return { available_hours: hours, energy, plan };
    }

    case 'get_focus_history': {
      const period = input.period || 'month';
      const filter = period === 'week'
        ? `date('now','-7 days')`
        : period === 'month'
        ? `date('now','-30 days')`
        : `date('now','-365 days')`;

      const [sessions, byDay, byHour, streak] = await Promise.all([
        db.execute({
          sql: `SELECT COUNT(*) total_sessions, COALESCE(SUM(duration_minutes),0) total_minutes,
                       COALESCE(AVG(duration_minutes),0) avg_minutes, COALESCE(MAX(duration_minutes),0) longest_session
                FROM focus_sessions WHERE user_id=? AND date(completed_at)>=${filter}`,
          args: [userId],
        }),
        db.execute({
          sql: `SELECT CASE strftime('%w', completed_at)
                  WHEN '0' THEN 'Sunday' WHEN '1' THEN 'Monday' WHEN '2' THEN 'Tuesday'
                  WHEN '3' THEN 'Wednesday' WHEN '4' THEN 'Thursday' WHEN '5' THEN 'Friday'
                  WHEN '6' THEN 'Saturday' END as day,
                COUNT(*) sessions, COALESCE(SUM(duration_minutes),0) minutes
                FROM focus_sessions WHERE user_id=? AND date(completed_at)>=${filter}
                GROUP BY strftime('%w', completed_at) ORDER BY minutes DESC`,
          args: [userId],
        }),
        db.execute({
          sql: `SELECT CAST(strftime('%H', completed_at) AS INTEGER) as hour,
                COUNT(*) sessions, COALESCE(SUM(duration_minutes),0) minutes
                FROM focus_sessions WHERE user_id=? AND date(completed_at)>=${filter}
                GROUP BY strftime('%H', completed_at) ORDER BY minutes DESC LIMIT 5`,
          args: [userId],
        }),
        db.execute({
          sql: `SELECT COUNT(DISTINCT date(completed_at)) streak_days FROM focus_sessions
                WHERE user_id=? AND date(completed_at) >= date('now','-30 days')`,
          args: [userId],
        }),
      ]);

      const s        = sessions.rows[0];
      const bestDay  = byDay.rows[0];
      const bestHour = byHour.rows[0];

      const formatHour = (h) => {
        if (h === null || h === undefined) return 'unknown';
        const hr = Number(h);
        if (hr === 0)  return '12 AM';
        if (hr < 12)  return `${hr} AM`;
        if (hr === 12) return '12 PM';
        return `${hr - 12} PM`;
      };

      return {
        period,
        total_sessions:   Number(s.total_sessions),
        total_minutes:    Number(s.total_minutes),
        total_hours:      Math.round(Number(s.total_minutes) / 60 * 10) / 10,
        avg_session_mins: Math.round(Number(s.avg_minutes)),
        longest_session:  Number(s.longest_session),
        best_day:         bestDay?.day || 'Not enough data',
        best_day_minutes: Number(bestDay?.minutes || 0),
        best_time_of_day: formatHour(bestHour?.hour),
        days_with_focus:  Number(streak.rows[0]?.streak_days || 0),
        by_day:           byDay.rows,
        top_hours:        byHour.rows.map(r => ({ ...r, hour_label: formatHour(r.hour) })),
        insight: Number(s.total_sessions) === 0
          ? 'No focus sessions yet. Start your first session in the Flow tab!'
          : `You focus best on ${bestDay?.day || 'weekdays'}, typically around ${formatHour(bestHour?.hour)}. You've logged ${Math.round(Number(s.total_minutes)/60*10)/10} hours of deep work this ${period}.`,
      };
    }

    case 'save_memory': {
      await db.execute({
        sql:  `INSERT INTO lumi_memory (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
               ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`,
        args: [userId, input.key, input.value],
      });
      return { success: true, key: input.key, value: input.value };
    }

    case 'forget_memory': {
      await db.execute({
        sql:  `DELETE FROM lumi_memory WHERE user_id=? AND key=?`,
        args: [userId, input.key],
      });
      return { success: true, deleted: input.key };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── Auto-title ─────────────────────────────────────────────────
async function generateTitle(firstUserMessage) {
  const words = firstUserMessage.split(' ').slice(0, 6).join(' ');
  return words.length > 40 ? words.slice(0, 40) + '…' : words;
}

// ── System prompt ──────────────────────────────────────────────
async function buildSystemPrompt(userId) {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [tasks, goals, habits, mood, focus, xp, memories, profile] = await Promise.all([
      db.execute({ sql: `SELECT title,priority,deadline FROM tasks WHERE user_id=? AND status!='done' ORDER BY deadline ASC LIMIT 8`, args: [userId] }),
      db.execute({ sql: `SELECT title,status,category FROM goals WHERE user_id=? LIMIT 5`, args: [userId] }),
      db.execute({ sql: `SELECT name,streak FROM habits WHERE user_id=? LIMIT 6`, args: [userId] }),
      db.execute({ sql: `SELECT mood FROM moods WHERE user_id=? AND date=?`, args: [userId, today] }),
      db.execute({ sql: `SELECT COALESCE(SUM(duration_minutes),0) w FROM focus_sessions WHERE user_id=? AND week_start>=date('now','weekday 0','-6 days')`, args: [userId] }),
      db.execute({ sql: `SELECT COALESCE(SUM(amount),0) t FROM xp_log WHERE user_id=?`, args: [userId] }),
      db.execute({ sql: `SELECT key, value FROM lumi_memory WHERE user_id=? ORDER BY updated_at DESC`, args: [userId] }),
      // ── NEW: fetch profile ─────────────────────────────────────
      db.execute({ sql: `SELECT name, gender, birthday, bio FROM users WHERE id=?`, args: [userId] }),
    ]);

    const taskList   = tasks.rows.map(t => `• ${t.title} [${t.priority}${t.deadline ? ` · due ${t.deadline}` : ''}]`).join('\n') || 'None';
    const goalList   = goals.rows.map(g => `• ${g.title} [${g.status}]`).join('\n') || 'None';
    const habitList  = habits.rows.map(h => `• ${h.name} (${h.streak}d streak)`).join('\n') || 'None';
    const memoryList = memories.rows.length
      ? memories.rows.map(m => `• ${m.key}: ${m.value}`).join('\n')
      : 'None yet';

    // ── Profile context ────────────────────────────────────────
    const p          = profile.rows[0] || {};
    const profileAge = p.birthday
      ? new Date().getFullYear() - Number(p.birthday.split('-')[0])
      : null;
    const profileContext = [
      p.gender   ? `Gender: ${p.gender}`          : null,
      profileAge ? `Age: ${profileAge} years old`  : null,
      p.bio      ? `Bio: "${p.bio}"`               : null,
    ].filter(Boolean).join('\n') || 'Not provided';

    // ── Mood personality ───────────────────────────────────────
    const moodValue = mood.rows[0] ? Number(mood.rows[0].mood) : null;
    const moodLabel = moodValue
      ? ['', 'Rough (1/5)', 'Meh (2/5)', 'Okay (3/5)', 'Good (4/5)', 'Great (5/5)'][moodValue]
      : 'Not logged yet';

    const moodPersonality = moodValue === null ? ''
      : moodValue <= 2
      ? `MOOD ALERT: The user is having a rough day (${moodLabel}).
— Open with genuine empathy before anything else.
— Suggest only 1-2 small, achievable tasks. Never overwhelm them.
— Avoid ambitious goal-setting or performance reviews today.
— Be warm and supportive — not a productivity robot.`
      : moodValue === 3
      ? `MOOD CONTEXT: Feeling okay today (${moodLabel}). Balanced, steady tone.`
      : `MOOD CONTEXT: Feeling great today (${moodLabel})!
— Match their positive energy. Be upbeat and enthusiastic.
— Suggest ambitious actions and celebrate wins.`;

    return `You are Lumi ✦, the intelligent productivity assistant built into Aurora — a personal life OS.

Today: ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}

USER PROFILE:
${profileContext}

WHAT YOU REMEMBER ABOUT THIS USER:
${memoryList}

USER WORKSPACE SNAPSHOT:
Active tasks:
${taskList}

Goals:
${goalList}

Recurring tasks / habits:
${habitList}

Today's mood: ${moodLabel}
Focus time this week: ${Number(focus.rows[0]?.w||0)} minutes
Total XP earned: ${Number(xp.rows[0]?.t||0)}

${moodPersonality}

INSTRUCTIONS:
- You are concise, warm, and action-oriented. Never verbose.
- Use the user's profile (gender, age, bio) to personalise your tone and suggestions naturally.
- When asked to create a task, goal, or take any action — use the tool immediately.
- Use save_memory when the user shares anything personal worth remembering.
- Reference memory naturally — don't announce that you remember, just use it.
- After taking an action, confirm briefly in 1-2 sentences.
- Keep responses short unless the user asks for detail.
- Never fabricate numbers — always fetch data with tools.
- If mood is 1-2, lead with empathy. If mood is 4-5, match their energy.`;

  } catch (_) {
    return `You are Lumi ✦, Aurora's productivity assistant. Be concise, warm, and helpful. Today is ${new Date().toLocaleDateString()}.`;
  }
}

// ── GET conversations ──────────────────────────────────────────
router.get('/conversations', async (req, res) => {
  try {
    const result = await db.execute({
      sql:  `SELECT id, title, updated_at FROM lumi_conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 30`,
      args: [req.user.id],
    });
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// ── GET messages for a conversation ───────────────────────────
router.get('/conversations/:id', async (req, res) => {
  try {
    const conv = await db.execute({
      sql:  `SELECT * FROM lumi_conversations WHERE id=? AND user_id=?`,
      args: [req.params.id, req.user.id],
    });
    if (!conv.rows[0]) return res.status(404).json({ error: 'Not found' });
    const msgs = await db.execute({
      sql:  `SELECT role, content, actions_json FROM lumi_messages WHERE conversation_id=? ORDER BY created_at ASC`,
      args: [req.params.id],
    });
    res.json({
      conversation: conv.rows[0],
      messages: msgs.rows.map((m) => ({
        role:    m.role,
        content: m.content,
        actions: JSON.parse(m.actions_json || '[]'),
      })),
    });
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// ── DELETE a conversation ──────────────────────────────────────
router.delete('/conversations/:id', async (req, res) => {
  try {
    await db.execute({
      sql:  `DELETE FROM lumi_conversations WHERE id=? AND user_id=?`,
      args: [req.params.id, req.user.id],
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// ── GET memory ─────────────────────────────────────────────────
router.get('/memory', async (req, res) => {
  try {
    const result = await db.execute({
      sql:  `SELECT key, value, updated_at FROM lumi_memory WHERE user_id=? ORDER BY updated_at DESC`,
      args: [req.user.id],
    });
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// ── DELETE a memory entry ──────────────────────────────────────
router.delete('/memory/:key', async (req, res) => {
  try {
    await db.execute({
      sql:  `DELETE FROM lumi_memory WHERE user_id=? AND key=?`,
      args: [req.user.id, req.params.key],
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// ── POST — send message ────────────────────────────────────────
router.post('/', async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set.' });

  const { messages, conversation_id } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  try {
    const system = await buildSystemPrompt(req.user.id);
    let currentMessages = [...messages];
    let finalText = '';
    const actions = [];

    for (let i = 0; i < 6; i++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key': key, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1024, system, tools: TOOLS, messages: currentMessages }),
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

    const responseText = finalText || "Done! Let me know if you need anything else.";

    // ── Persist ────────────────────────────────────────────────
    let convId = conversation_id;
    if (!convId) {
      const firstMsg   = messages.find(m => m.role === 'user')?.content || 'New conversation';
      const title      = await generateTitle(firstMsg);
      const convResult = await db.execute({
        sql:  `INSERT INTO lumi_conversations (user_id, title) VALUES (?, ?)`,
        args: [req.user.id, title],
      });
      convId = Number(convResult.lastInsertRowid);
      for (const msg of messages) {
        await db.execute({
          sql:  `INSERT INTO lumi_messages (conversation_id, role, content, actions_json) VALUES (?, ?, ?, '[]')`,
          args: [convId, msg.role, msg.content],
        });
      }
    } else {
      const lastUser = [...messages].reverse().find(m => m.role === 'user');
      if (lastUser) {
        await db.execute({
          sql:  `INSERT INTO lumi_messages (conversation_id, role, content, actions_json) VALUES (?, ?, ?, '[]')`,
          args: [convId, 'user', lastUser.content],
        });
      }
      await db.execute({
        sql:  `UPDATE lumi_conversations SET updated_at=datetime('now') WHERE id=?`,
        args: [convId],
      });
    }

    await db.execute({
      sql:  `INSERT INTO lumi_messages (conversation_id, role, content, actions_json) VALUES (?, 'assistant', ?, ?)`,
      args: [convId, responseText, JSON.stringify(actions)],
    });

    res.json({ text: responseText, actions, conversation_id: convId });

  } catch (err) {
    console.error('Lumi error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;