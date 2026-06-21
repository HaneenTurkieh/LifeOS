import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2, ListTodo } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber.jsx';
import AnimatedFlame from './AnimatedFlame.jsx';
import ProductivitySphere from './ProductivitySphere.jsx';
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
    productivityScore, totalTasksToday: counts.totalTasksToday, totalHabits: counts.totalHabits,
    habitsDoneToday: counts.habitsDoneToday, tasksDoneToday: counts.tasksDoneToday,
  });
  const remainingTasks = Math.max(counts.totalTasksToday - counts.tasksDoneToday, 0);
  const remainingHabits = Math.max(counts.totalHabits - counts.habitsDoneToday, 0);

  return (
    <GlassCard tier={3} className="relative overflow-hidden p-7 sm:p-10 mb-6">
      <div className="pointer-events-none absolute inset-0 bg-mesh-app opacity-[0.5] dark:opacity-100" />
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-aurora-violet/15 dark:bg-aurora-violet/20 blur-3xl animate-floaty" />

      <div className="relative grid lg:grid-cols-[1fr_auto] gap-8 items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-aurora-purple dark:text-aurora-sky mb-1.5">{today}</p>
          <motion.h1
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="font-display text-2xl sm:text-3xl font-bold text-ink dark:text-white tracking-tight"
          >
            {greeting()}, {firstName} 👋
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-sm text-ink/55 dark:text-white/50 mt-2 max-w-md"
          >
            {insight}
          </motion.p>

          <div className="grid grid-cols-3 gap-3 mt-7 max-w-md">
            <StatTile customIcon={<AnimatedFlame size={15} className="text-white" />} accent="from-amber-400 to-orange-500"
              label="Streak" value={<AnimatedNumber value={streak} suffix="d" />} delay={0.2} />
            <StatTile icon={Sparkles} accent="from-aurora-violet to-aurora-indigo"
              label={`Lvl ${level.level}`} value={<AnimatedNumber value={level.xp} suffix=" XP" />} delay={0.25} />
            <StatTile icon={remainingTasks + remainingHabits === 0 ? CheckCircle2 : ListTodo}
              accent={remainingTasks + remainingHabits === 0 ? 'from-emerald-400 to-emerald-600' : 'from-aurora-sky to-blue-500'}
              label="Left today" value={<AnimatedNumber value={remainingTasks + remainingHabits} />} delay={0.3} />
          </div>

          <p className="text-xs text-ink/35 dark:text-white/30 italic mt-6 max-w-md leading-relaxed">
            "{quote.text}" <span className="not-italic text-ink/30 dark:text-white/25">— {quote.author}</span>
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <ProductivitySphere score={productivityScore} />
        </div>
      </div>
    </GlassCard>
  );
}

function StatTile({ icon: Icon, customIcon, accent, label, value, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -2 }}
      className="clay px-3.5 py-3"
    >
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-sm bg-gradient-to-br ${accent} mb-2`}>
        {customIcon || <Icon size={13} />}
      </div>
      <p className="font-display text-base font-bold text-ink dark:text-white leading-none">{value}</p>
      <p className="text-[10px] text-ink/45 dark:text-white/40 mt-1">{label}</p>
    </motion.div>
  );
}
