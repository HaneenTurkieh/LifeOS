import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ListChecks, Target, Sparkles, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const PAGES = [
  { label: 'Dashboard',  path: '/',          icon: '🏠', keywords: ['home','dashboard'] },
  { label: 'Tasks',      path: '/tasks',      icon: '✅', keywords: ['tasks','todo'] },
  { label: 'Goals',      path: '/goals',      icon: '🎯', keywords: ['goals','habits','recurring'] },
  { label: 'Flow',       path: '/learning',   icon: '⏱', keywords: ['flow','focus','pomodoro','timer'] },
  { label: 'Lumi AI',    path: '/ai',         icon: '✦',  keywords: ['lumi','ai','chat','assistant'] },
  { label: 'Analytics',  path: '/analytics',  icon: '📊', keywords: ['analytics','stats','charts'] },
  { label: 'Launchpad',  path: '/launchpad',  icon: '🚀', keywords: ['launchpad','internship','cv','projects'] },
  { label: 'Tree Shop',  path: '/trees',      icon: '🌳', keywords: ['trees','xp','shop'] },
  { label: 'History',    path: '/history',    icon: '🕐', keywords: ['history','timeline'] },
];

const RESULT_ICONS = {
  task:         <ListChecks size={14} className="text-lavender-500" />,
  goal:         <Target     size={14} className="text-blue-500"     />,
  conversation: <Sparkles   size={14} className="text-violet-500"   />,
  page:         <ArrowRight size={14} className="text-ink/40"       />,
};

export default function GlobalSearch({ open, onClose }) {
  const navigate  = useNavigate();
  const inputRef  = useRef(null);
  const listRef   = useRef(null);

  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active,  setActive]  = useState(0);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Search
  const search = useCallback(async (q) => {
    const trimmed = q.trim().toLowerCase();

    // Always show page shortcuts
    const pageMatches = PAGES
      .filter((p) =>
        p.label.toLowerCase().includes(trimmed) ||
        p.keywords.some((k) => k.includes(trimmed))
      )
      .map((p) => ({ type: 'page', label: p.label, icon: p.icon, path: p.path }));

    if (!trimmed) {
      setResults(pageMatches.slice(0, 5));
      return;
    }

    setLoading(true);
    try {
      const [tasks, goals, convos] = await Promise.all([
        api.get('/tasks'),
        api.get('/goals'),
        api.get('/chat/conversations'),
      ]);

      const taskResults = tasks
        .filter((t) => t.title.toLowerCase().includes(trimmed))
        .slice(0, 4)
        .map((t) => ({
          type:     'task',
          label:    t.title,
          subtitle: `${t.priority} priority · ${t.status}`,
          path:     '/tasks',
        }));

      const goalResults = goals
        .filter((g) => g.title.toLowerCase().includes(trimmed))
        .slice(0, 3)
        .map((g) => ({
          type:     'goal',
          label:    g.title,
          subtitle: `${g.status} · ${g.progress || 0}% complete`,
          path:     '/goals',
        }));

      const convoResults = convos
        .filter((c) => c.title.toLowerCase().includes(trimmed))
        .slice(0, 3)
        .map((c) => ({
          type:     'conversation',
          label:    c.title,
          subtitle: 'Lumi conversation',
          path:     '/ai',
        }));

      setResults([...taskResults, ...goalResults, ...convoResults, ...pageMatches.slice(0, 3)]);
    } catch (_) {
      setResults(pageMatches);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => search(query), 150);
    return () => clearTimeout(id);
  }, [query, search]);

  const go = (result) => {
    navigate(result.path);
    onClose();
  };

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === 'Enter' && results[active]) {
        go(results[active]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, active, results]); // eslint-disable-line

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[active];
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[15vh]"
          style={{ background: 'rgba(7,11,20,0.60)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,   scale: 1    }}
            exit={{    opacity: 0, y: -8,  scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="w-full max-w-xl overflow-hidden rounded-3xl"
            style={{
              background:           'rgba(255,255,255,0.96)',
              backdropFilter:       'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border:               '1px solid rgba(255,255,255,0.80)',
              boxShadow:            '0 32px 80px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-5 py-4"
              style={{ borderBottom: '1px solid rgba(30,34,51,0.08)' }}>
              <Search size={18} className="text-ink/35 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                placeholder="Search tasks, goals, pages…"
                className="flex-1 bg-transparent outline-none text-sm font-medium text-ink placeholder:text-ink/35"
              />
              {query && (
                <button onClick={() => setQuery('')}
                  className="text-ink/30 hover:text-ink/60 transition shrink-0">
                  <X size={16} />
                </button>
              )}
              {/* Keyboard hint — desktop only */}
              <kbd className="hidden lg:flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-ink/30 border border-ink/10">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className="overflow-y-auto"
              style={{ maxHeight: 360 }}
            >
              {results.length === 0 && !loading && query.trim() && (
                <div className="flex flex-col items-center py-10 text-center">
                  <span className="text-3xl mb-2">🔍</span>
                  <p className="text-sm font-medium text-ink/55">No results for "{query}"</p>
                  <p className="text-xs text-ink/35 mt-1">Try a task name, goal, or page</p>
                </div>
              )}

              {results.length === 0 && !loading && !query.trim() && (
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink/30 mb-3">
                    Quick navigation
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {PAGES.slice(0, 6).map((p) => (
                      <button
                        key={p.path}
                        onClick={() => go({ path: p.path })}
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-ink/60 hover:text-ink transition-all"
                        style={{ background: 'rgba(30,34,51,0.04)', border: '1px solid rgba(30,34,51,0.06)' }}
                      >
                        <span className="text-base shrink-0">{p.icon}</span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.length > 0 && (
                <div className="py-2">
                  {/* Group by type */}
                  {['task','goal','conversation','page'].map((type) => {
                    const group = results.filter((r) => r.type === type);
                    if (!group.length) return null;
                    const labels = { task: 'Tasks', goal: 'Goals', conversation: 'Lumi Chats', page: 'Pages' };
                    return (
                      <div key={type}>
                        <p className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-ink/30">
                          {labels[type]}
                        </p>
                        {group.map((r) => {
                          const globalIdx = results.indexOf(r);
                          const isActive  = globalIdx === active;
                          return (
                            <button
                              key={`${r.type}-${r.label}`}
                              onClick={() => go(r)}
                              onMouseEnter={() => setActive(globalIdx)}
                              className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                              style={{ background: isActive ? 'rgba(124,106,240,0.08)' : 'transparent' }}
                            >
                              <span className="shrink-0">{RESULT_ICONS[r.type]}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${isActive ? 'text-lavender-700' : 'text-ink'}`}>
                                  {r.icon && <span className="mr-1.5">{r.icon}</span>}
                                  {r.label}
                                </p>
                                {r.subtitle && (
                                  <p className="text-[11px] text-ink/40 truncate mt-0.5">{r.subtitle}</p>
                                )}
                              </div>
                              {isActive && <ArrowRight size={13} className="text-lavender-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-8">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="h-5 w-5 rounded-full border-2 border-lavender-300 border-t-lavender-600"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 px-5 py-3"
              style={{ borderTop: '1px solid rgba(30,34,51,0.06)' }}>
              <span className="flex items-center gap-1.5 text-[10px] text-ink/30">
                <kbd className="rounded px-1.5 py-0.5 border border-ink/10 font-mono">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-ink/30">
                <kbd className="rounded px-1.5 py-0.5 border border-ink/10 font-mono">↵</kbd> open
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-ink/30">
                <kbd className="rounded px-1.5 py-0.5 border border-ink/10 font-mono">ESC</kbd> close
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}