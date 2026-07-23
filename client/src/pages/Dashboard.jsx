import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Circle, Calendar, Clock,
  Smile, TreePine, Zap, ListChecks,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import GlassCard          from '../components/GlassCard.jsx';
import ProductivitySphere from '../components/ProductivitySphere.jsx';
import PageLoader         from '../components/Loader.jsx';

const TREE_EMOJIS = {
  seedling:       '🌱', sprout: '🌿',  oak:  '🌳',
  cherry_blossom: '🌸', bamboo: '🎋',  palm: '🌴',
  pine:           '🌲', crystal: '✨',
};

const TREE_NAMES = {
  seedling:       'Seedling',       sprout: 'Sprout',
  oak:            'Oak',            cherry_blossom: 'Cherry Blossom',
  bamboo:         'Bamboo',         palm:   'Palm',
  pine:           'Pine',           crystal: 'Crystal Tree',
};

const TREE_DESC = {
  seedling:       'Every journey starts here.',
  sprout:         'Your first real growth.',
  oak:            'Strong and steady.',
  cherry_blossom: 'Beautiful under pressure.',
  bamboo:         'Flexible, fast, unstoppable.',
  palm:           'Thriving in the heat.',
  pine:           'Evergreen. Always growing.',
  crystal:        'Legendary. For the dedicated.',
};

// Maps current tree → next tree to unlock
const NEXT_TREE = {
  seedling:       { key: 'sprout',         name: 'Sprout',       cost: 100  },
  sprout:         { key: 'oak',            name: 'Oak',          cost: 300  },
  oak:            { key: 'cherry_blossom', name: 'Cherry Blossom',cost: 600 },
  cherry_blossom: { key: 'bamboo',         name: 'Bamboo',       cost: 1000 },
  bamboo:         { key: 'palm',           name: 'Palm',         cost: 1500 },
  palm:           { key: 'pine',           name: 'Pine',         cost: 2500 },
  pine:           { key: 'crystal',        name: 'Crystal Tree', cost: 5000 },
  crystal:        null, // fully collected
};

const MOOD_OPTIONS = [
  { value: 1, emoji: '😞', label: 'Rough'  },
  { value: 2, emoji: '😐', label: 'Meh'    },
  { value: 3, emoji: '🙂', label: 'Okay'   },
  { value: 4, emoji: '😊', label: 'Good'   },
  { value: 5, emoji: '🤩', label: 'Great'  },
];

function greeting(name) {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${g}, ${name} 👋`;
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatDeadline(d) {
  if (!d) return null;
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function Dashboard() {
  const { user }   = useAuth();
  const toast      = useToast();
  const navigate   = useNavigate();
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [moodSaving, setMoodSaving] = useState(false);
  const [equippedTree, setEquippedTree] = useState(null);

  const load = useCallback(async () => {
    try {
      const [dash, treeData] = await Promise.all([
        api.get('/dashboard'),
        api.get('/trees'),
      ]);
      setData(dash);
      setEquippedTree(treeData.equipped || 'seedling');
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const saveMood = async (value) => {
    setMoodSaving(true);
    try {
      await api.post('/mood', { mood: value });
      load();
    } catch (e) { toast.error(e.message); }
    finally { setMoodSaving(false); }
  };

  const completeTask = async (task) => {
    try {
      const { xpAwarded, unlocked } = await api.put(`/tasks/${task.id}`, { status: 'done', progress: 100 });
      if (xpAwarded) toast.xp(xpAwarded, task.title);
      unlocked?.forEach((k) => toast.achievement(k.replace(/_/g, ' ')));
      load();
    } catch (e) { toast.error(e.message); }
  };

  if (loading || !data) return <PageLoader />;

  const firstName = user?.name?.split(' ')[0] || 'there';
  const { todaysTasks, todaysHabits, upcomingDeadlines, mood, quote, productivityScore, streak, level, counts } = data;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Hero card ─────────────────────────────────────── */}
      <GlassCard className="p-7">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">

          {/* Left — greeting + stats */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-lavender-600 dark:text-lavender-300 mb-1">
              {todayLabel()}
            </p>
            <h1 className="font-display text-3xl font-bold text-ink dark:text-white mb-1">
              {greeting(firstName)}
            </h1>
            {todaysTasks.length === 0 && todaysHabits.length === 0 ? (
              <p className="text-sm text-ink/45 dark:text-white/40 mb-5">
                A clear day on the calendar — a good moment to set a goal or plan tomorrow.
              </p>
            ) : (
              <p className="text-sm text-ink/45 dark:text-white/40 mb-5">
                You have {todaysTasks.length} task{todaysTasks.length !== 1 ? 's' : ''} and{' '}
                {todaysHabits.filter(h => !h.doneToday).length} habit{todaysHabits.filter(h => !h.doneToday).length !== 1 ? 's' : ''} left today.
              </p>
            )}

            {/* Stat cards */}
            <div className="flex flex-wrap gap-3">
              {[
                {
                  icon:  '🔥',
                  color: 'from-sun-400 to-sun-500',
                  value: `${streak}d`,
                  label: 'Streak',
                },
                {
                  icon:  '⚡',
                  color: 'from-aurora-violet to-aurora-indigo',
                  value: `${level?.xp || 0} XP`,
                  label: `Lvl ${level?.level || 1}`,
                  onClick: () => navigate('/trees'),
                },
                {
                  icon:  '📋',
                  color: 'from-aurora-sky to-aurora-indigo',
                  value: counts.totalTasksToday > 0
                    ? `${counts.tasksDoneToday}/${counts.totalTasksToday}`
                    : String(todaysTasks.length),
                  label: 'Left today',
                },
              ].map(({ icon, color, value, label, onClick }) => (
                <motion.div
                  key={label}
                  whileHover={onClick ? { y: -2 } : {}}
                  onClick={onClick}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${onClick ? 'cursor-pointer' : ''}`}
                  style={{
                    background:   'rgba(255,255,255,0.65)',
                    border:       '1px solid rgba(255,255,255,0.75)',
                    backdropFilter: 'blur(16px)',
                    boxShadow:    'inset 0 1px 0 rgba(255,255,255,0.90)',
                  }}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-white text-base bg-gradient-to-br ${color}`}>
                    {icon}
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold text-ink dark:text-white leading-none">{value}</p>
                    <p className="text-xs text-ink/45 dark:text-white/35 mt-0.5">{label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Quote */}
            {quote && (
              <p className="text-xs text-ink/35 dark:text-white/25 italic mt-5 leading-relaxed max-w-sm">
                "{quote.text}" — {quote.author}
              </p>
            )}
          </div>

          {/* Right — productivity sphere with tree */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <ProductivitySphere score={productivityScore} equippedTree={equippedTree} />
            <button
              onClick={() => navigate('/trees')}
              className="flex items-center gap-1 text-xs text-ink/35 dark:text-white/30 hover:text-lavender-500 transition"
            >
              <TreePine size={11} /> Change tree
            </button>
          </div>
        </div>
      </GlassCard>

      {/* ── Main grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Today's tasks */}
        <div className="lg:col-span-2">
          <GlassCard className="p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ListChecks size={16} className="text-lavender-500" />
                <h2 className="font-display font-semibold text-ink dark:text-white">Today's tasks</h2>
              </div>
              <button onClick={() => navigate('/tasks')}
                className="text-xs font-semibold text-lavender-600 dark:text-lavender-300 hover:underline">
                View all
              </button>
            </div>

            {todaysTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-4xl mb-3">🎉</span>
                <p className="font-semibold text-ink dark:text-white text-sm mb-1">Nothing due today</p>
                <p className="text-xs text-ink/40 dark:text-white/35">
                  Enjoy the breathing room, or pull in tomorrow's tasks early.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {todaysTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 group"
                    style={{
                      background:   'rgba(255,255,255,0.55)',
                      border:       '1px solid rgba(255,255,255,0.65)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <button onClick={() => completeTask(task)}
                      className="shrink-0 text-ink/25 hover:text-sage-500 transition">
                      <Circle size={18} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink dark:text-white truncate">{task.title}</p>
                      {task.deadline && (
                        <p className="text-[11px] text-ink/35 flex items-center gap-1 mt-0.5">
                          <Calendar size={10} /> {formatDeadline(task.deadline)}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize ${
                      task.priority === 'high'   ? 'bg-coral-400/15 text-coral-500' :
                      task.priority === 'medium' ? 'bg-sun-400/15 text-sun-600'     :
                                                   'bg-lavender-100 text-lavender-600'
                    }`}>
                      {task.priority}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Mood */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Smile size={15} className="text-lavender-500" />
              <h3 className="font-display font-semibold text-sm text-ink dark:text-white">Mood of the day</h3>
            </div>
            <div className="flex justify-between">
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => saveMood(m.value)}
                  disabled={moodSaving}
                  className="flex flex-col items-center gap-1 group"
                >
                  <motion.span
                    whileHover={{ scale: 1.2, y: -2 }}
                    whileTap={{ scale: 0.9 }}
                    className={`text-2xl transition-all ${
                      mood?.mood === m.value ? 'scale-125 drop-shadow-sm' : 'opacity-60 group-hover:opacity-100'
                    }`}
                  >
                    {m.emoji}
                  </motion.span>
                  <span className="text-[10px] text-ink/40 dark:text-white/30">{m.label}</span>
                </button>
              ))}
            </div>
          </GlassCard>
          {/* Equipped tree card */}
{equippedTree && (
  <GlassCard className="p-5">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <TreePine size={15} className="text-lavender-500" />
        <h3 className="font-display font-semibold text-sm text-ink dark:text-white">Your tree</h3>
      </div>
      <button onClick={() => navigate('/trees')}
        className="text-xs text-lavender-600 dark:text-lavender-300 font-semibold hover:underline">
        Shop
      </button>
    </div>

    <div className="flex items-center gap-4">
      {/* Animated tree */}
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shrink-0"
        style={{
          background: 'linear-gradient(135deg, rgba(124,106,240,0.12) 0%, rgba(91,71,224,0.06) 100%)',
          border:     '1px solid rgba(124,106,240,0.18)',
          boxShadow:  'inset 0 1px 0 rgba(255,255,255,0.60)',
        }}
      >
        {TREE_EMOJIS[equippedTree] || '🌱'}
      </motion.div>

      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-ink dark:text-white text-sm">
          {TREE_NAMES[equippedTree] || 'Seedling'}
        </p>
        <p className="text-[11px] text-ink/40 dark:text-white/30 mt-0.5">
          {TREE_DESC[equippedTree] || 'Every journey starts here.'}
        </p>
        {/* XP progress toward next tree */}
        {NEXT_TREE[equippedTree] && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-ink/35 dark:text-white/25">
                Next: {TREE_EMOJIS[NEXT_TREE[equippedTree].key]} {NEXT_TREE[equippedTree].name}
              </span>
              <span className="text-[10px] font-bold text-lavender-500">
                {Math.min(data?.level?.xp || 0, NEXT_TREE[equippedTree].cost).toLocaleString()} / {NEXT_TREE[equippedTree].cost.toLocaleString()} XP
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-ink/5 dark:bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, ((data?.level?.xp || 0) / NEXT_TREE[equippedTree].cost) * 100)}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #7C6AF0, #60A5FA)' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  </GlassCard>
)}

          {/* Habits */}
          {todaysHabits.length > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-sm text-ink dark:text-white">Today's habits</h3>
                <button onClick={() => navigate('/goals')}
                  className="text-xs text-lavender-600 dark:text-lavender-300 font-semibold hover:underline">
                  View all
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {todaysHabits.slice(0, 4).map((h) => (
                  <div key={h.id} className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: h.doneToday ? h.color : 'rgba(30,34,51,0.15)' }} />
                    <span className={`text-xs flex-1 truncate ${
                      h.doneToday ? 'text-ink/40 dark:text-white/30 line-through' : 'text-ink/70 dark:text-white/60'
                    }`}>
                      {h.name}
                    </span>
                    {h.doneToday && <CheckCircle2 size={13} className="text-sage-500 shrink-0" />}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Upcoming deadlines */}
          {upcomingDeadlines?.length > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-lavender-500" />
                <h3 className="font-display font-semibold text-sm text-ink dark:text-white">Coming up</h3>
              </div>
              <div className="flex flex-col gap-2">
                {upcomingDeadlines.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-ink/65 dark:text-white/55 truncate">{t.title}</span>
                    <span className="text-[10px] text-ink/35 shrink-0 flex items-center gap-1">
                      <Calendar size={9} /> {formatDeadline(t.deadline)}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Daily quote */}
          {quote && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">💬</span>
                <h3 className="font-display font-semibold text-sm text-ink dark:text-white">Daily quote</h3>
              </div>
              <p className="text-xs text-ink/65 dark:text-white/55 italic leading-relaxed">
                "{quote.text}"
              </p>
              <p className="text-[10px] text-ink/35 mt-2">— {quote.author}</p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}