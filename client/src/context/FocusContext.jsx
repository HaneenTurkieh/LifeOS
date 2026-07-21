import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api/client.js';

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
];

export const randQuote = () => QUOTES[Math.floor(Math.random() * QUOTES.length)];

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

export function FocusProvider({ children }) {
  const [mode,      setMode]      = useState('focus');
  const [customMin, setCustomMin] = useState({ focus: 25, short: 5, long: 15 });
  const [timeLeft,  setTimeLeft]  = useState(25 * 60);
  const [totalTime, setTotalTime] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [taskName,  setTaskName]  = useState('');
  const [dots,      setDots]      = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [congrats,  setCongrats]  = useState(null);
  const [stats,     setStats]     = useState(null);
  const [board,     setBoard]     = useState([]);
  const [room,      setRoom]      = useState(null);

  const intervalRef  = useRef(null);
  const modeRef      = useRef(mode);
  const customMinRef = useRef(customMin);
  const taskRef      = useRef(taskName);
  const roomRef      = useRef(room);
  useEffect(() => { modeRef.current = mode; },      [mode]);
  useEffect(() => { customMinRef.current = customMin; }, [customMin]);
  useEffect(() => { taskRef.current = taskName; },   [taskName]);
  useEffect(() => { roomRef.current = room; },       [room]);

  const loadData = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([api.get('/focus/stats'), api.get('/focus/leaderboard')]);
      setStats(s); setBoard(l.leaderboard || []);
    } catch (_) {}
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Room polling
  useEffect(() => {
    if (!room) return;
    const poll = async () => {
      try {
        const d = await api.get(`/focus/rooms/${room.code}`);
        setRoom((r) => r ? { ...r, members: d.members } : null);
      } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [room?.code]); // eslint-disable-line

  // Room pulse
  useEffect(() => {
    if (!room) return;
    const pulse = () => api.post(`/focus/rooms/${room.code}/pulse`, { is_focusing: isRunning }).catch(() => {});
    pulse();
    const id = setInterval(pulse, 30000);
    return () => clearInterval(id);
  }, [room?.code, isRunning]); // eslint-disable-line

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
      setMode('focus'); setTimeLeft(mins * 60); setTotalTime(mins * 60);
    }
  }, [loadData]);

  // The one timer — lives here forever
  useEffect(() => {
    if (!isRunning) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setIsRunning(false);
          setStartedAt(null);
          setTimeout(handleComplete, 50);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isRunning, handleComplete]);

  // Update document title when running
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
    clearInterval(intervalRef.current); setIsRunning(false); setStartedAt(null);
    setMode(m); const mins = customMin[m]; setTimeLeft(mins * 60); setTotalTime(mins * 60);
  };

  const toggleTimer = () => {
    if (timeLeft === 0) return;
    if (!isRunning) setStartedAt(new Date());
    setIsRunning((r) => !r);
  };

  const resetTimer = () => {
    clearInterval(intervalRef.current); setIsRunning(false); setStartedAt(null);
    const mins = customMin[mode]; setTimeLeft(mins * 60); setTotalTime(mins * 60);
  };

  const addMinute = () => {
    setTimeLeft((t) => t + 60);
    setTotalTime((t) => t + 60);
    setCustomMin((c) => ({ ...c, [mode]: c[mode] + 1 }));
  };

  const setDuration = (mins) => {
    setCustomMin((c) => ({ ...c, [mode]: mins }));
    if (!isRunning) { setTimeLeft(mins * 60); setTotalTime(mins * 60); }
  };

  const handleModeClick = (m) => {
    if (isRunning && !window.confirm('Switch mode? Current session will be lost.')) return;
    switchMode(m);
  };

  return (
    <FocusContext.Provider value={{
      mode, customMin, timeLeft, totalTime, isRunning, taskName, dots, startedAt,
      congrats, stats, board, room,
      setTaskName, setRoom, setCongrats,
      toggleTimer, resetTimer, addMinute, setDuration, handleModeClick, switchMode,
      loadData,
    }}>
      {children}
    </FocusContext.Provider>
  );
}

export const useFocus = () => useContext(FocusContext);