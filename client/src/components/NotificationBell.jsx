import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCheck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

// Notification text used to be pre-rendered in English at insert time,
// so there was no way to show it in Arabic later. Newer rows carry a
// `data` JSON blob with the raw interpolation params instead — this maps
// each type to its translation keys so the client can render in whatever
// language is active right now. Rows from before this existed have
// data === null and just fall back to their stored English text below.
const NOTIF_KEYS = {
  overdue:                    { title: 'notif.overdue.title',                   body: 'notif.overdue.body' },
  overdue_digest:              { title: 'notif.overdue_digest.title',            body: 'notif.overdue_digest.body' },
  procrastination:            { title: 'notif.procrastination.title',           body: 'notif.procrastination.body' },
  streak:                     { title: 'notif.streak.title',                    body: 'notif.streak.body' },
  deadline:                   { title: 'notif.deadline.title',                  body: 'notif.deadline.body' },
  milestone_due:              { title: 'notif.milestone_due.title',             body: 'notif.milestone_due.body' },
  mood:                       { title: 'notif.mood.title',                      body: 'notif.mood.body' },
  grace_welcome:              { title: 'notif.grace_welcome.title',             body: 'notif.grace_welcome.body' },
  grace_ending:                { title: 'notif.grace_ending.title',              body: 'notif.grace_ending.body' },
  grace_passes_announcement:  { title: 'notif.grace_passes_announcement.title', body: 'notif.grace_passes_announcement.body' },
  focus_complete:             { title: 'notif.focus_complete.title',            body: 'notif.focus_complete.body' },
};

const TYPE_COLORS = {
  overdue:  { dot: '#FF7A63', bg: 'rgba(255,122,99,0.10)'  },
  overdue_digest: { dot: '#FF7A63', bg: 'rgba(255,122,99,0.10)' },
  streak:   { dot: '#FFB84D', bg: 'rgba(255,184,77,0.10)'  },
  deadline: { dot: 'rgb(var(--accent-500))', bg: 'rgb(var(--accent-500) / 0.10)' },
  milestone_due: { dot: '#8B5CF6', bg: 'rgba(139,92,246,0.10)' },
  mood:     { dot: '#4CC38A', bg: 'rgba(76,195,138,0.10)'  },
  focus_complete: { dot: '#22C55E', bg: 'rgba(34,197,94,0.10)' },
  default:  { dot: 'rgb(var(--accent-500))', bg: 'rgb(var(--accent-500) / 0.10)' },
};

export default function NotificationBell() {
  const navigate          = useNavigate();
  const panelRef          = useRef(null);
  const { resolvedTheme } = useTheme();
  const { t }             = useLanguage();
  const isDark            = resolvedTheme === 'dark';
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread,        setUnread]        = useState(0);

  const timeAgo = (dateStr) => {
    // created_at is a SQLite datetime('now') string — zone-less but
    // always UTC. Without the T/Z fix, new Date(...) parses it as local
    // time instead, which skews every "time ago" label by the local UTC
    // offset (wrong direction and magnitude depending on the sign) —
    // same fix already applied everywhere else in the app that parses
    // one of these strings.
    const iso  = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
    const diff = Date.now() - new Date(iso).getTime();
    const m    = Math.floor(diff / 60000);
    if (m < 1)  return t('notif.justNow');
    if (m < 60) return t('notif.mAgo', { n: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('notif.hAgo', { n: h });
    return t('notif.dAgo', { n: Math.floor(h / 24) });
  };

  const panelBg     = isDark ? 'rgba(18,14,35,0.95)'        : 'rgba(255,255,255,0.96)';
  const panelBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.80)';
  const dividerClr  = isDark ? 'rgba(255,255,255,0.06)'     : 'rgba(30,34,51,0.06)';
  const titleClr    = isDark ? 'text-white'                 : 'text-ink';
  const bodyClr     = isDark ? 'text-white/50'              : 'text-ink/50';
  const timeClr     = isDark ? 'text-white/30'              : 'text-ink/30';
  const clearClr    = isDark ? 'text-white/30 hover:text-coral-400' : 'text-ink/35 hover:text-coral-500';
  const bellBg      = open
    ? 'rgb(var(--accent-500) / 0.20)'
    : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.60)';
  const bellBorder  = open
    ? '1px solid rgb(var(--accent-500) / 0.40)'
    : isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.70)';

  const load = useCallback(async () => {
    try {
      // tz_offset lets the server convert a task's local deadline_time
      // into a real UTC instant for the new "due soon" reminder — same
      // convention Flow's forest history already uses (see Focus.jsx).
      const data = await api.get(`/notifications?tz_offset=${new Date().getTimezoneOffset()}`);
      setNotifications(data.notifications || []);
      setUnread(data.unread || 0);
    } catch (_) {}
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 120000);
    return () => clearInterval(id);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      setUnread((u) => Math.max(0, u - 1));
    } catch (_) {}
  };
  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch (_) {}
  };
  const dismiss = async (id, e) => {
    e.stopPropagation();
    const wasUnread = !notifications.find((n) => n.id === id)?.read;
    try {
      await api.del(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) setUnread((u) => Math.max(0, u - 1));
    } catch (_) {}
  };
  const clearAll = async () => {
    try {
      await Promise.all(notifications.map((n) => api.del(`/notifications/${n.id}`)));
      setNotifications([]);
      setUnread(0);
    } catch (_) {}
  };
  const handleClick = async (n) => {
    if (!n.read) await markRead(n.id);
    if (n.link) { navigate(n.link); setOpen(false); }
  };
  // Renders via translation keys when this row has structured `data`
  // (every notification created after the Arabic-support fix); silently
  // falls back to the stored English text for older rows that predate it.
  const displayText = (n) => {
    const keys = NOTIF_KEYS[n.type];
    if (!keys || n.data == null) return { title: n.title, body: n.body };
    let data = {};
    try { data = JSON.parse(n.data) || {}; } catch (_) { return { title: n.title, body: n.body }; }
    return { title: t(keys.title), body: t(keys.body, data) };
  };

  return (
    <div className="relative" ref={panelRef}>
      <motion.button
        whileHover={{ scale: 1.08, y: -2 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        title={t('notif.title')}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all"
        style={{
          background:           bellBg,
          border:               bellBorder,
          backdropFilter:       'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow:            isDark
            ? 'inset 0 1px 0 rgba(255,255,255,0.08)'
            : 'inset 0 1px 0 rgba(255,255,255,0.80), 0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <Bell
          size={18}
          strokeWidth={2}
          className={open
            ? 'text-lavender-400'
            : isDark ? 'text-white/50' : 'text-ink/55'
          }
        />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{   scale: 0, opacity: 0 }}
              className="absolute -top-1.5 -end-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#FF7A63,#FF4040)', boxShadow: '0 2px 8px rgba(255,100,64,0.50)' }}
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8,  scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 6,  scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="absolute w-80 overflow-hidden rounded-3xl"
            style={{
              top:                  '3rem',
              insetInlineEnd:       0,
              maxWidth:             'calc(100vw - 1.5rem)',
              background:           panelBg,
              backdropFilter:       'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border:               panelBorder,
              boxShadow:            isDark
                ? '0 20px 60px rgba(0,0,0,0.50)'
                : '0 20px 60px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.95)',
              zIndex: 200,
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: `1px solid ${dividerClr}` }}
            >
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-lavender-500" />
                <span className={`font-display font-bold text-sm ${titleClr}`}>{t('notif.title')}</span>
                {unread > 0 && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#FF7A63,#FF4040)' }}>
                    {unread}
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] font-semibold text-lavender-500 hover:underline">
                  <CheckCheck size={11} /> {t('notif.markAll')}
                </button>
              )}
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="text-4xl mb-3"
                  >
                    🔔
                  </motion.div>
                  <p className={`font-semibold text-sm mb-1 ${titleClr}`}>{t('notif.caughtUp')}</p>
                  <p className={`text-xs ${bodyClr}`}>{t('notif.none')}</p>
                </div>
              ) : (
                notifications.map((n, idx) => {
                  const colors = TYPE_COLORS[n.type] || TYPE_COLORS.default;
                  const isLast = idx === notifications.length - 1;
                  const { title: nTitle, body: nBody } = displayText(n);
                  return (
                    <motion.div
                      key={n.id}
                      layout
                      onClick={() => handleClick(n)}
                      className="group relative flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-colors hover:bg-white/5"
                      style={{
                        background:   !n.read ? colors.bg : 'transparent',
                        borderBottom: isLast ? 'none' : `1px solid ${dividerClr}`,
                      }}
                    >
                      <div className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: colors.dot }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-semibold leading-snug ${
                            n.read ? (isDark ? 'text-white/45' : 'text-ink/55') : titleClr
                          }`}>
                            {nTitle}
                          </p>
                          <button
                            onClick={(e) => dismiss(n.id, e)}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 ${
                              isDark ? 'text-white/25 hover:text-coral-400' : 'text-ink/25 hover:text-coral-500'
                            }`}
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <p className={`text-[11px] mt-0.5 leading-relaxed ${bodyClr}`}>{nBody}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] ${timeClr}`}>{timeAgo(n.created_at)}</span>
                          {n.link && (
                            <span className="flex items-center gap-0.5 text-[10px] text-lavender-500 font-medium">
                              <ExternalLink size={9} /> {t('notif.open')}
                            </span>
                          )}
                        </div>
                      </div>
                      {!n.read && (
                        <div className="mt-2 h-1.5 w-1.5 rounded-full bg-lavender-500 shrink-0" />
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
            {notifications.length > 0 && (
              <div className="px-5 py-3" style={{ borderTop: `1px solid ${dividerClr}` }}>
                <button
                  onClick={clearAll}
                  className={`w-full text-xs font-semibold transition-colors text-center py-1 ${clearClr}`}
                >
                  {t('notif.clearAll')}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}