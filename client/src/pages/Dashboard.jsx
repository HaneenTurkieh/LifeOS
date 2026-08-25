import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Calendar, Clock, Smile, TreePine, Trash2, Info, Target, Square, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api }            from '../api/client.js';
import { useToast }       from '../context/ToastContext.jsx';
import { useAuth }        from '../context/AuthContext.jsx';
import { useLanguage }    from '../context/LanguageContext.jsx';
import { useTheme }       from '../context/ThemeContext.jsx';
import { useWeather, weatherEmoji } from '../hooks/useWeather.js';
import GlassCard          from '../components/GlassCard.jsx';
import ProductivitySphere from '../components/ProductivitySphere.jsx';
import PageLoader         from '../components/Loader.jsx';
import MysticSvg          from '../components/MysticTreeIcon.jsx';
import { isTodayBirthday } from '../utils/birthday.js';

const TREE_EMOJIS = {
  seedling:'🌱', sprout:'🌿', oak:'🌳',
  cherry_blossom:'🌸', coral:'🪸', bamboo:'🎋', cactus:'🌵',
  palm:'🌴', water:'💧', maple:'🍁', pine:'🌲', flamingo:'🦩', money:'💰', crystal:'✨',
  christmas:'🎄',
};
const TREE_NAMES = {
  seedling:'Seedling', sprout:'Sprout', oak:'Oak',
  cherry_blossom:'Cherry Blossom', coral:'Coral Tree', bamboo:'Bamboo', cactus:'Cactus',
  palm:'Palm', water:'Water Tree', maple:'Maple', pine:'Pine', flamingo:'Flamingo Tree', money:'Money Tree', crystal:'Crystal Tree',
  christmas:'Birthday Tree',
};
const TREE_DESC = {
  seedling:'Every journey starts here.',
  sprout:'Your first real growth.',
  oak:'Strong and steady.',
  cherry_blossom:'Beautiful under pressure.',
  coral:'Vivid and alive, like a reef beneath the waves.',
  bamboo:'Flexible, fast, unstoppable.',
  cactus:'Thrives on very little — resilience in its purest form.',
  palm:'Thriving in the heat.',
  water:'Fluid, calm, endlessly renewing.',
  maple:'Changes color, never loses its roots.',
  pine:'Evergreen. Always growing.',
  flamingo:'Rare, pink, impossible to miss.',
  money:'Grows richer the more you tend it.',
  crystal:'Legendary. For the dedicated.',
  christmas:'One day a year, just for you. Not for sale — a birthday gift from Nuvora.',
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
// Small this-week-vs-last-week delta pill for the Weekly Recap card.
// No internal state, so it's safe at module scope even though it's only
// used in one place — keeps the three recap rows below from repeating
// the same up/down/flat branching three times.
function DeltaBadge({ diff }) {
  const rounded = Math.round(diff * 10) / 10;
  if (rounded === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-semibold text-ink/30 dark:text-white/25">
        <Minus size={10} />0
      </span>
    );
  }
  const Icon  = rounded > 0 ? TrendingUp : TrendingDown;
  const color = rounded > 0 ? 'text-sage-500' : 'text-coral-500';
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${color}`}>
      <Icon size={10} />{Math.abs(rounded)}
    </span>
  );
}

export default function Dashboard() {
  const { user }    = useAuth();
  const toast       = useToast();
  const navigate    = useNavigate();
  const { weather } = useWeather();
  const { t, lang } = useLanguage();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const isBirthday = isTodayBirthday(user?.birthday);
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [moodSaving,   setMoodSaving]   = useState(false);
  const [equippedTree, setEquippedTree] = useState('seedling');
  const [treeData,     setTreeData]     = useState(null);
  // Stat-card hints used the native `title` attribute, which only shows on
  // hover — phones and iPads have no hover, so those explanations were
  // simply unreachable there. Tap-to-open popover works on every device.
  const [openHint,     setOpenHint]     = useState(null);
  const [justCompletedId, setJustCompletedId] = useState(null);
  // Real bug that used to live here: the rough/meh-mood quote was a
  // single hardcoded string (t('dash.roughQuote')), so it looked
  // identical literally every time someone had a low mood day. Now a
  // pool of 6 (see translations.js), and this picks one at random once
  // per mount — a lazy useState initializer so it doesn't re-roll (and
  // visibly flicker) on every re-render, but does vary the next time the
  // page loads or mood changes.
  const [roughQuoteIndex] = useState(() => Math.floor(Math.random() * 6) + 1);
  // Same idea as roughQuoteIndex, but for the mirrored great-day
  // treatment below — picked once per mount so it doesn't re-roll on
  // every re-render.
  const [greatQuoteIndex] = useState(() => Math.floor(Math.random() * 6) + 1);
  const statsRef = useRef(null);
  useEffect(() => {
    if (!openHint) return;
    const handler = (e) => {
      if (statsRef.current && !statsRef.current.contains(e.target)) setOpenHint(null);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [openHint]);

  const load = useCallback(async () => {
    try {
      const localDate     = new Date().toLocaleDateString('en-CA');
      const [dash, trees] = await Promise.all([
        api.get(`/dashboard?date=${localDate}`),
        api.get('/trees'),
      ]);
      setData(dash);
      // Both flags only ever come back true on the exact load where the
      // server-side change actually happened (see syncStreakShields —
      // idempotent, doesn't re-fire on the next load), so no extra
      // client-side dedup needed here.
      if (dash.justShielded)     toast.success(t('dash.shieldUsed'));
      if (dash.justEarnedShield) toast.success(t('dash.shieldEarned'));
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
      // Lets the persistent corner buddy pick up today's mood right away
      // instead of only after AppShell's own fetch on next load.
      window.dispatchEvent(new CustomEvent('nuvora:mood-updated', { detail: { mood: value } }));
      load();
    } catch (e) { toast.error(e.message); }
    finally { setMoodSaving(false); }
  };
  const completeTask = async (task) => {
    // Two things used to be wrong here, both read as "the circle isn't
    // even checking": (1) nothing happened on screen until the full PUT
    // round trip resolved — Tasks.jsx's own markDone already updates
    // local state before the request resolves, this one never did — and
    // (2) even once it resolved, the task just vanished from the list
    // with no checked-state moment at all, which reads as "didn't
    // register" rather than "done." Fix: flash a filled checkmark the
    // instant you tap (real, immediate feedback), THEN remove the row a
    // beat later — the API call itself fires immediately in parallel, so
    // this delay is purely the visual confirmation, not added latency.
    setJustCompletedId(task.id);
    const req = api.put(`/tasks/${task.id}`, { status:'done', progress:100 });
    setTimeout(() => {
      setJustCompletedId((cur) => (cur === task.id ? null : cur));
      setData((prev) => prev && {
        ...prev,
        todaysTasks: prev.todaysTasks.filter((t) => t.id !== task.id),
        counts: { ...prev.counts, tasksDoneToday: (prev.counts?.tasksDoneToday || 0) + 1 },
      });
    }, 420);
    try {
      const { xpAwarded, unlocked } = await req;
      if (xpAwarded) toast.xp(xpAwarded, task.title);
      unlocked?.forEach((k) => toast.achievement(k.replace(/_/g,' ')));
      load(); // reconciles productivity score/streak/tree with real server state
    } catch (e) {
      toast.error(e.message);
      load(); // roll back the optimistic removal too
    }
  };
  const deleteTask = async (task) => {
    try {
      await api.del(`/tasks/${task.id}`);
      toast.success(t('tasks.deleted') || 'Deleted');
      load();
    } catch (e) { toast.error(e.message); }
  };
  // Mirrors Goals.jsx's toggleMilestone exactly — same endpoint, same
  // shape — so this card and the Goals page never disagree about what
  // "done" means for a milestone.
  const toggleMilestone = async (m) => {
    try {
      await api.put(`/goals/${m.goal_id}/milestones/${m.id}`, { done: true });
      load();
    } catch (e) { toast.error(e.message); }
  };

  if (loading || !data) return <PageLoader />;
  const firstName = user?.name?.split(' ')[0] || '';
  const { todaysTasks, todaysHabits, nextMilestones, birthday, mood, quote, productivityScore, streak, streakShields, recap, level, counts } = data;
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
  // "Just these two" only makes sense when there actually are tasks to show —
  // otherwise the title promises 2 tasks while the empty state says "nothing
  // due today", which read as a bug (it was one).
  const taskLabel    = isRoughDay && todaysTasks.length > 0 ? t('dash.justTwo') : t('dash.todaysTasks');
  const totalXp      = treeData?.totalXp || 0;
  // Real bug this fixes: this used to be NEXT_TREE[equippedTree] — a
  // second, hand-maintained copy of the tree progression that had
  // drifted out of sync with the real catalogue in trees.js (missing
  // Coral, Cactus, Water, Maple, Flamingo, Money Tree entirely) AND used
  // the wrong signal to begin with: which tree happens to be *equipped*
  // (a cosmetic choice) rather than which tree hasn't been unlocked yet.
  // Equip an old tree while saving for a new one, or have your equipped
  // tree be one of the ones missing from that list, and the bar had
  // nothing real to track — looked permanently stuck. treeData.trees
  // already comes straight from the server's real catalogue, in
  // ascending-cost order, with `owned` on every entry — the cheapest
  // one not yet owned IS the next tree to progress toward, no separate
  // list to keep in sync.
  const nextTree     = treeData?.trees?.find((t) => !t.owned) || null;
  // The actual designed Mystic Tree (shape/colour/glow), not just the
  // "mystic:<id>" key — so we can render the real shape the person made
  // instead of a generic placeholder emoji.
  const equippedMysticTree = equippedTree?.startsWith('mystic')
    ? treeData?.mystic?.trees?.find((mt) => `mystic:${mt.id}` === equippedTree) || null
    : null;

  return (
    <div className="flex flex-col gap-6">
      <GlassCard className="p-7 sm:p-8">
        {/* ref moved up here (was on just the stats row below) so the new
            score-ring info button — which lives in the sphere column, a
            sibling of that row, not inside it — is also treated as
            "inside" for the click-outside-closes-the-hint check below.
            Otherwise its own hint popover would never register as a
            valid click target and close itself the instant it opened. */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-6" ref={statsRef}>
          <div className="flex-1 min-w-0">
            {/* Small brand mark — the app's own name only ever showed up
                pre-login before this (the login page's wordmark). Kept
                tiny and folded into the date eyebrow rather than its
                own row, so it reads as a mark, not a banner. */}
            <div className="flex items-center gap-1.5 mb-1">
              <img src="/icon-192.png" alt="" className="h-3.5 w-3.5 opacity-70 shrink-0" />
              <p className="text-xs font-bold uppercase tracking-widest text-lavender-600 dark:text-lavender-300">
                Nuvora · {todayLabel}
              </p>
            </div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink dark:text-white mb-1.5">
              {isBirthday ? t('greet.birthday') : t(greetKey)}, {firstName} {isBirthday ? '🎂' : '👋'}
            </h1>
            <p className="text-sm text-ink/45 dark:text-white/40 mb-6">{subtitle}</p>
            <div className="relative z-30 flex flex-wrap gap-4">
              {[
                {
                  icon:'🔥', color:'from-sun-400 to-sun-500', value:`${streak}d`, label:t('dash.streak'),
                  // Shield count folded into the same hint rather than a
                  // second popover — it's context for the streak number,
                  // not a separate concept worth its own stat card.
                  hint: streakShields > 0 ? `${t('dash.streakHint')} ${t('dash.shieldsAvailable', { n: streakShields })}` : t('dash.streakHint'),
                  badge: streakShields > 0 ? `🛡️${streakShields}` : null,
                  glow:'rgba(251,146,60,0.45)',
                },
                { icon: isBirthday ? '🎁' : '⚡', color:'from-[rgb(var(--accent-500))] to-[rgb(var(--accent-700))]', value:`${level?.xp || 0} XP`, label:t('dash.lvl', { n: level?.level || 1 }), hint:t('dash.lvlHint'), onClick:() => navigate('/trees'), glow:'rgb(var(--accent-500) / 0.45)' },
                // "X/Y done" reads as "achieved today" to most people, but Y is
                // tasks *due* today and X counts a task as done no matter which
                // day it was actually finished — someone who finished a task
                // early sees "1/1" and reasonably thinks "I did nothing today".
                // A plain remaining count can't be misread either way.
                counts.totalTasksToday > 0
                  ? { icon:'📋', color:'from-nuvora-sky to-blue-500', value:String(Math.max(0, counts.totalTasksToday - counts.tasksDoneToday)), label:t('dash.leftToday'), hint:t('dash.leftTodayCountHint', { done: counts.tasksDoneToday, total: counts.totalTasksToday }) }
                  : { icon:'📋', color:'from-nuvora-sky to-blue-500', value:String(todaysTasks.length), label:t('dash.leftToday'), hint:t('dash.leftTodayHint') },
              ].map(({ icon, color, value, label, hint, onClick, glow, badge }) => (
                <motion.div
                  key={label}
                  whileHover={onClick ? { y:-2 } : {}}
                  onClick={onClick}
                  // Card is lifted to the top of its own stacking order
                  // while its hint is open — see note on the popover below
                  // for why this (not just the popover's own z-index)
                  // is what actually keeps it from rendering underneath
                  // the next card in the row.
                  style={{
                    ...(isDark
                      ? { background:'rgba(255,255,255,0.045)', border:'1px solid rgba(255,255,255,0.10)', backdropFilter:'blur(20px)' }
                      : { background:'rgba(255,255,255,0.30)', border:'1px solid rgba(255,255,255,0.95)', backdropFilter:'blur(20px)' }),
                    // Layered shadow: a soft ambient drop-shadow underneath
                    // (colored for Streak/XP — the "gamified accent" glow —
                    // neutral for the plain utility card) plus the original
                    // inset top highlight on top of it, instead of just the
                    // single flat inset shadow this used to have.
                    boxShadow: [
                      glow ? `0 10px 28px ${glow}` : (isDark ? '0 10px 24px rgba(0,0,0,0.28)' : '0 10px 24px rgba(124,106,240,0.10)'),
                      isDark ? 'inset 0 1px 0 rgba(255,255,255,0.10)' : 'inset 0 1px 0 rgba(255,255,255,0.95)',
                    ].join(', '),
                    zIndex: openHint === label ? 50 : undefined,
                  }}
                  className={`relative flex items-center gap-3 rounded-2xl px-5 py-3.5 ${onClick ? 'cursor-pointer' : ''}`}
                >
                  {badge && (
                    <span
                      className="absolute -top-2 -end-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white shadow"
                      style={{ background: 'linear-gradient(135deg, #60A5FA, #3B82F6)' }}
                    >
                      {badge}
                    </span>
                  )}
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-white text-base bg-gradient-to-br ${color}`}>
                    {icon}
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold text-ink dark:text-white leading-none">{value}</p>
                    {/* (i) moved inline next to the label instead of an
                        absolute corner badge — the corner badge overlapped
                        this card's own content and, on the Streak card
                        specifically, only its outer sliver (the part
                        poking clear of the card) ended up clickable; the
                        inner portion sat over the card's normal-flow
                        content and silently ate clicks. Inline avoids any
                        overlap/stacking ambiguity entirely. */}
                    <p className="text-xs text-ink/45 dark:text-white/35 mt-0.5 flex items-center gap-1">
                      {label}
                      {hint && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenHint((cur) => cur === label ? null : label); }}
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-ink/30 dark:text-white/40 hover:text-ink/60 dark:hover:text-white/70 transition-colors"
                          style={isDark
                            ? { background:'rgba(255,255,255,0.14)', border:'1px solid rgba(255,255,255,0.20)' }
                            : { background:'rgba(255,255,255,0.85)', border:'1px solid rgba(255,255,255,0.90)' }}
                        >
                          <Info size={9} />
                        </button>
                      )}
                    </p>
                  </div>
                  <AnimatePresence>
                    {hint && openHint === label && (
                      <motion.div
                        initial={{ opacity:0, y:-4, scale:0.96 }}
                        animate={{ opacity:1, y:0, scale:1 }}
                        exit={{ opacity:0, y:-4, scale:0.96 }}
                        transition={{ duration:0.15 }}
                        onClick={(e) => e.stopPropagation()}
                        // Real bug this fixes: `backdropFilter` on the card
                        // above creates its own stacking context, so this
                        // popover's z-20 only ever ordered it against its
                        // OWN card's children — it never competed with the
                        // *next* card in the row, which (also having its
                        // own backdrop-filter stacking context) simply
                        // painted after it in DOM order regardless of any
                        // z-index set here. On narrow/mobile widths, where
                        // this w-56 popover is wider than its own card, that
                        // made it visually clip under/behind whichever
                        // stat-card sat next to it — the "hidden explanation"
                        // bug. The real fix had to happen one level up: see
                        // `zIndex: openHint === label ? 50 : undefined` on
                        // the card's own style above, which lifts the
                        // card's entire stacking context (this popover
                        // included) above its siblings. This z-30 here is
                        // now just for ordering within the card itself.
                        className={`absolute top-full mt-2 start-0 z-30 w-56 max-w-[calc(100vw-3rem)] rounded-xl px-3 py-2.5 text-xs leading-relaxed ${isDark ? 'text-white/80' : 'text-ink/70'}`}
                        style={isDark
                          ? { background:'rgba(32,26,54,0.98)', border:'1px solid rgba(255,255,255,0.14)', boxShadow:'0 12px 32px rgba(0,0,0,0.45)' }
                          : { background:'rgba(255,255,255,0.98)', border:'1px solid rgba(255,255,255,0.90)', boxShadow:'0 12px 32px rgba(0,0,0,0.14)' }}
                      >
                        {hint}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-5 flex-wrap">
              {weather && (
                <motion.div
                  initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
                  className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2 shrink-0"
                  style={isDark
                    ? { background:'rgba(255,255,255,0.028)', border:'1px solid rgba(255,255,255,0.07)', backdropFilter:'blur(12px)' }
                    : { background:'rgba(255,255,255,0.19)', border:'1px solid rgba(255,255,255,0.85)', backdropFilter:'blur(12px)' }}
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
              {isRoughDay ? (
                <p className="text-xs text-ink/35 dark:text-white/25 italic leading-relaxed flex-1 min-w-0">
                  "{t(`dash.roughQuote${roughQuoteIndex}`)}" 💙
                </p>
              ) : isGreatDay ? (
                <p className="text-xs text-amber-600/70 dark:text-amber-300/60 italic leading-relaxed flex-1 min-w-0">
                  "{t(`dash.greatQuote${greatQuoteIndex}`)}" 🚀
                </p>
              ) : quote && (
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
                <div className="relative">
                  {/* Great-day treatment mirrors the rough-day one above,
                      just celebratory instead of restrictive: same slot,
                      an ambient glow ring behind the sphere instead of
                      swapping it out entirely (the score itself is good
                      news today, no reason to hide it) plus a short note
                      under the "change tree" button below, same spot the
                      rough-day heart's note sits in. */}
                  {isGreatDay && (
                    <motion.div
                      className="pointer-events-none absolute inset-0 -m-3 rounded-full"
                      style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.35) 0%, transparent 70%)' }}
                      animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.85, 0.5] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                  <ProductivitySphere score={productivityScore} equippedTree={isBirthday ? 'christmas' : equippedTree} mysticTree={isBirthday ? null : equippedMysticTree} />
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenHint((cur) => cur === 'score' ? null : 'score'); }}
                    className="absolute -top-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full text-ink/30 dark:text-white/40 hover:text-ink/60 dark:hover:text-white/70 transition-colors"
                    style={isDark
                      ? { background:'rgba(255,255,255,0.14)', border:'1px solid rgba(255,255,255,0.20)' }
                      : { background:'rgba(255,255,255,0.85)', border:'1px solid rgba(255,255,255,0.90)' }}
                  >
                    <Info size={11} />
                  </button>
                  <AnimatePresence>
                    {openHint === 'score' && (
                      <motion.div
                        initial={{ opacity:0, y:-4, scale:0.96 }}
                        animate={{ opacity:1, y:0, scale:1 }}
                        exit={{ opacity:0, y:-4, scale:0.96 }}
                        transition={{ duration:0.15 }}
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute top-full mt-2 end-0 z-20 w-56 rounded-xl px-3 py-2.5 text-xs leading-relaxed ${isDark ? 'text-white/80' : 'text-ink/70'}`}
                        style={isDark
                          ? { background:'rgba(32,26,54,0.98)', border:'1px solid rgba(255,255,255,0.14)', boxShadow:'0 12px 32px rgba(0,0,0,0.45)' }
                          : { background:'rgba(255,255,255,0.98)', border:'1px solid rgba(255,255,255,0.90)', boxShadow:'0 12px 32px rgba(0,0,0,0.14)' }}
                      >
                        {t('dash.scoreHint', {
                          tasksDone: counts.tasksDoneToday, tasksTotal: counts.totalTasksToday,
                          habitsDone: counts.habitsDoneToday, habitsTotal: counts.totalHabits,
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button onClick={() => navigate('/trees')}
                  className="flex items-center gap-1 text-xs text-ink/35 dark:text-white/30 hover:text-lavender-500 transition">
                  <TreePine size={11} /> {t('dash.changeTree')}
                </button>
                {isGreatDay && (
                  <p className="text-[10px] text-amber-600/70 dark:text-amber-300/60 text-center max-w-[90px] leading-relaxed">
                    {t('dash.greatDayNote')}
                  </p>
                )}
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
                <AnimatePresence initial={false}>
                {visibleTasks.map((task) => {
                  const dl        = daysUntil(task.deadline);
                  const isOverdue = dl !== null && dl < 0;
                  const isToday   = dl !== null && dl === 0;
                  const isSoon    = dl !== null && dl > 0 && dl <= 3;
                  return (
                    <motion.div key={task.id} layout
                      exit={{ opacity: 0, x: 24, transition: { duration: 0.25 } }}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 group"
                      style={isDark
                        ? { background:'rgba(255,255,255,0.028)', border:'1px solid rgba(255,255,255,0.06)', backdropFilter:'blur(12px)' }
                        : { background:'rgba(255,255,255,0.19)', border:'1px solid rgba(255,255,255,0.80)', backdropFilter:'blur(12px)' }}
                    >
                      <button onClick={() => completeTask(task)}
                        disabled={justCompletedId === task.id}
                        className="shrink-0 text-ink/25 dark:text-white/25 hover:text-sage-500 transition">
                        {justCompletedId === task.id
                          ? <CheckCircle2 size={18} className="text-sage-500" />
                          : <Circle size={18} />}
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
                                                     'bg-lavender-100 dark:bg-lavender-500/15 text-lavender-600 dark:text-lavender-300'
                      }`}>{t(`tasks.${task.priority}`)}</span>
                      <button onClick={() => deleteTask(task)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition text-ink/25 hover:text-coral-500 dark:text-white/25 dark:hover:text-coral-400 p-1">
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  );
                })}
                </AnimatePresence>
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
          {/* Flow used to have zero presence outside the mobile "More"
              bucket and a single line in the onboarding shortcuts list —
              easily the most distinctive feature in the app (a real focus
              timer that grows a tree live while you work) and the least
              discoverable. First card in this column on purpose: highest
              visibility real estate on the page after the hero stats. */}
          {/* Redesigned bigger/livelier per feedback that the first pass
              "wasn't pretty interesting" — a static small icon + one-line
              pitch undersold a feature meant to be the app's hook. Now:
              a real growing-tree animation cycling on its own (not just a
              static emoji), a glowing ambient blob behind it (same
              "gamified accent" language as the Streak/XP stat cards), a
              real button instead of a text link, and the current streak
              folded in here too — ties Flow directly to the number
              people already check most, instead of the two features
              feeling unrelated. */}
          <GlassCard
            interactive
            onClick={() => navigate('/learning')}
            className="p-6 overflow-hidden relative"
            style={{
              background: 'linear-gradient(150deg, rgb(var(--accent-500) / 0.20) 0%, rgba(74,222,128,0.10) 60%, rgba(74,222,128,0.14) 100%)',
              border: '1px solid rgb(var(--accent-500) / 0.28)',
              boxShadow: '0 16px 40px rgb(var(--accent-500) / 0.16)',
            }}
          >
            <motion.div
              className="pointer-events-none absolute -top-10 -end-10 h-40 w-40 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(74,222,128,0.35) 0%, transparent 70%)' }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="relative flex items-center gap-4">
              <motion.div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl bg-gradient-to-br from-[rgb(var(--accent-500))] to-emerald-500 shadow-glow"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                <motion.span
                  key="flow-tree-cycle"
                  animate={{ opacity: [1, 1, 0, 0, 1] }}
                  transition={{ duration: 3.6, repeat: Infinity, times: [0, 0.3, 0.4, 0.9, 1] }}
                >
                  🌱
                </motion.span>
              </motion.div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-bold text-base text-ink dark:text-white">{t('dash.flowTitle')}</h3>
                  {streak > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(251,146,60,0.18)', color: '#C2410C' }}>
                      🔥 {t('dash.flowStreakTie', { n: streak })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink/55 dark:text-white/45 mt-1 leading-relaxed">{t('dash.flowSubtitle')}</p>
              </div>
            </div>
            <motion.div
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              className="relative mt-4 flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--accent-500)) 0%, #16A34A 100%)',
                boxShadow: '0 8px 20px rgb(var(--accent-500) / 0.35)',
              }}
            >
              {t('dash.flowCta')} →
            </motion.div>
          </GlassCard>
          {/* Weekly Recap — a 2-second narrative glance, not a chart.
              Analytics already has the detailed 8-week bar/line breakdown
              of this same data; this is deliberately just three numbers
              with a this-week-vs-last-week delta, meant to be read at a
              glance on the Dashboard rather than studied. */}
          {recap && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={15} className="text-lavender-500" />
                <h3 className="font-display font-semibold text-sm text-ink dark:text-white">{t('dash.recapTitle')}</h3>
              </div>
              <div className="flex flex-col divide-y divide-ink/5 dark:divide-white/5">
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-sage-500 shrink-0" />
                    <span className="text-xs text-ink/60 dark:text-white/50">{t('dash.recapTasks')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-ink dark:text-white">{recap.tasksThisWeek}</span>
                    <DeltaBadge diff={recap.tasksThisWeek - recap.tasksLastWeek} />
                  </div>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <Clock size={13} className="text-[rgb(var(--accent-500))] shrink-0" />
                    <span className="text-xs text-ink/60 dark:text-white/50">{t('dash.recapFlow')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-ink dark:text-white">{recap.flowMinutesThisWeek}</span>
                    <DeltaBadge diff={recap.flowMinutesThisWeek - recap.flowMinutesLastWeek} />
                  </div>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <Smile size={13} className="text-lavender-500 shrink-0" />
                    <span className="text-xs text-ink/60 dark:text-white/50">{t('dash.recapMood')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-ink dark:text-white">
                      {recap.avgMoodThisWeek != null ? recap.avgMoodThisWeek : t('dash.recapNoMood')}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-ink/30 dark:text-white/20 mt-2 text-end">{t('dash.recapVsLastWeek')}</p>
            </GlassCard>
          )}
          {nextMilestones?.length > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target size={15} className="text-lavender-500" />
                  <h3 className="font-display font-semibold text-sm text-ink dark:text-white">{t('dash.nextMilestones')}</h3>
                </div>
                <button onClick={() => navigate('/goals')}
                  className="text-xs text-lavender-600 dark:text-lavender-300 font-semibold hover:underline">
                  {t('dash.viewAll')}
                </button>
              </div>
              <div className="flex flex-col gap-2.5">
                {nextMilestones.map((m) => (
                  <div key={m.id} className="flex items-start gap-2.5">
                    <button onClick={() => toggleMilestone(m)}
                      className="shrink-0 mt-0.5 text-ink/25 dark:text-white/25 hover:text-sage-500 transition">
                      <Square size={15} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-ink dark:text-white truncate">{m.title}</p>
                      <p className="text-[10px] text-ink/40 dark:text-white/30 truncate mt-0.5">
                        {m.goal_title}{m.scheduled_date ? ` · ${formatDeadline(m.scheduled_date)}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
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
          {birthday && daysUntil(birthday.deadline) != null && daysUntil(birthday.deadline) >= 0 && daysUntil(birthday.deadline) <= 30 && (
            <GlassCard className="p-5" style={{
              background: 'linear-gradient(135deg, rgb(var(--accent-500) / 0.10), rgb(var(--accent-600) / 0.04))',
              border: '1px solid rgb(var(--accent-500) / 0.18)',
            }}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎂</span>
                <div className="min-w-0">
                  <p className="font-display font-semibold text-sm text-ink dark:text-white">
                    {daysUntil(birthday.deadline) === 0
                      ? t('dash.birthdayToday')
                      : t('dash.birthdayIn', { n: daysUntil(birthday.deadline) })}
                  </p>
                  <p className="text-xs text-ink/45 dark:text-white/35 mt-0.5 truncate">{birthday.title}</p>
                </div>
              </div>
            </GlassCard>
          )}
          {/* "Coming up" (upcoming deadlines) removed on purpose — it
              duplicated what the Tasks tab already shows, and per your
              instructor's note, that space is better spent making the
              Flow card the more prominent, more interesting thing on
              this page. See the Flow card above, which absorbed the
              redesign work this slot's removal made room for. */}
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
                style={{
                  background:'linear-gradient(135deg, rgb(var(--accent-500) / 0.12), rgb(var(--accent-600) / 0.06))',
                  border:'1px solid rgb(var(--accent-500) / 0.18)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.60)',
                }}
              >
                {isBirthday
                  ? '🎄'
                  : equippedMysticTree
                  ? <MysticSvg shapeKey={equippedMysticTree.shape_key} size={34} colorHex={equippedMysticTree.color_hex} glowHex={equippedMysticTree.glow_hex} />
                  : (TREE_EMOJIS[equippedTree] || '🌱')}
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-ink dark:text-white text-sm">
                  {isBirthday
                    ? TREE_NAMES.christmas
                    : equippedTree?.startsWith('mystic')
                    ? (treeData?.mystic?.trees?.find((mt) => `mystic:${mt.id}` === equippedTree)?.custom_name || 'Mystic Tree')
                    : (TREE_NAMES[equippedTree] || 'Seedling')}
                </p>
                <p className="text-[11px] text-ink/40 dark:text-white/30 mt-0.5">
                  {isBirthday
                    ? TREE_DESC.christmas
                    : equippedTree?.startsWith('mystic') ? 'One of a kind. Made by you.' : TREE_DESC[equippedTree]}
                </p>
                {/* Deliberately plain — "First sprout" etc. right under a
                    named, purchased species like "Cherry Blossom" read as
                    a contradiction (is it a cherry blossom or a sprout?).
                    Streak stays visible, just without pretending it's a
                    growth stage of the specific tree you already own. */}
                <p className="text-[10px] text-sage-600 dark:text-sage-400 font-medium mt-1 flex items-center gap-1">
                  <span>🔥</span> {t('goals.dayStreak', { n: streak })}
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
          {quote && !isRoughDay && !isGreatDay && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">💬</span>
                <h3 className="font-display font-semibold text-sm text-ink dark:text-white">{t('dash.dailyQuote')}</h3>
              </div>
              <p className="text-xs text-ink/65 dark:text-white/55 italic leading-relaxed">"{quote.text}"</p>
              <p className="text-[10px] text-ink/35 dark:text-white/25 mt-2">— {quote.author}</p>
            </GlassCard>
          )}
          {isRoughDay && (
            <GlassCard className="p-5"
              style={{ background:'rgb(var(--accent-500) / 0.06)', border:'1px solid rgb(var(--accent-500) / 0.15)' }}>
              <p className="text-sm text-ink/65 dark:text-white/55 italic leading-relaxed text-center">
                "{t(`dash.roughQuote${roughQuoteIndex}`)}"
              </p>
              <p className="text-[10px] text-ink/35 dark:text-white/25 mt-2 text-center">{isBirthday ? '🎂' : '💙'} Nuvora</p>
            </GlassCard>
          )}
          {isGreatDay && (
            <GlassCard className="p-5"
              style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.20)' }}>
              <p className="text-sm text-ink/65 dark:text-white/55 italic leading-relaxed text-center">
                "{t(`dash.greatQuote${greatQuoteIndex}`)}"
              </p>
              <p className="text-[10px] text-ink/35 dark:text-white/25 mt-2 text-center">🚀 Nuvora</p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}