import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Calendar, Clock, Smile, TreePine } from 'lucide-react';
import { api }            from '../api/client.js';
import { useToast }       from '../context/ToastContext.jsx';
import { useAuth }        from '../context/AuthContext.jsx';
import { useLanguage }    from '../context/LanguageContext.jsx';
import { useWeather, weatherEmoji } from '../hooks/useWeather.js';
import GlassCard          from '../components/GlassCard.jsx';
import ProductivitySphere from '../components/ProductivitySphere.jsx';
import PageLoader         from '../components/Loader.jsx';

const TREE_EMOJIS = {
  seedling:'🌱', sprout:'🌿', oak:'🌳',
  cherry_blossom:'🌸', bamboo:'🎋', palm:'🌴',
  pine:'🌲', crystal:'✨',
};
const TREE_NAMES = {
  seedling:'Seedling', sprout:'Sprout', oak:'Oak',
  cherry_blossom:'Cherry Blossom', bamboo:'Bamboo',
  palm:'Palm', pine:'Pine', crystal:'Crystal Tree',
};
const TREE_DESC = {
  seedling:'Every journey starts here.',
  sprout:'Your first real growth.',
  oak:'Strong and steady.',
  cherry_blossom:'Beautiful under pressure.',
  bamboo:'Flexible, fast, unstoppable.',
  palm:'Thriving in the heat.',
  pine:'Evergreen. Always growing.',
  crystal:'Legendary. For the dedicated.',
};
const NEXT_TREE = {
  seedling:       { key:'sprout',         name:'Sprout',        cost:100  },
  sprout:         { key:'oak',            name:'Oak',           cost:300  },
  oak:            { key:'cherry_blossom', name:'Cherry Blossom',cost:600  },
  cherry_blossom: { key:'bamboo',         name:'Bamboo',        cost:1000 },
  bamboo:         { key:'palm',           name:'Palm',          cost:1500 },
  palm:           { key:'pine',           name:'Pine',          cost:2500 },
  pine:           { key:'crystal',        name:'Crystal Tree',  cost:5000 },
  crystal:        null,
};
const MOOD_OPTIONS = [
  { value:1, emoji:'😞', label:'mood.rough' },
  { value:2, emoji:'😐', label:'mood.meh'   },
  { value:3, emoji:'🙂', label:'mood.okay'  },
  { value:4, emoji:'😊', label:'mood.good'  },
  { value:5, emoji:'🤩', label:'mood.great' },
];

function daysUntil(deadline) {
  if (!deadline) return null;
  const [dy, dm, dd] = deadline.split('-').map(Number);
  const now    = new Date();
  const local  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dy, dm - 1, dd);
  return Math.ceil((target - local) / (1000 * 60 * 60 * 24));
}
function formatDeadline(d) {
  if (!d) return null;
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
}

export default function Dashboard() {
  const { user }    = useAuth();
  const toast       = useToast();
  const navigate    = useNavigate();
  const { weather } = useWeather();
  const { t, lang } = useLanguage();
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [moodSaving,   setMoodSaving]   = useState(false);
  const [equippedTree, setEquippedTree] = useState('seedling');
  const [treeData,     setTreeData]     = useState(null);

  const load = useCallback(async () => {
    try {
      const localDate     = new Date().toLocaleDateString('en-CA');
      const [dash, trees] = await Promise.all([
        api.get(`/dashboard?date=${localDate}`),
        api.get('/trees'),
      ]);
      setData(dash);
      setEquippedTree(trees.equipped || 'seedling');
      setTreeData(trees);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const saveMood = async (value) => {
    setMoodSaving(true);
    try {
      const localDate = new Date().toLocaleDateString('en-CA');
      await api.post('/mood', { mood: value, date: localDate });
      load();
    } catch (e) { toast.error(e.message); }
    finally { setMoodSaving(false); }
  };
  const completeTask = async (task) => {
    try {
      const { xpAwarded, unlocked } = await api.put(`/tasks/${task.id}`, { status:'done', progress:100 });
      if (xpAwarded) toast.xp(xpAwarded, task.title);
      unlocked?.forEach((k) => toast.achievement(k.replace(/_/g,' ')));
      load();
    } catch (e) { toast.error(e.message); }
  };

  if (loading || !data) return <PageLoader />;
  const firstName = user?.name?.split(' ')[0] || '';
  const { todaysTasks, todaysHabits, upcomingDeadlines, mood, quote, productivityScore, streak, level, counts } = data;
  const moodValue  = mood?.mood || null;
  const isRoughDay = moodValue && moodValue <= 2;
  const isGreatDay = moodValue && moodValue >= 4;
  const dateLocale = lang === 'ar' ? 'ar' : 'en-US';
  const todayLabel = new Date().toLocaleDateString(dateLocale, { weekday:'long', month:'long', day:'numeric' });
  const h = new Date().getHours();
  const greetKey = h < 12 ? 'greet.morning' : h < 17 ? 'greet.afternoon' : 'greet.evening';
  const habitsLeft = todaysHabits.filter(hb => !hb.doneToday).length;
  const subtitle = isRoughDay
    ? t('dash.roughSubtitle')
    : isGreatDay
    ? t('dash.greatSubtitle')
    : todaysTasks.length === 0 && todaysHabits.length === 0
    ? t('dash.clearSubtitle')
    : t('dash.leftSummary', { tasks: todaysTasks.length, habits: habitsLeft });
  const visibleTasks = isRoughDay ? todaysTasks.slice(0, 2) : todaysTasks;
  const taskLabel    = isRoughDay ? t('dash.justTwo') : t('dash.todaysTasks');
  const totalXp      = treeData?.totalXp || 0;
  const nextTree     = NEXT_TREE[equippedTree];

  return (
    <div className="flex flex-col gap-5">
      <GlassCard className="p-7">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-lavender-600 dark:text-lavender-300 mb-1">
              {todayLabel}
            </p>
            <h1 className="font-display text-3xl font-bold text-ink dark:text-white mb-1">
              {t(greetKey)}, {firstName} 👋
            </h1>
            <p className="text-sm text-ink/45 dark:text-white/40 mb-5">{subtitle}</p>
            <div className="flex flex-wrap gap-3">
              {[
                { icon:'🔥', color:'from-sun-400 to-sun-500', value:`${streak}d`, label:t('dash.streak') },
                { icon:'⚡', color:'from-[rgb(var(--accent-500))] to-[rgb(var(--accent-700))]', value:`${level?.xp || 0} XP`, label:t('dash.lvl', { n: level?.level || 1 }), onClick:() => navigate('/trees') },
                { icon:'📋', color:'from-aurora-sky to-blue-500', value: counts.totalTasksToday > 0 ? `${counts.tasksDoneToday}/${counts.totalTasksToday}` : String(todaysTasks.length), label:t('dash.leftToday') },
              ].map(({ icon, color, value, label, onClick }) => (
                <motion.div
                  key={label}
                  whileHover={onClick ? { y:-2 } : {}}
                  onClick={onClick}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${onClick ? 'cursor-pointer' : ''}`}
                  style={{ background:'rgba(255,255,255,0.65)', border:'1px solid rgba(255,255,255,0.75)', backdropFilter:'blur(16px)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.90)' }}
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
            <div className="flex items-center gap-4 mt-5 flex-wrap">
              {weather && (
                <motion.div
                  initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
                  className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2 shrink-0"
                  style={{ background:'rgba(255,255,255,0.55)', border:'1px solid rgba(255,255,255,0.70)', backdropFilter:'blur(12px)' }}
                >
                  <span className="text-xl leading-none">{weatherEmoji(weather.condition)}</span>
                  <div>
                    <p className="text-sm font-bold text-ink dark:text-white leading-none">{weather.temp}°C</p>
                    <p className="text-[10px] text-ink/40 dark:text-white/30 capitalize mt-0.5">
                      {weather.desc} · {weather.city}
                    </p>
                  </div>
                </motion.div>
              )}
              {quote && (
                <p className="text-xs text-ink/35 dark:text-white/25 italic leading-relaxed flex-1 min-w-0">
                  "{quote.text}" — {quote.author}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 shrink-0">
            {isRoughDay ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <motion.div animate={{ y:[0,-4,0] }} transition={{ duration:3, repeat:Infinity, ease:'easeInOut' }}
                  className="text-5xl">
                  💙
                </motion.div>
                <p className="text-xs text-ink/35 dark:text-white/25 text-center max-w-[90px] leading-relaxed">
                  {t('dash.restProductive')}
                </p>
              </div>
            ) : (
              <>
                <ProductivitySphere score={productivityScore} equippedTree={equippedTree} />
                <button onClick={() => navigate('/trees')}
                  className="flex items-center gap-1 text-xs text-ink/35 dark:text-white/30 hover:text-lavender-500 transition">
                  <TreePine size={11} /> {t('dash.changeTree')}
                </button>
              </>
            )}
          </div>
        </div>
      </GlassCard>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <GlassCard className="p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-ink dark:text-white">{taskLabel}</h2>
              <button onClick={() => navigate('/tasks')}
                className="text-xs font-semibold text-lavender-600 dark:text-lavender-300 hover:underline">
                {t('dash.viewAll')}
              </button>
            </div>
            {visibleTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-4xl mb-3">🎉</span>
                <p className="font-semibold text-ink dark:text-white text-sm mb-1">{t('dash.nothingDue')}</p>
                <p className="text-xs text-ink/40 dark:text-white/35">
                  {isRoughDay ? t('dash.takeEasy') : t('dash.enjoyRoom')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {visibleTasks.map((task) => {
                  const dl        = daysUntil(task.deadline);
                  const isOverdue = dl !== null && dl < 0;
                  const isToday   = dl !== null && dl === 0;
                  const isSoon    = dl !== null && dl > 0 && dl <= 3;
                  return (
                    <motion.div key={task.id} layout
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 group"
                      style={{ background:'rgba(255,255,255,0.55)', border:'1px solid rgba(255,255,255,0.65)', backdropFilter:'blur(12px)' }}
                    >
                      <button onClick={() => completeTask(task)}
                        className="shrink-0 text-ink/25 hover:text-sage-500 transition">
                        <Circle size={18} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink dark:text-white truncate">{task.title}</p>
                        {task.deadline && (
                          <p className={`text-[11px] flex items-center gap-1 mt-0.5 font-medium ${
                            isOverdue || isToday ? 'text-coral-500'
                            : isSoon ? 'text-sun-600'
                            : 'text-ink/35 dark:text-white/25'
                          }`}>
                            <Calendar size={10} />
                            {isOverdue ? t('dash.overdue')
                            : isToday  ? t('dash.dueToday')
                            : dl === 1 ? t('dash.dueTomorrow')
                            : isSoon   ? t('dash.dueInDays', { n: dl })
                            : formatDeadline(task.deadline)}
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        task.priority === 'high'   ? 'bg-coral-400/15 text-coral-500' :
                        task.priority === 'medium' ? 'bg-sun-400/15 text-sun-600'     :
                                                     'bg-lavender-100 text-lavender-600'
                      }`}>{t(`tasks.${task.priority}`)}</span>
                    </motion.div>
                  );
                })}
                {isRoughDay && todaysTasks.length > 2 && (
                  <p className="text-xs text-ink/35 dark:text-white/25 text-center py-2">
                    {t('dash.moreTasks', { n: todaysTasks.length - 2 })} →{' '}
                    <button onClick={() => navigate('/tasks')} className="underline">{t('dash.viewAll')}</button>
                  </p>
                )}
              </div>
            )}
          </GlassCard>
        </div>
        <div className="flex flex-col gap-4">
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Smile size={15} className="text-lavender-500" />
              <h3 className="font-display font-semibold text-sm text-ink dark:text-white">{t('dash.mood')}</h3>
            </div>
            <div className="flex justify-between">
              {MOOD_OPTIONS.map((m) => (
                <button key={m.value} onClick={() => saveMood(m.value)} disabled={moodSaving}
                  className="flex flex-col items-center gap-1 group">
                  <motion.span
                    whileHover={{ scale:1.2, y:-2 }} whileTap={{ scale:0.9 }}
                    className={`text-2xl transition-all ${
                      mood?.mood === m.value ? 'scale-125 drop-shadow-sm' : 'opacity-60 group-hover:opacity-100'
                    }`}
                  >
                    {m.emoji}
                  </motion.span>
                  <span className="text-[10px] text-ink/40 dark:text-white/30">{t(m.label)}</span>
                </button>
              ))}
            </div>
          </GlassCard>
          {todaysHabits.length > 0 && !isRoughDay && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-sm text-ink dark:text-white">{t('dash.todaysHabits')}</h3>
                <button onClick={() => navigate('/goals')}
                  className="text-xs text-lavender-600 dark:text-lavender-300 font-semibold hover:underline">
                  {t('dash.viewAll')}
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {todaysHabits.slice(0, 4).map((hb) => (
                  <div key={hb.id} className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: hb.doneToday ? hb.color : 'rgba(30,34,51,0.15)' }} />
                    <span className={`text-xs flex-1 truncate ${
                      hb.doneToday ? 'text-ink/40 dark:text-white/30 line-through' : 'text-ink/70 dark:text-white/60'
                    }`}>{hb.name}</span>
                    {hb.doneToday && <CheckCircle2 size={13} className="text-sage-500 shrink-0" />}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
          {upcomingDeadlines?.length > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-lavender-500" />
                <h3 className="font-display font-semibold text-sm text-ink dark:text-white">{t('dash.comingUp')}</h3>
              </div>
              <div className="flex flex-col gap-2">
                {upcomingDeadlines.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-ink/65 dark:text-white/55 truncate">{task.title}</span>
                    <span className="text-[10px] text-ink/35 shrink-0 flex items-center gap-1">
                      <Calendar size={9} /> {formatDeadline(task.deadline)}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TreePine size={15} className="text-lavender-500" />
                <h3 className="font-display font-semibold text-sm text-ink dark:text-white">{t('dash.yourTree')}</h3>
              </div>
              <button onClick={() => navigate('/trees')}
                className="text-xs text-lavender-600 dark:text-lavender-300 font-semibold hover:underline">
                {t('dash.shop')}
              </button>
            </div>
            <div className="flex items-center gap-4">
              <motion.div
                animate={{ y:[0,-5,0] }} transition={{ duration:3, repeat:Infinity, ease:'easeInOut' }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shrink-0"
                style={{ background:'linear-gradient(135deg, rgb(var(--accent-500) / 0.12), rgb(var(--accent-600) / 0.06))', border:'1px solid rgb(var(--accent-500) / 0.18)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.60)' }}
              >
                {equippedTree === 'mystic' ? '🔮' : (TREE_EMOJIS[equippedTree] || '🌱')}
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-ink dark:text-white text-sm">
                  {equippedTree === 'mystic' ? (treeData?.mystic?.config?.custom_name || 'Mystic Tree') : (TREE_NAMES[equippedTree] || 'Seedling')}
                </p>
                <p className="text-[11px] text-ink/40 dark:text-white/30 mt-0.5">
                  {equippedTree === 'mystic' ? 'One of a kind. Made by you.' : TREE_DESC[equippedTree]}
                </p>
                {nextTree && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-ink/35 dark:text-white/25">
                        {t('dash.next')}: {TREE_EMOJIS[nextTree.key]} {nextTree.name}
                      </span>
                      <span className="text-[10px] font-bold text-lavender-500">
                        {Math.min(totalXp, nextTree.cost).toLocaleString()} / {nextTree.cost.toLocaleString()} XP
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-ink/5 dark:bg-white/5 overflow-hidden">
                      <motion.div
                        initial={{ width:0 }}
                        animate={{ width:`${Math.min(100,(totalXp/nextTree.cost)*100)}%` }}
                        transition={{ duration:1, ease:[0.16,1,0.3,1] }}
                        className="h-full rounded-full"
                        style={{ background:'linear-gradient(90deg, rgb(var(--accent-500)), #60A5FA)' }}
                      />
                    </div>
                  </div>
                )}
                {!nextTree && (
                  <p className="text-[10px] text-amber-500 font-semibold mt-1">{t('dash.fullCollection')}</p>
                )}
              </div>
            </div>
          </GlassCard>
          {quote && !isRoughDay && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">💬</span>
                <h3 className="font-display font-semibold text-sm text-ink dark:text-white">{t('dash.dailyQuote')}</h3>
              </div>
              <p className="text-xs text-ink/65 dark:text-white/55 italic leading-relaxed">"{quote.text}"</p>
              <p className="text-[10px] text-ink/35 mt-2">— {quote.author}</p>
            </GlassCard>
          )}
          {isRoughDay && (
            <GlassCard className="p-5"
              style={{ background:'rgb(var(--accent-500) / 0.06)', border:'1px solid rgb(var(--accent-500) / 0.15)' }}>
              <p className="text-sm text-ink/65 dark:text-white/55 italic leading-relaxed text-center">
                "{t('dash.roughQuote')}"
              </p>
              <p className="text-[10px] text-ink/35 mt-2 text-center">💙 Aurora</p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}