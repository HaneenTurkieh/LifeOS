import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import * as Icons from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import GlassCard from '../components/GlassCard.jsx';
import PriorityPill from '../components/PriorityPill.jsx';
import PageLoader from '../components/Loader.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { localDateStr } from '../utils/birthday.js';

export default function History() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pastDays, setPastDays] = useState(14);
  const toast = useToast();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'ar' ? 'ar' : 'en-US';

  const formatDayLabel = (dateStr, isToday) => {
    if (isToday) return t('common.today');
    const d = new Date(dateStr + 'T00:00:00');
    // Real bug that used to live here: toISOString() converts "now" to
    // UTC before slicing out the date, which is a different calendar day
    // than the user's own local "today" for roughly a third of the day in
    // any UTC+ timezone (this app's audience skews UTC+2/+3) — near local
    // midnight this mislabeled yesterday as "today" or shifted every
    // diffDays comparison by one, showing the wrong day as
    // Today/Yesterday/Tomorrow. localDateStr() (already used for the same
    // reason elsewhere in the app) reads the browser's own local calendar
    // date instead.
    const diffDays = Math.round((d - new Date(localDateStr() + 'T00:00:00')) / 86400000);
    if (diffDays === -1) return t('common.yesterday');
    if (diffDays === 1) return t('common.tomorrow');
    return d.toLocaleDateString(dateLocale, { weekday: 'long', month: 'short', day: 'numeric' });
  };
  const formatShort = (dateStr) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' });

  // A run of empty days (no completions, no habits, nothing due) carries
  // zero information one-by-one — six identical "Nothing tracked" cards
  // in a row is just scroll fatigue. Collapse consecutive empty days
  // (never crossing Today, and never mixing past with future) into a
  // single compact strip, and keep full cards only where something
  // actually happened or is due.
  const buildBlocks = (days) => {
    const blocks = [];
    let run = [];
    const isEmptyDay = (d) => d.tasksCompleted.length + d.habitsCompleted.length === 0 && d.tasksDue.length === 0;
    const flush = () => {
      if (run.length === 1) blocks.push({ type: 'day', day: run[0] });
      else if (run.length > 1) blocks.push({ type: 'group', days: run });
      run = [];
    };
    for (const day of days) {
      if (isEmptyDay(day) && !day.isToday) {
        if (run.length && run[run.length - 1].isFuture !== day.isFuture) flush();
        run.push(day);
      } else {
        flush();
        blocks.push({ type: 'day', day });
      }
    }
    flush();
    return blocks;
  };

  useEffect(() => {
    setLoading(true);
    api.get(`/history?pastDays=${pastDays}&futureDays=7`)
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [pastDays]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !data) return <PageLoader />;

  const pastReversed = data.days.filter((d) => !d.isFuture).slice().reverse();
  const future = data.days.filter((d) => d.isFuture);
  const orderedDays = [...future.slice().reverse(), ...pastReversed];

  const hasAnyActivity = data.days.some((d) => d.tasksCompleted.length || d.habitsCompleted.length || d.tasksDue.length);

  return (
    <div>
      <PageHeader
        eyebrow={t('history.eyebrow')}
        title={t('history.title')}
        subtitle={t('history.subtitle')}
        action={
          <button onClick={() => setPastDays((p) => p + 14)} className="btn-secondary text-xs">
            {t('history.loadMore')}
          </button>
        }
      />

      {!hasAnyActivity ? (
        <EmptyState icon={Clock} title={t('history.emptyTitle')} message={t('history.emptyDesc')} />
      ) : (
        <div className="flex flex-col gap-3">
          {buildBlocks(orderedDays).map((block, i) => {
            if (block.type === 'group') {
              const isFuture = block.days[0].isFuture;
              const start = block.days[block.days.length - 1].date;
              const end   = block.days[0].date;
              return (
                <div
                  key={`group-${start}-${end}`}
                  className="flex items-center gap-3 rounded-2xl px-5 py-3"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px dashed rgba(255,255,255,0.14)',
                  }}
                >
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isFuture ? 'bg-sun-500/50' : 'bg-sage-500/50'}`} />
                  <p className="text-xs font-medium text-ink/40 dark:text-white/35">
                    {formatShort(start)} – {formatShort(end)}
                  </p>
                  <span className="h-1 w-1 rounded-full bg-ink/15 dark:bg-white/15 shrink-0" />
                  <p className="text-xs text-ink/35 dark:text-white/30">
                    {isFuture
                      ? t('history.groupNothingDue', { n: block.days.length })
                      : t('history.groupNothingTracked', { n: block.days.length })}
                  </p>
                </div>
              );
            }

            const day = block.day;
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
                        ? t('history.nDue', { n: day.tasksDue.length })
                        : t('history.nCompleted', { n: totalDone })}
                    </span>
                  )}
                </div>

                {isEmpty ? (
                  <p className="text-xs text-ink/35 dark:text-white/30 ps-4">
                    {day.isFuture ? t('history.nothingDue') : t('history.nothing')}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5 ps-4">
                    {day.tasksCompleted.map((tk) => (
                      <div key={`t-${tk.id}`} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 size={14} className="text-sage-500 shrink-0" />
                        <span className="text-ink/80 dark:text-white/75 truncate flex-1">{tk.title}</span>
                        <PriorityPill priority={tk.priority} />
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
                    {day.tasksDue.map((tk) => (
                      <div key={`due-${tk.id}`} className="flex items-center gap-2 text-sm">
                        <Clock size={14} className="text-sun-500 shrink-0" />
                        <span className="text-ink/70 dark:text-white/65 truncate flex-1">{tk.title}</span>
                        <PriorityPill priority={tk.priority} />
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