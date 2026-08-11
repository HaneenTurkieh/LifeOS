const express = require('express');
const router  = express.Router();
const { db }  = require('../db/connection');
const { checkLimit, recordUsage, limitMessage } = require('../lib/usageLimits');
const { callOpenRouter } = require('../lib/openrouter');
const { callGemini } = require('../lib/gemini');
const { getHabitStreak } = require('../lib/gamification');

const DEFAULT_SETTINGS = { tone:'friendly', response_length:'balanced', emoji_level:'some' };
const TONE_PROMPTS = {
  friendly:     'Tone: warm, casual, and supportive — like a close friend who has your back.',
  professional: 'Tone: polished, precise, and businesslike. No slang. Get straight to the point.',
  motivational: 'Tone: energetic coach. Celebrate every win, push gently, keep momentum high.',
  calm:         'Tone: gentle, soothing, and unhurried. Never pressure. Create a sense of ease.',
  playful:      'Tone: witty and light. Sprinkle in humor and personality, but stay genuinely helpful.',
};
const LENGTH_PROMPTS = {
  short:    'Response length: VERY short — 1-3 sentences max unless the user explicitly asks for detail.',
  balanced: 'Response length: concise but complete. A few sentences, more only when the topic needs it.',
  detailed: 'Response length: thorough. Explain reasoning, give context, structure longer answers clearly.',
};
const EMOJI_PROMPTS = {
  none: 'Emoji: never use emoji.',
  some: 'Emoji: use sparingly — one where it adds warmth, never more than a couple per message.',
  lots: 'Emoji: use freely and expressively — make messages lively.',
};
async function getSettings(userId) {
  try {
    const row = (await db.execute({
      sql:  `SELECT tone, response_length, emoji_level FROM lumi_settings WHERE user_id=?`,
      args: [userId],
    })).rows[0];
    return { ...DEFAULT_SETTINGS, ...(row || {}) };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

const MODE_PROMPTS = {
  chat:   '',
  think:  `MODE — DEEP THINKING: The user chose deep-reasoning mode. Think carefully and
step-by-step before answering. Consider multiple angles, check your logic, and give a
thorough, well-structured answer. Depth over speed.`,
  search: `MODE — DEEP SEARCH: The user chose research mode. Use the web_search tool to find
current, real information before answering. Synthesize what you find, mention your sources
by name, and clearly separate facts from your own suggestions. Never invent search results.`,
};

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
    description: 'Get total focus session stats.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_focus_history',
    description: 'Analyse focus session history — best days, best times, patterns, insights.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['week','month','all'] },
      },
    },
  },
  {
    name: 'generate_daily_plan',
    description: 'Generate a prioritized daily plan based on tasks and available time.',
    input_schema: {
      type: 'object',
      properties: {
        available_hours: { type: 'number' },
        energy:          { type: 'string', enum: ['low','medium','high'] },
      },
    },
  },
  {
    name: 'get_habit_streaks',
    description: 'Get the user\'s habits and their current streaks, consistency, and which are at risk.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_mood_insights',
    description: 'Get mood trends and insights — average mood, best and worst days, patterns.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['week','month'] },
      },
    },
  },
  {
    name: 'list_upcoming_deadlines',
    description: 'Get tasks with upcoming deadlines sorted by urgency.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'How many days ahead to look (default 7)' },
      },
    },
  },
  {
    name: 'get_xp_progress',
    description: 'Get the user\'s XP, current level, and progress toward the next tree unlock.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'save_memory',
    description: 'Save an important fact about the user for future conversations. Use when the user shares preferences, personal info, or anything worth remembering.',
    input_schema: {
      type: 'object',
      properties: {
        key:   { type: 'string', description: 'Short identifier e.g. "study_field", "wake_time"' },
        value: { type: 'string', description: 'The fact to remember' },
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
    case 'get_habit_streaks': {
      // habits has no `streak` column — streak is computed on the fly from
      // habit_logs (same helper the Habits page itself uses), not stored.
      const today = new Date().toISOString().slice(0, 10);
      const habits = await db.execute({
        sql: `SELECT h.id, h.name, h.color,
                     (SELECT COUNT(*) FROM habit_logs hl WHERE hl.habit_id=h.id AND hl.date=?) done_today,
                     (SELECT COUNT(*) FROM habit_logs hl WHERE hl.habit_id=h.id AND hl.date>=date('now','-30 days')) logs_30d
              FROM habits h WHERE h.user_id=?`,
        args: [today, userId],
      });
      const rows = (await Promise.all(habits.rows.map(async (h) => ({
        name:       h.name,
        streak:     await getHabitStreak(h.id),
        done_today: Boolean(h.done_today),
        logs_30d:   Number(h.logs_30d || 0),
        consistency_30d: Math.round((Number(h.logs_30d || 0) / 30) * 100),
      })))).map((h) => ({ ...h, at_risk: !h.done_today && h.streak > 0 }))
        .sort((a, b) => b.streak - a.streak);
      const atRisk = rows.filter(h => h.at_risk);
      return {
        habits: rows,
        total_habits: rows.length,
        done_today:   rows.filter(h => h.done_today).length,
        at_risk_count: atRisk.length,
        at_risk_names: atRisk.map(h => h.name),
        best_streak:   rows.reduce((max, h) => Math.max(max, h.streak), 0),
        insight: rows.length === 0
          ? 'No habits set up yet. Add habits in the Goals tab.'
          : atRisk.length > 0
          ? `${atRisk.length} habit${atRisk.length > 1 ? 's' : ''} at risk today: ${atRisk.map(h => h.name).join(', ')}. Log them to keep your streak!`
          : `Great — all habits logged today! Your best streak is ${rows[0]?.streak || 0} days.`,
      };
    }
    case 'get_mood_insights': {
      const period = input.period || 'week';
      const filter = period === 'week' ? `date('now','-7 days')` : `date('now','-30 days')`;
      const [avg, trend, best, worst] = await Promise.all([
        db.execute({
          sql:  `SELECT ROUND(AVG(mood),1) avg, COUNT(*) count FROM moods WHERE user_id=? AND date>=${filter}`,
          args: [userId],
        }),
        db.execute({
          sql:  `SELECT date, mood FROM moods WHERE user_id=? AND date>=${filter} ORDER BY date ASC`,
          args: [userId],
        }),
        db.execute({
          sql:  `SELECT date, mood FROM moods WHERE user_id=? AND date>=${filter} ORDER BY mood DESC LIMIT 1`,
          args: [userId],
        }),
        db.execute({
          sql:  `SELECT date, mood FROM moods WHERE user_id=? AND date>=${filter} ORDER BY mood ASC LIMIT 1`,
          args: [userId],
        }),
      ]);
      const moodLabels = ['', 'Rough', 'Meh', 'Okay', 'Good', 'Great'];
      const avgVal     = Number(avg.rows[0]?.avg || 0);
      return {
        period,
        average_mood:     avgVal,
        average_label:    moodLabels[Math.round(avgVal)] || 'Unknown',
        days_logged:      Number(avg.rows[0]?.count || 0),
        best_day:         best.rows[0] || null,
        worst_day:        worst.rows[0] || null,
        trend:            trend.rows,
        insight: avg.rows[0]?.count === 0
          ? 'No mood logged yet this period.'
          : `Your average mood this ${period} is ${avgVal}/5 (${moodLabels[Math.round(avgVal)] || ''}). You've logged ${avg.rows[0].count} days.`,
      };
    }
    case 'list_upcoming_deadlines': {
      const days   = input.days || 7;
      const result = await db.execute({
        sql: `SELECT title, priority, deadline, category, status
              FROM tasks
              WHERE user_id=? AND status!='done' AND deadline IS NOT NULL
                AND deadline BETWEEN date('now') AND date('now', '+${Number(days)} days')
              ORDER BY deadline ASC, priority ASC
              LIMIT 15`,
        args: [userId],
      });
      const today = new Date().toISOString().slice(0, 10);
      const tasks = result.rows.map(t => {
        const daysLeft = Math.ceil((new Date(t.deadline) - new Date(today)) / (1000*60*60*24));
        return { ...t, days_left: daysLeft, urgency: daysLeft <= 1 ? 'urgent' : daysLeft <= 3 ? 'soon' : 'upcoming' };
      });
      return {
        tasks,
        count:   tasks.length,
        urgent:  tasks.filter(t => t.urgency === 'urgent').length,
        insight: tasks.length === 0
          ? `No tasks due in the next ${days} days. You're on top of things!`
          : `You have ${tasks.length} task${tasks.length > 1 ? 's' : ''} due in the next ${days} days. ${tasks.filter(t => t.urgency === 'urgent').length} are urgent.`,
      };
    }
    case 'get_xp_progress': {
      const TREES = [
        { key:'seedling',       name:'Seedling',       cost:0    },
        { key:'sprout',         name:'Sprout',         cost:100  },
        { key:'oak',            name:'Oak',            cost:300  },
        { key:'cherry_blossom', name:'Cherry Blossom', cost:600  },
        { key:'bamboo',         name:'Bamboo',         cost:1000 },
        { key:'palm',           name:'Palm',           cost:1500 },
        { key:'pine',           name:'Pine',           cost:2500 },
        { key:'crystal',        name:'Crystal Tree',   cost:5000 },
      ];
      const [xp, equipped, unlocked] = await Promise.all([
        db.execute({ sql: `SELECT COALESCE(SUM(amount),0) total FROM xp_log WHERE user_id=?`, args: [userId] }),
        db.execute({ sql: `SELECT tree_key FROM user_equipped_tree WHERE user_id=?`, args: [userId] }),
        db.execute({ sql: `SELECT tree_key FROM user_trees WHERE user_id=?`, args: [userId] }),
      ]);
      const totalXp       = Number(xp.rows[0]?.total || 0);
      const equippedTree  = equipped.rows[0]?.tree_key || 'seedling';
      const unlockedKeys  = new Set(unlocked.rows.map(r => r.tree_key));
      // equippedTree can also be 'mystic' (the user-designed tree, not
      // part of this fixed list) — findIndex returns -1 there, which
      // would wrongly point "next tree" back at Seedling, so only chase
      // the ladder when they're actually on it.
      const currentIdx    = TREES.findIndex(t => t.key === equippedTree);
      const nextTree      = currentIdx >= 0 ? (TREES[currentIdx + 1] || null) : null;
      const level         = Math.floor(totalXp / 100) + 1;
      return {
        total_xp:       totalXp,
        level,
        equipped_tree:  equippedTree,
        unlocked_count: unlockedKeys.size,
        total_trees:    TREES.length,
        next_tree:      nextTree ? { name: nextTree.name, cost: nextTree.cost, xp_needed: Math.max(0, nextTree.cost - totalXp) } : null,
        insight: nextTree
          ? `You have ${totalXp} XP. ${nextTree.name} unlocks at ${nextTree.cost} XP — you need ${Math.max(0, nextTree.cost - totalXp)} more!`
          : `You have ${totalXp} XP and have unlocked all trees! You're legendary. 🌟`,
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

async function generateTitle(firstUserMessage) {
  const words = firstUserMessage.split(' ').slice(0, 6).join(' ');
  return words.length > 40 ? words.slice(0, 40) + '…' : words;
}

async function buildSystemPrompt(userId, mode = 'chat', hasAttachments = false, currentConvId = null) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const q = (sql, args) =>
      db.execute({ sql, args }).catch((e) => {
        console.error('[lumi prompt] query failed (non-fatal):', e.message, '—', sql.slice(0, 60));
        return { rows: [] };
      });
    const [tasks, goals, habits, mood, focus, xp, memories, recentConvos] = await Promise.all([
      q(`SELECT title,priority,deadline FROM tasks WHERE user_id=? AND status!='done' ORDER BY deadline ASC LIMIT 8`, [userId]),
      q(`SELECT title,status,category FROM goals WHERE user_id=? LIMIT 5`, [userId]),
      q(`SELECT id,name FROM habits WHERE user_id=? LIMIT 6`, [userId]),
      q(`SELECT mood FROM moods WHERE user_id=? AND date=?`, [userId, today]),
      q(`SELECT COALESCE(SUM(duration_minutes),0) w FROM focus_sessions WHERE user_id=? AND week_start>=date('now','weekday 0','-6 days')`, [userId]),
      q(`SELECT COALESCE(SUM(amount),0) t FROM xp_log WHERE user_id=?`, [userId]),
      // Capped — with save_memory now used proactively (see the
      // instruction below), this table only grows, and an unbounded
      // SELECT here means every chat message re-fetches a user's entire
      // memory history forever. 40 most-recent facts is more than enough
      // context for a system prompt; older ones just age out.
      q(`SELECT key, value FROM lumi_memory WHERE user_id=? ORDER BY updated_at DESC LIMIT 40`, [userId]),
      // Cross-chat continuity — every "New chat" used to start with zero
      // awareness of anything discussed in earlier conversations, only
      // ever recalling facts explicitly saved via save_memory. Titles are
      // free (already generated per-conversation) and cheap to include,
      // so Lumi can at least recognize "we talked about X before" instead
      // of treating every new chat as a stranger would.
      q(`SELECT id, title FROM lumi_conversations WHERE user_id=? AND id!=? ORDER BY updated_at DESC LIMIT 6`,
        [userId, currentConvId || 0]),
    ]);
    let profile = await q(`SELECT name, email, gender, birthday, bio FROM users WHERE id=?`, [userId]);
    if (!profile.rows.length) {
      profile = await q(`SELECT name, email FROM users WHERE id=?`, [userId]);
    }
    const settings = await getSettings(userId);
    const taskList   = tasks.rows.map(t => `• ${t.title} [${t.priority}${t.deadline ? ` · due ${t.deadline}` : ''}]`).join('\n') || 'None';
    const goalList   = goals.rows.map(g => `• ${g.title} [${g.status}]`).join('\n') || 'None';
    // habits has no `streak` column — computed on the fly from habit_logs.
    const habitStreaks = await Promise.all(habits.rows.map((h) => getHabitStreak(h.id)));
    const habitList  = habits.rows.map((h, i) => `• ${h.name} (${habitStreaks[i]}d streak)`).join('\n') || 'None';
    const memoryList = memories.rows.length
      ? memories.rows.map(m => `• ${m.key}: ${m.value}`).join('\n')
      : 'None yet';
    const recentTopicsList = recentConvos.rows.length
      ? recentConvos.rows.map(c => `• ${c.title}`).join('\n')
      : 'None yet — this is one of the user\'s first conversations.';

    const p          = profile.rows[0] || {};
    const profileAge = p.birthday
      ? new Date().getFullYear() - Number(p.birthday.split('-')[0])
      : null;
    const profileContext = [
      p.name     ? `Name: ${p.name}`                : null,
      p.gender   ? `Gender: ${p.gender}`            : null,
      profileAge ? `Age: ${profileAge} years old`   : null,
      p.bio      ? `Bio: "${p.bio}"`                : null,
    ].filter(Boolean).join('\n') || 'Not provided';

    const moodValue = mood.rows[0] ? Number(mood.rows[0].mood) : null;
    const moodLabel = moodValue
      ? ['','Rough (1/5)','Meh (2/5)','Okay (3/5)','Good (4/5)','Great (5/5)'][moodValue]
      : 'Not logged yet';
    const moodPersonality = moodValue === null ? ''
      : moodValue <= 2
      ? `MOOD CONTEXT: User logged today as ${moodLabel} earlier. Keep this in mind, but don't
assume it still applies — read the actual conversation for how they're doing right now.`
      : moodValue === 3
      ? `MOOD CONTEXT: Logged today as ${moodLabel}. Balanced, steady tone.`
      : `MOOD CONTEXT: Logged today as ${moodLabel}. Feel free to match upbeat energy if the
conversation is in that register too.`;

    const personality = [
      TONE_PROMPTS[settings.tone]              || TONE_PROMPTS.friendly,
      LENGTH_PROMPTS[settings.response_length] || LENGTH_PROMPTS.balanced,
      EMOJI_PROMPTS[settings.emoji_level]      || EMOJI_PROMPTS.some,
    ].join('\n');
    const attachmentNote = hasAttachments
      ? `\nATTACHED FILES: The user attached file content to their message (marked with 📎).
Read it fully. When asked to summarize, cover all key points faithfully — don't skip
sections. When asked questions about it, quote or reference specific parts.\n`
      : '';

    return `You are Lumi ✦, the intelligent productivity assistant built into Aurora — a personal life OS.
Today: ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}

LANGUAGE: Match the language of the user's MOST RECENT message specifically —
not the dominant language earlier in this same conversation. If a conversation
started in Arabic and the user's latest message is in English, respond in
English; if it started in English and they just switched to Arabic, switch
with them. Never let earlier turns pull you back into a language the user has
already moved away from. If their latest message is in Arabic, respond in
Palestinian colloquial Arabic (اللهجة الفلسطينية) — not Egyptian, not Gulf,
not formal Modern Standard Arabic (فصحى) — using everyday Palestinian
vocabulary and rhythm, the way someone from Nablus/the West Bank would
actually text a friend. If their latest message is in English, respond in
English.

ABOUT AURORA (public — share with any user who asks):
Aurora was designed and built entirely from scratch by Haneen Turkieh, a passionate
19-year-old developer from Palestine, studying in the Computer Science Apprenticeship
Program (CAP) at An-Najah National University in Nablus. If a user asks who made Aurora,
who Haneen Turkieh is, or anything about the app's creator — tell them proudly.

CONVERSATIONAL STYLE — READ THIS FIRST:
Lumi is a warm, natural conversational partner before it is a productivity tool —
the same kind of presence a good general assistant like ChatGPT or Gemini is. Aurora's
tools exist to help when they're useful, not a script every conversation gets funneled
back into. If the user is chatting, venting, thinking out loud, asking something
unrelated to Aurora, or just talking — be a genuine conversational partner first.
Do not steer the conversation back to tasks, exams, goals, or any Aurora feature
unless the user actually asks for that, or it's obviously what they want.

EMOTIONAL SUPPORT — THIS OVERRIDES "BE CONCISE" AND "USE TOOLS":
If the user expresses sadness, stress, anxiety, frustration, loneliness, or any
difficult emotion — in THIS message, regardless of what mood they logged earlier
today or didn't log at all — your first priority is to be present with them, the
way a caring friend would be. Concretely:
- Acknowledge how they're feeling in your own words. Don't rush past it into logistics.
- If it's unclear what's going on, ask — don't assume you already know why.
- Do NOT pivot to tasks, exams, productivity, or any Aurora feature unless they ask
  for that, or clearly want a distraction and say so themselves.
- Do NOT diagnose, label, or assume a clinical condition.
- Stay with them for as long as the conversation needs before circling back to
  anything app-related.
- If they seem to be in real distress, gently encourage talking to someone they
  trust or a professional — without sounding clinical or like a canned script.
A person who is upset does not want to be redirected to a study tool. Being genuinely
supportive matters more here than being brief or action-oriented.

USER PROFILE (use to personalise tone and suggestions):
${profileContext}

PERSONALITY SETTINGS (chosen by the user — always follow these, except where
EMOTIONAL SUPPORT above takes priority):
${personality}

WHAT YOU REMEMBER ABOUT THIS USER (facts saved across every past conversation):
${memoryList}

RECENT CONVERSATION TOPICS (titles of this user's last few chats with you,
most recent first — you don't have the full text, but reference them
naturally if this new conversation is clearly a continuation, e.g. "still
thinking about that Arduino project?" — don't force it if unrelated):
${recentTopicsList}

USER WORKSPACE SNAPSHOT:
Active tasks:
${taskList}
Goals:
${goalList}
Habits & streaks:
${habitList}
${moodPersonality}
Focus time this week: ${Number(focus.rows[0]?.w||0)} minutes
Total XP earned: ${Number(xp.rows[0]?.t||0)}

${MODE_PROMPTS[mode] || ''}
${attachmentNote}

TOOLS AVAILABLE:
Use these when they're genuinely relevant to what the user is asking for —
not as a default reflex:
- create_task / list_tasks / complete_task — task management
- create_goal / list_goals — goal tracking
- get_productivity_summary — weekly/monthly overview
- get_focus_stats / get_focus_history — deep work patterns
- generate_daily_plan — build a schedule
- get_habit_streaks — habit consistency and at-risk habits
- get_mood_insights — mood trends and patterns
- list_upcoming_deadlines — what's due soon
- get_xp_progress — level, XP, next tree unlock
- save_memory / forget_memory — remember important facts

INSTRUCTIONS:
- Be a real conversational partner first — warm, natural, present. Concise second.
- Match the emotional register of what the user brings. A heartfelt message doesn't
  get a clipped, task-oriented reply.
- Use the user's name (${p.name || 'there'}) naturally, not in every message.
- Use profile info (gender, age, bio) to personalise — adjust pronouns, references, tone.
- When the user clearly asks for an action, use the tool immediately — don't ask for
  confirmation first. But don't reach for a tool just because one exists.
- Use save_memory PROACTIVELY and OFTEN — don't wait to be told "remember this."
  Save it the moment you notice: a project or idea they're actively working on,
  a preference (language, tone, how they like things explained), a recurring
  topic, their field of study/goals, or any personal detail that would make a
  future conversation feel like picking up with someone who actually knows
  them. Err toward saving too much rather than too little — this is the only
  thing that carries real detail between separate conversations (conversation
  titles above are just topic labels, not full context).
- Reference memory naturally — don't announce that you remember, just use it.
- After a tool action, confirm briefly then ask what's next.
- Keep everyday responses short and punchy — except emotional-support conversations,
  which take as much space as the person needs.
- Never fabricate numbers — always fetch data with tools.`;
  } catch (err) {
    console.error('[lumi prompt] TOTAL failure — using generic fallback:', err.message);
    return `You are Lumi ✦, Aurora's productivity assistant. Be warm, conversational, and genuinely present with the user first — helpful with Aurora's tools second. Today is ${new Date().toLocaleDateString()}.`;
  }
}

router.get('/conversations', async (req, res) => {
  try {
    const result = await db.execute({
      sql:  `SELECT id, title, updated_at FROM lumi_conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 30`,
      args: [req.user.id],
    });
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    const conv = await db.execute({
      sql:  `SELECT * FROM lumi_conversations WHERE id=? AND user_id=?`,
      args: [req.params.id, req.user.id],
    });
    if (!conv.rows[0]) return res.status(404).json({ error: 'Not found' });
    const msgs = await db.execute({
      sql:  `SELECT id, role, content, actions_json FROM lumi_messages WHERE conversation_id=? ORDER BY created_at ASC`,
      args: [req.params.id],
    });
    res.json({
      conversation: conv.rows[0],
      messages: msgs.rows.map((m) => ({
        id:      m.id,
        role:    m.role,
        content: m.content,
        actions: JSON.parse(m.actions_json || '[]'),
      })),
    });
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// ── Edit-and-resend support — deletes a message and everything that
// came after it in the conversation (its own old content plus whatever
// Lumi replied with, and anything after that), so re-sending the edited
// text from that point produces a clean, single timeline instead of
// leaving orphaned rows that would reappear on the next reload.
router.delete('/conversations/:id/messages/from/:messageId', async (req, res) => {
  try {
    const conv = await db.execute({
      sql:  `SELECT id FROM lumi_conversations WHERE id=? AND user_id=?`,
      args: [req.params.id, req.user.id],
    });
    if (!conv.rows[0]) return res.status(404).json({ error: 'Not found' });
    await db.execute({
      sql:  `DELETE FROM lumi_messages WHERE conversation_id=? AND id >= ?`,
      args: [req.params.id, req.params.messageId],
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

router.delete('/conversations/:id', async (req, res) => {
  try {
    await db.execute({
      sql:  `DELETE FROM lumi_conversations WHERE id=? AND user_id=?`,
      args: [req.params.id, req.user.id],
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

router.get('/memory', async (req, res) => {
  try {
    const result = await db.execute({
      sql:  `SELECT key, value, updated_at FROM lumi_memory WHERE user_id=? ORDER BY updated_at DESC`,
      args: [req.user.id],
    });
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

router.delete('/memory/:key', async (req, res) => {
  try {
    await db.execute({
      sql:  `DELETE FROM lumi_memory WHERE user_id=? AND key=?`,
      args: [req.user.id, req.params.key],
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

router.get('/settings', async (req, res) => {
  res.json(await getSettings(req.user.id));
});

router.put('/settings', async (req, res) => {
  try {
    const tone   = Object.keys(TONE_PROMPTS).includes(req.body.tone)              ? req.body.tone            : DEFAULT_SETTINGS.tone;
    const length = Object.keys(LENGTH_PROMPTS).includes(req.body.response_length) ? req.body.response_length : DEFAULT_SETTINGS.response_length;
    const emoji  = Object.keys(EMOJI_PROMPTS).includes(req.body.emoji_level)      ? req.body.emoji_level     : DEFAULT_SETTINGS.emoji_level;
    await db.execute({
      sql: `INSERT INTO lumi_settings (user_id, tone, response_length, emoji_level, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(user_id) DO UPDATE SET
              tone=excluded.tone, response_length=excluded.response_length,
              emoji_level=excluded.emoji_level, updated_at=datetime('now')`,
      args: [req.user.id, tone, length, emoji],
    });
    res.json({ tone, response_length: length, emoji_level: emoji });
  } catch (err) {
    console.error('PUT /chat/settings error:', err);
    res.status(500).json({ error: 'Could not save settings' });
  }
});

const MAX_ATTACHMENT_CHARS = 25000;

// Numeric/statistical claim detector — deliberately narrow. Only fires
// on digits paired with a stat-like unit (%, percent, million, billion,
// thousand), not on bare numbers or bare years, which produced false
// positives like "step 3" or "chapter 2020". Only checked in plain
// 'chat' mode — 'search' mode is already web-grounded, 'think' mode is
// for reasoning, not factual lookup.
const STAT_CLAIM_RE = /\d[\d,.]*\s?(%|percent|million|billion|thousand)\b/i;

router.post('/', async (req, res) => {
  // Deep Think and Deep Search need capabilities OpenRouter/DeepSeek
  // doesn't have (native reasoning, hosted web-search grounding) — routed
  // to Gemini, which covers both on its free tier. Plain chat — the
  // everyday, highest-volume path — stays on OpenRouter/DeepSeek.
  const requestedMode = req.body?.mode || 'chat';
  const usesGemini = requestedMode === 'think' || requestedMode === 'search';
  if (usesGemini && !process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not set.' });
  if (!usesGemini && !process.env.OPENROUTER_API_KEY) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set.' });
  // no_history: true is for behind-the-scenes uses of this same endpoint
  // that were never meant to be a real conversation with Lumi — the
  // Projects "Break into tasks" breakdown and the CV Builder review both
  // reuse /chat for the model call, but were saving a brand-new
  // lumi_conversations row every time, cluttering the visible chat
  // history with raw internal prompts. Everything still runs exactly
  // the same; only the DB writes at the bottom get skipped.
  const { messages, conversation_id, mode = 'chat', attachments = [], no_history = false } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  // Deep Think and Deep Search are the priciest calls in the app
  // (extended thinking, and the web_search tool's own per-search fee) —
  // capped per day for free accounts. Plain chat stays unlimited since
  // it's cheap and it's the daily-habit feature.
  const gateFeature = mode === 'think' ? 'deep_think' : mode === 'search' ? 'deep_search' : null;
  if (gateFeature) {
    const gate = await checkLimit(req.user.id, gateFeature);
    if (!gate.allowed) {
      return res.status(403).json({ error: limitMessage(gateFeature, gate.limit), code: 'DAILY_LIMIT', feature: gateFeature });
    }
  }

  try {
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    const system = await buildSystemPrompt(req.user.id, mode, hasAttachments, conversation_id);
    let currentMessages = messages.map(m => ({ ...m }));
    if (hasAttachments) {
      for (let i = currentMessages.length - 1; i >= 0; i--) {
        if (currentMessages[i].role === 'user') {
          const attachBlock = attachments.map(a =>
            `\n\n📎 ATTACHED FILE: ${a.name || 'file'}\n---\n${String(a.text || '').slice(0, MAX_ATTACHMENT_CHARS)}\n---`
          ).join('');
          currentMessages[i] = { ...currentMessages[i], content: currentMessages[i].content + attachBlock };
          break;
        }
      }
    }
    // Deterministic language match, pinned right next to the message it
    // applies to — this is the actual fix for "responded in Arabic when I
    // wrote English." The LANGUAGE rule in the system prompt is one
    // paragraph inside a long block of text, and a model can drift toward
    // whichever language dominated earlier turns instead of rechecking it
    // every reply (DeepSeek especially, since it's not as strong at
    // instruction-following as what this app used before). Detecting the
    // latest message's script directly with a regex and tagging it inline
    // removes the guesswork entirely. Only touches what's sent to the
    // model — the original `messages`/DB save below is untouched, same
    // pattern as the attachment block above.
    const ARABIC_RE = /[؀-ۿ]/;
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      if (currentMessages[i].role === 'user') {
        const isArabic = ARABIC_RE.test(currentMessages[i].content || '');
        const langTag = isArabic
          ? '\n\n[Reply in Palestinian colloquial Arabic — this message is in Arabic.]'
          : '\n\n[Reply in English — this message is in English, regardless of what language earlier messages in this conversation used.]';
        currentMessages[i] = { ...currentMessages[i], content: currentMessages[i].content + langTag };
        break;
      }
    }
    let finalText = '';
    const actions = [];

    if (usesGemini) {
      // Deep Think / Deep Search — routed to Gemini. Deep Search uses
      // only the hosted google_search grounding tool (its whole job is
      // real web lookups, so the app's own function-calling tools are
      // left out of that request — Gemini doesn't allow combining
      // grounding with custom tools in one call). Deep Think keeps the
      // full app tool set plus a thinking budget for step-by-step reasoning.
      let geminiContents = currentMessages.map((m) => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
      }));
      const maxTokens = mode === 'think' ? 6000 : hasAttachments ? 3000 : 1024;
      for (let i = 0; i < 6; i++) {
        const data = await callGemini({
          system,
          contents:        geminiContents,
          tools:           mode === 'search' ? undefined : TOOLS,
          useGoogleSearch: mode === 'search',
          thinkingBudget:  mode === 'think' ? 4000 : undefined,
          maxOutputTokens: maxTokens,
        });
        const parts = data.candidates?.[0]?.content?.parts || [];
        const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);
        if (!functionCalls.length) {
          finalText = parts.filter((p) => p.text).map((p) => p.text).join('');
          break;
        }
        geminiContents = [...geminiContents, { role: 'model', parts }];
        const functionResponseParts = [];
        for (const fc of functionCalls) {
          const result = await executeTool(fc.name, fc.args || {}, req.user.id);
          actions.push({ tool: fc.name, input: fc.args || {}, result });
          functionResponseParts.push({
            functionResponse: { name: fc.name, response: { name: fc.name, content: result } },
          });
        }
        geminiContents = [...geminiContents, { role: 'function', parts: functionResponseParts }];
      }
    } else {
      // Plain chat — the everyday path (also what Projects' "Break into
      // tasks" and the CV Builder review reuse via no_history) — routed
      // to OpenRouter/DeepSeek instead. Same tool set (create_task,
      // list_tasks, etc.), converted to OpenAI's function-calling shape
      // by callOpenRouter, and the same up-to-6-turn loop so DeepSeek can
      // call a tool, see the result, and keep going same as the other modes.
      const maxTokens = hasAttachments ? 3000 : 1024;
      for (let i = 0; i < 6; i++) {
        const data = await callOpenRouter({
          system, messages: currentMessages, tools: TOOLS, max_tokens: maxTokens,
        });
        const msg = data.choices?.[0]?.message || {};
        const toolCalls = msg.tool_calls || [];
        if (!toolCalls.length) {
          finalText = msg.content || '';
          break;
        }
        const toolResults = [];
        for (const tc of toolCalls) {
          let input = {};
          try { input = JSON.parse(tc.function.arguments || '{}'); } catch (_) {}
          const result = await executeTool(tc.function.name, input, req.user.id);
          actions.push({ tool: tc.function.name, input, result });
          toolResults.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
        }
        currentMessages = [
          ...currentMessages,
          { role: 'assistant', content: msg.content || null, tool_calls: toolCalls },
          ...toolResults,
        ];
      }
    }
    const responseText = finalText || "Done! Let me know if you need anything else.";

    // Only relevant for plain chat — search mode is already grounded,
    // think mode isn't for factual lookup.
    const suggestSearch = mode === 'chat' && STAT_CLAIM_RE.test(responseText);

    const attachmentSuffix = hasAttachments
      ? `\n\n📎 ${attachments.map(a => a.name || 'file').join(', ')}`
      : '';
    let convId = conversation_id;
    let userMessageId = null; // lets the client attach a stable id to the
                               // just-sent message so it can be edited
                               // later without needing a full reload first
    if (!no_history) {
      if (!convId) {
        const firstMsg   = messages.find(m => m.role === 'user')?.content || 'New conversation';
        const title      = await generateTitle(firstMsg);
        const convResult = await db.execute({
          sql:  `INSERT INTO lumi_conversations (user_id, title) VALUES (?, ?)`,
          args: [req.user.id, title],
        });
        convId = Number(convResult.lastInsertRowid);
        for (let i = 0; i < messages.length; i++) {
          const msg    = messages[i];
          const isLastUser = msg.role === 'user' && i === messages.length - 1;
          const inserted = await db.execute({
            sql:  `INSERT INTO lumi_messages (conversation_id, role, content, actions_json) VALUES (?, ?, ?, '[]')`,
            args: [convId, msg.role, msg.content + (isLastUser ? attachmentSuffix : '')],
          });
          if (isLastUser) userMessageId = Number(inserted.lastInsertRowid);
        }
      } else {
        const lastUser = [...messages].reverse().find(m => m.role === 'user');
        if (lastUser) {
          const inserted = await db.execute({
            sql:  `INSERT INTO lumi_messages (conversation_id, role, content, actions_json) VALUES (?, ?, ?, '[]')`,
            args: [convId, 'user', lastUser.content + attachmentSuffix],
          });
          userMessageId = Number(inserted.lastInsertRowid);
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
    }
    if (gateFeature) await recordUsage(req.user.id, gateFeature);
    res.json({ text: responseText, actions, conversation_id: convId, mode, suggestSearch, user_message_id: userMessageId });
  } catch (err) {
    console.error('Lumi error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;