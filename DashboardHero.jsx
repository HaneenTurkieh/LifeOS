import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2, ListTodo, TrendingUp } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber.jsx';
import AnimatedFlame from './AnimatedFlame.jsx';
import GlassCard from './GlassCard.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function buildInsight({ productivityScore, totalTasksToday, totalHabits, habitsDoneToday, tasksDoneToday }) {
  const nothingPlanned = totalTasksToday === 0 && totalHabits === 0;
  if (nothingPlanned) return "A clear day on the calendar — a good moment to set a goal or plan tomorrow.";
  if (productivityScore >= 80) return "You're crushing it today — almost everything is done. 🔥";
  if (productivityScore >= 50) return "Solid pace today. A little more momentum and you're set.";
  const remainingTasks = Math.max(totalTasksToday - tasksDoneToday, 0);
  const remainingHabits = Math.max(totalHabits - habitsDoneToday, 0);
  if (remainingTasks + remainingHabits > 0) {
    const parts = [];
    if (remainingTasks > 0) parts.push(`${remainingTasks} task${remainingTasks === 1 ? '' : 's'}`);
    if (remainingHabits > 0) parts.push(`${remainingHabits} habit${remainingHabits === 1 ? '' : 's'}`);
    return `You've got ${parts.join(' and ')} left today — plenty of time to close it out.`;
  }
  return "Everything's wrapped up for today. Nice work.";
}

export default function DashboardHero({ data, userName }) {
  const { productivityScore, streak, level, counts, quote } = data;
  const firstName = userName?.split(' ')[0] || 'there';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const insight = buildInsight({
    productivityScore,
    totalTasksToday: counts.totalTasksToday,
    totalHabits: counts.totalHabits,
    habitsDoneToday: counts.habitsDoneToday,
    tasksDoneToday: counts.tasksDoneToday,
  });

  const remainingTasks = Math.max(counts.totalTasksToday - counts.tasksDoneToday, 0);
  const remainingHabits = Math.max(counts.totalHabits - counts.habitsDoneToday, 0);

  return (
    <GlassCard tier={3} className="relative overflow-hidden p-7 sm:p-9 mb-6">
      <div className="pointer-events-none absolute inset-0 bg-hero-gradient opacity-[0.07] dark:opacity-[0.18]" />
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-lavender-400/20 dark:bg-lavender-500/20 blur-3xl animate-floaty" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-sage-400/15 dark:bg-sage-500/10 blur-3xl animate-floaty" style={{ animationDelay: '1.5s' }} />

      <div className="relative">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-lavender-600 dark:text-lavender-300 mb-1.5">{today}</p>
            <motion.h1
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="font-display text-2xl sm:text-3xl font-bold text-ink dark:text-white"
            >
              {greeting()}, {firstName} 👋
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="text-sm text-ink/55 dark:text-white/50 mt-2 max-w-md"
            >
              {insight}
            </motion.p>
          </div>

          <div className="hidden sm:block max-w-[220px] text-right">
            <p className="text-xs text-ink/35 dark:text-white/30 italic leading-relaxed">"{quote.text}"</p>
            <p className="text-[11px] text-ink/30 dark:text-white/25 mt-1">— {quote.author}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-7">
          <StatTile
            icon={TrendingUp}
            accent="from-lavender-500 to-lavender-700"
            label="Productivity"
            value={<AnimatedNumber value={productivityScore} suffix="%" />}
            delay={0.15}
          />
          <StatTile
            customIcon={<AnimatedFlame size={16} className="text-white" />}
            accent="from-coral-400 to-coral-500"
            label="Streak"
            value={<AnimatedNumber value={streak} suffix={streak === 1 ? ' day' : ' days'} />}
            delay={0.2}
          />
          <StatTile
            icon={Sparkles}
            accent="from-lavender-400 to-lavender-600"
            label={`Level ${level.level}`}
            value={<AnimatedNumber value={level.xp} suffix=" XP" />}
            delay={0.25}
            footer={
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-ink/5 dark:bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-lavender-400 to-lavender-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${level.xpIntoLevel}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
                />
              </div>
            }
          />
          <StatTile
            icon={remainingTasks + remainingHabits === 0 ? CheckCircle2 : ListTodo}
            accent={remainingTasks + remainingHabits === 0 ? 'from-sage-400 to-sage-600' : 'from-sun-400 to-sun-600'}
            label="Remaining today"
            value={<AnimatedNumber value={remainingTasks + remainingHabits} />}
            delay={0.3}
          />
        </div>
      </div>
    </GlassCard>
  );
}

function StatTile({ icon: Icon, customIcon, accent, label, value, delay, footer }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}
      className="rounded-2xl bg-white/50 dark:bg-white/[0.04] border border-white/60 dark:border-white/10 px-4 py-3.5"
    >
      <div className="flex items-center gap-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm bg-gradient-to-br ${accent}`}>
          {customIcon || <Icon size={15} />}
        </div>
        <p className="text-[11px] font-medium text-ink/50 dark:text-white/40 truncate">{label}</p>
      </div>
      <p className="font-display text-lg font-bold text-ink dark:text-white mt-2 leading-none">{value}</p>
      {footer}
    </motion.div>
  );
}
