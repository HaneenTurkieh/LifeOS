import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Clock, ListChecks, Target, BookOpen, Dumbbell, BarChart3,
  Briefcase, FileText, FolderKanban, Sparkles, TreePine, Settings,
} from 'lucide-react';
import SettingsModal from './SettingsModal.jsx';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
{ to: '/history', icon: Clock, label: 'History' },
  { to: '/tasks', icon: ListChecks, label: 'Tasks' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/habits', icon: Dumbbell, label: 'Habits' },
  { to: '/learning', icon: BookOpen, label: 'Learning' },
  { to: '/ai', icon: Sparkles, label: 'AI Tools' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/internships', icon: Briefcase, label: 'Internships' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/cv', icon: FileText, label: 'CV Builder' },
];

export default function Sidebar() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <aside className="hidden lg:flex flex-col items-center w-20 shrink-0 py-6">
      <div className="relative flex flex-col items-center gap-1 rounded-[2rem] border border-white/70 dark:border-white/10 glass-spline px-2.5 py-4 sticky top-6">
        <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />

        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-aurora-violet to-aurora-indigo text-white shadow-[0_8px_20px_rgba(124,92,255,0.4)]"
        >
          <TreePine size={20} />
        </motion.div>

        <nav className="flex flex-col gap-1.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} title={label} className="group relative flex h-11 w-11 items-center justify-center">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-2xl bg-gradient-to-br from-aurora-violet to-aurora-indigo shadow-[0_6px_18px_rgba(124,92,255,0.45)]"
                    />
                  )}
                  <motion.span
                    whileHover={{ y: -2, scale: 1.06 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                      isActive ? 'text-white' : 'text-ink/40 dark:text-white/40 hover:text-aurora-violet dark:hover:text-aurora-sky hover:bg-white/70 dark:hover:bg-white/10'
                    }`}
                  >
                    <Icon size={19} strokeWidth={2.1} />
                  </motion.span>
                  <span className="pointer-events-none absolute left-[3.25rem] z-50 whitespace-nowrap rounded-xl bg-ink/90 dark:bg-black/90 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-3 pt-3 border-t border-ink/5 dark:border-white/10 w-full flex justify-center">
          <motion.button
            whileHover={{ y: -2, scale: 1.06 }}
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-ink/40 dark:text-white/40 hover:text-aurora-violet dark:hover:text-aurora-sky hover:bg-white/70 dark:hover:bg-white/10 transition-colors"
          >
            <Settings size={19} strokeWidth={2.1} />
          </motion.button>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}
