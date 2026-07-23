import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';

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
import ExamAssistant  from './pages/ExamAssistant.jsx';
import NotFound       from './pages/NotFound.jsx';

// ── Keyboard shortcuts reference ──────────────────────────────
const SHORTCUTS = [
  { key: 'D',       desc: 'Go to Dashboard'  },
  { key: 'T',       desc: 'Go to Tasks'       },
  { key: 'G',       desc: 'Go to Goals'       },
  { key: 'F',       desc: 'Go to Flow timer'  },
  { key: 'L',       desc: 'Go to Lumi AI'     },
  { key: 'A',       desc: 'Go to Analytics'   },
  { key: 'N',       desc: 'New task'           },
  { key: '⌘K',      desc: 'Search anywhere'   },
  { key: '?',       desc: 'Show this panel'   },
  { key: 'ESC',     desc: 'Close / go back'   },
];

function ShortcutsModal({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: 'rgba(7,11,20,0.60)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{
          background:           'rgba(255,255,255,0.96)',
          backdropFilter:       'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border:               '1px solid rgba(255,255,255,0.80)',
          boxShadow:            '0 24px 64px rgba(0,0,0,0.20)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink/6">
          <span className="font-display font-bold text-ink text-sm">Keyboard shortcuts</span>
          <button onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-xl text-ink/40 hover:text-ink/70 transition">
            <X size={15} />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="p-4 flex flex-col gap-1">
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-ink/3 transition">
              <span className="text-sm text-ink/60">{desc}</span>
              <kbd
                className="rounded-lg px-2.5 py-1 text-[11px] font-bold font-mono text-ink/50"
                style={{ background: 'rgba(30,34,51,0.07)', border: '1px solid rgba(30,34,51,0.10)' }}
              >
                {key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-6 pb-4">
          <p className="text-[11px] text-ink/30 text-center">
            Shortcuts are disabled when typing in a text field
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

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
  const location          = useLocation();
  const navigate          = useNavigate();
  const { user }          = useAuth();
  const toast             = useToast();
  const { resolvedTheme } = useTheme();
  const isDark            = resolvedTheme === 'dark';

  const [searchOpen,    setSearchOpen]    = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useTaskReminders();

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      return el && (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable
      );
    };

    const handler = (e) => {
      // ⌘K / Ctrl+K — search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }

      // Custom event from sidebar button
      if (e.type === 'aurora:search') { setSearchOpen(true); return; }

      // All other shortcuts — skip when typing
      if (isTyping()) return;

      switch (e.key.toLowerCase()) {
        case 'd': navigate('/');          break;
        case 't': navigate('/tasks');     break;
        case 'g': navigate('/goals');     break;
        case 'f': navigate('/learning'); break;
        case 'l': navigate('/ai');        break;
        case 'a': navigate('/analytics'); break;
        case 'n':
          // Dispatch event so Tasks page opens its modal
          window.dispatchEvent(new CustomEvent('aurora:new-task'));
          if (location.pathname !== '/tasks') navigate('/tasks');
          break;
        case '/':
          e.preventDefault();
          setSearchOpen(true);
          break;
        case '?':
          setShortcutsOpen((o) => !o);
          break;
        case 'escape':
          setSearchOpen(false);
          setShortcutsOpen(false);
          break;
        default: break;
      }
    };

    const customSearch = () => setSearchOpen(true);
    window.addEventListener('keydown', handler);
    window.addEventListener('aurora:search', customSearch);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('aurora:search', customSearch);
    };
  }, [navigate, location.pathname]);

  // One-time search tip
  useEffect(() => {
    if (!user?.id) return;
    const key = `aurora_search_hint_${user.id}`;
    if (!localStorage.getItem(key)) {
      const id = setTimeout(() => {
        toast.success('Tip: Press ⌘K to search · ? for all shortcuts');
        localStorage.setItem(key, '1');
      }, 3000);
      return () => clearTimeout(id);
    }
  }, [user?.id]); // eslint-disable-line

  // ── Pill styles ───────────────────────────────────────────────
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

      {/* ── Floating pill ─────────────────────────────────────── */}
      <div
        className="fixed top-5 right-5 z-50 flex items-center gap-1.5 rounded-2xl px-2 py-1.5"
        style={pillStyle}
      >
        {/* Search */}
        <motion.button
          whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
          onClick={() => setSearchOpen(true)}
          title="Search (⌘K)"
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 transition-colors"
        >
          <Search size={14} className={isDark ? 'text-white/40' : 'text-ink/45'} />
          <kbd
            className="hidden lg:block text-[10px] font-bold"
            style={{ color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(30,34,51,0.30)' }}
          >
            {navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </motion.button>

        {/* Divider */}
        <div className="w-px h-5" style={{ background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(30,34,51,0.10)' }} />

        {/* Bell */}
        <NotificationBell />
      </div>

      {/* Mobile search button */}
      <motion.button
        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
        onClick={() => setSearchOpen(true)}
        className="fixed top-5 right-20 z-50 flex h-10 w-10 items-center justify-center rounded-2xl transition-all lg:hidden"
        style={pillStyle}
      >
        <Search size={16} className={isDark ? 'text-white/50' : 'text-ink/55'} />
      </motion.button>

      {/* Shortcuts hint — desktop only, bottom right */}
      <button
        onClick={() => setShortcutsOpen(true)}
        className="hidden lg:flex fixed bottom-6 right-6 z-40 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all"
        style={{
          ...pillStyle,
          color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(30,34,51,0.30)',
        }}
      >
        <kbd>?</kbd> shortcuts
      </button>

      {/* Modals */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <AnimatePresence>
        {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}