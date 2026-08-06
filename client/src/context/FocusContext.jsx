import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { useToast } from './ToastContext.jsx';
import { useLanguage } from './LanguageContext.jsx';
import { computeFromServer } from '../utils/timerSync.mjs';
const FocusContext = createContext(null);

export const MODES = {
  focus: { label: 'Focus',       emoji: '🧠', color: '#7C6AF0', defaultMin: 25 },
  short: { label: 'Short Break', emoji: '☕', color: '#4CC38A', defaultMin: 5  },
  long:  { label: 'Long Break',  emoji: '🌿', color: '#60A5FA', defaultMin: 15 },
};

const QUOTES = [
  { text: 'The secret of getting ahead is getting started.',                          author: 'Mark Twain' },
  { text: 'Focus is the art of knowing what to ignore.',                              author: 'Unknown' },
  { text: 'Deep work is the ability to focus without distraction on a cognitively demanding task.', author: 'Cal Newport' },
  { text: 'Where focus goes, energy flows.',                                           author: 'Tony Robbins' },
  { text: 'Done is better than perfect.',                                              author: 'Sheryl Sandberg' },
  { text: 'Small progress is still progress.',                                         author: 'Unknown' },
  { text: "You don't need more time. You need more focus.",                            author: 'Unknown' },
  { text: 'One hour of focused work beats eight hours of distracted effort.',         author: 'Unknown' },
  { text: 'Your future is created by what you do today, not tomorrow.',               author: 'Robert Kiyosaki' },
  { text: 'Concentration is the root of all the higher abilities in man.',            author: 'Bruce Lee' },
  { text: "It's not that I'm so smart, it's just that I stay with problems longer.", author: 'Einstein' },
  { text: 'Productivity is never an accident.',                                        author: 'Paul J. Meyer' },
];
export const randQuote = () => QUOTES[Math.floor(Math.random() * QUOTES.length)];

const SESSION_KEY = 'aurora_focus_state';

function saveState(state) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      ...state,
      startedAt: state.startedAt?.toISOString?.() || state.startedAt || null,
      savedAt:   new Date().toISOString(),
    }));
  } catch (_) {}
}
function loadState() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.isRunning && s.savedAt) {
      const elapsed = Math.floor((Date.now() - new Date(s.savedAt).getTime()) / 1000);
      s.timeLeft = Math.max(0, (s.timeLeft || 0) - elapsed);
      if (s.timeLeft === 0) { s.isRunning = false; s.startedAt = null; }
    }
    if (s.startedAt) s.startedAt = new Date(s.startedAt);
    return s;
  } catch (_) { return null; }
}

function playDone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq; o.type = 'sine';
      const t = ctx.currentTime + i * 0.13;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.28, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.start(t); o.stop(t + 0.45);
    });
  } catch (_) {}
}
function playBreakEnd() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 440; o.type = 'sine';
    g.gain.setValueAtTime(0.22, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.6);
  } catch (_) {}
}
function playTreeDied() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [392, 349, 293].forEach((freq, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq; o.type = 'sine';
      const t = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.start(t); o.stop(t + 0.4);
    });
  } catch (_) {}
}

// Derive live timeLeft/isRunning/startedAt from a server timer row —
// same math the room timer already uses. remaining_seconds is the
// snapshot at started_at; devices compute elapsed locally.


export function FocusProvider({ children }) {
  const toast      = useToast();
  const { lang }   = useLanguage();

  const saved = loadState();
  const [mode,      setMode]      = useState(saved?.mode      || 'focus');
  const [customMin, setCustomMin] = useState(saved?.customMin || { focus: 25, short: 5, long: 15 });
  const [timeLeft,  setTimeLeft]  = useState(saved?.timeLeft  ?? 25 * 60);
  const [totalTime, setTotalTime] = useState(saved?.totalTime ?? 25 * 60);
  const [isRunning, setIsRunning] = useState(saved?.isRunning || false);
  const [taskName,  setTaskNameRaw] = useState(saved?.taskName || '');
  const [taskId,    setTaskIdRaw] = useState(saved?.taskId ?? null);
  const [dots,      setDots]      = useState(saved?.dots      || 0);
  const [startedAt, setStartedAt] = useState(saved?.startedAt || null);
  const [congrats,  setCongrats]  = useState(null);
  const [died,      setDied]      = useState(null);
  const [stats,     setStats]     = useState(null);
  const [board,     setBoard]     = useState([]);
  const [room,      setRoom]      = useState(null);
  const [roomTree,  setRoomTree]  = useState(null);
  const [myRooms,   setMyRooms]   = useState([]); // every room the user's created/joined

  const saveTimeoutRef = useRef(null);
  useEffect(() => {
    saveState({ mode, customMin, timeLeft, totalTime, isRunning, taskName, taskId, dots, startedAt });
  }, [mode, customMin, isRunning, taskName, taskId, dots]); // eslint-disable-line

  useEffect(() => {
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveState({ mode, customMin, timeLeft, totalTime, isRunning, taskName, taskId, dots, startedAt });
    }, isRunning ? 5000 : 0);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [timeLeft]); // eslint-disable-line

  const intervalRef      = useRef(null);
  const modeRef           = useRef(mode);
  const customMinRef      = useRef(customMin);
  const taskRef            = useRef(taskName);
  const taskIdRef          = useRef(taskId);
  const roomRef            = useRef(room);
  const prevTreeStatusRef  = useRef(null);
  useEffect(() => { modeRef.current      = mode;      }, [mode]);
  useEffect(() => { customMinRef.current = customMin; }, [customMin]);
  useEffect(() => { taskRef.current      = taskName;  }, [taskName]);
  useEffect(() => { taskIdRef.current    = taskId;    }, [taskId]);
  useEffect(() => { roomRef.current      = room;      }, [room]);

  // ── Server-authoritative solo timer sync ───────────────────
  const versionRef   = useRef(0);
  const loadedRef     = useRef(false);
  const taskDebounceRef = useRef(null);

  const pushTimerState = useCallback(async (partial) => {
    const payload = {
      mode:              partial.mode ?? mode,
      custom_min:        partial.custom_min ?? customMin,
      duration_seconds:  partial.duration_seconds ?? totalTime,
      remaining_seconds: partial.remaining_seconds ?? timeLeft,
      started_at:        'started_at' in partial ? partial.started_at : (startedAt ? startedAt.toISOString() : null),
      running:           'running' in partial ? partial.running : isRunning,
      task_name:         partial.task_name ?? taskName,
      task_id:           'task_id' in partial ? partial.task_id : taskId,
      dots:              partial.dots ?? dots,
    };
    try {
      const res = await api.post('/focus/timer/sync', payload);
      if (res?.version) versionRef.current = res.version;
    } catch (_) {}
  }, [mode, customMin, totalTime, timeLeft, startedAt, isRunning, taskName, taskId, dots]);

  const applyServerState = useCallback((d) => {
    const computed = computeFromServer(d);
    setMode(d.mode);
    setCustomMin(d.custom_min);
    setTaskNameRaw(d.task_name || '');
    setTaskIdRaw(d.task_id ?? null);
    setDots(d.dots || 0);
    setTimeLeft(computed.timeLeft);
    setTotalTime(computed.totalTime);
    setIsRunning(computed.isRunning);
    setStartedAt(computed.startedAt);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('aurora_auth_token');
    if (!token) return;
    let active = true;
    const load = async () => {
      try {
        const d = await api.get('/focus/timer');
        if (!active) return;
        if (d.exists) {
          versionRef.current = d.version;
          applyServerState(d);
        } else {
          // No row yet for this account — create one from current
          // (possibly sessionStorage-restored) local state.
          pushTimerState({});
        }
      } catch (_) {}
      loadedRef.current = true;
    };
    load();
    const poll = setInterval(async () => {
      try {
        const d = await api.get('/focus/timer');
        if (!active || !d.exists) return;
        if (d.version !== versionRef.current) {
          versionRef.current = d.version;
          applyServerState(d);
        }
      } catch (_) {}
    }, 5000);
    return () => { active = false; clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced task-name sync — pushes 700ms after typing stops.
  // (Used only for the free-text "custom focus" label, i.e. when no
  // real task is linked — see setTask/clearTask below.)
  const setTaskName = useCallback((val) => {
    setTaskNameRaw(val);
    clearTimeout(taskDebounceRef.current);
    taskDebounceRef.current = setTimeout(() => {
      pushTimerState({ task_name: val });
    }, 700);
  }, [pushTimerState]);

  // Link the timer to a real task from the Tasks board — its title
  // becomes the session label and its id is stamped onto the focus
  // session/tree so completed minutes accumulate on the task itself.
  const setTask = useCallback((task) => {
    clearTimeout(taskDebounceRef.current);
    setTaskNameRaw(task.title);
    setTaskIdRaw(task.id);
    pushTimerState({ task_name: task.title, task_id: task.id });
  }, [pushTimerState]);

  // Unlink from a task and go back to a blank, freely-typed label.
  const clearTask = useCallback(() => {
    clearTimeout(taskDebounceRef.current);
    setTaskNameRaw('');
    setTaskIdRaw(null);
    pushTimerState({ task_name: '', task_id: null });
  }, [pushTimerState]);

  const loadData = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([api.get('/focus/stats'), api.get('/focus/leaderboard')]);
      setStats(s); setBoard(l.leaderboard || []);
    } catch (_) {}
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  // The weekly stats/leaderboard genuinely zero out server-side once the
  // week rolls over (each session is bucketed by its week_start, and the
  // query only ever sums the current one) — but loadData() above only
  // ran once, on mount. A tab left open across the boundary (very normal
  // on desktop) would keep showing last week's numbers until something
  // else happened to call loadData() again. Revalidate on refocus, plus
  // a periodic backstop for tabs that just sit open for days.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') loadData(); };
    document.addEventListener('visibilitychange', onVisible);
    const iv = setInterval(loadData, 5 * 60 * 1000);
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(iv); };
  }, [loadData]);

  useEffect(() => {
    api.get('/focus/rooms/mine').then((d) => {
      if (d.code && !roomRef.current) {
        setRoom({ code: d.code, name: '', members: [] });
      }
    }).catch(() => {});
  }, []); // eslint-disable-line

  // The full list backing the room switcher — separate from the single
  // "which room am I looking at right now" `room` state above.
  const loadMyRooms = useCallback(async () => {
    try {
      const d = await api.get('/focus/rooms/mine-list');
      const rooms = d.rooms || [];
      setMyRooms(rooms);
      return rooms;
    } catch (_) { return []; }
  }, []);
  useEffect(() => { loadMyRooms(); }, [loadMyRooms]);

  // Switch which room is active/synced without leaving the others —
  // just points `room` at a different code; the polling effect below
  // (keyed on room.code) fetches that room's live data automatically.
  const switchRoom = useCallback((code) => {
    if (room?.code === code) return;
    setRoom({ code, name: '', members: [] });
    setRoomTree(null);
    prevTreeStatusRef.current = null;
  }, [room]);

  useEffect(() => {
    if (!room) { setRoomTree(null); prevTreeStatusRef.current = null; return; }
    const poll = async () => {
      try {
        const d = await api.get(`/focus/rooms/${room.code}`);
        setRoom((r) => r ? { ...r, name: d.name, members: d.members, host_id: d.host_id, timer: d.timer } : null);

        if (d.tree) {
          const prevStatus = prevTreeStatusRef.current;
          if (prevStatus === 'alive' && d.tree.status === 'dead') {
            playTreeDied();
            const who = d.tree.died_by_name || (lang === 'ar' ? 'أحد الأعضاء' : 'someone');
            const isHostStop = d.tree.died_reason === 'host_stopped';
            toast.error(
              lang === 'ar'
                ? (isHostStop ? `أنهى المضيف الجلسة مبكرًا — ماتت شجرة الغرفة 💔` : `ماتت شجرة الغرفة — ${who} استسلم 💔`)
                : (isHostStop ? `The host ended the session early — the tree died 💔` : `Your shared tree died — ${who} gave up 💔`)
            );
          } else if (prevStatus === 'alive' && d.tree.status === 'completed') {
            toast.success(
              lang === 'ar'
                ? 'نجت شجرة الغرفة من الجلسة! 🌳'
                : "The room's tree survived the session! 🌳"
            );
          }
          prevTreeStatusRef.current = d.tree.status;
          setRoomTree(d.tree);
        } else {
          prevTreeStatusRef.current = null;
          setRoomTree(null);
        }
      } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [room?.code]); // eslint-disable-line

  useEffect(() => {
    if (!room) return;
    const pulse = () => api.post(`/focus/rooms/${room.code}/pulse`, { is_focusing: isRunning }).catch(() => {});
    pulse();
    const id = setInterval(pulse, 30000);
    // Mobile browsers throttle/suspend background-tab timers, so a
    // phone/tablet that gets locked or backgrounded stops pulsing and
    // silently ages out of the "who's here" list (it's filtered by
    // last_seen, not actually removed). Firing a pulse the moment the
    // tab comes back to the foreground closes that gap immediately
    // instead of waiting up to 30s for the next scheduled one.
    const onVisible = () => { if (document.visibilityState === 'visible') pulse(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [room?.code, isRunning]); // eslint-disable-line

  const leaveRoom = useCallback(async () => {
    if (!room) return;
    await api.del(`/focus/rooms/${room.code}/leave`);
    setRoomTree(null);
    prevTreeStatusRef.current = null;
    // Leaving deletes membership in *this* room only — the others are
    // untouched server-side. But dropping `room` straight to null here
    // made it look like every room had disappeared, since the room
    // switcher only showed up once you had 2+ rooms and there was
    // nothing else on screen to point back at the ones you still
    // belong to. Auto-switch to the next most-recently-active one
    // instead, and only fall back to the empty state if that was
    // genuinely your last room.
    const remaining = await loadMyRooms();
    if (remaining.length > 0) {
      setRoom({ code: remaining[0].code, name: remaining[0].name, members: [] });
    } else {
      setRoom(null);
    }
  }, [room, loadMyRooms]);

  const handleComplete = useCallback(async () => {
    const m   = modeRef.current;
    const min = customMinRef.current;
    const t   = taskRef.current;
    const tid = taskIdRef.current;
    const r   = roomRef.current;
    if (m === 'focus') {
      playDone();
      const quote = randQuote();
      try {
        const res = await api.post('/focus/sessions', {
          task_name: t.trim() || 'Flow Session', duration_minutes: min.focus, task_id: tid || null,
        });
        if (r) api.post(`/focus/rooms/${r.code}/pulse`, { is_focusing: false, add_minutes: min.focus }).catch(() => {});
        setCongrats({ quote, xpAwarded: res.xpAwarded || 0, minutes: min.focus, task: res.task || null });
        setDots((d) => d + 1);
        pushTimerState({ running: false, started_at: null, remaining_seconds: 0, dots: (dots || 0) + 1 });
        loadData();
      } catch (_) {
        setCongrats({ quote, xpAwarded: 0, minutes: min.focus, task: null });
      }
    } else {
      playBreakEnd();
      const mins = customMinRef.current.focus;
      setMode('focus');
      setTimeLeft(mins * 60);
      setTotalTime(mins * 60);
      pushTimerState({
        mode: 'focus', running: false, started_at: null,
        remaining_seconds: mins * 60, duration_seconds: mins * 60,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData, pushTimerState, dots]);

  // ── Kill the tree: shared by the explicit Reset button and the
  // pause-grace timeout below, so there's exactly one place that talks
  // to the abandon endpoint and shows the outcome.
  const killTree = useCallback(async (elapsedMin, reason) => {
    const t   = taskRef.current;
    const tid = taskIdRef.current;
    try {
      await api.post('/focus/sessions/abandon', {
        task_name: t.trim() || 'Focus Session',
        duration_minutes: elapsedMin,
        task_id: tid || null,
      });
      playTreeDied();
      setDied({ minutes: elapsedMin, reason });
    } catch (_) {
      toast.error(lang === 'ar' ? 'تعذّر حفظ الجلسة — تحقّق من اتصالك' : "Couldn't save this session — check your connection");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // ── Pause is a 60s grace period, not a free pass. If you pause a
  // focus session with at least a minute already logged and don't
  // resume within 60s, the tree dies — same outcome as hitting Reset,
  // just with a warning window first instead of being instant.
  const pauseGraceTimeoutRef = useRef(null);
  const clearPauseGrace = useCallback(() => {
    clearTimeout(pauseGraceTimeoutRef.current);
    pauseGraceTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    if (!isRunning) { clearInterval(intervalRef.current); return; }
    const wallStart   = Date.now();
    const timeAtStart = timeLeft;
    intervalRef.current = setInterval(() => {
      const elapsed   = Math.floor((Date.now() - wallStart) / 1000);
      const remaining = Math.max(0, timeAtStart - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        setIsRunning(false);
        setStartedAt(null);
        setTimeout(handleComplete, 50);
      }
    }, 500);
    return () => clearInterval(intervalRef.current);
  }, [isRunning, handleComplete]); // eslint-disable-line

  useEffect(() => {
    if (isRunning) {
      const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0');
      const ss = String(timeLeft % 60).padStart(2, '0');
      document.title = `${mm}:${ss} · ${MODES[mode].emoji} Flow`;
    } else {
      document.title = 'Aurora';
    }
  }, [isRunning, timeLeft, mode]);

  const switchMode = (m) => {
    clearPauseGrace();
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setStartedAt(null);
    setMode(m);
    const mins = customMin[m];
    setTimeLeft(mins * 60);
    setTotalTime(mins * 60);
    pushTimerState({
      mode: m, running: false, started_at: null,
      remaining_seconds: mins * 60, duration_seconds: mins * 60,
    });
  };
  const handleModeClick = (m) => {
    if (m === mode) return;
    switchMode(m);
  };
  const toggleTimer = () => {
    if (timeLeft === 0) return;
    if (!isRunning) {
      // Resuming within the grace window — call it off, tree's safe.
      clearPauseGrace();
      const sa = new Date();
      setStartedAt(sa);
      setIsRunning(true);
      pushTimerState({ running: true, started_at: sa.toISOString(), remaining_seconds: timeLeft });
    } else {
      setIsRunning(false);
      setStartedAt(null);
      pushTimerState({ running: false, started_at: null, remaining_seconds: timeLeft });

      const elapsedMin = Math.floor((totalTime - timeLeft) / 60);
      if (mode === 'focus' && elapsedMin >= 1) {
        toast.error(lang === 'ar'
          ? '⏸ أوقفت الجلسة مؤقتًا — استأنف خلال 60 ثانية وإلا ماتت شجرتك 🥀'
          : "⏸ Paused — resume within 60s or your tree dies 🥀");
        clearPauseGrace();
        pauseGraceTimeoutRef.current = setTimeout(() => {
          pauseGraceTimeoutRef.current = null;
          killTree(elapsedMin, 'pause');
          const mins = customMinRef.current[modeRef.current];
          clearInterval(intervalRef.current);
          setIsRunning(false);
          setStartedAt(null);
          setTimeLeft(mins * 60);
          setTotalTime(mins * 60);
          pushTimerState({
            running: false, started_at: null,
            remaining_seconds: mins * 60, duration_seconds: mins * 60,
          });
        }, 60000);
      }
    }
  };
  // The explicit "give up" button — kills the tree immediately if at
  // least a minute of focus is already logged, whether the timer was
  // still running or sitting in its pause-grace window (that just
  // short-circuits the wait instead of skipping the consequence).
  const resetTimer = () => {
    const elapsedMin = Math.floor((totalTime - timeLeft) / 60);
    clearPauseGrace();
    if (mode === 'focus' && elapsedMin >= 1) {
      killTree(elapsedMin, 'reset');
    }
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setStartedAt(null);
    const mins = customMin[mode];
    setTimeLeft(mins * 60);
    setTotalTime(mins * 60);
    pushTimerState({
      running: false, started_at: null,
      remaining_seconds: mins * 60, duration_seconds: mins * 60,
    });
  };
  const addMinute = () => {
    if (isRunning) return;
    const newTimeLeft = timeLeft + 60;
    const newTotal     = totalTime + 60;
    const newCustomMin = { ...customMin, [mode]: customMin[mode] + 1 };
    setTimeLeft(newTimeLeft);
    setTotalTime(newTotal);
    setCustomMin(newCustomMin);
    pushTimerState({
      running: false, started_at: null,
      remaining_seconds: newTimeLeft, duration_seconds: newTotal,
      custom_min: newCustomMin,
    });
  };
  const setDuration = (mins) => {
    const newCustomMin = { ...customMin, [mode]: mins };
    setCustomMin(newCustomMin);
    if (!isRunning) {
      setTimeLeft(mins * 60);
      setTotalTime(mins * 60);
      pushTimerState({
        running: false, started_at: null,
        remaining_seconds: mins * 60, duration_seconds: mins * 60,
        custom_min: newCustomMin,
      });
    } else {
      pushTimerState({ custom_min: newCustomMin });
    }
  };

  return (
    <FocusContext.Provider value={{
      mode, customMin, timeLeft, totalTime, isRunning, taskName, taskId, dots,
      startedAt, congrats, died, stats, board, room, roomTree, myRooms,
      setTaskName, setTask, clearTask, setRoom, setCongrats, setDied, leaveRoom,
      switchRoom, loadMyRooms,
      toggleTimer, resetTimer, addMinute, setDuration, handleModeClick, switchMode,
      loadData,
    }}>
      {children}
    </FocusContext.Provider>
  );
}

export const useFocus = () => useContext(FocusContext);