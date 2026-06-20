import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Circle, Flame, Sparkles, Quote, CalendarClock, TrendingUp, Smile,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import TopBar from '../components/TopBar.jsx';
import GlassCard from '../components/GlassCard.jsx';
import ProgressRing from '../components/ProgressRing.jsx';
import PriorityPill from '../components/PriorityPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageLoader from '../components/Loader.jsx';
import ProductivityTree from '../components/ProductivityTree.jsx';

const MOODS = [
  { value: 1, emoji: '😞', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '🙂', label: 'Okay' },
  { value: 4, emoji: '😄', label: 'Good' },
  { value: 5, emoji: '🤩', label: 'Great' },
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const dash = await api.get('/dashboard');
      setData(dash);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const toggleTask = async (task) => {
    const status = task.status === 'done' ? 'todo' : 'done';
    const { xpAwarded, unlocked } = await api.put(`/tasks/${task.id}`, { status });
    if (xpAwarded) toast.xp(xpAwarded, task.title);
    unlocked?.forEach((key) => toast.achievement(key.replace(/_/g, ' ')));
    load();
  };

  const toggleHabit = async (habit) => {
    const { xpAwarded, unlocked } = await api.post(`/habits/${habit.id}/toggle`, {});
    if (xpAwarded) toast.xp(xpAwarded, habit.name);
    unlocked?.forEach((key) => toast.achievement(key.replace(/_/g, ' ')));
    load();
  };

  const setMood = async (value) => {
    await api.post('/mood', { mood: value });
    toast.success('Mood logged for today');
    load();
  };

  if (loading || !data) return <div className="pt-2"><PageLoader /></div>;

  return (
    <div className="pb-4">
      <TopBar streak={data.streak} level={data.level} xpIntoLevel={data.level.xpIntoLevel} />

      {/* Top stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <GlassCard delay={0.05} className="p-5 flex items-center gap-4">
          <ProgressRing value={data.productivityScore} size={64} strokeWidth={6} />
          <div>
            <p className="text-xs font-medium text-ink/50">Productivity</p>
            <p className="font-display text-sm font-bold text-ink">Today's score</p>
          </div>
        </GlassCard>
        <GlassCard delay={0.1} className="p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-coral-400 to-coral-500 text-white shadow-glow">
            <Flame size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-ink/50">Current streak</p>
            <p className="font-display text-xl font-bold text-ink">{data.streak} days</p>
          </div>
        </GlassCard>
        <GlassCard delay={0.15} className="p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-lavender-500 to-lavender-700 text-white shadow-glow">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-ink/50">Level {data.level.level}</p>
            <p className="font-display text-xl font-bold text-ink">{data.level.xp} XP</p>
          </div>
        </GlassCard>
        <GlassCard delay={0.2} className="p-5 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sage-400 to-sage-600 text-white shadow-glow">
            <TrendingUp size={20} />
          </div>
          <div>
            <p className="text-xs font-medium text-ink/50">Habits today</p>
            <p className="font-display text-xl font-bold text-ink">{data.counts.habitsDoneToday}/{data.counts.totalHabits}</p>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column: tasks + habits */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <GlassCard delay={0.1} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-ink">Today's tasks</h2>
              <a href="/tasks" className="text-xs font-semibold text-lavender-600 hover:underline">View all</a>
            </div>
            {data.todaysTasks.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Nothing due today" message="Enjoy the breathing room, or pull in tomorrow's tasks early." />
            ) : (
              <div className="flex flex-col gap-2">
                {data.todaysTasks.map((t) => (
                  <motion.button
                    key={t.id}
                    onClick={() => toggleTask(t)}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/40 px-4 py-3 text-left transition hover:bg-white/70"
                  >
                    {t.status === 'done' ? <CheckCircle2 className="text-sage-500 shrink-0" size={20} /> : <Circle className="text-ink/25 shrink-0" size={20} />}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${t.status === 'done' ? 'line-through text-ink/40' : 'text-ink'}`}>{t.title}</p>
                      <p className="text-xs text-ink/40">{t.category}</p>
                    </div>
                    <PriorityPill priority={t.priority} />
                  </motion.button>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard delay={0.15} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-ink">Today's habits</h2>
              <a href="/habits" className="text-xs font-semibold text-lavender-600 hover:underline">View all</a>
            </div>
            {data.todaysHabits.length === 0 ? (
              <EmptyState icon={Flame} title="No habits yet" message="Add a habit to start building your streak." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.todaysHabits.map((h) => (
                  <motion.button
                    key={h.id}
                    onClick={() => toggleHabit(h)}
                    whileTap={{ scale: 0.95 }}
                    className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 transition ${
                      h.doneToday ? 'border-sage-300 bg-sage-50' : 'border-white/60 bg-white/40 hover:bg-white/70'
                    }`}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: h.color }}
                    >
                      {h.doneToday ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </div>
                    <p className="text-xs font-semibold text-ink text-center leading-tight">{h.name}</p>
                  </motion.button>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          <GlassCard delay={0.1} className="p-6 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-lavender-200/40 blur-2xl animate-floaty" />
            <p className="text-xs font-semibold text-ink/50 mb-3 flex items-center gap-1.5"><Smile size={14}/> Mood of the day</p>
            <div className="flex justify-between">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMood(m.value)}
                  className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 transition ${
                    data.mood?.mood === m.value ? 'bg-lavender-100 scale-110' : 'hover:bg-white/60'
                  }`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-[10px] text-ink/45">{m.label}</span>
                </button>
              ))}
            </div>
          </GlassCard>

          <GlassCard delay={0.15} className="p-6">
            <p className="text-xs font-semibold text-ink/50 mb-3 flex items-center gap-1.5"><Quote size={14}/> Daily quote</p>
            <p className="font-display text-sm font-semibold text-ink leading-relaxed">"{data.quote.text}"</p>
            <p className="text-xs text-ink/45 mt-2">— {data.quote.author}</p>
          </GlassCard>

          <GlassCard delay={0.2} className="p-6">
            <p className="text-xs font-semibold text-ink/50 mb-2 flex items-center gap-1.5"><CalendarClock size={14}/> Upcoming deadlines</p>
            {data.upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-ink/40 py-3">Nothing on the horizon — nice and clear.</p>
            ) : (
              <div className="flex flex-col divide-y divide-white/50">
                {data.upcomingDeadlines.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{t.title}</p>
                      <p className="text-xs text-ink/40">{t.category}</p>
                    </div>
                    <span className="text-xs font-semibold text-lavender-600 shrink-0 ml-2">{t.deadline}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard delay={0.25} className="p-6 flex items-center justify-center">
            <ProductivityTree stage={data.treeStage} streak={data.streak} />
          </GlassCard>
        </div>
      </div>
    </div>
  );
}