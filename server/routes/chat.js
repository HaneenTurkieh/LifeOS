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
          : `You focus best on ${bestDay?.day || 'weekdays'}, typically around ${formatHour(bestHour?.hour)}. You\'ve logged ${Math.round(Number(s.total_minutes)/60*10)/10} hours of deep work this ${period}.`,
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
      const today = new Date().toISOString().slice(0, 10);
      const habits = await db.execute({
        sql: `SELECT h.id, h.name, h.streak, h.color,
                     (SELECT COUNT(*) FROM habit_logs hl WHERE hl.habit_id=h.id AND hl.date=?) done_today,
                     (SELECT COUNT(*) FROM habit_logs hl WHERE hl.habit_id=h.id AND hl.date>=date('now','-30 days')) logs_30d
              FROM habits h WHERE h.user_id=? ORDER BY h.streak DESC`,
        args: [today, userId],
      });

      const rows = habits.rows.map(h => ({
        name:       h.name,
        streak:     Number(h.streak || 0),
        done_today: Boolean(h.done_today),
        logs_30d:   Number(h.logs_30d || 0),
        consistency_30d: Math.round((Number(h.logs_30d || 0) / 30) * 100),
        at_risk: !h.done_today && Number(h.streak || 0) > 0,
      }));

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
          ? `No tasks due in the next ${days} days. You\'re on top of things!`
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
      const currentIdx    = TREES.findIndex(t => t.key === equippedTree);
      const nextTree      = TREES[currentIdx + 1] || null;
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
          : `You have ${totalXp} XP and have unlocked all trees! You\'re legendary. 🌟`,
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
      db.execute({ sql: `SELECT name, gender, birthday, bio FROM users WHERE id=?`, args: [userId] }),
    ]);

    const taskList   = tasks.rows.map(t => `• ${t.title} [${t.priority}${t.deadline ? ` · due ${t.deadline}` : ''}]`).join('\n') || 'None';
    const goalList   = goals.rows.map(g => `• ${g.title} [${g.status}]`).join('\n') || 'None';
    const habitList  = habits.rows.map(h => `• ${h.name} (${h.streak}d streak)`).join('\n') || 'None';
    const memoryList = memories.rows.length
      ? memories.rows.map(m => `• ${m.key}: ${m.value}`).join('\n')
      : 'None yet';

    // ── Profile ────────────────────────────────────────────────
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

    // ── Mood personality ───────────────────────────────────────
    const moodValue = mood.rows[0] ? Number(mood.rows[0].mood) : null;
    const moodLabel = moodValue
      ? ['','Rough (1/5)','Meh (2/5)','Okay (3/5)','Good (4/5)','Great (5/5)'][moodValue]
      : 'Not logged yet';

    const moodPersonality = moodValue === null ? ''
      : moodValue <= 2
      ? `MOOD ALERT: User is having a rough day (${moodLabel}).
— Open with genuine empathy. Acknowledge feelings first.
— Suggest only 1-2 small, achievable things. Never overwhelm.
— Be warm and human — not a productivity robot.
— If stressed, suggest a short break or Flow session.`
      : moodValue === 3
      ? `MOOD CONTEXT: Feeling okay today (${moodLabel}). Balanced, steady tone.`
      : `MOOD CONTEXT: Feeling great today (${moodLabel})!
— Match their energy. Be upbeat and enthusiastic.
— Suggest ambitious actions, celebrate wins.`;

    return `You are Lumi ✦, the intelligent productivity assistant built into Aurora — a personal life OS.

Today: ${new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}

USER PROFILE (always use this to personalise your tone and suggestions):
${profileContext}

WHAT YOU REMEMBER ABOUT THIS USER:
${memoryList}

USER WORKSPACE SNAPSHOT:
Active tasks:
${taskList}

Goals:
${goalList}

Habits & streaks:
${habitList}

Today's mood: ${moodLabel}
Focus time this week: ${Number(focus.rows[0]?.w||0)} minutes
Total XP earned: ${Number(xp.rows[0]?.t||0)}

${moodPersonality}

TOOLS AVAILABLE:
You have access to powerful tools. Use them proactively:
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
- You are concise, warm, and action-oriented. Never verbose.
- ALWAYS use the user's name (${p.name || 'there'}) naturally in conversation.
- Use profile info (gender, age, bio) to personalise — adjust pronouns, references, tone.
- When asked to take an action — use the tool immediately. Don't ask for confirmation first.
- Use save_memory proactively whenever the user shares something worth remembering.
- Reference memory naturally — don't announce that you remember, just use it.
- After any tool action, confirm briefly in 1-2 sentences then ask what's next.
- Keep responses short and punchy unless the user asks for detail.
- Never fabricate numbers — always fetch data with tools.
- If mood is 1-2, lead with empathy before anything else.
- If mood is 4-5, match their energy and be ambitious.`;

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