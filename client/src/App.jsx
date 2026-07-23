import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';

import GlobalBackground  from './components/GlobalBackground.jsx';
import Sidebar           from './components/Sidebar.jsx';
import MobileNav         from './components/MobileNav.jsx';
import FocusBar          from './components/FocusBar.jsx';
import ProtectedRoute    from './components/ProtectedRoute.jsx';
import NotificationBell  from './components/NotificationBell.jsx';
import GlobalSearch      from './components/GlobalSearch.jsx';
import { FocusProvider } from './context/FocusContext.jsx';
import { useAuth }       from './context/AuthContext.jsx';
import useTaskReminders  from './hooks/useTaskReminders.js';

import Login          from './pages/Login.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword  from './pages/ResetPassword.jsx';
import Dashboard      from './pages/Dashboard.jsx';
import Tasks          from './pages/Tasks.jsx';
import Goals          from './pages/Goals.jsx';
import Focus          from './pages/Focus.jsx';
import Analytics      from './pages/Analytics.jsx';
import Launchpad      from './pages/Launchpad.jsx';
import AITools        from './pages/AITools.jsx';
import History        from './pages/History.jsx';
import TreeShop       from './pages/TreeShop.jsx';
import NotFound       from './pages/NotFound.jsx';

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

// ── App shell — rendered for every authenticated route ────────
function AppShell() {
  const location               = useLocation();
  const { user }               = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  useTaskReminders();

  // Cmd+K / Ctrl+K → open search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="min-h-screen flex relative z-10">
      <Sidebar />

      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 pb-24 lg:pb-10 pt-6 max-w-[1600px] mx-auto w-full">
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
            <Route path="/internships" element={<Navigate to="/launchpad" replace />} />
            <Route path="/projects"    element={<Navigate to="/launchpad" replace />} />
            <Route path="/cv"          element={<Navigate to="/launchpad" replace />} />
            <Route path="*"            element={<NotFound />} />
          </Routes>
        </motion.div>
      </main>

      <MobileNav />
      <FocusBar />

      {/* ── Fixed top-right utility bar ─────────────────────── */}
      <div className="fixed top-5 right-5 z-50 flex items-center gap-2">
        {/* Search icon — visible on mobile (desktop uses Cmd+K) */}
        <motion.button
          whileHover={{ scale: 1.08, y: -2 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setSearchOpen(true)}
          title="Search (Ctrl+K)"
          className="flex h-10 w-10 items-center justify-center rounded-2xl transition-all lg:hidden"
          style={{
            background:           'rgba(255,255,255,0.55)',
            border:               '1px solid rgba(255,255,255,0.65)',
            backdropFilter:       'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow:            'inset 0 1px 0 rgba(255,255,255,0.80)',
          }}
        >
          <Search size={16} className="text-ink/55 dark:text-white/50" />
        </motion.button>

        <NotificationBell />
      </div>

      {/* ── Global search overlay ────────────────────────────── */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}