import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, LayoutDashboard, ListChecks, Target, Sparkles,
  MoreHorizontal, BarChart3, Timer, Rocket, TreePine,
  GraduationCap, X, Settings,
} from 'lucide-react';
import SettingsModal from './SettingsModal.jsx';

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Home'  },
  { to: '/tasks',     icon: ListChecks,      label: 'Tasks' },
  { to: '/goals',     icon: Target,          label: 'Goals' },
  { to: '/analytics', icon: BarChart3,       label: 'Stats' },
  { to: '/ai',        icon: Sparkles,        label: 'Lumi'  },
];

const MORE_ITEMS = [
  { to: '/history',   icon: Clock,          label: 'History'   },
  { to: '/learning',  icon: Timer,          label: 'Flow'      },
  { to: '/exam',      icon: GraduationCap,  label: 'Exam AI'   },
  { to: '/launchpad', icon: Rocket,         label: 'Launchpad' },
  { to: '/trees',     icon: TreePine,       label: 'Tree Shop' },
];

export default function MobileNav() {
  const [moreOpen,     setMoreOpen]     = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      {/* Bottom nav */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-50 glass-panel rounded-3xl px-2 py-2">
        <div className="flex items-center justify-between">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="flex flex-1 flex-col items-center"
            >
              {({ isActive }) => (
                <motion.div
                  className="flex flex-col items-center gap-0.5 py-1.5 w-full rounded-2xl"
                  animate={isActive ? { y: -3 } : { y: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                >
                  <motion.div
                    whileTap={{ scale: 0.90 }}
                    className="relative flex h-9 w-9 items-center justify-center rounded-xl"
                    style={isActive ? {
                      background: 'rgba(255,255,255,0.95)',
                      boxShadow:  '0 8px 20px rgba(0,0,0,0.14), 0 2px 8px rgba(124,92,255,0.22), inset 0 1px 0 rgba(255,255,255,1)',
                    } : {}}
                  >
                    <Icon
                      size={17}
                      className={isActive ? 'text-aurora-violet' : 'text-ink/40 dark:text-white/40'}
                    />
                  </motion.div>
                  <span className={`text-[10px] font-medium ${
                    isActive ? 'text-aurora-violet dark:text-lavender-300' : 'text-ink/40 dark:text-white/40'
                  }`}>
                    {label}
                  </span>
                </motion.div>
              )}
            </NavLink>
          ))}

          {/* More button */}
          <motion.button
            whileTap={{ scale: 0.90 }}
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 py-1.5 rounded-2xl"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl">
              <MoreHorizontal size={17} className="text-ink/40 dark:text-white/40" />
            </div>
            <span className="text-[10px] font-medium text-ink/40 dark:text-white/40">More</span>
          </motion.button>
        </div>
      </nav>

      {/* More sheet */}
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
                <button
                  onClick={() => setMoreOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-ink/40 dark:text-white/40 hover:bg-ink/5 dark:hover:bg-white/10"
                >
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
                    <Icon size={20} />{label}
                  </NavLink>
                ))}
                <button
                  onClick={() => { setMoreOpen(false); setSettingsOpen(true); }}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-ink/5 dark:bg-white/5 py-4 text-xs font-medium text-ink/70 dark:text-white/60"
                >
                  <Settings size={20} /> Settings
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