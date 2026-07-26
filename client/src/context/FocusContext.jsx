import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { useToast } from './ToastContext.jsx';
import { useLanguage } from './LanguageContext.jsx';

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

export function FocusProvider({ children }) {
  const toast      = useToast();
  const { lang }   = useLanguage();

  const saved = loadState();
  const [mode,      setMode]      = useState(saved?.mode      || 'focus');
  const [customMin, setCustomMin] = useState(saved?.customMin || { focus: 25, short: 5, long: 15 });
  const [timeLeft,  setTimeLeft]  = useState(saved?.timeLeft  ?? 25 * 60);
  const [totalTime, setTotalTime] = useState(saved?.totalTime ?? 25 * 60);
  const [isRunning, setIsRunning] = useState(saved?.isRunning || false);
  const [taskName,  setTaskName]  = useState(saved?.taskName  || '');
  const [dots,      setDots]      = useState(saved?.dots      || 0);
  const [startedAt, setStartedAt] = useState(saved?.startedAt || null);
  const [congrats,  setCongrats]  = useState(null);
  const [stats,     setStats]     = useState(null);
  const [board,     setBoard]     = useState([]);
  const [room,      setRoom]      = useState(null);
  const [roomTree,  setRoomTree]  = useState(null);

  const saveTimeoutRef = useRef(null);
  useEffect(() => {
    saveState({ mode, customMin, timeLeft, totalTime, isRunning, taskName, dots, startedAt });
  }, [mode, customMin, isRunning, taskName, dots]); // eslint-disable-line

  useEffect(() => {
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveState({ mode, customMin, timeLeft, totalTime, isRunning, taskName, dots, startedAt });
    }, isRunning ? 5000 : 0);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [timeLeft]); // eslint-disable-line

  const intervalRef       = useRef(null);
  const modeRef            = useRef(mode);
  const customMinRef       = useRef(customMin);
  const taskRef             = useRef(taskName);
  const roomRef             = useRef(room);
  const prevTreeStatusRef   = useRef(null);
  useEffect(() => { modeRef.current      = mode;      }, [mode]);
  useEffect(() => { customMinRef.current = customMin; }, [customMin]);
  useEffect(() => { taskRef.current      = taskName;  }, [taskName]);
  useEffect(() => { roomRef.current      = room;      }, [room]);

  const loadData = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([api.get('/focus/stats'), api.get('/focus/leaderboard')]);
      setStats(s); setBoard(l.leaderboard || []);
    } catch (_) {}
  }, []);
  useEffect(() => { loadData(); }, [loadData]);

  // ── Rehydrate room membership from the server on mount. This is what
  //    makes room/tree/timer state actually sync across devices logged
  //    into the same account — sessionStorage is per-device, this isn't.
  useEffect(() => {
    api.get('/focus/rooms/mine').then((d) => {
      if (d.code && !roomRef.current) {
        setRoom({ code: d.code, name: '', members: [] });
      }
    }).catch(() => {});
  }, []); // eslint-disable-line

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
    return () => clearInterval(id);
  }, [room?.code, isRunning]); // eslint-disable-line

  // Throws on failure (e.g. 403 while a session is running) so the caller
  // (Focus.jsx) can show the server's exact reason instead of failing silently.
  const leaveRoom = useCallback(async () => {
    if (!room) return;
    await api.del(`/focus/rooms/${room.code}/leave`);
    setRoom(null);
    setRoomTree(null);
    prevTreeStatusRef.current = null;
  }, [room]);

  const handleComplete = useCallback(async () => {
    const m   = modeRef.current;
    const min = customMinRef.current;
    const t   = taskRef.current;
    const r   = roomRef.current;
    if (m === 'focus') {
      playDone();
      const quote = randQuote();
      try {
        const res = await api.post('/focus/sessions', {
          task_name: t.trim() || 'Flow Session', duration_minutes: min.focus,
        });
        if (r) api.post(`/focus/rooms/${r.code}/pulse`, { is_focusing: false, add_minutes: min.focus }).catch(() => {});
        setCongrats({ quote, xpAwarded: res.xpAwarded || 0, minutes: min.focus });
        setDots((d) => d + 1);
        loadData();
      } catch (_) {
        setCongrats({ quote, xpAwarded: 0, minutes: min.focus });
      }
    } else {
      playBreakEnd();
      const mins = customMinRef.current.focus;
      setMode('focus');
      setTimeLeft(mins * 60);
      setTotalTime(mins * 60);
    }
  }, [loadData]);

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
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setStartedAt(null);
    setMode(m);
    const mins = customMin[m];
    setTimeLeft(mins * 60);
    setTotalTime(mins * 60);
  };
  const handleModeClick = (m) => {
    if (m === mode) return;
    switchMode(m);
  };
  const toggleTimer = () => {
    if (timeLeft === 0) return;
    if (!isRunning) setStartedAt(new Date());
    setIsRunning((r) => !r);
  };
  const resetTimer = () => {
    clearInterval(intervalRef.current);
    setIsRunning(false);
    setStartedAt(null);
    const mins = customMin[mode];
    setTimeLeft(mins * 60);
    setTotalTime(mins * 60);
  };
  const addMinute = () => {
    if (isRunning) return; // can't extend once started — enforced here too, not just UI
    setTimeLeft((t) => t + 60);
    setTotalTime((t) => t + 60);
    setCustomMin((c) => ({ ...c, [mode]: c[mode] + 1 }));
  };
  const setDuration = (mins) => {
    setCustomMin((c) => ({ ...c, [mode]: mins }));
    if (!isRunning) { setTimeLeft(mins * 60); setTotalTime(mins * 60); }
  };

  return (
    <FocusContext.Provider value={{
      mode, customMin, timeLeft, totalTime, isRunning, taskName, dots,
      startedAt, congrats, stats, board, room, roomTree,
      setTaskName, setRoom, setCongrats, leaveRoom,
      toggleTimer, resetTimer, addMinute, setDuration, handleModeClick, switchMode,
      loadData,
    }}>
      {children}
    </FocusContext.Provider>
  );
}

export const useFocus = () => useContext(FocusContext);