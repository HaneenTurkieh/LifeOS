import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, RotateCcw, Coffee, Brain,
  Users, Trophy, Plus, LogOut, Timer,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import GlassCard  from '../components/GlassCard.jsx';
import Modal      from '../components/Modal.jsx';

// ── Quotes ────────────────────────────────────────────────────
const QUOTES = [
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Focus is the art of knowing what to ignore.', author: 'Unknown' },
  { text: 'Deep work is the ability to focus without distraction on a cognitively demanding task.', author: 'Cal Newport' },
  { text: 'Where focus goes, energy flows.', author: 'Tony Robbins' },
  { text: 'The successful warrior is the average person with laser-like focus.', author: 'Bruce Lee' },
  { text: "It's not that I'm so smart, it's just that I stay with problems longer.", author: 'Einstein' },
  { text: 'Productivity is never an accident. It is always the result of a commitment to excellence.', author: 'Paul J. Meyer' },
  { text: "Done is better than perfect.", author: 'Sheryl Sandberg' },
  { text: 'Small progress is still progress.', author: 'Unknown' },
  { text: 'Every moment of focused work is an investment in your future.', author: 'Unknown' },
  { text: 'Concentration is the root of all the higher abilities in man.', author: 'Bruce Lee' },
  { text: 'You don\'t need more time. You need more focus.', author: 'Unknown' },
  { text: 'The quality of your work is determined by the quality of your attention.', author: 'Unknown' },
  { text: 'One hour of focused work beats eight hours of distracted effort.', author: 'Unknown' },
  { text: 'Your future is created by what you do today, not tomorrow.', author: 'Robert Kiyosaki' },
];

// ── Timer config ──────────────────────────────────────────────
const MODES = {
  focus: { label: 'Focus',       color: '#7C6AF0', defaultMin: 25 },
  short: { label: 'Short Break', color: '#4CC38A', defaultMin: 5  },
  long:  { label: 'Long Break',  color: '#60A5FA', defaultMin: 15 },
};
const OPTIONS = { focus: [15,25,30,45,50,60,90], short: [5,10], long: [15,20,30] };

// ── Audio ─────────────────────────────────────────────────────
function playDone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      const t = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.28, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t); osc.stop(t + 0.4);
    });
  } catch (_) {}
}

function playBreakEnd() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.value = 440; osc.type = 'sine';
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
  } catch (_) {}
}

const randQuote = () => QUOTES[Math.floor(Math.random() * QUOTES.length)];

// ── Component ─────────────────────────────────────────────────
export default function Focus() {
  const toast      = useToast();
  const { user }   = useAuth();

  // Timer
  const [mode,       setMode]       = useState('focus');
  const [customMin,  setCustomMin]  = useState({ focus: 25, short: 5, long: 15 });
  const [timeLeft,   setTimeLeft]   = useState(25 * 60);
  const [totalTime,  setTotalTime]  = useState(25 * 60);
  const [isRunning,  setIsRunning]  = useState(false);
  const [taskName,   setTaskName]   = useState('');
  const [dots,       setDots]       = useState(0); // completed focus sessions

  // Congrats overlay
  const [congrats,   setCongrats]   = useState(null);

  // Data
  const [stats,      setStats]      = useState(null);
  const [board,      setBoard]      = useState([]);

  // Room
  const [room,       setRoom]       = useState(null);
  const [roomModal,  setRoomModal]  = useState(false);
  const [roomForm,   setRoomForm]   = useState({ tab: 'join', name: '', code: '', password: '' });

  // Tab
  const [tab, setTab] = useState('timer');

  // Refs to avoid stale closures in timer
  const intervalRef  = useRef(null);
  const modeRef      = useRef(mode);
  const customMinRef = useRef(customMin);
  const taskNameRef  = useRef(taskName);
  const roomRef      = useRef(room);
  useEffect(() => { modeRef.current      = mode;      }, [mode]);
  useEffect(() => { customMinRef.current = customMin; }, [customMin]);
  useEffect(() => { taskNameRef.current  = taskName;  }, [taskName]);
  useEffect(() => { roomRef.current      = room;      }, [room]);

  // ── Load stats + leaderboard ──────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([api.get('/focus/stats'), api.get('/focus/leaderboard')]);
      setStats(s);
      setBoard(l.leaderboard || []);
    } catch (_) {}
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  // ── Room polling every 5s ─────────────────────────────────
  useEffect(() => {
    if (!room) return;
    const poll = async () => {
      try {
        const data = await api.get(`/focus/rooms/${room.code}`);
        setRoom((r) => r ? { ...r, members: data.members } : null);
      } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [room?.code]); // eslint-disable-line

  // ── Room pulse every 30s ──────────────────────────────────
  useEffect(() => {
    if (!room) return;
    const pulse = () => {
      api.post(`/focus/rooms/${room.code}/pulse`, { is_focusing: isRunning }).catch(() => {});
    };
    pulse();
    const id = setInterval(pulse, 30000);
    return () => clearInterval(id);
  }, [room?.code, isRunning]); // eslint-disable-line

  // ── Completion handler (uses refs) ────────────────────────
  const handleComplete = useCallback(async () => {
    const currentMode    = modeRef.current;
    const currentMin     = customMinRef.current;
    const currentTask    = taskNameRef.current;
    const currentRoom    = roomRef.current;

    if (currentMode === 'focus') {
      const minutes = currentMin.focus;
      playDone();
      const quote = randQuote();
      try {
        const res = await api.post('/focus/sessions', {
          task_name:        currentTask.trim() || 'Focus Session',
          duration_minutes: minutes,
        });
        if (currentRoom) {
          api.post(`/focus/rooms/${currentRoom.code}/pulse`, { is_focusing: false, add_minutes: minutes }).catch(() => {});
        }
        setCongrats({ quote, xpAwarded: res.xpAwarded || 0, minutes });
        setDots((d) => d + 1);
        loadData();
      } catch (_) {
        setCongrats({ quote, xpAwarded: 0, minutes });
      }
    } else {
      playBreakEnd();
      // Auto-switch back to focus
      const mins = customMinRef.current.focus;
      setMode('focus');
      setTimeLeft(mins * 60);
      setTotalTime(mins * 60);
    }
  }, [loadData]);

  // ── Timer tick ────────────────────────────────────────────
  useEffect(() => {
    if (!isRunning) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setIsRunning(false);
          setTimeout(handleComplete, 50); // after state settles
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isRunning, handleComplete]);

  // ── Timer controls ────────────────────────────────────────
  const switchMode = (newMode) => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setMode(newMode);
    const mins = customMin[newMode];
    setTimeLeft(mins * 60);
    setTotalTime(mins * 60);
  };

  const handleModeClick = (newMode) => {
    if (isRunning && !window.confirm('Switch mode? Current session will be lost.')) return;
    switchMode(newMode);
  };

  const setDuration = (mins) => {
    setCustomMin((c) => ({ ...c, [mode]: mins }));
    if (!isRunning) { setTimeLeft(mins * 60); setTotalTime(mins * 60); }
  };

  const toggleTimer = () => { if (timeLeft > 0) setIsRunning((r) => !r); };

  const resetTimer = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    const mins = customMin[mode];
    setTimeLeft(mins * 60); setTotalTime(mins * 60);
  };

  // ── Room handlers ─────────────────────────────────────────
  const handleRoomSubmit = async (e) => {
    e.preventDefault();
    try {
      if (roomForm.tab === 'create') {
        const res = await api.post('/focus/rooms', { name: roomForm.name, password: roomForm.password });
        setRoom({ code: res.code, name: res.name, members: [] });
        toast.success(`Room created! Code: ${res.code}`);
      } else {
        const res = await api.post('/focus/rooms/join', { code: roomForm.code, password: roomForm.password });
        setRoom({ code: res.code, name: res.name, members: [] });
        toast.success(`Joined ${res.name}`);
      }
      setRoomModal(false);
      setRoomForm({ tab: 'join', name: '', code: '', password: '' });
      setTab('timer');
    } catch (err) { toast.error(err.message); }
  };

  const leaveRoom = async () => {
    if (!room) return;
    try { await api.del(`/focus/rooms/${room.code}/leave`); } catch (_) {}
    setRoom(null);
    toast.success('Left the room');
  };

  // ── Derived display ───────────────────────────────────────
  const mm           = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss           = String(timeLeft % 60).padStart(2, '0');
  const progress     = totalTime > 0 ? (totalTime - timeLeft) / totalTime : 0;
  const R            = 110;
  const circumference = 2 * Math.PI * R;
  const dashOffset   = circumference * (1 - progress);
  const modeColor    = MODES[mode].color;

  const TABS_NAV = [
    { key: 'timer',       label: 'Timer',                              icon: Timer  },
    { key: 'room',        label: room ? `Room · ${room.code}` : 'Room', icon: Users  },
    { key: 'leaderboard', label: 'Leaderboard',                        icon: Trophy },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Focus"
        title="Deep work, done right"
        subtitle="Pomodoro timer · Study rooms · Weekly leaderboard."
      />

      {/* Top tab bar */}
      <div className="flex gap-1 mb-6 bg-white/40 dark:bg-white/[0.04] rounded-2xl p-1 w-fit">
        {TABS_NAV.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === key
                ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-sm'
                : 'text-ink/50 dark:text-white/40 hover:text-ink/80 dark:hover:text-white/60'
            }`}>
            <Icon size={14} /> {label}
            {key === 'room' && room && <span className="h-1.5 w-1.5 rounded-full bg-sage-500 animate-pulse" />}
          </button>
        ))}
      </div>

      {/* ── TIMER TAB ─────────────────────────────────────── */}
      {tab === 'timer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main timer card */}
          <GlassCard className="lg:col-span-2 p-8 flex flex-col items-center">

            {/* Mode pills */}
            <div className="flex gap-2 mb-8 flex-wrap justify-center">
              {Object.entries(MODES).map(([key, m]) => (
                <button key={key} onClick={() => handleModeClick(key)}
                  className={`px-5 py-2 rounded-2xl text-sm font-semibold transition-all ${
                    mode === key ? 'text-white' : 'bg-white/60 dark:bg-white/[0.06] text-ink/50 dark:text-white/40 hover:bg-white/80 dark:hover:bg-white/10'
                  }`}
                  style={mode === key ? { backgroundColor: modeColor, boxShadow: `0 4px 16px ${modeColor}55` } : {}}>
                  {m.label}
                </button>
              ))}
            </div>

            {/* SVG ring timer */}
            <div className="relative flex items-center justify-center mb-8">
              <svg width="264" height="264">
                <circle cx="132" cy="132" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
                <circle cx="132" cy="132" r={R} fill="none"
                  stroke={modeColor} strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={dashOffset}
                  transform="rotate(-90 132 132)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center select-none">
                <span className="font-display text-6xl font-bold text-ink dark:text-white tabular-nums">
                  {mm}:{ss}
                </span>
                <span className="text-sm text-ink/45 dark:text-white/40 mt-1">{MODES[mode].label}</span>
                {dots > 0 && (
                  <div className="flex gap-1.5 mt-3 flex-wrap justify-center max-w-[120px]">
                    {Array.from({ length: Math.min(dots, 8) }).map((_, i) => (
                      <div key={i} className="h-2 w-2 rounded-full" style={{ backgroundColor: modeColor }} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Task name */}
            <input
              className="input-field text-center mb-6 max-w-sm"
              placeholder="What are you working on?"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
            />

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button onClick={resetTimer}
                className="btn-secondary !w-11 !h-11 !p-0 flex items-center justify-center rounded-2xl">
                <RotateCcw size={16} />
              </button>
              <button onClick={toggleTimer}
                className="flex items-center gap-2 rounded-2xl px-10 py-3.5 text-base font-bold text-white transition-all hover:brightness-110 active:scale-[0.97]"
                style={{ backgroundColor: modeColor, boxShadow: `0 8px 24px ${modeColor}44` }}>
                {isRunning ? <Pause size={21} /> : <Play size={21} />}
                {isRunning ? 'Pause' : 'Start'}
              </button>
            </div>

            {/* Duration picker */}
            <div className="mt-8 w-full border-t border-white/30 dark:border-white/10 pt-5">
              <p className="text-xs font-semibold text-ink/40 dark:text-white/30 uppercase tracking-widest mb-3">
                Duration
              </p>
              <div className="flex flex-wrap gap-2">
                {OPTIONS[mode].map((min) => (
                  <button key={min} onClick={() => setDuration(min)} disabled={isRunning}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition disabled:opacity-40 ${
                      customMin[mode] === min
                        ? 'text-white'
                        : 'bg-white/60 dark:bg-white/[0.05] text-ink/50 dark:text-white/40 hover:bg-white dark:hover:bg-white/10'
                    }`}
                    style={customMin[mode] === min ? { backgroundColor: modeColor } : {}}>
                    {min} min
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>

          {/* Side panel */}
          <div className="flex flex-col gap-4">

            {/* Weekly stats */}
            {stats && (
              <GlassCard className="p-5">
                <p className="text-xs font-semibold text-ink/45 dark:text-white/35 uppercase tracking-wider mb-3">This Week</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: stats.total_minutes, label: 'minutes' },
                    { val: stats.sessions,      label: 'sessions' },
                  ].map(({ val, label }) => (
                    <div key={label} className="rounded-2xl bg-white/50 dark:bg-white/[0.04] p-3 text-center">
                      <p className="font-display text-2xl font-bold text-ink dark:text-white">{val}</p>
                      <p className="text-xs text-ink/45 dark:text-white/35">{label}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Room quick card */}
            {room ? (
              <GlassCard className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-ink dark:text-white text-sm">{room.name}</p>
                    <p className="text-xs text-ink/45 dark:text-white/35 mt-0.5">
                      Code: <span className="font-mono font-bold tracking-widest text-lavender-600 dark:text-lavender-300">{room.code}</span>
                    </p>
                  </div>
                  <button onClick={leaveRoom} className="text-ink/30 hover:text-coral-500 transition"><LogOut size={15} /></button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {room.members?.slice(0, 4).map((m) => (
                    <div key={m.user_id} className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${m.is_focusing ? 'bg-sage-500 animate-pulse' : 'bg-ink/15 dark:bg-white/15'}`} />
                      <span className="text-xs text-ink/70 dark:text-white/60 flex-1 truncate">{m.display_name}</span>
                      <span className="text-xs text-ink/40 dark:text-white/30 shrink-0">{m.focus_minutes}m</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setTab('room')} className="mt-3 text-xs font-semibold text-lavender-600 dark:text-lavender-300 hover:underline">
                  View room →
                </button>
              </GlassCard>
            ) : (
              <button onClick={() => setRoomModal(true)}
                className="glass-card p-5 text-left hover:bg-white/70 dark:hover:bg-white/[0.07] transition cursor-pointer rounded-3xl w-full">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <Users size={17} className="text-lavender-500" />
                  <p className="font-semibold text-ink dark:text-white text-sm">Study Room</p>
                </div>
                <p className="text-xs text-ink/45 dark:text-white/35">Focus with friends. Shared leaderboard inside.</p>
              </button>
            )}

            {/* Top 3 */}
            {board.length > 0 && (
              <GlassCard className="p-5">
                <p className="text-xs font-semibold text-ink/45 dark:text-white/35 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Trophy size={12} /> Top this week
                </p>
                {board.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex items-center gap-2 py-1.5">
                    <span className="text-sm w-5 text-center">{['🥇','🥈','🥉'][e.rank - 1]}</span>
                    <span className="flex-1 text-sm text-ink dark:text-white truncate">{e.name}</span>
                    <span className="text-xs text-ink/45 dark:text-white/35 shrink-0">{e.total_minutes}m</span>
                  </div>
                ))}
                <button onClick={() => setTab('leaderboard')} className="mt-2 text-xs font-semibold text-lavender-600 dark:text-lavender-300 hover:underline">
                  Full leaderboard →
                </button>
              </GlassCard>
            )}
          </div>
        </div>
      )}

      {/* ── ROOM TAB ──────────────────────────────────────── */}
      {tab === 'room' && (
        <div className="max-w-2xl">
          {room ? (
            <GlassCard className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="font-display font-bold text-ink dark:text-white text-xl">{room.name}</h2>
                  <p className="text-sm text-ink/50 dark:text-white/40 mt-0.5">
                    Share code:{' '}
                    <span className="font-mono font-bold tracking-widest text-lavender-600 dark:text-lavender-300">{room.code}</span>
                  </p>
                </div>
                <button onClick={leaveRoom} className="btn-secondary flex items-center gap-2 text-sm">
                  <LogOut size={14} /> Leave
                </button>
              </div>
              {room.members?.length === 0 ? (
                <p className="text-sm text-ink/40 dark:text-white/30 text-center py-6">Waiting for others to join…</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {room.members.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-3 rounded-2xl bg-white/50 dark:bg-white/[0.04] px-4 py-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-lavender-400 to-lavender-600 text-white text-xs font-bold shrink-0">
                        {m.display_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink dark:text-white truncate">{m.display_name}</p>
                        <p className="text-xs text-ink/40 dark:text-white/30">{m.focus_minutes} min focused</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`h-2 w-2 rounded-full ${m.is_focusing ? 'bg-sage-500 animate-pulse' : 'bg-ink/15 dark:bg-white/15'}`} />
                        <span className={`text-xs font-medium ${m.is_focusing ? 'text-sage-600 dark:text-sage-400' : 'text-ink/40 dark:text-white/30'}`}>
                          {m.is_focusing ? 'Focusing' : 'On break'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          ) : (
            <GlassCard className="p-10 text-center">
              <Users size={30} className="text-lavender-400 mx-auto mb-3" />
              <h3 className="font-display font-bold text-ink dark:text-white mb-1">No active room</h3>
              <p className="text-sm text-ink/50 dark:text-white/40 mb-5">Create a private room or join one with a code and password.</p>
              <button onClick={() => setRoomModal(true)} className="btn-primary mx-auto">
                <Plus size={16} /> Create or Join Room
              </button>
            </GlassCard>
          )}
        </div>
      )}

      {/* ── LEADERBOARD TAB ───────────────────────────────── */}
      {tab === 'leaderboard' && (
        <div className="max-w-2xl">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display font-bold text-ink dark:text-white">Weekly Leaderboard</h2>
              <span className="text-xs text-ink/40 dark:text-white/30">Resets every Sunday at midnight</span>
            </div>
            <p className="text-xs text-ink/40 dark:text-white/30 mb-5">Total focus minutes logged this week</p>

            {board.length === 0 ? (
              <div className="text-center py-10">
                <Trophy size={28} className="text-ink/20 dark:text-white/20 mx-auto mb-2" />
                <p className="text-sm text-ink/40 dark:text-white/30">No sessions yet this week.</p>
                <p className="text-xs text-ink/30 dark:text-white/20 mt-1">Complete a session to appear here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {board.map((e) => {
                  const isMe    = e.id == user?.id;
                  const medals  = ['🥇','🥈','🥉'];
                  const hrs     = Math.floor(e.total_minutes / 60);
                  const mins    = e.total_minutes % 60;
                  return (
                    <div key={e.id}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                        isMe
                          ? 'bg-lavender-50 dark:bg-lavender-500/10 border border-lavender-200/50 dark:border-lavender-500/20'
                          : 'bg-white/40 dark:bg-white/[0.03]'
                      }`}>
                      <span className="text-xl w-8 text-center shrink-0">
                        {e.rank <= 3
                          ? medals[e.rank - 1]
                          : <span className="text-sm font-bold text-ink/30 dark:text-white/25">{e.rank}</span>}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isMe ? 'text-lavender-700 dark:text-lavender-300' : 'text-ink dark:text-white'}`}>
                          {e.name}{isMe ? ' (you)' : ''}
                        </p>
                        <p className="text-xs text-ink/40 dark:text-white/30">{e.session_count} sessions</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${isMe ? 'text-lavender-600 dark:text-lavender-300' : 'text-ink dark:text-white'}`}>
                          {e.total_minutes}m
                        </p>
                        <p className="text-xs text-ink/35 dark:text-white/25">
                          {hrs > 0 ? `${hrs}h ` : ''}{mins}m
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* ── Room modal ─────────────────────────────────────── */}
      <Modal open={roomModal} onClose={() => setRoomModal(false)} title="Study Room">
        <div className="flex gap-1 mb-5 bg-white/40 dark:bg-white/[0.04] rounded-xl p-1">
          {[{ key: 'join', label: 'Join Room' }, { key: 'create', label: 'Create Room' }].map(({ key, label }) => (
            <button key={key} onClick={() => setRoomForm({ ...roomForm, tab: key })}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                roomForm.tab === key
                  ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-sm'
                  : 'text-ink/50 dark:text-white/40'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={handleRoomSubmit} className="flex flex-col gap-3.5">
          {roomForm.tab === 'create' && (
            <input className="input-field" placeholder="Room name, e.g. Study Squad"
              value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} autoFocus required />
          )}
          {roomForm.tab === 'join' && (
            <input className="input-field font-mono tracking-[0.3em] text-center uppercase"
              placeholder="ROOM CODE" maxLength={6}
              value={roomForm.code} onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value.toUpperCase() })} autoFocus required />
          )}
          <input type="password" className="input-field" placeholder="Password"
            value={roomForm.password} onChange={(e) => setRoomForm({ ...roomForm, password: e.target.value })} required />
          <button type="submit" className="btn-primary justify-center">
            {roomForm.tab === 'join' ? 'Join Room' : 'Create Room'}
          </button>
        </form>
      </Modal>

      {/* ── Congrats overlay ───────────────────────────────── */}
      <AnimatePresence>
        {congrats && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/30 dark:bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setCongrats(null)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 28 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 16 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="glass-card w-full max-w-md p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-5xl mb-4 animate-bounce">🎉</div>
              <h2 className="font-display text-2xl font-bold text-ink dark:text-white mb-1">Session Complete!</h2>
              <p className="text-ink/50 dark:text-white/40 mb-2">{congrats.minutes} min of focused work — well done.</p>
              {congrats.xpAwarded > 0 && (
                <p className="inline-block rounded-full bg-aurora-violet/10 text-aurora-violet px-3 py-1 text-sm font-bold mb-4">
                  +{congrats.xpAwarded} XP
                </p>
              )}
              <div className="rounded-2xl bg-white/50 dark:bg-white/[0.05] px-5 py-4 mb-6 text-left">
                <p className="text-sm font-medium text-ink dark:text-white italic leading-relaxed">
                  "{congrats.quote.text}"
                </p>
                <p className="text-xs text-ink/45 dark:text-white/35 mt-2">— {congrats.quote.author}</p>
              </div>
              <button onClick={() => setCongrats(null)} className="btn-primary w-full justify-center text-base">
                Keep going 🚀
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}