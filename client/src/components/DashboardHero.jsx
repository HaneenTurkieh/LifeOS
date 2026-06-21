import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Circle, Quote, CalendarClock, Smile,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import DashboardHero from '../components/DashboardHero.jsx';
import GlassCard from '../components/GlassCard.jsx';
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
  const { user } = useAuth();
  const prevLevel = useRef(null);

  const load = useCallback(async () => {
    try {
      const dash = await api.get('/dashboard');
      if (prevLevel.current !== null && dash.level.level > prevLevel.current) {
        toast.levelUp(dash.level.level);
      }
      prevLevel.current = dash.level.level;
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

  if (loading || !data) {
    return (
      <div className="pt-2">
        <div className="glass-card h-44 mb-6 skeleton" />
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="pb-4">
      <DashboardHero data={data} userName={user?.name} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-5">
          <GlassCard tier={2} delay={0.1} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-ink dark:text-white">Today's tasks</h2>
              <a href="/tasks" className="text-xs font-semibold text-lavender-600 dark:text-lavender-300 hover:underline">View all</a>
            </div>
            {data.todaysTasks.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Nothing due today" message="Enjoy the breathing room, or pull in tomorrow's tasks early." />
            ) : (
              <div className="flex flex-col gap-2">
                {data.todaysTasks.map((t, i) => (
                  <motion.button
                    key={t.id}
                    onClick={() => toggleTask(t)}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 rounded-2xl border border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/[0.03] px-4 py-3 text-left transition-all duration-200 hover:bg-white/70 dark:hover:bg-white/[0.07] hover:-translate-y-0.5"
                  >
                    {t.status === 'done'
                      ? <CheckCircle2 className="text-sage-500 shrink-0" size={20} />
                      : <Circle className="text-ink/25 dark:text-white/25 shrink-0" size={20} />}
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${t.status === 'done' ? 'line-through text-ink/40 dark:text-white/30' : 'text-ink dark:text-white'}`}>
                        {t.title}
                      </p>
                      <p className="text-xs text-ink/40 dark:text-white/35">{t.category}</p>
                    </div>
                    <PriorityPill priority={t.priority} />
                  </motion.button>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard tier={2} delay={0.15} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-ink dark:text-white">Today's habits</h2>
              <a href="/habits" className="text-xs font-semibold text-lavender-600 dark:text-lavender-300 hover:underline">View all</a>
            </div>
            {data.todaysHabits.length === 0 ? (
              <EmptyState icon={Smile} title="No habits yet" message="Add a habit to start building your streak." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.todaysHabits.map((h, i) => (
                  <motion.button
                    key={h.id}
                    onClick={() => toggleHabit(h)}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 transition-all duration-200 hover:-translate-y-0.5 ${
                      h.doneToday
                        ? 'border-sage-300 dark:border-sage-500/30 bg-sage-50 dark:bg-sage-500/10'
                        : 'border-white/60 dark:border-white/10 bg-white/40 dark:bg-white/[0.03] hover:bg-white/70 dark:hover:bg-white/[0.07]'
                    }`}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: h.color }}
                    >
                      {h.doneToday ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </div>
                    <p className="text-xs font-semibold text-ink dark:text-white text-center leading-tight">{h.name}</p>
                  </motion.button>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        <div className="flex flex-col gap-5">
          <GlassCard delay={0.1} className="p-6 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-lavender-200/40 dark:bg-lavender-500/10 blur-2xl animate-floaty" />
            <p className="text-xs font-semibold text-ink/50 dark:text-white/40 mb-3 flex items-center gap-1.5"><Smile size={14}/> Mood of the day</p>
            <div className="flex justify-between">
              {MOODS.map((m) => (
                <motion.button
                  key={m.value}
                  whileTap={{ scale: 0.85 }}
                  whileHover={{ scale: 1.08 }}
                  onClick={() => setMood(m.value)}
                  className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 transition ${
                    data.mood?.mood === m.value ? 'bg-lavender-100 dark:bg-lavender-500/20 scale-110' : 'hover:bg-white/60 dark:hover:bg-white/10'
                  }`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-[10px] text-ink/45 dark:text-white/35">{m.label}</span>
                </motion.button>
              ))}
            </div>
          </GlassCard>

          <GlassCard delay={0.15} className="p-6">
            <p className="text-xs font-semibold text-ink/50 dark:text-white/40 mb-3 flex items-center gap-1.5"><Quote size={14}/> Daily quote</p>
            <p className="font-display text-sm font-semibold text-ink dark:text-white leading-relaxed">"{data.quote.text}"</p>
            <p className="text-xs text-ink/45 dark:text-white/35 mt-2">— {data.quote.author}</p>
          </GlassCard>

          <GlassCard delay={0.2} className="p-6">
            <p className="text-xs font-semibold text-ink/50 dark:text-white/40 mb-2 flex items-center gap-1.5"><CalendarClock size={14}/> Upcoming deadlines</p>
            {data.upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-ink/40 dark:text-white/30 py-3">Nothing on the horizon — nice and clear.</p>
            ) : (
              <div className="flex flex-col divide-y divide-white/50 dark:divide-white/10">
                {data.upcomingDeadlines.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink dark:text-white truncate">{t.title}</p>
                      <p className="text-xs text-ink/40 dark:text-white/30">{t.category}</p>
                    </div>
                    <span className="text-xs font-semibold text-lavender-600 dark:text-lavender-300 shrink-0 ml-2">{t.deadline}</span>
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