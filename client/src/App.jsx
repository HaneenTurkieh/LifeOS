import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';

import GlobalBackground  from './components/GlobalBackground.jsx';
import Sidebar           from './components/Sidebar.jsx';
import MobileNav         from './components/MobileNav.jsx';
import FocusBar          from './components/FocusBar.jsx';
import ProtectedRoute    from './components/ProtectedRoute.jsx';
import GlobalSearch      from './components/GlobalSearch.jsx';
import NotificationBell  from './components/NotificationBell.jsx';
import { FocusProvider } from './context/FocusContext.jsx';
import { useAuth }       from './context/AuthContext.jsx';
import { useToast }      from './context/ToastContext.jsx';
import { useTheme }      from './context/ThemeContext.jsx';
import useTaskReminders  from './hooks/useTaskReminders.js';

import Login           from './pages/Login.jsx';
import ForgotPassword  from './pages/ForgotPassword.jsx';
import ResetPassword   from './pages/ResetPassword.jsx';
import Dashboard       from './pages/Dashboard.jsx';
import Tasks           from './pages/Tasks.jsx';
import Goals           from './pages/Goals.jsx';
import Focus           from './pages/Focus.jsx';
import Analytics       from './pages/Analytics.jsx';
import Launchpad       from './pages/Launchpad.jsx';
import AITools         from './pages/AITools.jsx';
import History         from './pages/History.jsx';
import TreeShop        from './pages/TreeShop.jsx';
import ExamAssistant   from './pages/ExamAssistant.jsx';
import NotFound        from './pages/NotFound.jsx';

// ── Root ──────────────────────────────────────────────────────
export default function App() {
  return (
    <FocusProvider>
      <GlobalBackground />
      <Routes>
        <Route path="/login"           element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        } />
      </Routes>
    </FocusProvider>
  );
}

// ── AppShell ──────────────────────────────────────────────────
function AppShell() {
  const location             = useLocation();
  const { user }             = useAuth();
  const toast                = useToast();
  const { resolvedTheme }    = useTheme();
  const isDark               = resolvedTheme === 'dark';
  const [searchOpen, setSearchOpen] = useState(false);

  useTaskReminders();

  // ⌘K / Ctrl+K
  useEffect(() => {
    const keyHandler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    const customHandler = () => setSearchOpen(true);
    window.addEventListener('keydown', keyHandler);
    window.addEventListener('aurora:search', customHandler);
    return () => {
      window.removeEventListener('keydown', keyHandler);
      window.removeEventListener('aurora:search', customHandler);
    };
  }, []);

  // One-time search tip
  useEffect(() => {
    if (!user?.id) return;
    const key = `aurora_search_hint_${user.id}`;
    if (!localStorage.getItem(key)) {
      const id = setTimeout(() => {
        toast.success('Tip: Press ⌘K (or Ctrl+K) to search anything in Aurora');
        localStorage.setItem(key, '1');
      }, 3000);
      return () => clearTimeout(id);
    }
  }, [user?.id]); // eslint-disable-line

  // Pill styles — dark mode aware
  const pillStyle = {
    background:           isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)',
    border:               isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(255,255,255,0.80)',
    backdropFilter:       'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    boxShadow:            isDark
      ? 'inset 0 1px 0 rgba(255,255,255,0.08)'
      : '0 4px 20px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.90)',
  };

  return (
    <div className="min-h-screen flex relative z-10">
      <Sidebar />

      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 lg:pr-28 pb-24 lg:pb-10 pt-20 max-w-[1600px] mx-auto w-full">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <Routes location={location}>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/tasks"       element={<Tasks />} />
            <Route path="/goals"       element={<Goals />} />
            <Route path="/learning"    element={<Focus />} />
            <Route path="/analytics"   element={<Analytics />} />
            <Route path="/launchpad"   element={<Launchpad />} />
            <Route path="/ai"          element={<AITools />} />
            <Route path="/history"     element={<History />} />
            <Route path="/trees"       element={<TreeShop />} />
            <Route path="/exam"        element={<ExamAssistant />} />
            <Route path="/internships" element={<Navigate to="/launchpad" replace />} />
            <Route path="/projects"    element={<Navigate to="/launchpad" replace />} />
            <Route path="/cv"          element={<Navigate to="/launchpad" replace />} />
            <Route path="*"            element={<NotFound />} />
          </Routes>
        </motion.div>
      </main>

      <MobileNav />
      <FocusBar />

      {/* ── Floating pill — search + bell ────────────────────── */}
      <div
        className="fixed top-5 right-5 z-50 flex items-center gap-1.5 rounded-2xl px-2 py-1.5"
        style={pillStyle}
      >
        {/* Search */}
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setSearchOpen(true)}
          title="Search"
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-colors"
          style={{ background: 'transparent' }}
        >
          <Search
            size={14}
            className={isDark ? 'text-white/40' : 'text-ink/45'}
          />
          <kbd
            className="hidden lg:block text-[10px] font-bold"
            style={{ color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(30,34,51,0.30)' }}
          >
            {navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </motion.button>

        {/* Divider */}
        <div
          className="w-px h-5"
          style={{ background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(30,34,51,0.10)' }}
        />

        {/* Bell */}
        <NotificationBell />
      </div>

      {/* Mobile search button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setSearchOpen(true)}
        title="Search"
        className="fixed top-5 right-20 z-50 flex h-10 w-10 items-center justify-center rounded-2xl transition-all lg:hidden"
        style={pillStyle}
      >
        <Search size={16} className={isDark ? 'text-white/50' : 'text-ink/55'} />
      </motion.button>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}