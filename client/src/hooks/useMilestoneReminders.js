import { useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { playReminderSound } from '../utils/sounds.js';

const STORAGE_KEY = 'nuvora:remindedMilestones';

// Same persistence trick as useTaskReminders.js's loadRemindedToday/
// saveReminded — see that file for the full rationale. Storage shape is
// { [milestoneId]: 'YYYY-MM-DD' }, pruned to today on every write.
function loadRemindedToday(todayStr) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return new Set(Object.keys(raw).filter((id) => raw[id] === todayStr));
  } catch {
    return new Set();
  }
}

function saveReminded(milestoneId, todayStr) {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    raw[milestoneId] = todayStr;
    Object.keys(raw).forEach((id) => { if (raw[id] !== todayStr) delete raw[id]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  } catch {
    // localStorage unavailable — reminder still works for this tab via
    // remindedRef, just won't survive a reload.
  }
}

// Companion to useTaskReminders.js — same in-tab-only pattern, but for
// milestones pinned to "today" via the goal day-planner
// (goals.js's PUT .../milestones/:id/schedule). Polls once a minute,
// pops a toast + sound the moment a scheduled milestone's day arrives,
// once per milestone per day (persisted to localStorage so a reload
// doesn't re-pop it — a persistent copy also lands in the notification
// bell via generateNotifications in notifications.js; this hook is just
// the immediate "pop" while the tab is open).
export default function useMilestoneReminders() {
  const toast = useToast();
  const remindedRef = useRef(null); // lazy-seeded from localStorage inside the effect, needs today's date first

  useEffect(() => {
    const checkDueMilestones = async () => {
      try {
        const goals = await api.get('/goals');
        const todayStr = new Date().toISOString().slice(0, 10);

        if (!remindedRef.current) remindedRef.current = loadRemindedToday(todayStr);

        goals.forEach((g) => {
          (g.milestones || []).forEach((m) => {
            const id = String(m.id);
            if (
              !m.done &&
              m.scheduled_date === todayStr &&
              !remindedRef.current.has(id)
            ) {
              remindedRef.current.add(id);
              saveReminded(id, todayStr);
              toast.push({
                type:     'achievement',
                title:    '📅 Milestone due today',
                message:  `${m.title} — ${g.title}`,
                duration: 6000,
              });
              playReminderSound();
            }
          });
        });
      } catch {
        // Silently skip a failed check — it'll retry next minute.
      }
    };

    checkDueMilestones();
    const interval = setInterval(checkDueMilestones, 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
