import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ListChecks, Target, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const PAGES = [
  { navKey: 'nav.dashboard', path: '/',          icon: '🏠', keywords: ['home','dashboard'] },
  { navKey: 'nav.tasks',     path: '/tasks',      icon: '✅', keywords: ['tasks','todo'] },
  { navKey: 'nav.goals',     path: '/goals',      icon: '🎯', keywords: ['goals','habits','recurring'] },
  { navKey: 'nav.flow',      path: '/learning',   icon: '⏱', keywords: ['flow','focus','pomodoro','timer'] },
  { navKey: 'nav.lumi',      path: '/ai',         icon: '✦',  keywords: ['lumi','ai','chat','assistant'] },
  { navKey: 'nav.analytics', path: '/analytics',  icon: '📊', keywords: ['analytics','stats','charts'] },
  { navKey: 'nav.launchpad', path: '/launchpad',  icon: '🚀', keywords: ['launchpad','internship','cv','projects'] },
  { navKey: 'nav.treeshop',  path: '/trees',      icon: '🌳', keywords: ['trees','xp','shop'] },
  { navKey: 'nav.history',   path: '/history',    icon: '🕐', keywords: ['history','timeline'] },
  { navKey: 'nav.exam',      path: '/exam',       icon: '🎓', keywords: ['exam','quiz','flashcards','study'] },
];

export default function GlobalSearch({ open, onClose }) {
  const navigate              = useNavigate();
  const { resolvedTheme }     = useTheme();
  const { t }                 = useLanguage();
  const isDark                = resolvedTheme === 'dark';
  const PAGES_T = PAGES.map((p) => ({ ...p, label: t(p.navKey) }));
  const inputRef              = useRef(null);
  const listRef               = useRef(null);
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active,  setActive]  = useState(0);

  const panelBg      = isDark ? 'rgba(18,14,35,0.97)'              : 'rgba(255,255,255,0.97)';
  const panelBorder  = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.80)';
  const divider      = isDark ? 'rgba(255,255,255,0.06)'           : 'rgba(30,34,51,0.07)';
  const inputClr     = isDark ? 'text-white'                       : 'text-ink';
  const placeholderC = isDark ? 'placeholder:text-white/25'        : 'placeholder:text-ink/35';
  const labelClr     = isDark ? 'text-white/30'                    : 'text-ink/30';
  const titleClr     = isDark ? 'text-white'                       : 'text-ink';
  const subtitleClr  = isDark ? 'text-white/40'                    : 'text-ink/40';
  const quickBg      = isDark ? 'rgba(255,255,255,0.05)'           : 'rgba(30,34,51,0.04)';
  const quickBorder  = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(30,34,51,0.06)';
  const quickClr     = isDark ? 'text-white/55 hover:text-white/90': 'text-ink/60 hover:text-ink';
  const kbdBg        = isDark ? 'rgba(255,255,255,0.06)'           : 'rgba(30,34,51,0.05)';
  const kbdBorder    = isDark ? 'rgba(255,255,255,0.10)'           : 'rgba(30,34,51,0.10)';
  const kbdClr       = isDark ? 'text-white/25'                    : 'text-ink/30';
  const RESULT_ICONS = {
    task:         <ListChecks size={14} className="text-lavender-500" />,
    goal:         <Target     size={14} className="text-blue-400"     />,
    conversation: <Sparkles   size={14} className="text-violet-400"   />,
    page:         <ArrowRight size={14} className={isDark ? 'text-white/30' : 'text-ink/30'} />,
  };

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const search = useCallback(async (q) => {
    const trimmed = q.trim().toLowerCase();
    const pageMatches = PAGES_T
      .filter((p) =>
        p.label.toLowerCase().includes(trimmed) ||
        p.keywords.some((k) => k.includes(trimmed))
      )
      .map((p) => ({ type: 'page', label: p.label, icon: p.icon, path: p.path }));
    if (!trimmed) { setResults(pageMatches.slice(0, 6)); return; }
    setLoading(true);
    try {
      const [tasks, goals, convos] = await Promise.all([
        api.get('/tasks'),
        api.get('/goals'),
        api.get('/chat/conversations'),
      ]);
      const priorityLabel = (p) => t(p === 'high' ? 'tasks.high' : p === 'low' ? 'tasks.low' : 'tasks.medium');
      const statusLabel   = (s) => t(s === 'doing' ? 'search.statusDoing' : s === 'done' ? 'search.statusDone' : 'search.statusTodo');
      const taskResults = tasks
        .filter((tk) => tk.title.toLowerCase().includes(trimmed))
        .slice(0, 4)
        .map((tk) => ({ type:'task', label:tk.title, subtitle: t('search.taskSubtitle', { priority: priorityLabel(tk.priority), status: statusLabel(tk.status) }), path:'/tasks' }));
      const goalResults = goals
        .filter((g) => g.title.toLowerCase().includes(trimmed))
        .slice(0, 3)
        .map((g) => ({ type:'goal', label:g.title, subtitle: t('search.goalSubtitle', { status: t(g.status === 'completed' ? 'search.goalCompleted' : 'search.goalActive'), n: g.progress||0 }), path:'/goals' }));
      const convoResults = convos
        .filter((c) => c.title.toLowerCase().includes(trimmed))
        .slice(0, 3)
        .map((c) => ({ type:'conversation', label:c.title, subtitle: t('search.chatSubtitle'), path:'/ai' }));
      setResults([...taskResults, ...goalResults, ...convoResults, ...pageMatches.slice(0, 3)]);
    } catch (_) {
      setResults(pageMatches);
    } finally {
      setLoading(false);
    }
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = setTimeout(() => search(query), 150);
    return () => clearTimeout(id);
  }, [query, search]);

  const go = (result) => { navigate(result.path); onClose(); };
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'ArrowDown')  { e.preventDefault(); setActive((a) => Math.min(a+1, results.length-1)); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(a-1, 0)); }
      else if (e.key === 'Enter' && results[active]) go(results[active]);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, active, results]); // eslint-disable-line
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block:'nearest' });
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
          style={{ background:'rgba(7,11,20,0.65)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity:0, y:-16, scale:0.97 }}
            animate={{ opacity:1, y:0,   scale:1    }}
            exit={{    opacity:0, y:-8,  scale:0.98 }}
            transition={{ type:'spring', stiffness:420, damping:30 }}
            className="w-full max-w-xl overflow-hidden rounded-3xl"
            style={{
              background:           panelBg,
              backdropFilter:       'blur(48px)',
              WebkitBackdropFilter: 'blur(48px)',
              border:               panelBorder,
              boxShadow:            isDark
                ? '0 32px 80px rgba(0,0,0,0.60)'
                : '0 32px 80px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center gap-3 px-5 py-4"
              style={{ borderBottom: `1px solid ${divider}` }}
            >
              <Search size={18} className={isDark ? 'text-white/35 shrink-0' : 'text-ink/35 shrink-0'} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                placeholder={t('search.placeholder')}
                className={`flex-1 bg-transparent outline-none text-sm font-medium ${inputClr} ${placeholderC}`}
              />
              {query && (
                <button onClick={() => setQuery('')}
                  className={`shrink-0 transition ${isDark ? 'text-white/30 hover:text-white/60' : 'text-ink/30 hover:text-ink/60'}`}>
                  <X size={16} />
                </button>
              )}
              <kbd
                className="hidden lg:flex items-center rounded-lg px-2 py-1 text-[10px] font-semibold"
                style={{ background: kbdBg, border: `1px solid ${kbdBorder}`, color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(30,34,51,0.30)' }}
              >
                ESC
              </kbd>
            </div>
            <div ref={listRef} className="overflow-y-auto" style={{ maxHeight: 360 }}>
              {results.length === 0 && !loading && query.trim() && (
                <div className="flex flex-col items-center py-10 text-center">
                  <span className="text-3xl mb-2">🔍</span>
                  <p className={`text-sm font-medium ${isDark ? 'text-white/55' : 'text-ink/55'}`}>
                    {t('search.noResults', { query })}
                  </p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-white/30' : 'text-ink/35'}`}>
                    {t('search.tryHint')}
                  </p>
                </div>
              )}
              {results.length === 0 && !loading && !query.trim() && (
                <div className="px-5 py-4">
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${labelClr}`}>
                    {t('search.quickNav')}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {PAGES_T.slice(0, 6).map((p) => (
                      <button
                        key={p.path}
                        onClick={() => go({ path: p.path })}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-all ${quickClr}`}
                        style={{ background: quickBg, border: quickBorder }}
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
                  {['task','goal','conversation','page'].map((type) => {
                    const group = results.filter((r) => r.type === type);
                    if (!group.length) return null;
                    const labels = { task:t('search.groupTasks'), goal:t('search.groupGoals'), conversation:t('search.groupChats'), page:t('search.groupPages') };
                    return (
                      <div key={type}>
                        <p className={`px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest ${labelClr}`}>
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
                              style={{
                                background: isActive
                                  ? isDark ? 'rgb(var(--accent-500) / 0.15)' : 'rgb(var(--accent-500) / 0.08)'
                                  : 'transparent',
                              }}
                            >
                              <span className="shrink-0">{RESULT_ICONS[r.type]}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${
                                  isActive ? 'text-lavender-400' : titleClr
                                }`}>
                                  {r.icon && <span className="mr-1.5">{r.icon}</span>}
                                  {r.label}
                                </p>
                                {r.subtitle && (
                                  <p className={`text-[11px] truncate mt-0.5 ${subtitleClr}`}>{r.subtitle}</p>
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
                    transition={{ duration:1, repeat:Infinity, ease:'linear' }}
                    className="h-5 w-5 rounded-full border-2 border-lavender-400 border-t-lavender-600"
                  />
                </div>
              )}
            </div>
            <div
              className="flex items-center gap-4 px-5 py-3"
              style={{ borderTop: `1px solid ${divider}` }}
            >
              {[
                { key:'↑↓', label:t('search.navHint') },
                { key:'↵',  label:t('search.openHint')     },
                { key:'ESC',label:t('search.closeHint')    },
              ].map(({ key, label }) => (
                <span key={key} className={`flex items-center gap-1.5 text-[10px] ${kbdClr}`}>
                  <kbd
                    className="rounded px-1.5 py-0.5 font-mono text-[10px]"
                    style={{ background: kbdBg, border: `1px solid ${kbdBorder}` }}
                  >
                    {key}
                  </kbd>
                  {label}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}