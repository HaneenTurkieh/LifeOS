import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, CheckCircle2, Target, ListChecks, BarChart2, Timer, Zap } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageLoader from '../components/Loader.jsx';

// ── Suggested prompts ─────────────────────────────────────────
const SUGGESTIONS = [
  { icon: '📋', text: 'What are my most important tasks today?' },
  { icon: '🎯', text: 'Create a goal to learn a new skill this month' },
  { icon: '📊', text: 'How productive have I been this week?' },
  { icon: '⚡', text: 'Plan my day — I have 4 hours and high energy' },
  { icon: '✅', text: 'Add a task: Review project proposal, high priority' },
  { icon: '🧠', text: 'I\'m procrastinating. Help me get started.' },
];

// ── Tool action display ───────────────────────────────────────
function ActionCard({ action }) {
  const { tool, input, result } = action;

  const TOOL_META = {
    create_task:             { icon: '✅', label: 'Task created',     color: '#7C6AF0' },
    complete_task:           { icon: '🎉', label: 'Task completed',   color: '#4CC38A' },
    create_goal:             { icon: '🎯', label: 'Goal created',     color: '#60A5FA' },
    list_tasks:              { icon: '📋', label: 'Tasks fetched',    color: '#7C6AF0' },
    list_goals:              { icon: '🎯', label: 'Goals fetched',    color: '#60A5FA' },
    get_productivity_summary:{ icon: '📊', label: 'Productivity data',color: '#F59E0B' },
    get_focus_stats:         { icon: '⏱', label: 'Focus stats',      color: '#7C6AF0' },
    generate_daily_plan:     { icon: '🗓', label: 'Plan generated',   color: '#4CC38A' },
  };

  const meta = TOOL_META[tool] || { icon: '⚡', label: tool, color: '#7C6AF0' };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="flex items-start gap-2 mt-1.5"
    >
      <div className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium"
        style={{
          background: `${meta.color}14`,
          border:     `1px solid ${meta.color}30`,
          color:      meta.color,
        }}>
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
        {result?.title && <span className="opacity-70">· {result.title}</span>}
        {result?.tasks && <span className="opacity-70">· {result.tasks.length} tasks</span>}
        {result?.goals && <span className="opacity-70">· {result.goals.length} goals</span>}
        {result?.tasks_completed !== undefined && (
          <span className="opacity-70">· {result.tasks_completed} done this {result.period}</span>
        )}
      </div>
    </motion.div>
  );
}

// ── Message bubble ────────────────────────────────────────────
function Message({ msg }) {
  const isLumi = msg.role === 'assistant';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`flex gap-3 ${isLumi ? '' : 'flex-row-reverse'}`}
    >
      {/* Avatar */}
      {isLumi && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-white text-sm mt-0.5"
          style={{ background: 'linear-gradient(135deg, #7C6AF0 0%, #5B47E0 100%)', boxShadow: '0 4px 12px rgba(124,106,240,0.35)' }}>
          ✦
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[82%] ${isLumi ? '' : 'items-end'}`}>
        {/* Bubble */}
        <div className={`rounded-3xl px-4 py-3 text-sm leading-relaxed ${
          isLumi
            ? 'rounded-tl-md bg-white/70 dark:bg-white/[0.06] border border-white/60 dark:border-white/10 text-ink dark:text-white'
            : 'rounded-tr-md text-white'
        }`}
          style={!isLumi ? {
            background: 'linear-gradient(135deg, #7C6AF0 0%, #5B47E0 100%)',
            boxShadow:  '0 4px 16px rgba(124,106,240,0.30)',
          } : {}}>
          {msg.content}
        </div>

        {/* Tool action cards */}
        {isLumi && msg.actions?.map((a, i) => (
          <ActionCard key={i} action={a} />
        ))}
      </div>
    </motion.div>
  );
}

// ── Typing indicator ──────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-white text-sm"
        style={{ background: 'linear-gradient(135deg, #7C6AF0 0%, #5B47E0 100%)' }}>
        ✦
      </div>
      <div className="rounded-3xl rounded-tl-md px-4 py-3 bg-white/70 dark:bg-white/[0.06] border border-white/60 dark:border-white/10 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div key={i} className="h-1.5 w-1.5 rounded-full bg-lavender-400"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function AITools() {
  const { user }    = useAuth();
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');

    const userMsg = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // Build history for API (only role + content, no actions)
    const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));

    try {
      const res = await api.post('/chat', { messages: history });
      setMessages((prev) => [...prev, {
        role:    'assistant',
        content: res.text,
        actions: res.actions || [],
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role:    'assistant',
        content: "Sorry, I couldn't connect right now. Please try again.",
        actions: [],
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const isFirstMessage = messages.length === 0;
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="flex flex-col h-[calc(100vh-88px)] lg:h-[calc(100vh-64px)] max-w-3xl mx-auto">

      {/* ── Empty state / welcome ────────────────────────── */}
      <AnimatePresence>
        {isFirstMessage && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col items-center justify-center flex-1 gap-6 px-4 pb-4"
          >
            {/* Lumi avatar */}
            <div className="flex flex-col items-center gap-3">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-16 w-16 items-center justify-center rounded-3xl text-white text-3xl shadow-[0_12px_32px_rgba(124,106,240,0.4)]"
                style={{ background: 'linear-gradient(135deg, #7C6AF0 0%, #5B47E0 50%, #4634B8 100%)' }}>
                ✦
              </motion.div>
              <div className="text-center">
                <h1 className="font-display text-2xl font-bold text-ink dark:text-white">
                  Hi {firstName}, I'm Lumi ✦
                </h1>
                <p className="text-sm text-ink/50 dark:text-white/40 mt-1">
                  Your Aurora productivity assistant. Ask me anything.
                </p>
              </div>
            </div>

            {/* Suggested prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map(({ icon, text }) => (
                <motion.button
                  key={text}
                  whileHover={{ y: -1, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => sendMessage(text)}
                  className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-left text-sm font-medium text-ink/70 dark:text-white/60 transition-all"
                  style={{
                    background:   'rgba(255,255,255,0.55)',
                    border:       '1px solid rgba(255,255,255,0.60)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    boxShadow:    'inset 0 1px 0 rgba(255,255,255,0.7)',
                  }}>
                  <span className="text-base shrink-0">{icon}</span>
                  {text}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages ─────────────────────────────────────── */}
      {!isFirstMessage && (
        <div className="flex-1 overflow-y-auto px-2 py-4 flex flex-col gap-4 scroll-smooth">
          {messages.map((msg, i) => (
            <Message key={i} msg={msg} />
          ))}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── Input bar ────────────────────────────────────── */}
      <div className="pt-3 pb-1 px-1">
        <div className="flex items-end gap-2 rounded-3xl p-2 pl-4"
          style={{
            background:           'rgba(255,255,255,0.65)',
            border:               '1px solid rgba(255,255,255,0.65)',
            backdropFilter:       'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            boxShadow:            'inset 0 1.5px 0 rgba(255,255,255,0.80), 0 4px 20px rgba(0,0,0,0.06)',
          }}>
          <textarea
            ref={inputRef}
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none text-sm text-ink dark:text-white placeholder:text-ink/35 dark:placeholder:text-white/30 py-2 max-h-32"
            placeholder="Ask Lumi anything…"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={handleKey}
          />
          <motion.button
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white transition disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #7C6AF0 0%, #5B47E0 100%)',
              boxShadow:  '0 4px 12px rgba(124,106,240,0.35)',
            }}>
            <Send size={15} />
          </motion.button>
        </div>
        <p className="text-center text-[10px] text-ink/25 dark:text-white/20 mt-2">
          Lumi can make mistakes. Double-check important actions.
        </p>
      </div>
    </div>
  );
}