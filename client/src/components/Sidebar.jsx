// Sidebar.jsx
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Clock, ListChecks, Target, Timer,
  BarChart3, Rocket, Sparkles, TreePine, Settings,
  GraduationCap, CalendarDays, Users, Trophy,
} from 'lucide-react';
import SettingsModal from './SettingsModal.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useAuth }     from '../context/AuthContext.jsx';

// Labels are translation keys — resolved with t() at render time
const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'nav.dashboard' },
  { to: '/history',   icon: Clock,           label: 'nav.history'   },
  { to: '/tasks',     icon: ListChecks,      label: 'nav.tasks'     },
  { to: '/calendar',  icon: CalendarDays,    label: 'nav.calendar'  },
  { to: '/goals',     icon: Target,          label: 'nav.goals'     },
  { to: '/learning',  icon: Timer,           label: 'nav.flow'      },
  { to: '/rankings',  icon: Trophy,          label: 'nav.rankings'  },
  { to: '/channels',  icon: Users,           label: 'nav.channels'  },
  { to: '/ai',        icon: Sparkles,        label: 'nav.lumi'      },
  { to: '/exam',      icon: GraduationCap,   label: 'nav.exam'      },
  { to: '/analytics', icon: BarChart3,       label: 'nav.analytics' },
  { to: '/launchpad', icon: Rocket,          label: 'nav.launchpad' },
  { to: '/trees',     icon: TreePine,        label: 'nav.treeshop'  },
];
// An instructor account only gets what it actually needs — Dashboard
// (its own simplified view, see InstructorDashboard.jsx), Channels (the
// whole point of the account), and Lumi. Settings is separate from this
// array (its own gear icon below) and stays available to every role.
// Per Haneen's spec: "admins have lumi and settings... only add features
// and tabs they need."
const INSTRUCTOR_NAV_PATHS = new Set(['/', '/channels', '/rankings', '/ai']);

function NavTooltip({ label }) {
  return (
    <span
      className="pointer-events-none absolute whitespace-nowrap rounded-xl bg-ink/90 dark:bg-black/90 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
      // insetInlineStart is a CSS *logical* property: it means "left" in
      // LTR and "right" in RTL, so the tooltip always points toward the
      // page content no matter which side the sidebar sits on.
      style={{ insetInlineStart: '3.25rem', top: '50%', transform: 'translateY(-50%)', zIndex: 9999 }}
    >
      {label}
    </span>
  );
}
const hoverCard = {
  background: 'rgba(255,255,255,0.90)',
  boxShadow:  '0 8px 24px rgba(0,0,0,0.14), 0 2px 8px rgb(var(--accent-500) / 0.18), inset 0 1px 0 rgba(255,255,255,1)',
};

export default function Sidebar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { t }    = useLanguage();
  const { user } = useAuth();
  const navItems = user?.role === 'instructor'
    ? NAV.filter((item) => INSTRUCTOR_NAV_PATHS.has(item.to))
    : NAV;
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
        {/* Logo mark — the Nuvora ribbon icon. Carries its own violet/
            pink/blue gradient, so unlike most sidebar chrome it doesn't
            re-tint with the user's chosen accent color — a brand mark
            should stay recognizable regardless of theme. */}
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-3 flex h-10 w-10 items-center justify-center shrink-0"
        >
          <img src="/icon-192.png" alt="Nuvora" className="h-10 w-10 drop-shadow-lg" />
        </motion.div>
        {/* Nav */}
        <nav className="flex flex-col gap-1" style={{ overflow: 'visible' }}>
          {navItems.map(({ to, icon: Icon, label }) => (
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
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        background: 'linear-gradient(135deg, rgb(var(--accent-500)) 0%, rgb(var(--accent-600)) 100%)',
                        boxShadow: '0 8px 24px rgb(var(--accent-500) / 0.5)',
                      }}
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
                        style={hoverCard}
                      />
                    )}
                    <Icon
                      size={19}
                      strokeWidth={2.1}
                      className={`relative z-10 transition-colors duration-150 ${
                        isActive
                          ? 'text-white'
                          : 'text-ink/40 dark:text-white/40 group-hover:text-[rgb(var(--accent-500))]'
                      }`}
                    />
                  </motion.span>
                  <NavTooltip label={t(label)} />
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
              style={hoverCard}
            />
            <Settings
              size={19}
              strokeWidth={2.1}
              className="relative z-10 text-ink/40 dark:text-white/40 group-hover:text-[rgb(var(--accent-500))] transition-colors duration-150"
            />
            <NavTooltip label={t('nav.settings')} />
          </motion.button>
        </div>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </aside>
  );
}