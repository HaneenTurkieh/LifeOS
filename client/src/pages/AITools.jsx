import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Plus, Trash2, ChevronLeft, Brain } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const SUGGESTIONS = [
  { icon: '📋', text: 'What are my most important tasks today?' },
  { icon: '🎯', text: 'Create a goal to learn a new skill this month' },
  { icon: '📊', text: 'How productive have I been this week?' },
  { icon: '⚡', text: 'Plan my day — I have 4 hours and high energy' },
  { icon: '✅', text: 'Add a task: Review project proposal, high priority' },
  { icon: '🧠', text: 'I\'m procrastinating. Help me get started.' },
];

const TOOL_META = {
  create_task:             { icon: '✅', label: 'Task created',      color: '#7C6AF0' },
  complete_task:           { icon: '🎉', label: 'Task completed',    color: '#4CC38A' },
  create_goal:             { icon: '🎯', label: 'Goal created',      color: '#60A5FA' },
  list_tasks:              { icon: '📋', label: 'Tasks fetched',     color: '#7C6AF0' },
  list_goals:              { icon: '🎯', label: 'Goals fetched',     color: '#60A5FA' },
  get_productivity_summary:{ icon: '📊', label: 'Productivity data', color: '#F59E0B' },
  get_focus_stats:         { icon: '⏱', label: 'Focus stats',       color: '#7C6AF0' },
  generate_daily_plan:     { icon: '🗓', label: 'Plan generated',    color: '#4CC38A' },
  save_memory:             { icon: '🧠', label: 'Memory saved',      color: '#A855F7' },
  forget_memory:           { icon: '🗑', label: 'Memory cleared',    color: '#EF4444' },
};

// Glass style
const glass = {
  background:           'rgba(255,255,255,0.55)',
  border:               '1px solid rgba(255,255,255,0.60)',
  backdropFilter:       'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  boxShadow:            'inset 0 1px 0 rgba(255,255,255,0.75)',
};

function ActionCard({ action }) {
  const meta = TOOL_META[action.tool] || { icon: '⚡', label: action.tool, color: '#7C6AF0' };
  const r    = action.result;
  return (
    <div className="flex items-center gap-2 mt-1.5 rounded-xl px-3 py-1.5 text-xs font-medium w-fit"
      style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}28`, color: meta.color }}>
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
      {r?.title       && <span className="opacity-60">· {r.title}</span>}
      {r?.tasks?.length !== undefined && r.tasks && <span className="opacity-60">· {r.tasks.length} tasks</span>}
      {r?.goals?.length !== undefined && r.goals && <span className="opacity-60">· {r.goals.length} goals</span>}
      {r?.key         && <span className="opacity-60">· {r.key}</span>}
    </div>
  );
}

function Message({ msg }) {
  const isLumi = msg.role === 'assistant';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 ${isLumi ? '' : 'flex-row-reverse'}`}
    >
      {isLumi && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-white text-sm mt-0.5 shrink-0"
          style={{ background: 'linear-gradient(135deg, #7C6AF0 0%, #5B47E0 100%)', boxShadow: '0 4px 12px rgba(124,106,240,0.35)' }}>
          ✦
        </div>
      )}
      <div className={`flex flex-col gap-1 max-w-[82%] ${isLumi ? '' : 'items-end'}`}>
        <div className={`rounded-3xl px-4 py-3 text-sm leading-relaxed ${
          isLumi
            ? 'rounded-tl-md bg-white/70 dark:bg-white/[0.07] border border-white/60 dark:border-white/10 text-ink dark:text-white'
            : 'rounded-tr-md text-white'
        }`} style={!isLumi ? { background: 'linear-gradient(135deg,#7C6AF0 0%,#5B47E0 100%)', boxShadow: '0 4px 16px rgba(124,106,240,0.28)' } : {}}>
          {msg.content}
        </div>
        {isLumi && msg.actions?.map((a, i) => <ActionCard key={i} action={a} />)}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-white text-sm"
        style={{ background: 'linear-gradient(135deg,#7C6AF0 0%,#5B47E0 100%)' }}>✦</div>
      <div className="rounded-3xl rounded-tl-md px-4 py-3 bg-white/70 dark:bg-white/[0.07] border border-white/60 dark:border-white/10 flex items-center gap-1.5">
        {[0,1,2].map((i) => (
          <motion.div key={i} className="h-1.5 w-1.5 rounded-full bg-lavender-400"
            animate={{ y: [0,-4,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i*0.15 }} />
        ))}
      </div>
    </div>
  );
}

function ConversationList({ convos, activeId, onSelect, onNew, onDelete }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-ink/35 dark:text-white/30">History</span>
        <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
          onClick={onNew}
          className="flex h-7 w-7 items-center justify-center rounded-xl text-ink/50 dark:text-white/40"
          style={glass}>
          <Plus size={14} />
        </motion.button>
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto flex-1">
        {convos.length === 0 && (
          <p className="text-xs text-ink/30 dark:text-white/25 text-center mt-4">No chats yet</p>
        )}
        {convos.map((c) => (
          <div key={c.id}
            className={`group flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition-all ${
              activeId === c.id ? 'bg-lavender-100 dark:bg-lavender-500/15' : 'hover:bg-white/60 dark:hover:bg-white/[0.05]'
            }`}
            onClick={() => onSelect(c.id)}>
            <span className={`flex-1 text-xs font-medium truncate ${activeId === c.id ? 'text-lavender-700 dark:text-lavender-300' : 'text-ink/65 dark:text-white/55'}`}>
              {c.title}
            </span>
            <button onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
              className="opacity-0 group-hover:opacity-100 transition text-ink/25 hover:text-coral-500 shrink-0">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AITools() {
  const { user } = useAuth();

  const [convos,      setConvos]      = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Load conversation list
  const loadConvos = useCallback(async () => {
    try {
      const data = await api.get('/chat/conversations');
      setConvos(data);
    } catch (_) {}
  }, []);

  useEffect(() => { loadConvos(); }, [loadConvos]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Load a specific conversation
  const loadConversation = async (id) => {
    try {
      const data = await api.get(`/chat/conversations/${id}`);
      setActiveConvId(id);
      setMessages(data.messages);
      setSidebarOpen(false);
    } catch (_) {}
  };

  const startNew = () => {
    setActiveConvId(null);
    setMessages([]);
    setInput('');
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const deleteConvo = async (id) => {
    await api.del(`/chat/conversations/${id}`);
    if (activeConvId === id) startNew();
    setConvos((c) => c.filter((x) => x.id !== id));
  };

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    setInput('');

    const userMsg = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));

    try {
      const res = await api.post('/chat', { messages: history, conversation_id: activeConvId });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.text, actions: res.actions || [] }]);
      if (!activeConvId) {
        setActiveConvId(res.conversation_id);
        loadConvos(); // refresh sidebar
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: "Sorry, I couldn't connect. Please try again.", actions: [] }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages, activeConvId, loadConvos]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const isFirstMessage = messages.length === 0;
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="flex h-[calc(100vh-88px)] lg:h-[calc(100vh-64px)] gap-4">

      {/* ── Sidebar ───────────────────────────────────────── */}
      <AnimatePresence>
        {(sidebarOpen || true) && ( // always show on desktop, toggle on mobile
          <motion.div
            initial={false}
            className="hidden lg:flex flex-col w-56 shrink-0 rounded-3xl p-4"
            style={glass}>
            <ConversationList
              convos={convos}
              activeId={activeConvId}
              onSelect={loadConversation}
              onNew={startNew}
              onDelete={deleteConvo}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chat area ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Mobile history button */}
        <div className="flex items-center gap-2 mb-3 lg:hidden">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-ink/60 dark:text-white/50"
            style={glass}>
            <Brain size={14} /> History
          </button>
          <button onClick={startNew} className="flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold btn-primary">
            <Plus size={13} /> New chat
          </button>
        </div>

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}>
              <motion.div
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                className="absolute top-0 left-0 bottom-0 w-64 p-5"
                style={{ ...glass, borderRadius: '0 2rem 2rem 0' }}
                onClick={(e) => e.stopPropagation()}>
                <ConversationList convos={convos} activeId={activeConvId} onSelect={loadConversation} onNew={startNew} onDelete={deleteConvo} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Welcome / empty state */}
        <AnimatePresence>
          {isFirstMessage && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center justify-center flex-1 gap-6 px-4 pb-4">
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  animate={{ y: [0,-6,0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex h-16 w-16 items-center justify-center rounded-3xl text-white text-3xl"
                  style={{ background: 'linear-gradient(135deg,#7C6AF0 0%,#5B47E0 50%,#4634B8 100%)', boxShadow: '0 12px 32px rgba(124,106,240,0.4)' }}>
                  ✦
                </motion.div>
                <div className="text-center">
                  <h1 className="font-display text-2xl font-bold text-ink dark:text-white">
                    Hi {firstName}, I'm Lumi ✦
                  </h1>
                  <p className="text-sm text-ink/50 dark:text-white/40 mt-1">
                    Your Aurora productivity assistant. I remember things between chats.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTIONS.map(({ icon, text }) => (
                  <motion.button key={text}
                    whileHover={{ y: -1, scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    onClick={() => sendMessage(text)}
                    className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-left text-sm font-medium text-ink/70 dark:text-white/60"
                    style={glass}>
                    <span className="text-base shrink-0">{icon}</span>{text}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        {!isFirstMessage && (
          <div className="flex-1 overflow-y-auto px-1 py-2 flex flex-col gap-4">
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input */}
        <div className="pt-3 pb-1">
          <div className="flex items-end gap-2 rounded-3xl p-2 pl-4" style={glass}>
            <textarea
              ref={inputRef}
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none text-sm text-ink dark:text-white placeholder:text-ink/35 dark:placeholder:text-white/30 py-2 max-h-32"
              placeholder="Ask Lumi anything…"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={handleKey}
            />
            <motion.button
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#7C6AF0 0%,#5B47E0 100%)', boxShadow: '0 4px 12px rgba(124,106,240,0.35)' }}>
              <Send size={15} />
            </motion.button>
          </div>
          <p className="text-center text-[10px] text-ink/25 dark:text-white/20 mt-2">
            Lumi can make mistakes. Double-check important actions.
          </p>
        </div>
      </div>
    </div>
  );
}