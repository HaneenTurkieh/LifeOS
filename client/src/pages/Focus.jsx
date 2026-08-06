import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Plus, LogOut, Lock, Target, X, Search, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useFocus, MODES } from '../context/FocusContext.jsx';
import PageHeader   from '../components/PageHeader.jsx';
import Modal        from '../components/Modal.jsx';
import EmptyState   from '../components/EmptyState.jsx';
import PriorityPill from '../components/PriorityPill.jsx';

const OPTIONS = { focus: [15,25,30,45,50,60,90], short: [5,10], long: [15,20,30] };
const CX = 140, CY = 140, R = 108;
const CIRC = 2 * Math.PI * R;

const ACCENT_HEX = { purple: '#7C6AF0', orange: '#FF7A2E', pink: '#F5408F', blue: '#3B82F6' };

function lg({ color, active } = {}) {
  if (active && color) {
    return {
      background:           `linear-gradient(145deg, ${color}28 0%, ${color}0C 100%)`,
      backdropFilter:       'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border:               `1px solid ${color}44`,
      boxShadow:            `0 6px 24px ${color}22, inset 0 1.5px 0 rgba(255,255,255,0.60), inset 0 -1px 0 rgba(0,0,0,0.04)`,
    };
  }
  return {
    background:           'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
    backdropFilter:       'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    border:               '1px solid rgba(255,255,255,0.22)',
    boxShadow:            'inset 0 1.5px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.12)',
  };
}
const cardGlass = {
  background:           'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
  backdropFilter:       'blur(48px)',
  WebkitBackdropFilter: 'blur(48px)',
  border:               '1px solid rgba(255,255,255,0.18)',
  boxShadow:            '0 24px 64px rgba(0,0,0,0.22), inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.08)',
  borderRadius:         '2rem',
};
const TREE_EMOJIS = {
  seedling:       '🌱', sprout: '🌿',  oak:  '🌳',
  cherry_blossom: '🌸', bamboo: '🎋',  palm: '🌴',
  pine:           '🌲', crystal: '✨',
};
const DEAD_EMOJI = '🥀';

const xpFor = (min) => Math.floor(min / 5) * 2;
const MODE_LABEL_KEYS = { focus: 'flow.focus', short: 'flow.shortBreak', long: 'flow.longBreak' };

// ── Forest-style land plot: today's trees planted on grass ─────────────
function LandPlot({ trees, t }) {
  const seeded = (i) => {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  return (
    <div className="relative w-full rounded-3xl overflow-hidden mb-4" style={{ height: 190 }}>
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(180deg, rgba(147,197,253,0.30) 0%, rgba(147,197,253,0.06) 55%, transparent 62%)',
      }} />
      <div className="absolute inset-x-0 bottom-0" style={{
        height: '64%',
        background: 'linear-gradient(180deg, #93D9A0 0%, #5FAE72 35%, #3E7A4E 100%)',
        borderTopLeftRadius: '50% 20px', borderTopRightRadius: '50% 20px',
      }}>
        <div className="absolute inset-0 opacity-[0.15]" style={{
          backgroundImage: 'repeating-linear-gradient(100deg, rgba(255,255,255,0.25) 0px, transparent 2px, transparent 16px)',
        }} />
      </div>
      {trees.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <p className="text-white/85 text-xs font-semibold drop-shadow">{t('flow.landEmptyDesc')}</p>
        </div>
      ) : (
        trees.map((tr, i) => {
          const leftPct   = 8 + seeded(i) * 82;
          const bottomPct = 6 + seeded(i + 50) * 24;
          return (
            <motion.div
              key={i}
              initial={{ scale: 0, y: 10 }} animate={{ scale: 1, y: 0 }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 18 }}
              className="absolute text-3xl select-none"
              style={{
                left: `${leftPct}%`, bottom: `${bottomPct}%`,
                filter: tr.status === 'dead' ? 'grayscale(0.7) brightness(0.85)' : 'none',
                transform: 'translateX(-50%)',
                textShadow: '0 2px 6px rgba(0,0,0,0.25)',
              }}
              title={`${tr.task_name || 'Focus'} · ${tr.duration_minutes}m`}
            >
              {tr.status === 'dead' ? DEAD_EMOJI : (TREE_EMOJIS[tr.tree_key] || '🌳')}
            </motion.div>
          );
        })
      )}
    </div>
  );
}

export default function Flow() {
  const toast    = useToast();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { resolvedTheme, accent } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const muted = (a) => (isDark ? `rgba(255,255,255,${a})` : `rgba(30,34,51,${a})`);
  const dateLocale = lang === 'ar' ? 'ar' : 'en-US';
  const fmtTime = (d) => d.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });
  const fmtForestDay = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date  = new Date(y, m - 1, d);
    const today = new Date();
    const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return t('common.today');
    if (date.toDateString() === yest.toDateString())  return t('common.yesterday');
    return date.toLocaleDateString(dateLocale, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const {
    mode, customMin, timeLeft, totalTime, isRunning,
    taskName, taskId, dots, startedAt, congrats, died, stats, board, room, roomTree,
    myRooms, switchRoom, loadMyRooms,
    setTaskName, setTask, clearTask, setRoom, setCongrats, setDied, leaveRoom,
    toggleTimer, resetTimer, addMinute, setDuration, handleModeClick,
  } = useFocus();

  // ── Link the timer to a real task instead of a free-text label ──
  const [openTasks,      setOpenTasks]      = useState([]);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [taskSearch,     setTaskSearch]     = useState('');

  const loadOpenTasks = () => {
    api.get('/tasks')
      .then((list) => setOpenTasks((list || []).filter((tk) => tk.status !== 'done')))
      .catch(() => {});
  };
  useEffect(() => { loadOpenTasks(); }, []);
  useEffect(() => { if (taskPickerOpen) loadOpenTasks(); }, [taskPickerOpen]);

  const filteredTasks = openTasks.filter((tk) =>
    tk.title.toLowerCase().includes(taskSearch.trim().toLowerCase())
  );

  const handlePickTask = (tk) => {
    setTask({ id: tk.id, title: tk.title });
    setTaskPickerOpen(false);
    setTaskSearch('');
  };

  const handleMarkTaskDone = async (tk) => {
    try {
      await api.put(`/tasks/${tk.id}`, { status: 'done' });
      toast.success(lang === 'ar' ? `أُنجزت "${tk.title}" ✅` : `Marked "${tk.title}" as done ✅`);
      setOpenTasks((list) => list.filter((x) => x.id !== tk.id));
      clearTask();
      setCongrats((c) => c ? { ...c, task: null } : c);
    } catch (err) { toast.error(err.message); }
  };

  const [equippedTree, setEquippedTree] = useState('seedling');
  useEffect(() => {
    api.get('/trees')
      .then((d) => setEquippedTree(d.equipped || 'seedling'))
      .catch(() => {});
  }, []);

  const [tab,       setTab]       = useState('timer');
  const [roomModal, setRoomModal] = useState(false);
  const [roomForm,  setRoomForm]  = useState({ tab: 'join', name: '', code: '', password: '' });
  const [forest,    setForest]    = useState(null);
  const [liveRoom,  setLiveRoom]  = useState(null);
  const lastTimerStartRef = useRef(null);
  const isRunningRef      = useRef(isRunning);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  const loadForest = () => api.get('/focus/forest').then(setForest).catch(() => {});
  useEffect(() => { if (tab === 'forest') loadForest(); }, [tab]);
  // died (tree-died confirmation) lives in FocusContext now — it fires
  // from both the Reset button and the pause-grace timeout, so refresh
  // the land here whenever either one lands a kill.
  useEffect(() => { if (died) loadForest(); }, [died]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!room) { setLiveRoom(null); return; }
    let active = true;
    const poll = async () => {
      try {
        const d = await api.get(`/focus/rooms/${room.code}`);
        if (!active) return;
        setLiveRoom(d);
        const tm = d.timer;
        if (tm?.running && tm.started_at && lastTimerStartRef.current !== tm.started_at) {
          lastTimerStartRef.current = tm.started_at;
          if (!isRunningRef.current && tm.remaining_seconds > 20) {
            const mins = Math.max(1, Math.round(tm.duration_seconds / 60));
            if (mode !== 'focus') handleModeClick('focus');
            setDuration(mins);
            setTimeout(() => { if (!isRunningRef.current) toggleTimer(); }, 150);
            toast.success(t('flow.hostStarted', { name: d.name, n: mins }));
          }
        }
      } catch (_) {}
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => { active = false; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  const displayRoom  = liveRoom ? { ...room, ...liveRoom } : room;
  const isHost       = displayRoom?.host_id != null && Number(displayRoom.host_id) === Number(user?.id);
  const sessionLive  = Boolean(displayRoom?.timer?.running); // blocks leaving while true

  const startForEveryone = async () => {
    if (!room) return;
    const mins = customMin.focus || 25;
    try {
      await api.post(`/focus/rooms/${room.code}/timer/start`, { duration_minutes: mins, mode: 'focus' });
      toast.success(t('flow.startedAll', { n: mins }));
      if (!isRunning) {
        if (mode !== 'focus') handleModeClick('focus');
        setDuration(mins);
        setTimeout(() => { if (!isRunningRef.current) toggleTimer(); }, 150);
      }
      setTab('timer');
    } catch (err) { toast.error(err.message); }
  };

  const stopForEveryone = async () => {
    try {
      const res = await api.post(`/focus/rooms/${room.code}/timer/stop`);
      toast.success(t('flow.timerStopped'));
      if (res.stoppedEarly) {
        toast.error(lang === 'ar' ? 'أنهيت الجلسة مبكرًا — ماتت الشجرة 💔' : "You ended the session early — the tree died 💔");
      }
    } catch (err) { toast.error(err.message); }
  };

  const handleRoomSubmit = async (e) => {
    e.preventDefault();
    try {
      if (roomForm.tab === 'create') {
        const res = await api.post('/focus/rooms', { name: roomForm.name, password: roomForm.password });
        setRoom({ code: res.code, name: res.name, members: [] });
        toast.success(t('flow.roomCreated', { code: res.code }));
      } else {
        const res = await api.post('/focus/rooms/join', { code: roomForm.code, password: roomForm.password });
        setRoom({ code: res.code, name: res.name, members: [] });
        toast.success(t('flow.joined', { name: res.name }));
      }
      // Membership isn't exclusive anymore — creating or joining a room
      // doesn't replace the others you already belong to, it just makes
      // this one active. Refresh the switcher list so it shows up there.
      loadMyRooms();
      setRoomModal(false);
      setRoomForm({ tab: 'join', name: '', code: '', password: '' });
      setTab('room');
    } catch (err) { toast.error(err.message); }
  };

  // Blocked server-side too — this just surfaces the exact reason.
  const handleLeaveRoom = async () => {
    if (!room) return;
    try {
      await leaveRoom();
      setLiveRoom(null);
      toast.success(t('flow.leftRoom'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const treeStatusLabel = () => {
    if (!roomTree) return null;
    if (roomTree.status === 'alive')
      return lang === 'ar' ? 'الشجرة المشتركة حيّة 🌳' : 'Shared tree is alive 🌳';
    if (roomTree.status === 'dead') {
      const isHostStop = roomTree.died_reason === 'host_stopped';
      if (isHostStop) return lang === 'ar' ? 'أنهى المضيف الجلسة مبكرًا — ماتت الشجرة 💔' : 'Host ended the session early — the tree died 💔';
      return lang === 'ar'
        ? `ماتت الشجرة — ${roomTree.died_by_name || 'أحد الأعضاء'} استسلم 💔`
        : `Tree died — ${roomTree.died_by_name || 'someone'} gave up 💔`;
    }
    if (roomTree.status === 'completed')
      return lang === 'ar' ? 'نجت الشجرة من الجلسة! 🌱' : 'Tree survived the session! 🌱';
    return null;
  };
  const treeStatusColor = () => {
    if (!roomTree) return modeColor;
    if (roomTree.status === 'dead') return '#FF7A63';
    if (roomTree.status === 'completed') return '#4CC38A';
    return modeColor;
  };

  const mm         = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss         = String(timeLeft % 60).padStart(2, '0');
  // Reset (and, since pausing now risks the tree too, staying paused)
  // both threaten the tree once a minute of real focus is logged —
  // this is no longer scoped to "only while running".
  const elapsedFocusMin = mode === 'focus' ? Math.floor((totalTime - timeLeft) / 60) : 0;
  const treeAtRisk      = mode === 'focus' && elapsedFocusMin >= 1;
  const progress   = totalTime > 0 ? (totalTime - timeLeft) / totalTime : 0;
  const dashOffset = CIRC * (1 - progress);
  const modeColor  = mode === 'focus' ? (ACCENT_HEX[accent] || ACCENT_HEX.purple) : MODES[mode].color;
  const now        = new Date();
  const endsAt     = new Date(now.getTime() + timeLeft * 1000);
  const timeRange  = startedAt
    ? `${fmtTime(startedAt)} → ${fmtTime(endsAt)}`
    : isRunning ? `→ ${fmtTime(endsAt)}` : null;

  const TABS_NAV = [
    { key: 'timer',       label: t('flow.timer'),                                icon: '⏱' },
    { key: 'room',        label: room ? `${t('flow.room')} · ${room.code}` : t('flow.room'), icon: '👥' },
    { key: 'forest',      label: t('flow.myLand'),                               icon: '🌳' },
    { key: 'leaderboard', label: t('flow.rankings'),                             icon: '🏆' },
  ];

  const memberList = displayRoom?.members || [];
  const todayStr = new Date().toLocaleDateString('en-CA');
  const todaysTrees = forest?.days.find((d) => d.date === todayStr)?.trees || [];

  return (
    <div>
      <PageHeader
        eyebrow={t('flow.eyebrow')}
        title={t('flow.title')}
        subtitle={t('flow.pageSubtitle')}
      />

      <div className="flex gap-1 mb-6 p-1 w-fit rounded-2xl flex-wrap" style={lg()}>
        {TABS_NAV.map(({ key, label, icon }) => (
          <motion.button
            key={key}
            onClick={() => setTab(key)}
            whileHover={tab !== key ? { y: -3, scale: 1.06, transition: { type: 'spring', stiffness: 500, damping: 22 } } : {}}
            whileTap={{ scale: 0.95 }}
            className="relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={tab === key ? {
              background: 'rgba(255,255,255,0.88)',
              boxShadow:  `0 8px 24px rgba(0,0,0,0.13), 0 2px 8px ${modeColor}2E, inset 0 1px 0 rgba(255,255,255,1)`,
              color:      '#1E2233',
            } : { color: 'rgba(255,255,255,0.45)' }}
          >
            {tab !== key && (
              <span className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                style={{ background: 'rgba(255,255,255,0.10)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }} />
            )}
            <span className="relative z-10">{icon}</span>
            <span className="relative z-10">{label}</span>
            {key === 'room' && room && (
              <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-sage-500 animate-pulse" />
            )}
          </motion.button>
        ))}
      </div>

      {tab === 'timer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col items-center py-10 px-8" style={cardGlass}>
            <div className="flex gap-2 mb-8 flex-wrap justify-center">
              {Object.entries(MODES).map(([key, m]) => (
                <motion.button key={key}
                  whileHover={{ y: -1, scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => handleModeClick(key)}
                  className="px-5 py-2 rounded-2xl text-sm font-semibold transition-all"
                  style={lg({ color: key === 'focus' ? modeColor : m.color, active: mode === key })}>
                  {m.emoji} {t(MODE_LABEL_KEYS[key])}
                </motion.button>
              ))}
            </div>

            <div className="h-5 mb-2">
              <AnimatePresence>
                {timeRange && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="text-sm font-mono font-medium" style={{ color: modeColor, direction: 'ltr' }}>
                    {timeRange}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="relative my-2">
              <svg width="280" height="280">
                {Array.from({ length: 60 }, (_, i) => {
                  const angle   = (i / 60) * 2 * Math.PI - Math.PI / 2;
                  const isMajor = i % 5 === 0;
                  const outerR  = 130;
                  const innerR  = isMajor ? 120 : 125;
                  const isPast  = (i / 60) <= progress && progress > 0;
                  return (
                    <line key={i}
                      x1={CX + innerR * Math.cos(angle)} y1={CY + innerR * Math.sin(angle)}
                      x2={CX + outerR * Math.cos(angle)} y2={CY + outerR * Math.sin(angle)}
                      stroke={isPast ? modeColor : 'rgb(var(--accent-500) / 0.10)'}
                      strokeWidth={isMajor ? 2.5 : 1.2} strokeLinecap="round"
                    />
                  );
                })}
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="5" />
                <circle cx={CX} cy={CY} r={R} fill="none"
                  stroke={modeColor} strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={CIRC} strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${CX} ${CY})`}
                  style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 6px ${modeColor}88)` }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
                <motion.div
                  key={equippedTree}
                  animate={isRunning
                    ? { y: [0, -5, 0], scale: [1, 1.05, 1] }
                    : { y: [0, -3, 0] }
                  }
                  transition={{ duration: isRunning ? 2 : 3.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="text-4xl mb-1 select-none"
                  style={{ filter: isRunning ? `drop-shadow(0 0 8px ${modeColor}88)` : 'none' }}
                >
                  {TREE_EMOJIS[equippedTree] || '🌱'}
                </motion.div>
                <span
                  className="font-display tabular-nums leading-none text-ink dark:text-white"
                  style={{ fontSize: 52, fontWeight: 700, direction: 'ltr' }}
                >
                  {mm}:{ss}
                </span>
                <span className="text-xs font-medium mt-1.5" style={{ color: modeColor }}>
                  {t(MODE_LABEL_KEYS[mode])}
                </span>
                {mode === 'focus' && xpFor(Math.round(totalTime / 60)) > 0 && (
                  <span className="text-[10px] font-bold mt-1" style={{ color: modeColor }}>
                    {t('flow.xpOnComplete', { n: xpFor(Math.round(totalTime / 60)) })}
                  </span>
                )}
                {dots > 0 && (
                  <div className="flex gap-1.5 mt-3">
                    {Array.from({ length: Math.min(dots, 8) }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: modeColor, boxShadow: `0 0 4px ${modeColor}` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <AnimatePresence>
              {treeAtRisk && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-[11px] mt-2 font-medium" style={{ color: 'rgba(255,122,99,0.75)' }}>
                  {isRunning ? t('flow.resetWarning') : t('flow.pauseGraceWarning')}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="w-full max-w-xs mt-4 mb-8">
              {taskId ? (
                <div className="flex items-center gap-2 rounded-2xl px-3.5 py-2" style={lg({ color: modeColor, active: true })}>
                  <Target size={13} style={{ color: modeColor }} className="shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-sm font-semibold text-ink dark:text-white">{taskName}</span>
                  <button type="button" onClick={clearTask} disabled={isRunning}
                    title={isRunning ? (lang === 'ar' ? 'لا يمكن الإلغاء أثناء العمل' : "Can't unlink while running") : (lang === 'ar' ? 'إلغاء الربط' : 'Unlink task')}
                    className="shrink-0 text-ink/35 dark:text-white/30 hover:text-coral-500 disabled:opacity-30 disabled:cursor-not-allowed transition">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 min-w-0 text-center text-sm font-medium bg-transparent outline-none pb-2 text-ink dark:text-white placeholder:text-ink/30 dark:placeholder:text-white/25"
                    style={{ borderBottom: `1px solid ${modeColor}33` }}
                    placeholder={t('flow.workingOn')}
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                  />
                  <motion.button type="button" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
                    onClick={() => setTaskPickerOpen(true)}
                    title={t('flow.pickTask')}
                    className="mb-2 shrink-0 flex h-8 w-8 items-center justify-center rounded-xl"
                    style={lg()}>
                    <Target size={14} style={{ color: modeColor }} />
                  </motion.button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-5">
              <motion.button whileHover={{ scale: 1.08, y: -1 }} whileTap={{ scale: 0.94 }}
                onClick={resetTimer}
                className="flex h-11 w-11 items-center justify-center rounded-2xl" style={lg()}>
                <RotateCcw size={16} className="text-ink/50 dark:text-white/40" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={toggleTimer}
                className="flex h-[76px] w-[76px] items-center justify-center rounded-full"
                style={{
                  background:           `linear-gradient(145deg, ${modeColor}DD 0%, ${modeColor}99 100%)`,
                  backdropFilter:       'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border:               '1.5px solid rgba(255,255,255,0.55)',
                  boxShadow:            `0 10px 36px ${modeColor}55, 0 4px 16px rgba(0,0,0,0.14), inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -2px 0 rgba(0,0,0,0.10)`,
                }}>
                {isRunning ? <Pause size={26} className="text-white" /> : <Play size={26} className="text-white ms-1 rtl:rotate-180" />}
              </motion.button>
              <motion.button whileHover={!isRunning ? { scale: 1.08, y: -1 } : {}} whileTap={!isRunning ? { scale: 0.94 } : {}}
                onClick={addMinute}
                disabled={isRunning}
                title={isRunning ? (lang === 'ar' ? 'لا يمكن الزيادة بعد البدء' : "Can't extend once started") : undefined}
                className="flex items-center gap-1 h-11 px-3.5 rounded-2xl text-xs font-bold disabled:opacity-35 disabled:cursor-not-allowed"
                style={{ ...lg(), color: muted(0.55) }}>
                <Plus size={12} /> 1m
              </motion.button>
            </div>

            <div className="mt-8 pt-6 w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.30)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-center mb-3"
                style={{ color: muted(0.30) }}>{t('flow.duration')}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {OPTIONS[mode].map((min) => (
                  <motion.button key={min}
                    whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}
                    onClick={() => setDuration(min)} disabled={isRunning}
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold transition disabled:opacity-40"
                    style={lg({ color: modeColor, active: customMin[mode] === min })}>
                    {min}m{mode === 'focus' && <span className="opacity-60"> · {xpFor(min)}xp</span>}
                  </motion.button>
                ))}
              </div>
              {mode === 'focus' && (
                <p className="text-[10px] text-center mt-3 font-medium" style={{ color: `${modeColor}A6` }}>
                  {t('flow.xpRate')}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {stats && (
              <div className="rounded-3xl p-5" style={lg()}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-4"
                  style={{ color: muted(0.38) }}>{t('flow.thisWeek')}</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: stats.total_minutes, label: t('flow.minutes') },
                    { val: stats.sessions, label: t('flow.sessions') },
                  ].map(({ val, label }) => (
                    <div key={label} className="rounded-2xl p-3 text-center" style={lg()}>
                      <p className="font-display text-2xl font-bold text-ink dark:text-white">{val}</p>
                      <p className="text-xs text-ink/45 dark:text-white/35 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl px-3 py-2 text-center"
                  style={{ background: `${modeColor}14`, border: `1px solid ${modeColor}26` }}>
                  <p className="text-xs font-bold" style={{ color: modeColor }}>
                    {t('flow.weeklyXp', { n: xpFor(stats.total_minutes) })}
                  </p>
                </div>
              </div>
            )}

            {room ? (
              <div className="rounded-3xl p-5" style={lg({ color: modeColor, active: true })}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-ink dark:text-white text-sm">{displayRoom.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: muted(0.45) }}>
                      {t('flow.code')}: <span className="font-mono font-bold tracking-[0.2em]" style={{ color: modeColor, direction: 'ltr', display: 'inline-block' }}>{displayRoom.code}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button type="button" onClick={() => setRoomModal(true)} title={t('flow.newOrJoinRoom')}
                      className="text-ink/30 dark:text-white/25 hover:text-ink/60 dark:hover:text-white/50 transition">
                      <Plus size={15} />
                    </button>
                    {sessionLive ? (
                      <div title={lang === 'ar' ? 'لا يمكن المغادرة أثناء الجلسة' : 'Cannot leave during a session'}
                        className="text-ink/20 dark:text-white/15 cursor-not-allowed">
                        <Lock size={14} />
                      </div>
                    ) : (
                      <button onClick={handleLeaveRoom} className="text-ink/30 dark:text-white/25 hover:text-coral-500 dark:hover:text-coral-400 transition">
                        <LogOut size={15} className="rtl:rotate-180" />
                      </button>
                    )}
                  </div>
                </div>

                {myRooms.length > 1 && (
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    {myRooms.map((r) => (
                      <button key={r.code} type="button" onClick={() => switchRoom(r.code)}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-semibold truncate max-w-[7rem] transition"
                        style={room.code === r.code ? lg({ color: modeColor, active: true }) : lg()}>
                        {r.isHost && '👑 '}{r.name}
                      </button>
                    ))}
                  </div>
                )}

                {roomTree && (
                  <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3"
                    style={{ background: `${treeStatusColor()}12`, border: `1px solid ${treeStatusColor()}28` }}>
                    <span className="text-lg shrink-0">
                      {roomTree.status === 'dead' ? DEAD_EMOJI : (TREE_EMOJIS[roomTree.tree_key] || '🌱')}
                    </span>
                    <span className="text-[11px] font-semibold leading-snug" style={{ color: treeStatusColor() }}>
                      {treeStatusLabel()}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  {memberList.slice(0, 4).map((m) => (
                    <div key={m.user_id} className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${m.is_focusing ? 'bg-sage-500 animate-pulse' : 'bg-ink/15 dark:bg-white/15'}`} />
                      <span className="text-xs text-ink/65 dark:text-white/55 flex-1 truncate">{m.display_name}</span>
                      <span className="text-xs text-ink/35 dark:text-white/30 shrink-0">{m.focus_minutes}m</span>
                    </div>
                  ))}
                </div>
                {isHost && !sessionLive && (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={startForEveryone}
                    className="mt-3 w-full rounded-2xl py-2.5 text-xs font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${modeColor} 0%, ${modeColor}AA 100%)`, boxShadow: `0 4px 14px ${modeColor}44` }}>
                    {t('flow.startForAll', { n: customMin.focus })}
                  </motion.button>
                )}
                {isHost && sessionLive && (
                  <button onClick={stopForEveryone}
                    className="mt-3 w-full rounded-2xl py-2.5 text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#FF7A63,#E85D50)', boxShadow: '0 4px 14px rgba(255,122,99,0.35)' }}>
                    {t('flow.stop')}
                  </button>
                )}
                <button onClick={() => setTab('room')} className="mt-3 text-xs font-semibold hover:underline"
                  style={{ color: modeColor }}>
                  {t('flow.viewRoom')}
                </button>
              </div>
            ) : (
              <motion.button whileHover={{ y: -1 }} onClick={() => setRoomModal(true)}
                className="rounded-3xl p-5 text-start w-full" style={lg()}>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="text-lg">👥</span>
                  <p className="font-semibold text-ink dark:text-white text-sm">{t('flow.studyRoom')}</p>
                </div>
                <p className="text-xs text-ink/45 dark:text-white/35">{t('flow.studyRoomDesc')}</p>
              </motion.button>
            )}

            {board.length > 0 && (
              <div className="rounded-3xl p-5" style={lg()}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
                  style={{ color: muted(0.38) }}>🏆 {t('flow.rankings')}</p>
                {board.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex items-center gap-2 py-1.5">
                    <span className="text-sm w-5 text-center">{['🥇','🥈','🥉'][e.rank - 1]}</span>
                    <span className="flex-1 text-sm text-ink dark:text-white truncate">{e.name}</span>
                    <span className="text-xs text-ink/40 dark:text-white/30 shrink-0">{e.total_minutes}m</span>
                  </div>
                ))}
                <button onClick={() => setTab('leaderboard')}
                  className="mt-2 text-xs font-semibold hover:underline" style={{ color: modeColor }}>
                  {t('flow.viewRoom').replace('room', 'rankings')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'room' && (
        <div className="max-w-2xl">
          {myRooms.length > 1 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest me-1" style={{ color: muted(0.35) }}>
                {t('flow.myRooms')}
              </span>
              {myRooms.map((r) => (
                <button key={r.code} type="button" onClick={() => switchRoom(r.code)}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold truncate max-w-[10rem] transition"
                  style={room?.code === r.code ? lg({ color: modeColor, active: true }) : lg()}>
                  {r.isHost && '👑 '}{r.name}
                </button>
              ))}
              <button type="button" onClick={() => setRoomModal(true)}
                className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold" style={lg()}>
                <Plus size={12} /> {t('flow.newRoom')}
              </button>
            </div>
          )}

          {room ? (
            <div className="rounded-3xl p-7" style={cardGlass}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="font-display font-bold text-ink dark:text-white text-xl">{displayRoom.name}</h2>
                  <p className="text-sm mt-0.5" style={{ color: muted(0.45) }}>
                    {t('flow.shareCode')}: <span className="font-mono font-bold tracking-[0.2em]" style={{ color: modeColor, direction: 'ltr', display: 'inline-block' }}>{displayRoom.code}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => setRoomModal(true)} title={t('flow.newOrJoinRoom')}
                    className="flex items-center gap-2 text-sm font-semibold rounded-2xl px-3.5 py-2 text-ink dark:text-white" style={lg()}>
                    <Plus size={14} />
                  </button>
                  {sessionLive ? (
                    <div className="flex items-center gap-2 text-sm font-semibold rounded-2xl px-4 py-2 text-ink/30 dark:text-white/25 cursor-not-allowed" style={lg()}
                      title={lang === 'ar' ? 'لا يمكن المغادرة أثناء الجلسة — انتظر أن يوقفها المضيف' : 'Cannot leave while a session is running — wait for the host to stop it'}>
                      <Lock size={14} /> {t('flow.leave')}
                    </div>
                  ) : (
                    <button onClick={handleLeaveRoom}
                      className="flex items-center gap-2 text-sm font-semibold rounded-2xl px-4 py-2 text-ink dark:text-white" style={lg()}>
                      <LogOut size={14} className="rtl:rotate-180" /> {t('flow.leave')}
                    </button>
                  )}
                </div>
              </div>

              {roomTree && (
                <div className="flex items-center gap-2.5 rounded-2xl px-5 py-3 mb-4"
                  style={{ background: `${treeStatusColor()}12`, border: `1px solid ${treeStatusColor()}28` }}>
                  <span className="text-xl shrink-0">
                    {roomTree.status === 'dead' ? DEAD_EMOJI : (TREE_EMOJIS[roomTree.tree_key] || '🌱')}
                  </span>
                  <span className="text-xs font-semibold leading-snug" style={{ color: treeStatusColor() }}>
                    {treeStatusLabel()}
                  </span>
                </div>
              )}

              <div className="rounded-2xl px-5 py-4 mb-5" style={lg({ color: modeColor, active: true })}>
                {displayRoom.timer?.running ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-ink dark:text-white">{t('flow.syncedLive')}</p>
                      <p className="text-xs mt-0.5" style={{ color: muted(0.50) }}>
                        {t('flow.remaining', { n: Math.ceil((displayRoom.timer.remaining_seconds || 0) / 60) })}
                      </p>
                    </div>
                    {isHost && (
                      <button onClick={stopForEveryone}
                        className="text-xs font-bold shrink-0 rounded-xl px-3 py-2 text-ink dark:text-white" style={lg()}>
                        {t('flow.stop')}
                      </button>
                    )}
                  </div>
                ) : isHost ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-ink dark:text-white">{t('flow.youAreHost')}</p>
                      <p className="text-xs mt-0.5" style={{ color: muted(0.50) }}>{t('flow.hostDesc')}</p>
                    </div>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                      onClick={startForEveryone}
                      className="shrink-0 rounded-2xl px-4 py-2.5 text-xs font-bold text-white"
                      style={{ background: `linear-gradient(135deg, ${modeColor} 0%, ${modeColor}AA 100%)`, boxShadow: `0 4px 14px ${modeColor}44` }}>
                      {t('flow.startForAll', { n: customMin.focus })}
                    </motion.button>
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: muted(0.50) }}>{t('flow.waitingHost')}</p>
                )}
              </div>

              {memberList.length === 0 ? (
                <p className="text-sm text-ink/40 dark:text-white/30 text-center py-8">{t('flow.waiting')}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {memberList.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={lg()}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-xs font-bold shrink-0"
                        style={{ background: `linear-gradient(135deg, ${modeColor} 0%, ${modeColor}88 100%)` }}>
                        {m.display_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink dark:text-white truncate">
                          {m.display_name}
                          {Number(displayRoom.host_id) === Number(m.user_id) && ' 👑'}
                        </p>
                        <p className="text-xs text-ink/40 dark:text-white/30">{m.focus_minutes} {t('flow.minFocusedSub')}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${m.is_focusing ? 'bg-sage-500 animate-pulse' : 'bg-ink/15 dark:bg-white/15'}`} />
                        <span className={`text-xs font-medium ${m.is_focusing ? 'text-sage-600 dark:text-sage-400' : 'text-ink/35 dark:text-white/30'}`}>
                          {m.is_focusing ? t('flow.focusing') : t('flow.break')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              illustration={<span className="text-6xl">👥</span>}
              title={t('flow.studyRoom')}
              description={t('flow.studyRoomDesc')}
              action={
                <button className="btn-primary w-full justify-center" onClick={() => setRoomModal(true)}>
                  <Plus size={16} /> {t('flow.createRoom')}
                </button>
              }
            />
          )}
        </div>
      )}

      {tab === 'forest' && (
        <div className="max-w-3xl">
          {!forest ? null : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { val: forest.stats.total_alive,   label: t('flow.treesAlive'),   icon: '🌳' },
                  { val: forest.stats.total_dead,    label: t('flow.treesDied'),    icon: '🥀' },
                  { val: forest.stats.today_planted, label: t('flow.plantedToday'), icon: '☀️' },
                  { val: `${Math.round(forest.stats.total_minutes / 60 * 10) / 10}h`, label: t('flow.totalFocus'), icon: '⏱' },
                ].map(({ val, label, icon }) => (
                  <div key={label} className="rounded-2xl p-4 text-center" style={lg()}>
                    <p className="text-xl mb-1">{icon}</p>
                    <p className="font-display text-xl font-bold text-ink dark:text-white">{val}</p>
                    <p className="text-[11px] text-ink/40 dark:text-white/35">{label}</p>
                  </div>
                ))}
              </div>

              <LandPlot trees={todaysTrees} t={t} />

              {forest.days.length === 0 ? (
                <EmptyState
                  illustration={<span className="text-6xl">🌳</span>}
                  title={t('flow.landEmptyTitle')}
                  description={t('flow.landEmptyDesc')}
                  action={
                    <button className="btn-primary w-full justify-center" onClick={() => setTab('timer')}>
                      {t('flow.plantFirst')}
                    </button>
                  }
                />
              ) : (
                forest.days.map((day) => (
                  <div key={day.date} className="rounded-3xl p-5" style={lg()}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-ink dark:text-white">{fmtForestDay(day.date)}</p>
                      <p className="text-[11px] text-ink/35 dark:text-white/30">
                        {day.trees.filter(tr => tr.status === 'alive').length} 🌳 · {day.trees.filter(tr => tr.status === 'dead').length} 🥀
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {day.trees.map((tr, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 18 }}
                          className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                          title={`${tr.task_name || 'Focus'} · ${tr.duration_minutes}m`}
                          style={tr.status === 'dead'
                            ? { background: 'rgba(255,122,99,0.08)', border: '1px solid rgba(255,122,99,0.18)', filter: 'grayscale(0.4)' }
                            : { background: 'rgba(76,195,138,0.10)', border: '1px solid rgba(76,195,138,0.20)' }}
                        >
                          {tr.status === 'dead' ? DEAD_EMOJI : (TREE_EMOJIS[tr.tree_key] || '🌳')}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="max-w-2xl">
          {board.length === 0 ? (
            <EmptyState
              illustration={<span className="text-6xl">🏆</span>}
              title={t('flow.weeklyRank')}
              description={t('flow.totalWeekMin')}
              action={
                <button className="btn-primary w-full justify-center" onClick={() => setTab('timer')}>
                  {t('flow.plantFirst')}
                </button>
              }
            />
          ) : (
            <div className="rounded-3xl p-7" style={cardGlass}>
              <div className="flex items-start justify-between mb-1">
                <h2 className="font-display font-bold text-ink dark:text-white">{t('flow.weeklyRank')}</h2>
                <span className="text-xs text-ink/35 dark:text-white/30">{t('flow.resetsSunday')}</span>
              </div>
              <p className="text-xs text-ink/40 dark:text-white/30 mb-6">{t('flow.totalWeekMin')}</p>
              <div className="flex flex-col gap-2">
                {board.map((e) => {
                  const isMe   = e.id == user?.id;
                  const medals = ['🥇','🥈','🥉'];
                  const hrs    = Math.floor(e.total_minutes / 60);
                  const mins   = e.total_minutes % 60;
                  return (
                    <div key={e.id} className="flex items-center gap-3 rounded-2xl px-4 py-3"
                      style={isMe ? lg({ color: modeColor, active: true }) : lg()}>
                      <span className="text-xl w-8 text-center shrink-0">
                        {e.rank <= 3 ? medals[e.rank - 1] : <span className="text-sm font-bold text-ink/30 dark:text-white/25">{e.rank}</span>}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isMe ? 'text-lavender-700 dark:text-lavender-300' : 'text-ink dark:text-white'}`}>
                          {e.name}{isMe ? t('flow.you') : ''}
                        </p>
                        <p className="text-xs text-ink/35 dark:text-white/30">{t('flow.sessionsCount', { n: e.session_count })}</p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className={`text-sm font-bold ${isMe ? 'text-lavender-600' : 'text-ink dark:text-white'}`}>{e.total_minutes}m</p>
                        <p className="text-xs text-ink/30 dark:text-white/25">{hrs > 0 ? `${hrs}h ` : ''}{mins}m</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={roomModal} onClose={() => setRoomModal(false)} title={t('flow.studyRoom')}>
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={lg()}>
          {[{ key: 'join', label: t('flow.joinRoom') }, { key: 'create', label: t('flow.createRoom') }].map(({ key, label }) => (
            <button key={key} onClick={() => setRoomForm({ ...roomForm, tab: key })}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition"
              style={roomForm.tab === key
                ? { background: 'rgba(255,255,255,0.85)', boxShadow: '0 2px 10px rgba(0,0,0,0.09)', color: '#1E2233' }
                : { color: muted(0.45) }}>
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={handleRoomSubmit} className="flex flex-col gap-3.5">
          {roomForm.tab === 'create' && (
            <input className="input-field" placeholder={t('flow.roomNamePh')}
              value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} autoFocus required />
          )}
          {roomForm.tab === 'join' && (
            <input className="input-field font-mono tracking-[0.3em] text-center uppercase"
              placeholder={t('flow.roomCode')} maxLength={6} dir="ltr"
              value={roomForm.code} onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value.toUpperCase() })} autoFocus required />
          )}
          <input type="password" className="input-field" placeholder={t('flow.password')}
            value={roomForm.password} onChange={(e) => setRoomForm({ ...roomForm, password: e.target.value })} required />
          <button type="submit" className="btn-primary justify-center">
            {roomForm.tab === 'join' ? t('flow.joinRoom') : t('flow.createRoom')}
          </button>
        </form>
      </Modal>

      <Modal open={taskPickerOpen} onClose={() => setTaskPickerOpen(false)} title={t('flow.pickTask')}>
        <div className="relative mb-4">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 left-3.5 rtl:left-auto rtl:right-3.5 text-ink/30 dark:text-white/30" />
          <input
            autoFocus
            className="input-field ps-9"
            placeholder={t('flow.searchTasks')}
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
          />
        </div>
        {filteredTasks.length === 0 ? (
          <p className="text-sm text-center py-8 text-ink/40 dark:text-white/30">
            {openTasks.length === 0 ? t('flow.noOpenTasks') : t('flow.noTasksMatch')}
          </p>
        ) : (
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {filteredTasks.map((tk) => (
              <button key={tk.id} type="button" onClick={() => handlePickTask(tk)}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-start hover:bg-ink/5 dark:hover:bg-white/5 transition" style={lg()}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink dark:text-white truncate">{tk.title}</p>
                  {Number(tk.time_spent_minutes) > 0 && (
                    <p className="text-xs text-ink/40 dark:text-white/30 mt-0.5">
                      {t('flow.timeSpentSoFar', { n: Number(tk.time_spent_minutes) })}
                    </p>
                  )}
                </div>
                <PriorityPill priority={tk.priority} />
              </button>
            ))}
          </div>
        )}
      </Modal>

      <AnimatePresence>
        {congrats && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center px-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(30,34,51,0.25)' }}
            onClick={() => setCongrats(null)}>
            <motion.div
              initial={{ scale: 0.82, y: 32 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 20 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="w-full max-w-md p-8 text-center rounded-3xl" style={cardGlass}
              onClick={(e) => e.stopPropagation()}>
              <motion.div
                animate={{ y: [0, -8, 0], rotate: [0, -5, 5, -3, 0] }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="text-6xl mb-4">🎉</motion.div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <motion.span animate={{ rotate: [-10, 10, -10] }} transition={{ duration: 0.5, repeat: 2 }} className="text-3xl">
                  {TREE_EMOJIS[equippedTree] || '🌱'}
                </motion.span>
                <h2 className="font-display text-2xl font-bold text-ink dark:text-white">{t('flow.complete')}</h2>
                <motion.span animate={{ rotate: [10, -10, 10] }} transition={{ duration: 0.5, repeat: 2 }} className="text-3xl">
                  {TREE_EMOJIS[equippedTree] || '🌱'}
                </motion.span>
              </div>
              <p className="text-ink/50 dark:text-white/40 mb-1">{t('flow.minFocused', { n: congrats.minutes })}</p>
              <p className="text-xs text-sage-600 dark:text-sage-400 font-semibold mb-3">🌳 {t('flow.treePlanted')}</p>
              {congrats.xpAwarded > 0 && (
                <span className="inline-block rounded-full px-3 py-1 text-sm font-bold mb-4"
                  style={lg({ color: modeColor, active: true })}>
                  ✨ +{congrats.xpAwarded} XP
                </span>
              )}
              {congrats.task && (
                <div className="rounded-2xl px-5 py-4 mb-4 text-start flex items-center gap-3" style={lg({ color: modeColor, active: true })}>
                  <Target size={16} style={{ color: modeColor }} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink dark:text-white truncate">{congrats.task.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: muted(0.45) }}>
                      {t('flow.timeSpentSoFar', { n: congrats.task.time_spent_minutes })}
                    </p>
                  </div>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={() => handleMarkTaskDone(congrats.task)}
                    className="shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#4CC38A,#2FA36B)', boxShadow: '0 4px 14px rgba(76,195,138,0.35)' }}>
                    <CheckCircle2 size={13} /> {t('flow.markDone')}
                  </motion.button>
                </div>
              )}
              <div className="rounded-2xl px-5 py-4 mb-6 text-start" style={lg()}>
                <p className="text-sm font-medium text-ink dark:text-white italic leading-relaxed">"{congrats.quote.text}"</p>
                <p className="text-xs text-ink/40 dark:text-white/30 mt-2">— {congrats.quote.author}</p>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => setCongrats(null)} className="btn-primary w-full justify-center text-base">
                {t('flow.keepGoing')}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {died && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center px-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(30,34,51,0.25)' }}
            onClick={() => setDied(null)}>
            <motion.div
              initial={{ scale: 0.82, y: 32 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 20 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="w-full max-w-md p-8 text-center rounded-3xl" style={cardGlass}
              onClick={(e) => e.stopPropagation()}>
              <motion.div
                animate={{ rotate: [0, -6, 6, -3, 0], y: [0, 3, 0] }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="text-6xl mb-4">{DEAD_EMOJI}</motion.div>
              <h2 className="font-display text-2xl font-bold text-ink dark:text-white mb-1">{t('flow.treeDiedTitle')}</h2>
              <p className="text-ink/50 dark:text-white/40 mb-4">{t('flow.diedAfterMin', { n: died.minutes })}</p>
              <div className="rounded-2xl px-5 py-4 mb-6 text-start"
                style={{ background: 'rgba(255,122,99,0.10)', border: '1px solid rgba(255,122,99,0.22)' }}>
                <p className="text-sm font-medium text-ink dark:text-white leading-relaxed">
                  {died.reason === 'pause' ? t('flow.diedFromPause') : t('flow.treeDied')}
                </p>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => setDied(null)}
                className="w-full justify-center text-base rounded-2xl py-3 font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#FF7A63,#E85D50)', boxShadow: '0 6px 20px rgba(255,122,99,0.35)' }}>
                {t('flow.tryAgain')}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}