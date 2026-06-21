import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import * as Icons from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import GlassCard from '../components/GlassCard.jsx';
import PriorityPill from '../components/PriorityPill.jsx';
import PageLoader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';

function formatDayLabel(dateStr, isToday) {
  if (isToday) return 'Today';
  const d = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((d - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')) / 86400000);
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function History() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pastDays, setPastDays] = useState(14);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    api.get(`/history?pastDays=${pastDays}&futureDays=7`)
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [pastDays]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !data) return <PageLoader />;

  // Show most recent first: reverse past days, keep today + future in order.
  const pastReversed = data.days.filter((d) => !d.isFuture).slice().reverse();
  const future = data.days.filter((d) => d.isFuture);
  const orderedDays = [...future.slice().reverse(), ...pastReversed];

  const hasAnyActivity = data.days.some((d) => d.tasksCompleted.length || d.habitsCompleted.length || d.tasksDue.length);

  return (
    <div>
      <PageHeader
        eyebrow="History"
        title="Your timeline"
        subtitle="See what you've gotten done, and what's coming up next."
        action={
          <button
            onClick={() => setPastDays((p) => p + 14)}
            className="btn-secondary text-xs"
          >
            Load more history
          </button>
        }
      />

      {!hasAnyActivity ? (
        <EmptyState icon={Clock} title="Nothing tracked yet" message="Complete a task or habit and it'll show up here." />
      ) : (
        <div className="flex flex-col gap-3">
          {orderedDays.map((day, i) => {
            const totalDone = day.tasksCompleted.length + day.habitsCompleted.length;
            const isEmpty = totalDone === 0 && day.tasksDue.length === 0;
            return (
              <GlassCard
                key={day.date}
                tier={day.isToday ? 2 : 1}
                delay={Math.min(i * 0.02, 0.3)}
                className={`p-5 ${day.isToday ? 'ring-1 ring-lavender-400/40' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${day.isToday ? 'bg-lavender-500' : day.isFuture ? 'bg-sun-500' : 'bg-sage-500'}`} />
                    <p className="font-display font-semibold text-ink dark:text-white text-sm">
                      {formatDayLabel(day.date, day.isToday)}
                    </p>
                  </div>
                  {!isEmpty && (
                    <span className="text-[11px] text-ink/40 dark:text-white/35">
                      {day.isFuture
                        ? `${day.tasksDue.length} due`
                        : `${totalDone} completed`}
                    </span>
                  )}
                </div>

                {isEmpty ? (
                  <p className="text-xs text-ink/35 dark:text-white/30 pl-4">Nothing tracked.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 pl-4">
                    {day.tasksCompleted.map((t) => (
                      <div key={`t-${t.id}`} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 size={14} className="text-sage-500 shrink-0" />
                        <span className="text-ink/80 dark:text-white/75 truncate flex-1">{t.title}</span>
                        <PriorityPill priority={t.priority} />
                      </div>
                    ))}
                    {day.habitsCompleted.map((h) => {
                      const Icon = Icons[h.icon] || Icons.Sparkles;
                      return (
                        <div key={`h-${h.id}-${day.date}`} className="flex items-center gap-2 text-sm">
                          <div className="flex h-4 w-4 items-center justify-center rounded shrink-0" style={{ backgroundColor: h.color }}>
                            <Icon size={10} className="text-white" />
                          </div>
                          <span className="text-ink/70 dark:text-white/65">{h.name}</span>
                        </div>
                      );
                    })}
                    {day.tasksDue.map((t) => (
                      <div key={`due-${t.id}`} className="flex items-center gap-2 text-sm">
                        <Clock size={14} className="text-sun-500 shrink-0" />
                        <span className="text-ink/70 dark:text-white/65 truncate flex-1">{t.title}</span>
                        <PriorityPill priority={t.priority} />
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
