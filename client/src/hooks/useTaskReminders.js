import { useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { playReminderSound } from '../utils/sounds.js';

const STORAGE_KEY = 'nuvora:remindedTasks';

// Storage shape is { [taskId]: 'YYYY-MM-DD' } — only entries dated today
// count as "already reminded"; anything older is stale (yesterday's
// reminders) and gets dropped on the next write, so this never grows
// unbounded. Reading it on mount is what stops a hard refresh, a
// reopened tab, or navigating by typing a URL from re-popping a toast
// for a task that already got its toast earlier today — previously the
// "already reminded" set lived only in a useRef, which is wiped by any
// full remount of the app.
function loadRemindedToday(todayStr) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return new Set(Object.keys(raw).filter((id) => raw[id] === todayStr));
  } catch {
    return new Set();
  }
}

function saveReminded(taskId, todayStr) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    raw[taskId] = todayStr;
    Object.keys(raw).forEach((id) => { if (raw[id] !== todayStr) delete raw[id]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  } catch {
    // localStorage unavailable (private mode, quota) — reminder still
    // works for this tab via remindedRef, just won't survive a reload.
  }
}

// Polls for tasks due "right now" once a minute while the app is open in
// a tab, and fires a toast + sound when one matches. This is an in-tab
// reminder only — it does NOT work if the tab/app is closed or the device
// is locked. True push notifications (working when closed) would require
// a service worker + Web Push API + backend scheduling — a bigger,
// separate project. iOS Safari additionally only supports push at all if
// the site is added to the Home Screen as a PWA, regardless.
export default function useTaskReminders() {
  const toast = useToast();
  const remindedRef = useRef(null); // lazy-seeded from localStorage inside the effect, needs today's date first

  useEffect(() => {
    const checkDueTasks = async () => {
      try {
        const tasks = await api.get('/tasks');
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const currentHHMM = now.toTimeString().slice(0, 5); // "HH:MM"

        if (!remindedRef.current) remindedRef.current = loadRemindedToday(todayStr);

        tasks.forEach((t) => {
          const id = String(t.id);
          if (
            t.status !== 'done' &&
            t.deadline === todayStr &&
            t.deadline_time &&
            t.deadline_time <= currentHHMM &&
            !remindedRef.current.has(id)
          ) {
            remindedRef.current.add(id);
            saveReminded(id, todayStr);
            toast.push({ type: 'achievement', title: '⏰ Task reminder', message: t.title, duration: 6000 });
            playReminderSound();
          }
        });
      } catch {
        // Silently skip a failed check — it'll retry next minute.
      }
    };

    checkDueTasks(); // check immediately on mount too, not just after 60s
    const interval = setInterval(checkDueTasks, 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
