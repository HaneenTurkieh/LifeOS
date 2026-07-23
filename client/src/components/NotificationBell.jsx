import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCheck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const TYPE_COLORS = {
  overdue:  { bg: 'rgba(255,122,99,0.12)',  border: 'rgba(255,122,99,0.25)',  dot: '#FF7A63' },
  streak:   { bg: 'rgba(255,184,77,0.12)',  border: 'rgba(255,184,77,0.25)',  dot: '#FFB84D' },
  deadline: { bg: 'rgba(124,106,240,0.12)', border: 'rgba(124,106,240,0.25)', dot: '#7C6AF0' },
  mood:     { bg: 'rgba(76,195,138,0.12)',  border: 'rgba(76,195,138,0.25)',  dot: '#4CC38A' },
  default:  { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)', dot: '#7C6AF0' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const navigate  = useNavigate();
  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread,        setUnread]        = useState(0);
  const [loading,       setLoading]       = useState(false);
  const panelRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/notifications');
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch (_) {}
  }, []);

  // Poll every 2 minutes
  useEffect(() => {
    load();
    const id = setInterval(load, 120000);
    return () => clearInterval(id);
  }, [load]);

  // Close on outside click
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
      setNotifications((prev) => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnread((u) => Math.max(0, u - 1));
    } catch (_) {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map(n => ({ ...n, read: true })));
      setUnread(0);
    } catch (_) {}
  };

  const dismiss = async (id, e) => {
    e.stopPropagation();
    try {
      await api.del(`/notifications/${id}`);
      setNotifications((prev) => prev.filter(n => n.id !== id));
      if (!notifications.find(n => n.id === id)?.read) setUnread((u) => Math.max(0, u - 1));
    } catch (_) {}
  };

  const handleClick = async (n) => {
    if (!n.read) await markRead(n.id);
    if (n.link) { navigate(n.link); setOpen(false); }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <motion.button
        whileHover={{ scale: 1.08, y: -2 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl transition-colors"
        style={{
          background:   open ? 'rgba(124,106,240,0.15)' : 'rgba(255,255,255,0.08)',
          border:       `1px solid ${open ? 'rgba(124,106,240,0.30)' : 'rgba(255,255,255,0.15)'}`,
          backdropFilter: 'blur(16px)',
        }}
      >
        <Bell size={18} className="text-ink/60 dark:text-white/55" strokeWidth={2} />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #FF7A63, #FF4040)', boxShadow: '0 2px 8px rgba(255,122,99,0.5)' }}
          >
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="absolute right-0 top-14 w-80 z-[100] overflow-hidden rounded-3xl"
            style={{
              background:           'rgba(255,255,255,0.92)',
              backdropFilter:       'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border:               '1px solid rgba(255,255,255,0.70)',
              boxShadow:            '0 20px 60px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.90)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink/5">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-lavender-500" />
                <span className="font-display font-bold text-ink text-sm">Notifications</span>
                {unread > 0 && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#FF7A63,#FF4040)' }}>
                    {unread}
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] font-semibold text-lavender-600 hover:underline">
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="text-4xl mb-3">🔔</span>
                  <p className="font-semibold text-ink text-sm mb-1">All caught up!</p>
                  <p className="text-xs text-ink/40">No notifications right now.</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const colors = TYPE_COLORS[n.type] || TYPE_COLORS.default;
                  return (
                    <motion.div
                      key={n.id}
                      layout
                      onClick={() => handleClick(n)}
                      className={`group relative flex items-start gap-3 px-5 py-4 cursor-pointer transition-all border-b border-ink/[0.04] last:border-0 ${
                        !n.read ? 'bg-lavender-50/60' : 'hover:bg-ink/[0.02]'
                      }`}
                    >
                      {/* Type dot */}
                      <div className="shrink-0 mt-1 h-2 w-2 rounded-full" style={{ backgroundColor: colors.dot }} />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-semibold leading-snug ${n.read ? 'text-ink/60' : 'text-ink'}`}>
                            {n.title}
                          </p>
                          <button
                            onClick={(e) => dismiss(n.id, e)}
                            className="opacity-0 group-hover:opacity-100 transition shrink-0 text-ink/25 hover:text-coral-500"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <p className="text-[11px] text-ink/50 mt-0.5 leading-relaxed">{n.body}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-ink/30">{timeAgo(n.created_at)}</span>
                          {n.link && (
                            <span className="flex items-center gap-0.5 text-[10px] text-lavender-500 font-medium">
                              <ExternalLink size={9} /> Go
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Unread dot */}
                      {!n.read && (
                        <div className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-lavender-500" />
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}