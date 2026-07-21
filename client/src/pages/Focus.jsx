import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, Plus, LogOut } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFocus, MODES } from '../context/FocusContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Modal      from '../components/Modal.jsx';

// UI-only constants (not in context)
const OPTIONS = { focus: [15,25,30,45,50,60,90], short: [5,10], long: [15,20,30] };
const CX = 140, CY = 140, R = 108;
const CIRC = 2 * Math.PI * R;

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

const fmtTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function Flow() {
  const toast    = useToast();
  const { user } = useAuth();

  // ── All timer state from context — survives navigation ────
  const {
    mode, customMin, timeLeft, totalTime, isRunning,
    taskName, dots, startedAt, congrats, stats, board, room,
    setTaskName, setRoom, setCongrats,
    toggleTimer, resetTimer, addMinute, setDuration, handleModeClick,
    loadData,
  } = useFocus();

  // ── Local UI state only ───────────────────────────────────
  const [tab,       setTab]       = useState('timer');
  const [roomModal, setRoomModal] = useState(false);
  const [roomForm,  setRoomForm]  = useState({ tab: 'join', name: '', code: '', password: '' });

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
  const mm         = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const ss         = String(timeLeft % 60).padStart(2, '0');
  const progress   = totalTime > 0 ? (totalTime - timeLeft) / totalTime : 0;
  const dashOffset = CIRC * (1 - progress);
  const modeColor  = MODES[mode].color;

  const now      = new Date();
  const endsAt   = new Date(now.getTime() + timeLeft * 1000);
  const timeRange = startedAt
    ? `${fmtTime(startedAt)} → ${fmtTime(endsAt)}`
    : isRunning ? `now → ${fmtTime(endsAt)}` : null;

  const TABS_NAV = [
    { key: 'timer',       label: 'Timer',                               icon: '⏱' },
    { key: 'room',        label: room ? `Room · ${room.code}` : 'Room', icon: '👥' },
    { key: 'leaderboard', label: 'Rankings',                            icon: '🏆' },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Flow"
        title="Enter your flow state"
        subtitle="Deep work timer · Study rooms · Weekly rankings."
      />

      {/* Tab bar */}
<div className="flex gap-1 mb-6 p-1 w-fit rounded-2xl" style={lg()}>
  {TABS_NAV.map(({ key, label, icon }) => (
    <motion.button
      key={key}
      onClick={() => setTab(key)}
      whileHover={tab !== key ? {
        y: -3,
        scale: 1.06,
        transition: { type: 'spring', stiffness: 500, damping: 22 },
      } : {}}
      whileTap={{ scale: 0.95 }}
      className="relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
      style={tab === key ? {
        background: 'rgba(255,255,255,0.88)',
        boxShadow:  '0 8px 24px rgba(0,0,0,0.13), 0 2px 8px rgba(124,92,255,0.18), inset 0 1px 0 rgba(255,255,255,1)',
        color:      '#1E2233',
      } : { color: 'rgba(255,255,255,0.45)' }}>
      {/* Hover card — same pattern as sidebar */}
      {tab !== key && (
        <span className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none"
          style={{
            background: 'rgba(255,255,255,0.10)',
            boxShadow:  'inset 0 1px 0 rgba(255,255,255,0.25)',
          }}
        />
      )}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10">{label}</span>
      {key === 'room' && room && (
        <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-sage-500 animate-pulse" />
      )}
    </motion.button>
  ))}
</div>

      {/* ── TIMER TAB ─────────────────────────────────────── */}
      {tab === 'timer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main card */}
          <div className="lg:col-span-2 flex flex-col items-center py-10 px-8" style={cardGlass}>

            {/* Mode pills */}
            <div className="flex gap-2 mb-8 flex-wrap justify-center">
              {Object.entries(MODES).map(([key, m]) => (
                <motion.button key={key}
                  whileHover={{ y: -1, scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => handleModeClick(key)}
                  className="px-5 py-2 rounded-2xl text-sm font-semibold transition-all"
                  style={lg({ color: m.color, active: mode === key })}>
                  {m.emoji} {m.label}
                </motion.button>
              ))}
            </div>

            {/* Time range */}
            <div className="h-5 mb-2">
              <AnimatePresence>
                {timeRange && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="text-sm font-mono font-medium"
                    style={{ color: modeColor }}>
                    {timeRange}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Ring */}
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
  stroke={isPast ? modeColor : 'rgba(124,106,240,0.10)'}
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
                <span className="font-display tabular-nums leading-none text-ink dark:text-white"
                  style={{ fontSize: 58, fontWeight: 700 }}>
                  {mm}:{ss}
                </span>
                <span className="text-sm font-medium mt-2" style={{ color: modeColor }}>
                  {MODES[mode].emoji} {MODES[mode].label}
                </span>
                {dots > 0 && (
                  <div className="flex gap-1.5 mt-3">
                    {Array.from({ length: Math.min(dots, 8) }).map((_, i) => (
                      <div key={i} className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: modeColor, boxShadow: `0 0 4px ${modeColor}` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Task name */}
            <input
              className="text-center text-sm font-medium bg-transparent outline-none w-full max-w-xs mt-4 mb-8 pb-2"
              style={{ borderBottom: '1px solid rgba(124,106,240,0.20)', color: taskName ? '#1E2233' : undefined }}
              placeholder="What are you working on?"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
            />

            {/* Controls */}
            <div className="flex items-center gap-5">
              <motion.button whileHover={{ scale: 1.08, y: -1 }} whileTap={{ scale: 0.94 }}
                onClick={resetTimer}
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={lg()}>
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
                {isRunning
                  ? <Pause size={26} className="text-white" />
                  : <Play  size={26} className="text-white ml-1" />}
              </motion.button>

              <motion.button whileHover={{ scale: 1.08, y: -1 }} whileTap={{ scale: 0.94 }}
                onClick={addMinute}
                className="flex items-center gap-1 h-11 px-3.5 rounded-2xl text-xs font-bold"
                style={{ ...lg(), color: 'rgba(30,34,51,0.55)' }}>
                <Plus size={12} /> 1m
              </motion.button>
            </div>

            {/* Duration picker */}
            <div className="mt-8 pt-6 w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.30)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-center mb-3"
                style={{ color: 'rgba(30,34,51,0.30)' }}>Duration</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {OPTIONS[mode].map((min) => (
                  <motion.button key={min}
                    whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}
                    onClick={() => setDuration(min)} disabled={isRunning}
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold transition disabled:opacity-40"
                    style={lg({ color: modeColor, active: customMin[mode] === min })}>
                    {min}m
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="flex flex-col gap-4">

            {stats && (
              <div className="rounded-3xl p-5" style={lg()}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-4"
                  style={{ color: 'rgba(30,34,51,0.38)' }}>This Week</p>
                <div className="grid grid-cols-2 gap-3">
                  {[{ val: stats.total_minutes, label: 'minutes' }, { val: stats.sessions, label: 'sessions' }].map(({ val, label }) => (
                    <div key={label} className="rounded-2xl p-3 text-center" style={lg()}>
                      <p className="font-display text-2xl font-bold text-ink dark:text-white">{val}</p>
                      <p className="text-xs text-ink/45 dark:text-white/35 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {room ? (
              <div className="rounded-3xl p-5" style={lg({ color: MODES.focus.color, active: true })}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-ink dark:text-white text-sm">{room.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(30,34,51,0.45)' }}>
                      Code: <span className="font-mono font-bold tracking-[0.2em]" style={{ color: modeColor }}>{room.code}</span>
                    </p>
                  </div>
                  <button onClick={leaveRoom} className="text-ink/30 hover:text-coral-500 transition">
                    <LogOut size={15} />
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {room.members?.slice(0, 4).map((m) => (
                    <div key={m.user_id} className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${m.is_focusing ? 'bg-sage-500 animate-pulse' : 'bg-ink/15'}`} />
                      <span className="text-xs text-ink/65 dark:text-white/55 flex-1 truncate">{m.display_name}</span>
                      <span className="text-xs text-ink/35 shrink-0">{m.focus_minutes}m</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setTab('room')} className="mt-3 text-xs font-semibold hover:underline"
                  style={{ color: modeColor }}>
                  View room →
                </button>
              </div>
            ) : (
              <motion.button whileHover={{ y: -1 }} onClick={() => setRoomModal(true)}
                className="rounded-3xl p-5 text-left w-full" style={lg()}>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="text-lg">👥</span>
                  <p className="font-semibold text-ink dark:text-white text-sm">Study Room</p>
                </div>
                <p className="text-xs text-ink/45 dark:text-white/35">Focus with friends. Shared leaderboard inside.</p>
              </motion.button>
            )}

            {board.length > 0 && (
              <div className="rounded-3xl p-5" style={lg()}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-3"
                  style={{ color: 'rgba(30,34,51,0.38)' }}>🏆 Top This Week</p>
                {board.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex items-center gap-2 py-1.5">
                    <span className="text-sm w-5 text-center">{['🥇','🥈','🥉'][e.rank - 1]}</span>
                    <span className="flex-1 text-sm text-ink dark:text-white truncate">{e.name}</span>
                    <span className="text-xs text-ink/40 shrink-0">{e.total_minutes}m</span>
                  </div>
                ))}
                <button onClick={() => setTab('leaderboard')}
                  className="mt-2 text-xs font-semibold hover:underline"
                  style={{ color: modeColor }}>
                  Full rankings →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ROOM TAB ──────────────────────────────────────── */}
      {tab === 'room' && (
        <div className="max-w-2xl">
          {room ? (
            <div className="rounded-3xl p-7" style={cardGlass}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="font-display font-bold text-ink dark:text-white text-xl">{room.name}</h2>
                  <p className="text-sm mt-0.5" style={{ color: 'rgba(30,34,51,0.45)' }}>
                    Share code: <span className="font-mono font-bold tracking-[0.2em]" style={{ color: modeColor }}>{room.code}</span>
                  </p>
                </div>
                <button onClick={leaveRoom}
                  className="flex items-center gap-2 text-sm font-semibold rounded-2xl px-4 py-2"
                  style={lg()}>
                  <LogOut size={14} /> Leave
                </button>
              </div>
              {room.members?.length === 0 ? (
                <p className="text-sm text-ink/40 text-center py-8">Waiting for others to join…</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {room.members.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={lg()}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-xs font-bold shrink-0"
                        style={{ background: `linear-gradient(135deg, ${modeColor} 0%, ${modeColor}88 100%)` }}>
                        {m.display_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink dark:text-white truncate">{m.display_name}</p>
                        <p className="text-xs text-ink/40">{m.focus_minutes} min focused</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${m.is_focusing ? 'bg-sage-500 animate-pulse' : 'bg-ink/15'}`} />
                        <span className={`text-xs font-medium ${m.is_focusing ? 'text-sage-600' : 'text-ink/35'}`}>
                          {m.is_focusing ? 'Focusing' : 'Break'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl p-12 text-center" style={cardGlass}>
              <span className="text-5xl mb-4 block">👥</span>
              <h3 className="font-display font-bold text-ink dark:text-white mb-1">No active room</h3>
              <p className="text-sm text-ink/50 mb-6">Create a private room or join one with a code and password.</p>
              <button onClick={() => setRoomModal(true)} className="btn-primary mx-auto">
                <Plus size={16} /> Create or Join Room
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── LEADERBOARD TAB ───────────────────────────────── */}
      {tab === 'leaderboard' && (
        <div className="max-w-2xl">
          <div className="rounded-3xl p-7" style={cardGlass}>
            <div className="flex items-start justify-between mb-1">
              <h2 className="font-display font-bold text-ink dark:text-white">Weekly Rankings</h2>
              <span className="text-xs text-ink/35">Resets every Sunday midnight</span>
            </div>
            <p className="text-xs text-ink/40 mb-6">Total flow minutes logged this week</p>
            {board.length === 0 ? (
              <div className="text-center py-10">
                <span className="text-4xl block mb-3">🏆</span>
                <p className="text-sm text-ink/40">No sessions yet this week.</p>
              </div>
            ) : (
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
                        {e.rank <= 3
                          ? medals[e.rank - 1]
                          : <span className="text-sm font-bold text-ink/30">{e.rank}</span>}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isMe ? 'text-lavender-700 dark:text-lavender-300' : 'text-ink dark:text-white'}`}>
                          {e.name}{isMe ? ' (you)' : ''}
                        </p>
                        <p className="text-xs text-ink/35">{e.session_count} sessions</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${isMe ? 'text-lavender-600' : 'text-ink dark:text-white'}`}>
                          {e.total_minutes}m
                        </p>
                        <p className="text-xs text-ink/30">{hrs > 0 ? `${hrs}h ` : ''}{mins}m</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Room modal ─────────────────────────────────────── */}
      <Modal open={roomModal} onClose={() => setRoomModal(false)} title="Study Room">
        <div className="flex gap-1 mb-5 p-1 rounded-xl" style={lg()}>
          {[{ key: 'join', label: 'Join Room' }, { key: 'create', label: 'Create Room' }].map(({ key, label }) => (
            <button key={key} onClick={() => setRoomForm({ ...roomForm, tab: key })}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition"
              style={roomForm.tab === key
                ? { background: 'rgba(255,255,255,0.85)', boxShadow: '0 2px 10px rgba(0,0,0,0.09)', color: '#1E2233' }
                : { color: 'rgba(30,34,51,0.45)' }}>
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={handleRoomSubmit} className="flex flex-col gap-3.5">
          {roomForm.tab === 'create' && (
            <input className="input-field" placeholder="Room name, e.g. Study Squad"
              value={roomForm.name}
              onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
              autoFocus required />
          )}
          {roomForm.tab === 'join' && (
            <input className="input-field font-mono tracking-[0.3em] text-center uppercase"
              placeholder="ROOM CODE" maxLength={6}
              value={roomForm.code}
              onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value.toUpperCase() })}
              autoFocus required />
          )}
          <input type="password" className="input-field" placeholder="Password"
            value={roomForm.password}
            onChange={(e) => setRoomForm({ ...roomForm, password: e.target.value })}
            required />
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
            className="fixed inset-0 z-[90] flex items-center justify-center px-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(30,34,51,0.25)' }}
            onClick={() => setCongrats(null)}>
            <motion.div
              initial={{ scale: 0.82, y: 32 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 20 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="w-full max-w-md p-8 text-center rounded-3xl"
              style={cardGlass}
              onClick={(e) => e.stopPropagation()}>
              <motion.div
                animate={{ y: [0, -8, 0], rotate: [0, -5, 5, -3, 0] }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="text-6xl mb-4">
                🎉
              </motion.div>
              <h2 className="font-display text-2xl font-bold text-ink dark:text-white mb-1">Session Complete!</h2>
              <p className="text-ink/50 mb-3">{congrats.minutes} min of focused work.</p>
              {congrats.xpAwarded > 0 && (
                <span className="inline-block rounded-full px-3 py-1 text-sm font-bold mb-4"
                  style={lg({ color: '#7C6AF0', active: true })}>
                  ✨ +{congrats.xpAwarded} XP
                </span>
              )}
              <div className="rounded-2xl px-5 py-4 mb-6 text-left" style={lg()}>
                <p className="text-sm font-medium text-ink dark:text-white italic leading-relaxed">
                  "{congrats.quote.text}"
                </p>
                <p className="text-xs text-ink/40 mt-2">— {congrats.quote.author}</p>
              </div>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => setCongrats(null)}
                className="btn-primary w-full justify-center text-base">
                Keep going 🚀
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}