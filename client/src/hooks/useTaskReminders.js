import { useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { playReminderSound } from '../utils/sounds.js';

// Polls for tasks due "right now" once a minute while the app is open in
// a tab, and fires a toast + sound when one matches. This is an in-tab
// reminder only — it does NOT work if the tab/app is closed or the device
// is locked. True push notifications (working when closed) would require
// a service worker + Web Push API + backend scheduling — a bigger,
// separate project. iOS Safari additionally only supports push at all if
// the site is added to the Home Screen as a PWA, regardless.
export default function useTaskReminders() {
  const toast = useToast();
  const remindedRef = useRef(new Set()); // task ids already reminded this session, avoid repeat pings

  useEffect(() => {
    const checkDueTasks = async () => {
      try {
        const tasks = await api.get('/tasks');
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const currentHHMM = now.toTimeString().slice(0, 5); // "HH:MM"

        tasks.forEach((t) => {
          if (
            t.status !== 'done' &&
            t.deadline === todayStr &&
            t.deadline_time &&
            t.deadline_time <= currentHHMM &&
            !remindedRef.current.has(t.id)
          ) {
            remindedRef.current.add(t.id);
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
