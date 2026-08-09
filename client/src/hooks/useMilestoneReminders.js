import { useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { playReminderSound } from '../utils/sounds.js';

// Companion to useTaskReminders.js — same in-tab-only pattern, but for
// milestones pinned to "today" via the goal day-planner
// (goals.js's PUT .../milestones/:id/schedule). Polls once a minute,
// pops a toast + sound the moment a scheduled milestone's day arrives,
// once per milestone per session (a persistent copy also lands in the
// notification bell via generateNotifications in notifications.js —
// this hook is just the immediate "pop" while the tab is open).
export default function useMilestoneReminders() {
  const toast = useToast();
  const remindedRef = useRef(new Set());

  useEffect(() => {
    const checkDueMilestones = async () => {
      try {
        const goals = await api.get('/goals');
        const todayStr = new Date().toISOString().slice(0, 10);

        goals.forEach((g) => {
          (g.milestones || []).forEach((m) => {
            if (
              !m.done &&
              m.scheduled_date === todayStr &&
              !remindedRef.current.has(m.id)
            ) {
              remindedRef.current.add(m.id);
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
