import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, LayoutDashboard, ListChecks, Target, Sparkles,
  MoreHorizontal, BarChart3, Timer, Rocket, TreePine,
  GraduationCap, CalendarDays, X, Settings,
} from 'lucide-react';
import SettingsModal from './SettingsModal.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

// Labels are translation keys — resolved with t() at render time.
// Flow used to be buried in the "More" sheet, which meant the single most
// distinctive feature in the app — a live focus timer that grows a tree
// while you work — was the one thing most people never opened. Promoted
// to a direct tab; everything else in MORE_ITEMS stays there.
const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'nav.dashboard' },
  { to: '/tasks',     icon: ListChecks,      label: 'nav.tasks'     },
  { to: '/calendar',  icon: CalendarDays,    label: 'nav.calendar'  },
  { to: '/goals',     icon: Target,          label: 'nav.goals'     },
  { to: '/learning',  icon: Timer,           label: 'nav.flow'      },
  { to: '/ai',        icon: Sparkles,        label: 'nav.lumi'      },
];
const MORE_ITEMS = [
  { to: '/history',   icon: Clock,          label: 'nav.history'   },
  { to: '/exam',      icon: GraduationCap,  label: 'nav.exam'      },
  { to: '/analytics', icon: BarChart3,      label: 'nav.analytics' },
  { to: '/launchpad', icon: Rocket,         label: 'nav.launchpad' },
  { to: '/trees',     icon: TreePine,       label: 'nav.treeshop'  },
];

export default function MobileNav() {
  const [moreOpen,     setMoreOpen]     = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { t } = useLanguage();
  return (
    <>
      {/* Bottom nav */}
      {/* That white block floating mid-page mid-scroll on iPhone/iPad is
          a known WebKit bug, not a layout bug: a `position: fixed`
          element that ALSO has `backdrop-filter: blur` (glass-panel's
          own backdrop-blur-xl) can get left behind during scroll —
          Safari finishes compositing at the old scroll offset before
          catching up, so for a frame or two it's rendering the nav's
          blurred backdrop at the wrong spot with nothing (a plain white
          rect) behind it yet. transform: translateZ(0) forces this
          element onto its own GPU layer instead of being repainted
          inline with the rest of the page — the standard, well-known
          fix for this exact fixed+backdrop-filter WebKit combination.
      */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-50 glass-panel rounded-3xl px-2 py-2"
        style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}>
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
                      boxShadow:  '0 8px 20px rgba(0,0,0,0.14), 0 2px 8px rgb(var(--accent-500) / 0.22), inset 0 1px 0 rgba(255,255,255,1)',
                    } : {}}
                  >
                    <Icon
                      size={17}
                      className={isActive ? 'text-[rgb(var(--accent-500))]' : 'text-ink/40 dark:text-white/40'}
                    />
                  </motion.div>
                  <span className={`text-[10px] font-medium ${
                    isActive ? 'text-[rgb(var(--accent-500))] dark:text-lavender-300' : 'text-ink/40 dark:text-white/40'
                  }`}>
                    {t(label)}
                  </span>
                </motion.div>
              )}
            </NavLink>
          ))}
          {/* More */}
          <motion.button
            whileTap={{ scale: 0.90 }}
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 py-1.5 rounded-2xl"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl">
              <MoreHorizontal size={17} className="text-ink/40 dark:text-white/40" />
            </div>
            <span className="text-[10px] font-medium text-ink/40 dark:text-white/40">{t('common.more')}</span>
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
                <h3 className="font-display font-bold text-ink dark:text-white">{t('common.more')}</h3>
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
                    <Icon size={20} />
                    {t(label)}
                  </NavLink>
                ))}
                <button
                  onClick={() => { setMoreOpen(false); setSettingsOpen(true); }}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-ink/5 dark:bg-white/5 py-4 text-xs font-medium text-ink/70 dark:text-white/60"
                >
                  <Settings size={20} /> {t('nav.settings')}
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