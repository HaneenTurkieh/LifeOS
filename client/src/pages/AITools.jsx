import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, CalendarDays, Target, ListOrdered, LineChart, Zap, Loader2, Coffee,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import GlassCard from '../components/GlassCard.jsx';

const TOOLS = [
  { key: 'planner', label: 'Daily Planner', icon: CalendarDays },
  { key: 'breakdown', label: 'Goal Breakdown', icon: Target },
  { key: 'prioritize', label: 'Smart Prioritizer', icon: ListOrdered },
  { key: 'coach', label: 'Productivity Coach', icon: LineChart },
  { key: 'antiproc', label: 'Anti-Procrastination', icon: Zap },
];

const BLOCK_STYLES = {
  focus: 'border-lavender-300 bg-lavender-50',
  break: 'border-sage-200 bg-sage-50',
  task: 'border-white/70 bg-white/60',
  habit: 'border-sun-200 bg-sun-50',
};

export default function AITools() {
  const [tool, setTool] = useState('planner');

  return (
    <div>
      <PageHeader
        eyebrow="AI Tools"
        title="Your second brain, on demand"
        subtitle="Lightweight, rule-based assistants — no setup, fully offline, ready to swap for a real LLM."
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {TOOLS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTool(key)}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
              tool === key ? 'bg-lavender-600 text-white shadow-glow' : 'bg-white/60 text-ink/50 hover:bg-white'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tool === 'planner' && <DailyPlanner />}
      {tool === 'breakdown' && <GoalBreakdown />}
      {tool === 'prioritize' && <SmartPrioritizer />}
      {tool === 'coach' && <ProductivityCoach />}
      {tool === 'antiproc' && <AntiProcrastination />}
    </div>
  );
}

function ToolShell({ children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {children}
    </motion.div>
  );
}

function DailyPlanner() {
  const [hours, setHours] = useState(4);
  const [energy, setEnergy] = useState('medium');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const generate = async () => {
    setLoading(true);
    try { setPlan(await api.post('/ai/daily-plan', { availableHours: hours, energy })); }
    catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <ToolShell>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <GlassCard className="p-6 lg:col-span-1">
          <h3 className="font-display font-bold text-ink mb-4 flex items-center gap-2"><CalendarDays size={18} className="text-lavender-600"/> Plan today</h3>
          <label className="text-xs font-semibold text-ink/50 block mb-1.5">Available hours: {hours}</label>
          <input type="range" min="1" max="10" value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full accent-lavender-600 mb-4" />
          <label className="text-xs font-semibold text-ink/50 block mb-1.5">Energy level</label>
          <div className="flex gap-2 mb-5">
            {['low', 'medium', 'high'].map((lvl) => (
              <button key={lvl} onClick={() => setEnergy(lvl)} className={`flex-1 rounded-2xl py-2 text-sm font-semibold capitalize transition ${energy === lvl ? 'bg-lavender-600 text-white' : 'bg-white/60 text-ink/50 hover:bg-white'}`}>{lvl}</button>
            ))}
          </div>
          <button onClick={generate} disabled={loading} className="btn-primary w-full justify-center">
            {loading ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} />} Generate plan
          </button>
        </GlassCard>

        <GlassCard delay={0.05} className="p-6 lg:col-span-2">
          <h3 className="font-display font-bold text-ink mb-4">Hour-by-hour plan</h3>
          {!plan ? (
            <p className="text-sm text-ink/40 py-12 text-center">Set your hours and energy, then generate a plan.</p>
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                {plan.blocks.map((b, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className={`rounded-2xl border px-4 py-3 ${BLOCK_STYLES[b.type]}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-ink">{b.label}</p>
                      <span className="text-xs font-medium text-ink/45">{b.time}</span>
                    </div>
                    <p className="text-xs text-ink/45 mt-0.5">{b.detail}</p>
                  </motion.div>
                ))}
              </div>
              <p className="text-xs text-lavender-700 bg-lavender-50 rounded-2xl px-4 py-3 mt-4">💡 {plan.tip}</p>
            </>
          )}
        </GlassCard>
      </div>
    </ToolShell>
  );
}

function GoalBreakdown() {
  const [title, setTitle] = useState('');
  const [weeks, setWeeks] = useState(4);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const generate = async () => {
    if (!title.trim()) { toast.error('Enter a goal first'); return; }
    setLoading(true);
    try { setPlan((await api.post('/ai/goal-breakdown', { title, weeks })).plan); }
    catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <ToolShell>
      <GlassCard className="p-6 mb-5">
        <h3 className="font-display font-bold text-ink mb-4 flex items-center gap-2"><Target size={18} className="text-lavender-600"/> Break down a goal</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input className="input-field flex-1" placeholder="e.g. Build portfolio project" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="input-field sm:w-40" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            {[2, 4, 6, 8].map((w) => <option key={w} value={w}>{w} weeks</option>)}
          </select>
          <button onClick={generate} disabled={loading} className="btn-primary shrink-0">
            {loading ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} />} Generate
          </button>
        </div>
      </GlassCard>

      {plan && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plan.map((p, i) => (
            <GlassCard key={p.week} delay={i * 0.05} className="p-5">
              <span className="pill bg-lavender-100 text-lavender-700 mb-2">Week {p.week}</span>
              <p className="text-sm font-medium text-ink leading-snug">{p.focus}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </ToolShell>
  );
}

function SmartPrioritizer() {
  const [buckets, setBuckets] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const generate = async () => {
    setLoading(true);
    try { setBuckets(await api.get('/ai/prioritize')); }
    catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const COLS = [
    { key: 'urgent', title: 'Urgent', accent: 'bg-coral-500/10 text-coral-500 border-coral-200' },
    { key: 'important', title: 'Important', accent: 'bg-sun-500/10 text-sun-600 border-sun-200' },
    { key: 'optional', title: 'Optional', accent: 'bg-sage-500/10 text-sage-600 border-sage-200' },
  ];

  return (
    <ToolShell>
      <GlassCard className="p-6 mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-display font-bold text-ink flex items-center gap-2"><ListOrdered size={18} className="text-lavender-600"/> Smart Prioritizer</h3>
          <p className="text-sm text-ink/50 mt-1">Sorts your open tasks into Urgent, Important, and Optional.</p>
        </div>
        <button onClick={generate} disabled={loading} className="btn-primary shrink-0">
          {loading ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} />} Sort my tasks
        </button>
      </GlassCard>

      {buckets && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {COLS.map((c) => (
            <div key={c.key} className="glass-panel rounded-3xl p-4">
              <h4 className={`pill border ${c.accent} mb-3`}>{c.title} · {buckets[c.key].length}</h4>
              {buckets[c.key].length === 0 ? (
                <p className="text-xs text-ink/35 px-2 py-4">Nothing here right now.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {buckets[c.key].map((t) => (
                    <div key={t.id} className="rounded-2xl bg-white/70 border border-white/70 px-3.5 py-2.5">
                      <p className="text-sm font-medium text-ink">{t.title}</p>
                      <p className="text-xs text-ink/40">{t.category} {t.deadline && `· due ${t.deadline}`}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ToolShell>
  );
}

function ProductivityCoach() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const generate = async () => {
    setLoading(true);
    try { setReport(await api.get('/ai/coach')); }
    catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <ToolShell>
      <GlassCard className="p-6 mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-display font-bold text-ink flex items-center gap-2"><LineChart size={18} className="text-lavender-600"/> Productivity Coach</h3>
          <p className="text-sm text-ink/50 mt-1">A quick read on how your week is going, with concrete next steps.</p>
        </div>
        <button onClick={generate} disabled={loading} className="btn-primary shrink-0">
          {loading ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} />} Get insights
        </button>
      </GlassCard>

      {report && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <GlassCard className="p-4 text-center"><p className="text-xs text-ink/45">Tasks done</p><p className="font-display text-xl font-bold text-ink">{report.stats.tasksDoneThisWeek}</p></GlassCard>
            <GlassCard delay={0.05} className="p-4 text-center"><p className="text-xs text-ink/45">Tasks total</p><p className="font-display text-xl font-bold text-ink">{report.stats.tasksTotalThisWeek}</p></GlassCard>
            <GlassCard delay={0.1} className="p-4 text-center"><p className="text-xs text-ink/45">Habit rate</p><p className="font-display text-xl font-bold text-ink">{report.stats.habitCompletionRate}%</p></GlassCard>
            <GlassCard delay={0.15} className="p-4 text-center"><p className="text-xs text-ink/45">Streak</p><p className="font-display text-xl font-bold text-ink">{report.stats.streak}d</p></GlassCard>
          </div>
          <div className="flex flex-col gap-3">
            {report.insights.map((line, i) => (
              <GlassCard key={i} delay={i * 0.05} className="p-4 flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-lavender-100 text-lavender-600"><Sparkles size={14} /></div>
                <p className="text-sm text-ink/80 leading-relaxed">{line}</p>
              </GlassCard>
            ))}
          </div>
        </>
      )}
    </ToolShell>
  );
}

function AntiProcrastination() {
  const [title, setTitle] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const generate = async () => {
    if (!title.trim()) { toast.error('Enter the task you\'re avoiding'); return; }
    setLoading(true);
    try { setResult(await api.post('/ai/anti-procrastination', { title })); }
    catch (e) { toast.error(e.message); } finally { setLoading(false); }
  };

  const CARDS = result ? [
    { key: 'five_minute', label: '5 minutes', icon: Coffee, accent: 'from-sage-400 to-sage-600' },
    { key: 'fifteen_minute', label: '15 minutes', icon: Zap, accent: 'from-sun-400 to-sun-600' },
    { key: 'one_hour', label: '1 hour', icon: Target, accent: 'from-lavender-500 to-lavender-700' },
  ] : [];

  return (
    <ToolShell>
      <GlassCard className="p-6 mb-5">
        <h3 className="font-display font-bold text-ink mb-1 flex items-center gap-2"><Zap size={18} className="text-lavender-600"/> Anti-Procrastination Mode</h3>
        <p className="text-sm text-ink/50 mb-4">Stuck on something? Get a tiny, medium, and full-effort version of it.</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input className="input-field flex-1" placeholder="What are you avoiding?" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button onClick={generate} disabled={loading} className="btn-primary shrink-0">
            {loading ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} />} Help me start
          </button>
        </div>
      </GlassCard>

      {result && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CARDS.map((c, i) => (
            <GlassCard key={c.key} delay={i * 0.08} className="p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${c.accent} text-white shadow-glow mb-3`}>
                <c.icon size={18} />
              </div>
              <p className="text-xs font-semibold text-ink/50 mb-1.5">{c.label} version</p>
              <p className="text-sm text-ink/80 leading-relaxed">{result[c.key]}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </ToolShell>
  );
}