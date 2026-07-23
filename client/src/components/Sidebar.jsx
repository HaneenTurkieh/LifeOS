import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Clock, ListChecks, Target, Timer,
  BarChart3, Rocket, Sparkles, TreePine, Settings, GraduationCap,
} from 'lucide-react';
import SettingsModal from './SettingsModal.jsx';

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/history',   icon: Clock,           label: 'History'   },
  { to: '/tasks',     icon: ListChecks,      label: 'Tasks'     },
  { to: '/goals',     icon: Target,          label: 'Goals'     },
  { to: '/learning',  icon: Timer,           label: 'Flow'      },
  { to: '/ai',        icon: Sparkles,        label: 'Lumi AI'   },
  { to: '/exam',      icon: GraduationCap,   label: 'Exam AI'   },
  { to: '/analytics', icon: BarChart3,       label: 'Analytics' },
  { to: '/launchpad', icon: Rocket,          label: 'Launchpad' },
  { to: '/trees',     icon: TreePine,        label: 'Tree Shop' },
];

export default function Sidebar() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <aside
      className="hidden lg:flex flex-col items-center w-20 shrink-0 py-6"
      style={{ position: 'relative', zIndex: 100, overflow: 'visible' }}
    >
      <div
        className="relative flex flex-col items-center gap-1 rounded-[2rem] border border-white/70 dark:border-white/10 glass-spline px-2.5 py-4 sticky top-6"
        style={{ overflow: 'visible' }}
      >
        <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />

        {/* Logo */}
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-aurora-violet to-aurora-indigo text-white shadow-[0_8px_20px_rgba(124,92,255,0.4)]"
        >
          <TreePine size={20} />
        </motion.div>

        {/* Nav */}
        <nav className="flex flex-col gap-1" style={{ overflow: 'visible' }}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="group relative flex h-11 w-11 items-center justify-center"
              style={{ overflow: 'visible' }}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute inset-0 rounded-2xl bg-gradient-to-br from-aurora-violet to-aurora-indigo"
                      style={{ boxShadow: '0 8px 24px rgba(124,92,255,0.5)' }}
                    />
                  )}

                  <motion.span
                    whileHover={!isActive ? {
                      y: -4, scale: 1.18,
                      transition: { type: 'spring', stiffness: 500, damping: 22 },
                    } : {}}
                    whileTap={{ scale: 0.94 }}
                    className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                      isActive ? 'text-white' : 'text-ink/40 dark:text-white/40'
                    }`}
                  >
                    {!isActive && (
                      <span
                        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        style={{
                          background: 'rgba(255,255,255,0.90)',
                          boxShadow:  '0 8px 24px rgba(0,0,0,0.14), 0 2px 8px rgba(124,92,255,0.18), inset 0 1px 0 rgba(255,255,255,1)',
                        }}
                      />
                    )}
                    <Icon
                      size={19}
                      strokeWidth={2.1}
                      className={`relative z-10 transition-colors duration-150 ${
                        isActive
                          ? 'text-white'
                          : 'text-ink/40 dark:text-white/40 group-hover:text-aurora-violet'
                      }`}
                    />
                  </motion.span>

                  {/* Tooltip */}
                  <span
                    className="pointer-events-none absolute whitespace-nowrap rounded-xl bg-ink/90 dark:bg-black/90 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
                    style={{
                      left:      '3.25rem',
                      top:       '50%',
                      transform: 'translateY(-50%)',
                      zIndex:    9999,
                    }}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Settings */}
        <div
          className="mt-3 pt-3 border-t border-ink/5 dark:border-white/10 w-full flex justify-center"
          style={{ overflow: 'visible' }}
        >
          <motion.button
            whileHover={{ y: -4, scale: 1.18, transition: { type: 'spring', stiffness: 500, damping: 22 } }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setSettingsOpen(true)}
            className="group relative flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ overflow: 'visible' }}
          >
            <span
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{
                background: 'rgba(255,255,255,0.90)',
                boxShadow:  '0 8px 24px rgba(0,0,0,0.14), 0 2px 8px rgba(124,92,255,0.18), inset 0 1px 0 rgba(255,255,255,1)',
              }}
            />
            <Settings
              size={19}
              strokeWidth={2.1}
              className="relative z-10 text-ink/40 dark:text-white/40 group-hover:text-aurora-violet transition-colors duration-150"
            />
            <span
              className="pointer-events-none absolute whitespace-nowrap rounded-xl bg-ink/90 dark:bg-black/90 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
              style={{
                left:      '3.25rem',
                top:       '50%',
                transform: 'translateY(-50%)',
                zIndex:    9999,
              }}
            >
              Settings
            </span>
          </motion.button>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}