import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

import GlobalBackground  from './components/GlobalBackground.jsx';
import Sidebar           from './components/Sidebar.jsx';
import MobileNav         from './components/MobileNav.jsx';
import FocusBar          from './components/FocusBar.jsx';
import TopBar            from './components/TopBar.jsx';
import ProtectedRoute    from './components/ProtectedRoute.jsx';
import GlobalSearch      from './components/GlobalSearch.jsx';
import { FocusProvider } from './context/FocusContext.jsx';
import { useAuth }       from './context/AuthContext.jsx';
import { useToast }      from './context/ToastContext.jsx';
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

function AppShell() {
  const location = useLocation();
  const { user } = useAuth();
  const toast    = useToast();
  const [searchOpen, setSearchOpen] = useState(false);

  useTaskReminders();

  // ⌘K / Ctrl+K
  useEffect(() => {
    const keyHandler    = (e) => {
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

  // One-time tip
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

  return (
    <div className="min-h-screen flex relative z-10">
      {/* Top bar — fixed, full width */}
      <TopBar onSearchOpen={() => setSearchOpen(true)} />

      <Sidebar />

      {/* pt-14 pushes content below the top bar */}
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 pb-24 lg:pb-10 pt-20 max-w-[1600px] mx-auto w-full">
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
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}