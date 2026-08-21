import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2 } from 'lucide-react';
import GlobalBackground  from './components/GlobalBackground.jsx';
import Sidebar           from './components/Sidebar.jsx';
import MobileNav         from './components/MobileNav.jsx';
import FocusBar          from './components/FocusBar.jsx';
import ProtectedRoute    from './components/ProtectedRoute.jsx';
import GlobalSearch      from './components/GlobalSearch.jsx';
import NotificationBell  from './components/NotificationBell.jsx';
import NuvoraBuddy       from './components/NuvoraBuddy.jsx';
import BirthdayCelebration from './components/BirthdayCelebration.jsx';
import FestiveDecoration   from './components/FestiveDecoration.jsx';
import { FocusProvider, useFocus } from './context/FocusContext.jsx';
import { useAuth }       from './context/AuthContext.jsx';
import { useToast }      from './context/ToastContext.jsx';
import { useTheme }      from './context/ThemeContext.jsx';
import { useLanguage }   from './context/LanguageContext.jsx';
import useTaskReminders  from './hooks/useTaskReminders.js';
import useMilestoneReminders from './hooks/useMilestoneReminders.js';
import { isTodayBirthday } from './utils/birthday.js';
import { api }           from './api/client.js';
// Every page below is lazy-loaded so each route becomes its own JS chunk
// instead of all of them (plus their dependencies, e.g. recharts pulled in
// by Analytics) getting bundled into one ~2.3MB file that every visitor
// downloads just to see the login screen. <Suspense> boundaries around
// both <Routes> blocks below show a small spinner during the (usually
// sub-100ms) chunk fetch.
const Login          = lazy(() => import('./pages/Login.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword  = lazy(() => import('./pages/ResetPassword.jsx'));
const Terms          = lazy(() => import('./pages/legal/Terms.jsx'));
const Privacy        = lazy(() => import('./pages/legal/Privacy.jsx'));
const Refund         = lazy(() => import('./pages/legal/Refund.jsx'));
const Pricing        = lazy(() => import('./pages/legal/Pricing.jsx'));
const Dashboard      = lazy(() => import('./pages/Dashboard.jsx'));
const Tasks          = lazy(() => import('./pages/Tasks.jsx'));
const Goals          = lazy(() => import('./pages/Goals.jsx'));
const Focus          = lazy(() => import('./pages/Focus.jsx'));
const Analytics      = lazy(() => import('./pages/Analytics.jsx'));
const Launchpad      = lazy(() => import('./pages/Launchpad.jsx'));
const AITools        = lazy(() => import('./pages/AITools.jsx'));
const History        = lazy(() => import('./pages/History.jsx'));
const TreeShop       = lazy(() => import('./pages/TreeShop.jsx'));
const ExamAssistant  = lazy(() => import('./pages/ExamAssistant.jsx'));
const Calendar       = lazy(() => import('./pages/Calendar.jsx'));
const NotFound       = lazy(() => import('./pages/NotFound.jsx'));
// Onboarding was fully built but never actually mounted anywhere in
// the app — that's why it "skipped entirely" rather than just showing
// without the fold animation. Wired in below, in AppShell.
// Kept as a regular (non-lazy) import: isOnboarded() is called directly
// inside a synchronous useEffect below, not just referenced in JSX, and
// React.lazy only works for the default-exported component itself.
import Onboarding, { isOnboarded } from './pages/Onboarding.jsx';

// Shown briefly in the gap while a route's JS chunk downloads. Deliberately
// minimal (no i18n/theme wiring) since it only flashes for a moment and
// must never itself suspend.
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh] w-full">
      <Loader2 size={22} className="animate-spin text-white/30" />
    </div>
  );
}

// ── Shortcuts modal ───────────────────────────────────────────
function ShortcutsModal({ onClose }) {
  const { resolvedTheme } = useTheme();
  const { t } = useLanguage();
  const isDark = resolvedTheme === 'dark';
  const isMac  = navigator.platform?.includes('Mac');
  const SHORTCUTS = [
    { key: 'D',                      desc: t('nav.dashboard') },
    { key: 'T',                      desc: t('nav.tasks')     },
    { key: 'G',                      desc: t('nav.goals')     },
    { key: 'F',                      desc: t('app.flowTimer') },
    { key: 'L',                      desc: t('nav.lumi')      },
    { key: 'A',                      desc: t('nav.analytics') },
    { key: 'N',                      desc: t('app.newTask')   },
    { key: isMac ? '⌘K' : 'Ctrl+K', desc: t('common.search') },
    { key: '?',                      desc: t('app.thisPanel') },
    { key: 'ESC',                    desc: t('common.close')  },
  ];
  const panelBg     = isDark ? 'rgba(18,14,35,0.97)'              : 'rgba(255,255,255,0.97)';
  const panelBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.80)';
  const titleClr    = isDark ? 'text-white'                       : 'text-ink';
  const divider     = isDark ? 'rgba(255,255,255,0.06)'           : 'rgba(30,34,51,0.06)';
  const descClr     = isDark ? 'text-white/55'                    : 'text-ink/60';
  const rowHover    = isDark ? 'hover:bg-white/5'                 : 'hover:bg-ink/[0.03]';
  const kbdBg       = isDark ? 'rgba(255,255,255,0.08)'           : 'rgba(30,34,51,0.07)';
  const kbdBorder   = isDark ? 'rgba(255,255,255,0.12)'           : 'rgba(30,34,51,0.10)';
  const kbdClr      = isDark ? 'text-white/45'                    : 'text-ink/50';
  const noteClr     = isDark ? 'text-white/25'                    : 'text-ink/30';
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
          background:           panelBg,
          backdropFilter:       'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border:               panelBorder,
          boxShadow:            isDark ? '0 24px 64px rgba(0,0,0,0.55)' : '0 24px 64px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid ${divider}` }}>
          <span className={`font-display font-bold text-sm ${titleClr}`}>{t('app.shortcutsTitle')}</span>
          <button onClick={onClose}
            className={`flex h-7 w-7 items-center justify-center rounded-xl transition ${
              isDark ? 'text-white/40 hover:text-white/70' : 'text-ink/40 hover:text-ink/70'
            }`}>
            <X size={15} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-0.5">
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key}
              className={`flex items-center justify-between px-3 py-2 rounded-xl transition ${rowHover}`}>
              <span className={`text-sm ${descClr}`}>{desc}</span>
              <kbd className={`rounded-lg px-2.5 py-1 text-[11px] font-bold font-mono ${kbdClr}`}
                style={{ background: kbdBg, border: `1px solid ${kbdBorder}` }}>
                {key}
              </kbd>
            </div>
          ))}
        </div>
        <div className="px-6 pb-4">
          <p className={`text-[11px] text-center ${noteClr}`}>
            {t('app.typingNote')}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Root ──────────────────────────────────────────────────────
// FocusProvider used to wrap this whole component — including the public
// routes below (/login, /terms, /pricing, etc.). Its own effects fetch
// focus stats/leaderboard/room membership immediately on mount, with
// whatever's in localStorage at that instant — so on a fresh visit to
// /login (no token yet) or during the brief window before AuthContext
// confirms a token is actually valid, those calls fired anyway and came
// back 401. Harmless to the UI (each one fails into an empty catch), but
// real console noise on every single load, logged-in or not. Scoping
// FocusProvider to only wrap AppShell — which ProtectedRoute only ever
// renders once a user is confirmed authenticated — means Focus data
// simply doesn't load until there's a real session to load it for.
export default function App() {
  return (
    <>
      <GlobalBackground />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login"           element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          {/* Public — no login required. Paddle's domain review needs these
              reachable without an account. */}
          <Route path="/terms"           element={<Terms />} />
          <Route path="/privacy"         element={<Privacy />} />
          <Route path="/refund-policy"   element={<Refund />} />
          <Route path="/pricing"         element={<Pricing />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <FocusProvider>
                <AppShell />
              </FocusProvider>
            </ProtectedRoute>
          } />
        </Routes>
      </Suspense>
    </>
  );
}

// ── AppShell ──────────────────────────────────────────────────
function AppShell() {
  const location          = useLocation();
  const navigate          = useNavigate();
  const { user }          = useAuth();
  const toast             = useToast();
  const { resolvedTheme, setBirthdayOverride } = useTheme();
  const { t }             = useLanguage();
  const isDark            = resolvedTheme === 'dark';
  const focus             = useFocus();
  // Same visibility rule FocusBar.jsx uses internally — needed here too so
  // the corner buddy knows to lift itself out of the way on the rare
  // occasion both are docked on the same side at once, instead of
  // guessing a single fixed offset that's wrong whenever a Flow session
  // is running.
  const focusBarVisible = !!focus && location.pathname !== '/learning' && (focus.totalTime > focus.timeLeft || focus.isRunning);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [moodValue, setMoodValue] = useState(null);
  const [buddyGreeting, setBuddyGreeting] = useState(false);
  const [buddyWave, setBuddyWave] = useState(false);
  useTaskReminders();
  useMilestoneReminders();

  // ── Companion mood ────────────────────────────────────────────
  // Feeds the floating buddy's expression from today's mood-of-the-day
  // pick (Dashboard). Fetched once on load, then kept live via a custom
  // event Dashboard fires right after a successful save — so picking a
  // mood updates the corner buddy immediately instead of only after a
  // refresh.
  useEffect(() => {
    if (!user?.id) return;
    api.get('/mood/today').then((m) => setMoodValue(m?.mood ?? null)).catch(() => {});
  }, [user?.id]);
  useEffect(() => {
    const onMoodUpdate = (e) => setMoodValue(e.detail?.mood ?? null);
    window.addEventListener('nuvora:mood-updated', onMoodUpdate);
    return () => window.removeEventListener('nuvora:mood-updated', onMoodUpdate);
  }, []);

  // ── "How can I help you today?" greeting ───────────────────────
  // Fires on a brand new account's very first login (no "last seen"
  // record at all yet) AND on any later login/return after being away a
  // while — buddy waves again and a speech bubble offers a one-tap way
  // into Lumi, instead of only ever waving once per browser (the earlier
  // bug) or sitting there silently every single load (which would get
  // old fast). A lightweight heartbeat keeps "last seen" fresh while the
  // app stays open, so reloading mid-session doesn't retrigger it.
  useEffect(() => {
    if (!user?.id) return;
    const KEY = `nuvora_buddy_last_seen_${user.id}`;
    const ABSENCE_MS = 20 * 60 * 1000; // 20 minutes away counts as "back"
    const last = Number(localStorage.getItem(KEY) || 0);
    const wasAbsent = last === 0 || (Date.now() - last > ABSENCE_MS);
    localStorage.setItem(KEY, String(Date.now()));
    let showT, hideT;
    if (wasAbsent) {
      showT = setTimeout(() => { setBuddyWave(true); setBuddyGreeting(true); }, 900);
      hideT = setTimeout(() => setBuddyGreeting(false), 900 + 7000);
    }
    const heartbeat = setInterval(() => localStorage.setItem(KEY, String(Date.now())), 60000);
    return () => { clearTimeout(showT); clearTimeout(hideT); clearInterval(heartbeat); };
  }, [user?.id]);
  const openLumi = () => { setBuddyGreeting(false); navigate('/ai'); };

  // ── Onboarding gate ────────────────────────────────────────
  // Checks once user.id is actually populated (not on the very first
  // render where it may still be undefined right after registration —
  // that race is what caused onboarding to silently never trigger).
  useEffect(() => {
    if (user?.id && !isOnboarded(user.id)) {
      setShowOnboarding(true);
    }
  }, [user?.id]);

  // ── Birthday theme ───────────────────────────────────────────
  // Pink for a girl, blue for a boy, for just that one day — then back
  // to whatever theme they actually had, Free or Premium. This only ever
  // sets a display-time override in ThemeContext (see its own comment);
  // it never writes to the real saved accent, so there's nothing to
  // "restore" the next day — it just stops applying itself. AppShell is
  // the natural place for this: it's the one component that already sits
  // inside both AuthProvider (for user.birthday/gender) and ThemeProvider.
  useEffect(() => {
    if (isTodayBirthday(user?.birthday) && (user?.gender === 'male' || user?.gender === 'female')) {
      setBirthdayOverride(user.gender === 'male' ? 'blue' : 'pink');
    } else {
      setBirthdayOverride(null);
    }
  }, [user?.birthday, user?.gender, setBirthdayOverride]);

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      return el && (
        el.tagName === 'INPUT'    ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT'   ||
        el.isContentEditable
      );
    };
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setSearchOpen((o) => !o); return;
      }
      if (isTyping()) return;
      switch (e.key.toLowerCase()) {
        case 'd': navigate('/');          break;
        case 't': navigate('/tasks');     break;
        case 'g': navigate('/goals');     break;
        case 'f': navigate('/learning');  break;
        case 'l': navigate('/ai');        break;
        case 'a': navigate('/analytics'); break;
        case 'n':
          window.dispatchEvent(new CustomEvent('nuvora:new-task'));
          if (location.pathname !== '/tasks') navigate('/tasks');
          break;
        case '/':      e.preventDefault(); setSearchOpen(true);         break;
        case '?':      setShortcutsOpen((o) => !o);                     break;
        case 'escape': setSearchOpen(false); setShortcutsOpen(false);   break;
        default: break;
      }
    };
    const customSearch = () => setSearchOpen(true);
    window.addEventListener('keydown', handler);
    window.addEventListener('nuvora:search', customSearch);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('nuvora:search', customSearch);
    };
  }, [navigate, location.pathname]);

  // One-time tip
  useEffect(() => {
    if (!user?.id) return;
    const key    = `nuvora_search_hint_${user.id}`;
    const oldKey = `aurora_search_hint_${user.id}`;
    if (!localStorage.getItem(key) && !localStorage.getItem(oldKey)) {
      const id = setTimeout(() => {
        toast.success(t('app.searchTip'));
        localStorage.setItem(key, '1');
      }, 3000);
      return () => clearTimeout(id);
    }
  }, [user?.id]); // eslint-disable-line

  // ── Pill style ────────────────────────────────────────────────
  const pillStyle = {
    background:           isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.75)',
    border:               isDark ? '1px solid rgba(255,255,255,0.11)' : '1px solid rgba(255,255,255,0.85)',
    backdropFilter:       'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    boxShadow:            isDark
      ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 12px rgba(0,0,0,0.25)'
      : 'inset 0 1px 0 rgba(255,255,255,0.95), 0 2px 12px rgba(0,0,0,0.06)',
  };
  const iconClr = isDark ? 'text-white/45' : 'text-ink/50';
  const kbdClr  = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(30,34,51,0.28)';
  const divClr  = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(30,34,51,0.10)';

  return (
    <div className="min-h-screen flex relative z-10">
      <Sidebar />
      {/* lg:pe-28 is the logical version of lg:pr-28 — flips in RTL */}
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 lg:pe-28 pb-24 lg:pb-10 pt-20 max-w-[1600px] mx-auto w-full">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <Suspense fallback={<PageLoader />}>
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
              <Route path="/calendar"    element={<Calendar />} />
              <Route path="/internships" element={<Navigate to="/launchpad" replace />} />
              <Route path="/projects"    element={<Navigate to="/launchpad" replace />} />
              <Route path="/cv"          element={<Navigate to="/launchpad" replace />} />
              <Route path="*"            element={<NotFound />} />
            </Routes>
          </Suspense>
        </motion.div>
      </main>
      <MobileNav />
      <FocusBar />
      {/* Persistent companion — moved twice now trying to find a spot
          nothing else ever touches: the sidebar's Settings icon (start
          side) ruled that corner out, and per-page content can have its
          own fixed bottom bar that ignores <main>'s usual padding (the
          AI page's chat input does) so "anywhere on the left" wasn't
          actually safe either. End side, stacked above the shortcuts
          hint — the same corner FocusBar and the shortcuts hint already
          share without colliding with page content, because no route
          docks anything of its own there. focusBarVisible (mirrors
          FocusBar's own show/hide check) lifts it further only on the
          rare load where a Flow session is actually running, instead of
          permanently reserving that much space.

          Still wasn't actually safe on /ai specifically — on a phone-width
          screen, Lumi's full-width composer puts its Send button in this
          exact corner, and this widget sat right on top of it, blocking
          taps. Hidden on /ai entirely rather than nudged further: buddy's
          only job here is "open Lumi", which is redundant when you're
          already looking at Lumi. */}
      {/* z-[85] — was z-[105], which sat ABOVE every modal (Modal.jsx
          itself is z-[90]), so the buddy widget rendered on top of
          Settings/any other modal's content instead of behind its
          backdrop like everything else on the page does. 85 keeps it
          above FocusBar (z-[80]) and normal page content, but now
          correctly tucks behind any modal's backdrop. */}
      {location.pathname !== '/ai' && (
      <div className={`fixed z-[85] end-4 lg:end-6 lg:bottom-20 ${focusBarVisible ? 'bottom-40' : 'bottom-24'}`}>
        {/* flex column + items-center centers the bubble over buddy using
            layout, not inset/transform math — the previous version pinned
            the bubble's edge to buddy's edge and let it grow sideways,
            which is what walked it into the Next milestones / Mood cards.
            This can't drift off-center in either LTR or RTL. */}
        <div className="relative flex flex-col items-center">
          <AnimatePresence>
            {buddyGreeting && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 6 }}
                transition={{ duration: 0.25 }}
                onClick={openLumi}
                className="relative mb-3 w-[180px] rounded-2xl px-4 py-3 text-center text-[13px] font-semibold leading-snug text-white"
                style={{
                  background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)',
                  boxShadow:  '0 10px 30px rgb(var(--accent-500) / 0.45), inset 0 1px 0 rgba(255,255,255,0.30)',
                }}
              >
                <span className="pointer-events-none absolute inset-x-3 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                {t('app.buddyGreeting')}
                <span className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 h-3 w-3 rotate-45"
                  style={{ background: 'rgb(var(--accent-600))' }} />
              </motion.button>
            )}
          </AnimatePresence>
          <div className="relative">
            {/* Soft glass backdrop so the buddy reads clearly against any
                page background instead of blending into it. */}
            <div className="absolute -inset-2 rounded-full" style={{ ...pillStyle, borderRadius: 999 }} />
            <NuvoraBuddy size={56} mood={moodValue} wave={buddyWave} onClick={openLumi} title={t('app.buddyName')} className="relative" />
          </div>
        </div>
      </div>
      )}
      {/* ── Floating pill — search + bell (end-4 = right in LTR, LEFT in RTL) ── */}
      <div
        className="fixed top-4 end-4 z-50 flex items-center"
        style={{ ...pillStyle, borderRadius: 18, padding: '5px 6px', gap: 4 }}
      >
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => setSearchOpen(true)}
          title={t('common.search')}
          className={`flex items-center gap-1.5 rounded-xl transition-colors ${iconClr}`}
          style={{ padding: '5px 8px', minHeight: 34 }}
        >
          <Search size={15} strokeWidth={2} />
          <span
            className="hidden lg:block text-[10px] font-bold font-mono whitespace-nowrap"
            style={{ color: kbdClr }}
          >
            {navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K'}
          </span>
        </motion.button>
        <div style={{ width: 1, height: 18, background: divClr, flexShrink: 0 }} />
        <NotificationBell />
      </div>
      {/* Shortcuts hint — also flips side in RTL */}
      <button
        onClick={() => setShortcutsOpen(true)}
        className="hidden lg:flex fixed bottom-6 end-6 z-40 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all"
        style={{ ...pillStyle, borderRadius: 12, color: kbdClr }}
      >
        <kbd>?</kbd> {t('app.shortcuts')}
      </button>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <AnimatePresence>
        {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showOnboarding && (
          <Onboarding user={user} onComplete={() => setShowOnboarding(false)} />
        )}
      </AnimatePresence>
      <BirthdayCelebration user={user} />
      <FestiveDecoration user={user} />
    </div>
  );
}