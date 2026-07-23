import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { api }       from '../api/client.js';
import { useToast }  from '../context/ToastContext.jsx';
import { useTheme }  from '../context/ThemeContext.jsx';
import PageHeader    from '../components/PageHeader.jsx';
import GlassCard     from '../components/GlassCard.jsx';
import EmptyState    from '../components/EmptyState.jsx';
import PageLoader    from '../components/Loader.jsx';

// ── Colours ───────────────────────────────────────────────────
const PURPLE     = '#7C6AF0';
const PIE_COLORS = ['#7C6AF0','#FFB84D','#4CC38A','#FF7A63','#06B6D4','#A855F7'];

const MOOD_LABELS = { 1:'😞', 2:'😐', 3:'🙂', 4:'😊', 5:'🤩' };

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color = PURPLE, delay = 0 }) {
  return (
    <GlassCard delay={delay} className="p-5 flex flex-col gap-1">
      <p className="text-xs font-bold uppercase tracking-widest text-ink/35 dark:text-white/30">{label}</p>
      <p className="font-display text-3xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-ink/40 dark:text-white/30">{sub}</p>}
    </GlassCard>
  );
}

// ── Chart wrapper ─────────────────────────────────────────────
function Chart({ title, children, delay = 0, height = 220 }) {
  return (
    <GlassCard delay={delay} className="p-6">
      <h3 className="font-display font-semibold text-ink dark:text-white mb-4 text-sm">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </GlassCard>
  );
}

// ── Mood tick ─────────────────────────────────────────────────
function MoodTick({ x, y, payload }) {
  return (
    <text x={x} y={y} dy={4} textAnchor="middle" fontSize={14}>
      {MOOD_LABELS[payload.value] || payload.value}
    </text>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function Analytics() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const { resolvedTheme }     = useTheme();
  const isDark                = resolvedTheme === 'dark';
  const toast                 = useToast();

  useEffect(() => {
    api.get('/analytics')
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  if (loading || !data) return <PageLoader />;

  const hasData =
    data.tasksPerWeek?.some((w) => w.tasks > 0)    ||
    data.habitsPerWeek?.some((w) => w.habits > 0)  ||
    data.moodTrend?.some((d)  => d.mood !== null);

  // ── Theme-aware chart styles ───────────────────────────────
  const gridColor   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(30,34,51,0.06)';
  const tickColor   = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(30,34,51,0.45)';
  const tooltipStyle = {
    contentStyle: {
      background:   isDark ? 'rgba(18,14,35,0.95)' : 'rgba(255,255,255,0.97)',
      border:       isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(124,106,240,0.20)',
      borderRadius: 14,
      fontSize:     12,
      color:        isDark ? 'white' : '#111827',
      boxShadow:    '0 8px 24px rgba(0,0,0,0.15)',
    },
    labelStyle: { color: isDark ? 'rgba(255,255,255,0.50)' : 'rgba(30,34,51,0.50)' },
  };

  const axisProps = {
    tick:     { fontSize: 11, fill: tickColor },
    axisLine: false,
    tickLine: false,
  };

  if (!hasData) {
    return (
      <div>
        <PageHeader
          eyebrow="Analytics"
          title="Your trends, at a glance"
          subtitle="Tasks, habits, study time, mood and productivity over the last weeks."
        />
        <EmptyState
          illustration={<span className="text-6xl">📊</span>}
          title="Your story starts now"
          description="Analytics fills in as you use Aurora. Complete tasks, build habits, and log focus sessions — your patterns will appear here."
          features={[
            { icon:'✅', text:'Complete tasks → see productivity trends by week'         },
            { icon:'🔥', text:'Build habits → see your 30-day consistency patterns'       },
            { icon:'⏱', text:'Run flow sessions → see total deep work hours'             },
            { icon:'😊', text:'Log your mood → see how it correlates with output'        },
          ]}
          tip="Most users see meaningful analytics after their first full week"
        />
      </div>
    );
  }

  // ── Summary numbers ────────────────────────────────────────
  const totalTasksDone  = data.tasksPerWeek?.reduce((s, w) => s + (w.tasks  || 0), 0) || 0;
  const totalHabitLogs  = data.habitsPerWeek?.reduce((s, w) => s + (w.habits || 0), 0) || 0;
  const totalFocusHours = data.studyHoursPerWeek?.reduce((s, w) => s + (w.hours || 0), 0) || 0;
  const avgMood         = (() => {
    const valid = data.moodTrend?.filter((d) => d.mood != null) || [];
    if (!valid.length) return null;
    return (valid.reduce((s, d) => s + d.mood, 0) / valid.length).toFixed(1);
  })();

  return (
    <div>
      <PageHeader
        eyebrow="Analytics"
        title="Your trends, at a glance"
        subtitle="Tasks, habits, study time, mood and productivity over the last weeks."
      />

      {/* ── Summary row ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Tasks done"
          value={totalTasksDone}
          sub="last 8 weeks"
          color={PURPLE}
          delay={0}
        />
        <StatCard
          label="Habit logs"
          value={totalHabitLogs}
          sub="last 8 weeks"
          color="#4CC38A"
          delay={0.04}
        />
        <StatCard
          label="Focus hours"
          value={`${Math.round(totalFocusHours * 10) / 10}h`}
          sub="total deep work"
          color="#FFB84D"
          delay={0.08}
        />
        <StatCard
          label="Avg mood"
          value={avgMood ? `${avgMood} ${MOOD_LABELS[Math.round(avgMood)] || ''}` : '—'}
          sub="last 14 days"
          color="#FF7A63"
          delay={0.12}
        />
      </div>

      {/* ── Charts grid ────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Tasks per week */}
        <Chart title="Tasks completed per week" delay={0.05}>
          <BarChart data={data.tasksPerWeek}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="week" {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="tasks" fill={PURPLE} radius={[8,8,0,0]} />
          </BarChart>
        </Chart>

        {/* Habits per week */}
        <Chart title="Habits completed per week" delay={0.1}>
          <BarChart data={data.habitsPerWeek}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="week" {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="habits" fill="#4CC38A" radius={[8,8,0,0]} />
          </BarChart>
        </Chart>

        {/* Study hours */}
        <Chart title="Focus hours per week" delay={0.15}>
          <AreaChart data={data.studyHoursPerWeek}>
            <defs>
              <linearGradient id="studyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#FFB84D" stopOpacity={isDark ? 0.4 : 0.5} />
                <stop offset="100%" stopColor="#FFB84D" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="week" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} formatter={(v) => [`${v}h`, 'Hours']} />
            <Area type="monotone" dataKey="hours" stroke="#F59E0B" strokeWidth={2.5} fill="url(#studyGrad)" />
          </AreaChart>
        </Chart>

        {/* Mood trend */}
        <Chart title="Mood trend (last 14 days)" delay={0.2}>
          <LineChart data={data.moodTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="date" {...axisProps} />
            <YAxis
              domain={[1, 5]}
              ticks={[1,2,3,4,5]}
              tick={<MoodTick />}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(v) => [MOOD_LABELS[v] ? `${MOOD_LABELS[v]} (${v}/5)` : v, 'Mood']}
            />
            <Line
              type="monotone" dataKey="mood" stroke="#FF7A63"
              strokeWidth={2.5} dot={{ r: 4, fill:'#FF7A63', strokeWidth:0 }}
              connectNulls
            />
          </LineChart>
        </Chart>

        {/* Productivity trend */}
        <Chart title="Productivity score (last 14 days)" delay={0.25}>
          <AreaChart data={data.productivityTrend}>
            <defs>
              <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={PURPLE} stopOpacity={isDark ? 0.35 : 0.45} />
                <stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="date" {...axisProps} />
            <YAxis {...axisProps} domain={[0, 100]} />
            <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, 'Score']} />
            <Area
              type="monotone" dataKey="score" stroke={PURPLE}
              strokeWidth={2.5} fill="url(#prodGrad)"
            />
          </AreaChart>
        </Chart>

        {/* Tasks by category */}
        <GlassCard delay={0.30} className="p-6">
          <h3 className="font-display font-semibold text-ink dark:text-white mb-4 text-sm">
            Completed tasks by category
          </h3>
          {!data.tasksByCategory?.length ? (
            <div className="flex flex-col items-center justify-center h-[220px] text-center gap-2">
              <span className="text-4xl">🍩</span>
              <p className="text-sm text-ink/40 dark:text-white/30">
                Complete a few tasks across different categories to see this chart.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={220}>
                <PieChart>
                  <Pie
                    data={data.tasksByCategory} dataKey="c" nameKey="category"
                    innerRadius={55} outerRadius={85} paddingAngle={3}
                  >
                    {data.tasksByCategory.map((entry, idx) => (
                      <Cell key={entry.category} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              {/* Custom legend */}
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                {data.tasksByCategory.map((entry, idx) => (
                  <div key={entry.category} className="flex items-center gap-2 min-w-0">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    <span className="text-xs text-ink/65 dark:text-white/55 truncate">{entry.category}</span>
                    <span className="text-xs font-bold text-ink/45 dark:text-white/35 ml-auto shrink-0">{entry.c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>

      </div>
    </div>
  );
}