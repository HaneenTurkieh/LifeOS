import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, LayoutDashboard, ListChecks, Target, Dumbbell, Sparkles, MoreHorizontal,
  BarChart3, BookOpen, Briefcase, FolderKanban, FileText, X, Settings,
} from 'lucide-react';
import SettingsModal from './SettingsModal.jsx';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/tasks', icon: ListChecks, label: 'Tasks' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/habits', icon: Dumbbell, label: 'Habits' },
  { to: '/ai', icon: Sparkles, label: 'AI' },
];

const MORE_ITEMS = [
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/learning', icon: BookOpen, label: 'Learning' },
  { to: '/internships', icon: Briefcase, label: 'Internships' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/cv', icon: FileText, label: 'CV Builder' },
];

export default function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-50 glass-panel rounded-3xl px-2 py-2">
        <div className="flex items-center justify-between">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-lavender-600 dark:text-lavender-300' : 'text-ink/40 dark:text-white/40'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${isActive ? 'bg-lavender-100 dark:bg-lavender-500/15' : ''}`}>
                    <Icon size={17} />
                  </div>
                  {label}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-medium text-ink/40 dark:text-white/40"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl">
              <MoreHorizontal size={17} />
            </div>
            More
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-[90] bg-ink/30 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="absolute bottom-0 left-0 right-0 glass-panel rounded-t-3xl p-5 pb-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-ink dark:text-white">More</h3>
                <button onClick={() => setMoreOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-xl text-ink/40 dark:text-white/40 hover:bg-ink/5 dark:hover:bg-white/10">
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {MORE_ITEMS.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-2 rounded-2xl bg-ink/5 dark:bg-white/5 py-4 text-xs font-medium text-ink/70 dark:text-white/60"
                  >
                    <Icon size={20} />
                    {label}
                  </NavLink>
                ))}

                {/* Settings opens the modal, not a route */}
                <button
                  onClick={() => { setMoreOpen(false); setSettingsOpen(true); }}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-ink/5 dark:bg-white/5 py-4 text-xs font-medium text-ink/70 dark:text-white/60"
                >
                  <Settings size={20} />
                  Settings
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}