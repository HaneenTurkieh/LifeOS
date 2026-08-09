import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Plus, Trash2, Brain, Paperclip, X, FileText,
  Sparkles, Globe, SlidersHorizontal, Check, Pencil,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const TOOL_META = {
  create_task:             { icon: '✅', label: 'Task created',      color: 'rgb(var(--accent-500))' },
  complete_task:           { icon: '🎉', label: 'Task completed',    color: '#4CC38A' },
  create_goal:             { icon: '🎯', label: 'Goal created',      color: '#60A5FA' },
  list_tasks:              { icon: '📋', label: 'Tasks fetched',     color: 'rgb(var(--accent-500))' },
  list_goals:              { icon: '🎯', label: 'Goals fetched',     color: '#60A5FA' },
  get_productivity_summary:{ icon: '📊', label: 'Productivity data', color: '#F59E0B' },
  get_focus_stats:         { icon: '⏱', label: 'Focus stats',       color: 'rgb(var(--accent-500))' },
  get_focus_history:       { icon: '📈', label: 'Focus history',     color: 'rgb(var(--accent-500))' },
  get_habit_streaks:       { icon: '🔥', label: 'Habit streaks',     color: '#F59E0B' },
  get_mood_insights:       { icon: '💜', label: 'Mood insights',     color: '#A855F7' },
  list_upcoming_deadlines: { icon: '⏰', label: 'Deadlines',         color: '#FF7A63' },
  get_xp_progress:         { icon: '🌳', label: 'XP progress',       color: '#4CC38A' },
  generate_daily_plan:     { icon: '🗓', label: 'Plan generated',    color: '#4CC38A' },
  save_memory:             { icon: '🧠', label: 'Memory saved',      color: '#A855F7' },
  forget_memory:           { icon: '🗑', label: 'Memory cleared',    color: '#EF4444' },
};
const ACCEPTED_FILES = '.pdf,.pptx,.docx,.txt,.png,.jpg,.jpeg,.webp,.gif';
const MAX_FILE_MB    = 25;
const MAX_ATTACH     = 3;

const glassDark = {
  background:           'rgba(255,255,255,0.04)',
  border:               '1px solid rgba(255,255,255,0.08)',
  backdropFilter:       'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  boxShadow:            'inset 0 1px 0 rgba(255,255,255,0.06)',
};
const glassLight = {
  background:           'rgba(255,255,255,0.55)',
  border:               '1px solid rgba(255,255,255,0.60)',
  backdropFilter:       'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  boxShadow:            'inset 0 1px 0 rgba(255,255,255,0.75)',
};
const accentBtn = {
  background: 'rgb(var(--accent-500) / 0.12)',
  border:     '1px solid rgb(var(--accent-500) / 0.30)',
  color:      'rgb(var(--accent-500))',
};

function ActionCard({ action }) {
  const meta = TOOL_META[action.tool] || { icon: '⚡', label: action.tool, color: 'rgb(var(--accent-500))' };
  const r    = action.result;
  return (
    <div
      className="flex items-center gap-2 mt-1.5 rounded-xl px-3 py-1.5 text-xs font-medium w-fit"
      style={{ background: `${meta.color}14`, border: `1px solid ${meta.color}28`, color: meta.color }}
    >
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
      {r?.title  && <span className="opacity-60">· {r.title}</span>}
      {r?.tasks  && <span className="opacity-60">· {r.tasks.length} tasks</span>}
      {r?.goals  && <span className="opacity-60">· {r.goals.length} goals</span>}
      {r?.key    && <span className="opacity-60">· {r.key}</span>}
    </div>
  );
}
function Message({ msg, isEditing, canEdit, onStartEdit, onCancelEdit, onSaveEdit, editBusy, t }) {
  const isLumi = msg.role === 'assistant';
  const [draft, setDraft] = useState(msg.content);
  useEffect(() => { if (isEditing) setDraft(msg.content); }, [isEditing]); // eslint-disable-line
  const textareaRef = useRef(null);
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(draft.length, draft.length);
    }
  }, [isEditing]); // eslint-disable-line

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`group flex gap-3 ${isLumi ? '' : 'flex-row-reverse'}`}
    >
      {isLumi && (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-white text-sm mt-0.5"
          style={{ background: 'linear-gradient(135deg, rgb(var(--accent-500)) 0%, rgb(var(--accent-600)) 100%)', boxShadow: '0 4px 12px rgb(var(--accent-500) / 0.35)' }}
        >
          ✦
        </div>
      )}
      <div className={`flex flex-col gap-1 max-w-[82%] ${isLumi ? '' : 'items-end'} ${isEditing ? 'w-full' : ''}`}>
        {isEditing ? (
          <div className="w-full flex flex-col gap-2 items-end">
            <textarea
              ref={textareaRef}
              dir="auto"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (draft.trim()) onSaveEdit(draft.trim()); }
                if (e.key === 'Escape') onCancelEdit();
              }}
              rows={Math.min(8, Math.max(2, draft.split('\n').length))}
              className="w-full rounded-3xl rounded-tr-md px-4 py-3 text-sm leading-relaxed text-ink dark:text-white resize-none outline-none"
              style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid rgb(var(--accent-500) / 0.35)' }}
            />
            <div className="flex items-center gap-1.5">
              <button onClick={onCancelEdit} disabled={editBusy}
                className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-ink/45 dark:text-white/40 hover:text-ink/70 dark:hover:text-white/65 transition disabled:opacity-40">
                <X size={11} /> {t ? t('common.cancel') : 'Cancel'}
              </button>
              <button onClick={() => draft.trim() && onSaveEdit(draft.trim())} disabled={editBusy || !draft.trim()}
                className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-white transition disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, rgb(var(--accent-500)) 0%, rgb(var(--accent-600)) 100%)' }}>
                <Check size={11} /> {editBusy ? '…' : (t ? t('lumi.saveResend') : 'Save & resend')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-1.5">
            {!isLumi && canEdit && (
              <button
                onClick={onStartEdit}
                title={t ? t('lumi.editPrompt') : 'Edit'}
                className="opacity-0 group-hover:opacity-100 transition mb-1 flex h-6 w-6 items-center justify-center rounded-lg text-ink/30 dark:text-white/30 hover:text-ink/60 dark:hover:text-white/60"
                style={{ background: 'rgba(255,255,255,0.5)' }}
              >
                <Pencil size={11} />
              </button>
            )}
            <div
              dir="auto"
              className={`rounded-3xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                isLumi
                  ? 'rounded-tl-md bg-white/70 dark:bg-white/[0.07] border border-white/60 dark:border-white/10 text-ink dark:text-white'
                  : 'rounded-tr-md text-white'
              }`}
              style={!isLumi ? { background: 'linear-gradient(135deg, rgb(var(--accent-500)) 0%, rgb(var(--accent-600)) 100%)', boxShadow: '0 4px 16px rgb(var(--accent-500) / 0.28)' } : {}}
            >
              {msg.content}
            </div>
          </div>
        )}
        {!isLumi && msg.attachmentNames?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-end">
            {msg.attachmentNames.map((n) => (
              <span key={n}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold"
                style={accentBtn}
              >
                <Paperclip size={9} /> {n}
              </span>
            ))}
          </div>
        )}
        {isLumi && msg.actions?.map((a, i) => <ActionCard key={i} action={a} />)}
        {isLumi && msg.suggestSearch && (
          <p className="text-[11px] text-ink/35 dark:text-white/25 mt-1 px-1">
            💡 For guaranteed up-to-date numbers on this, try{' '}
            <span className="font-semibold text-lavender-500">Deep Search</span> instead of regular chat.
          </p>
        )}
      </div>
    </motion.div>
  );
}
function TypingIndicator({ mode, t }) {
  return (
    <div className="flex gap-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-white text-sm"
        style={{ background: 'linear-gradient(135deg, rgb(var(--accent-500)) 0%, rgb(var(--accent-600)) 100%)' }}
      >✦</div>
      <div className="rounded-3xl rounded-tl-md px-4 py-3 bg-white/70 dark:bg-white/[0.07] border border-white/60 dark:border-white/10 flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-lavender-400"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
        {mode === 'think'  && <span className="text-[10px] text-ink/35 dark:text-white/30 font-medium">{t('lumi.thinkingDeeply')}</span>}
        {mode === 'search' && <span className="text-[10px] text-ink/35 dark:text-white/30 font-medium">{t('lumi.searchingWeb')}</span>}
      </div>
    </div>
  );
}
function ConversationList({ convos, activeId, onSelect, onNew, onDelete, t }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold uppercase tracking-widest text-ink/35 dark:text-white/30">{t('lumi.history')}</span>
        <motion.button
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
          onClick={onNew}
          className="flex h-7 w-7 items-center justify-center rounded-xl transition"
          style={accentBtn}
        >
          <Plus size={14} />
        </motion.button>
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto flex-1">
        {convos.length === 0 && (
          <p className="text-xs text-ink/30 dark:text-white/25 text-center mt-6">{t('lumi.noChats')}</p>
        )}
        {convos.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition-all ${
              activeId === c.id
                ? 'bg-lavender-500/20 text-lavender-600 dark:text-lavender-300'
                : 'text-ink/55 dark:text-white/50 hover:bg-ink/[0.04] dark:hover:bg-white/[0.06] hover:text-ink/80 dark:hover:text-white/75'
            }`}
            onClick={() => onSelect(c.id)}
          >
            <span className="flex-1 text-xs font-medium truncate">{c.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
              className="opacity-0 group-hover:opacity-100 transition text-ink/25 dark:text-white/25 hover:!text-coral-400 shrink-0"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
function PanelIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function LumiSettingsPanel({ open, onClose, isDark, t }) {
  const [settings, setSettings] = useState(null);
  const [saved,    setSaved]    = useState(false);

  const SETTINGS_OPTIONS = {
    tone:            { label: t('lumi.tone'),       options: ['friendly','professional','motivational','calm','playful'] },
    response_length: { label: t('lumi.length'),     options: ['short','balanced','detailed'] },
    emoji_level:     { label: t('lumi.emojiLabel'), options: ['none','some','lots'] },
  };
  const OPTION_LABELS = {
    friendly: t('lumi.toneFriendly'), professional: t('lumi.toneProfessional'), motivational: t('lumi.toneMotivational'),
    calm: t('lumi.toneCalm'), playful: t('lumi.tonePlayful'),
    short: t('lumi.lengthShort'), balanced: t('lumi.lengthBalanced'), detailed: t('lumi.lengthDetailed'),
    none: t('lumi.emojiNone'), some: t('lumi.emojiSome'), lots: t('lumi.emojiLots'),
  };

  useEffect(() => {
    if (!open) return;
    api.get('/chat/settings').then(setSettings).catch(() => {
      setSettings({ tone:'friendly', response_length:'balanced', emoji_level:'some' });
    });
  }, [open]);

  const update = async (field, value) => {
    const next = { ...settings, [field]: value };
    setSettings(next);
    try {
      await api.put('/chat/settings', next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (_) {}
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.16 }}
          className="absolute bottom-full end-0 mb-2 w-72 rounded-3xl p-4 z-30"
          style={{
            ...(isDark ? glassDark : glassLight),
            background: isDark ? 'rgba(18,14,35,0.92)' : 'rgba(255,255,255,0.92)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/35">
              {t('lumi.settingsTitle')}
            </span>
            <div className="flex items-center gap-2">
              <AnimatePresence>
                {saved && (
                  <motion.span
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-1 text-[10px] font-semibold text-sage-500"
                  >
                    <Check size={10} /> {t('lumi.saved')}
                  </motion.span>
                )}
              </AnimatePresence>
              <button onClick={onClose} className="text-ink/30 dark:text-white/30 hover:text-ink/60 dark:hover:text-white/60 transition">
                <X size={14} />
              </button>
            </div>
          </div>
          {!settings ? (
            <p className="text-xs text-ink/35 dark:text-white/30 py-4 text-center">{t('lumi.loadingSettings')}</p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {Object.entries(SETTINGS_OPTIONS).map(([field, { label, options }]) => (
                <div key={field}>
                  <p className="text-[11px] font-bold text-ink/45 dark:text-white/40 mb-1.5">{label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {options.map((opt) => {
                      const active = settings[field] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => update(field, opt)}
                          className="rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-all"
                          style={active
                            ? { background:'rgb(var(--accent-500) / 0.18)', border:'1px solid rgb(var(--accent-500) / 0.45)', color:'rgb(var(--accent-500))' }
                            : {
                                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(30,34,51,0.04)',
                                border:     isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(30,34,51,0.07)',
                                color:      isDark ? 'rgba(255,255,255,0.45)' : 'rgba(30,34,51,0.50)',
                              }}
                        >
                          {OPTION_LABELS[opt] || opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-ink/30 dark:text-white/25 pt-1">
                {t('lumi.settingsHint')}
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AITools() {
  const { user }          = useAuth();
  const { resolvedTheme } = useTheme();
  const toast              = useToast();
  const { t, lang }        = useLanguage();
  const isDark             = resolvedTheme === 'dark';
  const isRTL              = lang === 'ar';

  const SUGGESTIONS = [
    { icon: '📋', text: t('lumi.sugg1') },
    { icon: '🎯', text: t('lumi.sugg2') },
    { icon: '📊', text: t('lumi.sugg3') },
    { icon: '⚡', text: t('lumi.sugg4') },
    { icon: '✅', text: t('lumi.sugg5') },
    { icon: '🧠', text: t('lumi.sugg6') },
  ];
  const CHAT_MODES = [
    { key: 'chat',   label: t('lumi.chat'),       Icon: Sparkles, hint: t('lumi.chatHint')   },
    { key: 'think',  label: t('lumi.deepThink'),  Icon: Brain,    hint: t('lumi.thinkHint')  },
    { key: 'search', label: t('lumi.deepSearch'), Icon: Globe,    hint: t('lumi.searchHint') },
  ];

  const [convos,         setConvos]         = useState([]);
  const [activeConvId,   setActiveConvId]   = useState(null);
  const [messages,       setMessages]       = useState([]);
  const [input,          setInput]          = useState('');
  const [loading,        setLoading]        = useState(false);
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [mode,           setMode]           = useState('chat');
  const [attachments,    setAttachments]    = useState([]);
  const [attaching,      setAttaching]      = useState(false);
  const [settingsOpen,   setSettingsOpen]   = useState(false);
  const [editingIndex,   setEditingIndex]   = useState(null);
  const [editBusy,       setEditBusy]       = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const fileRef   = useRef(null);

  const BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:4000'
    : 'https://lifeos-0l81.onrender.com';

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
    setAttachments([]);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const deleteConvo = async (id) => {
    await api.del(`/chat/conversations/${id}`);
    if (activeConvId === id) startNew();
    setConvos((c) => c.filter((x) => x.id !== id));
  };

  const handleAttach = async (file) => {
    if (!file) return;
    if (attachments.length >= MAX_ATTACH) {
      toast.error(t('lumi.maxFiles', { n: MAX_ATTACH }));
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(t('lumi.fileTooLarge', { n: MAX_FILE_MB }));
      return;
    }
    setAttaching(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BASE_URL}/api/exam/extract`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('aurora_auth_token')}` },
        body:    formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setAttachments((prev) => [...prev, { name: file.name, text: data.text, wordCount: data.wordCount }]);
      toast.success(t('lumi.attached', { name: file.name }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAttaching(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const removeAttachment = (name) => setAttachments((prev) => prev.filter((a) => a.name !== name));

  const sendMessage = useCallback(async (text, historyBase) => {
    const content = (text || input).trim();
    if ((!content && attachments.length === 0) || loading) return;
    const finalContent = content || (attachments.length > 1 ? t('lumi.summarizeFiles') : t('lumi.summarizeFile'));
    const sendAttachments = attachments;
    const base = historyBase ?? messages; // editAndResend passes the
    // already-truncated history explicitly, since `messages` here would
    // otherwise be a stale closure from before the truncation happened
    setInput('');
    setAttachments([]);
    const userMsg = {
      role: 'user',
      content: finalContent,
      attachmentNames: sendAttachments.map((a) => a.name),
    };
    setMessages([...base, userMsg]);
    setLoading(true);
    const history = [...base, userMsg].map(({ role, content }) => ({ role, content }));
    try {
      const res = await api.post('/chat', {
        messages:        history,
        conversation_id: activeConvId,
        mode,
        attachments:     sendAttachments.map(({ name, text }) => ({ name, text })),
      });
      setMessages((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].role === 'user' && next[i].id == null) { next[i] = { ...next[i], id: res.user_message_id }; break; }
        }
        next.push({ role: 'assistant', content: res.text, actions: res.actions || [], suggestSearch: res.suggestSearch });
        return next;
      });
      if (!activeConvId) {
        setActiveConvId(res.conversation_id);
        loadConvos();
      }
    } catch (_) {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('lumi.errorConnect'), actions: [] }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, loading, messages, activeConvId, loadConvos, mode, attachments, t]);

  // Edit-and-resend — deletes the edited message and everything after it
  // (both locally and, if it was already persisted, on the server) then
  // resends the edited text as a fresh turn, same as ChatGPT/Claude's
  // "edit message" behavior.
  const editAndResend = useCallback(async (index, newContent) => {
    const target = messages[index];
    const truncated = messages.slice(0, index);
    setEditBusy(true);
    try {
      if (target?.id && activeConvId) {
        try { await api.del(`/chat/conversations/${activeConvId}/messages/from/${target.id}`); } catch (_) {}
      }
      setEditingIndex(null);
      await sendMessage(newContent, truncated);
    } finally {
      setEditBusy(false);
    }
  }, [messages, activeConvId, sendMessage]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const isFirstMessage = messages.length === 0;
  const firstName      = user?.name?.split(' ')[0] || 'there';
  const glass          = isDark ? glassDark : glassLight;

  return (
    <div className="flex h-[calc(100vh-88px)] lg:h-[calc(100vh-64px)] gap-3">
      <AnimatePresence initial={false}>
        {sidebarVisible && (
          <motion.div
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 216, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="hidden lg:flex flex-col shrink-0 overflow-hidden"
          >
            <div className="flex flex-col h-full rounded-3xl p-4" style={glass}>
              <ConversationList
                convos={convos}
                activeId={activeConvId}
                onSelect={loadConversation}
                onNew={startNew}
                onDelete={deleteConvo}
                t={t}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3 h-9">
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition"
              style={accentBtn}
            >
              <PanelIcon /> {t('lumi.history')}
            </button>
            <button onClick={startNew} className="btn-primary !py-2 !px-3 !text-xs !rounded-xl">
              <Plus size={13} /> {t('common.new')}
            </button>
          </div>
          <div className="hidden lg:flex items-center gap-2">
            {!isFirstMessage && (
              <button
                onClick={startNew}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition hover:scale-[1.03]"
                style={accentBtn}
              >
                <Plus size={13} /> {t('lumi.newChat')}
              </button>
            )}
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}
              onClick={() => setSidebarVisible((v) => !v)}
              title={sidebarVisible ? t('lumi.hide') : t('lumi.history')}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition"
              style={accentBtn}
            >
              <PanelIcon />
              <span>{sidebarVisible ? t('lumi.hide') : t('lumi.history')}</span>
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {isFirstMessage && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex flex-col items-center justify-center flex-1 gap-6 px-4 pb-4 overflow-y-auto"
            >
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex h-16 w-16 items-center justify-center rounded-3xl text-white text-3xl"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--accent-500)) 0%, rgb(var(--accent-600)) 50%, rgb(var(--accent-700)) 100%)', boxShadow: '0 12px 32px rgb(var(--accent-500) / 0.4)' }}
                >
                  ✦
                </motion.div>
                <div className="text-center">
                  <h1 className="font-display text-2xl font-bold text-ink dark:text-white">
                    {t('lumi.greeting', { name: firstName })}
                  </h1>
                  <p className="text-sm text-ink/50 dark:text-white/40 mt-1">
                    {t('lumi.subtitle')}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTIONS.map(({ icon, text }) => (
                  <motion.button
                    key={text}
                    whileHover={{ y: -1, scale: 1.01 }} whileTap={{ scale: 0.98 }}
                    onClick={() => sendMessage(text)}
                    className="flex items-center gap-2.5 rounded-2xl px-4 py-3 text-start text-sm font-medium text-ink/70 dark:text-white/60"
                    style={glass}
                  >
                    <span className="text-base shrink-0">{icon}</span>{text}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isFirstMessage && (
          <div className="flex-1 overflow-y-auto px-1 py-2 flex flex-col gap-4">
            {messages.map((msg, i) => (
              <Message
                key={i}
                msg={msg}
                t={t}
                isEditing={editingIndex === i}
                canEdit={msg.role === 'user' && !loading && !(msg.attachmentNames?.length > 0)}
                editBusy={editBusy}
                onStartEdit={() => setEditingIndex(i)}
                onCancelEdit={() => setEditingIndex(null)}
                onSaveEdit={(newContent) => editAndResend(i, newContent)}
              />
            ))}
            {loading && <TypingIndicator mode={mode} t={t} />}
            <div ref={bottomRef} />
          </div>
        )}

        <div className="pt-3 pb-1">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            {CHAT_MODES.map(({ key, label, Icon, hint }) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  title={hint}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all"
                  style={active
                    ? { background:'rgb(var(--accent-500) / 0.16)', border:'1px solid rgb(var(--accent-500) / 0.45)', color:'rgb(var(--accent-500))' }
                    : {
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.40)',
                        border:     isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.55)',
                        color:      isDark ? 'rgba(255,255,255,0.40)' : 'rgba(30,34,51,0.45)',
                      }}
                >
                  <Icon size={12} /> {label}
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="flex flex-wrap gap-1.5 mb-2 px-1 overflow-hidden"
              >
                {attachments.map((a) => (
                  <div
                    key={a.name}
                    className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold"
                    style={accentBtn}
                  >
                    <FileText size={11} />
                    <span className="max-w-[140px] truncate">{a.name}</span>
                    <span className="opacity-50">{a.wordCount?.toLocaleString()}w</span>
                    <button onClick={() => removeAttachment(a.name)} className="opacity-60 hover:opacity-100 transition">
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <div className="flex items-end gap-1.5 rounded-3xl p-2" style={glass}>
              <input
                ref={fileRef} type="file" accept={ACCEPTED_FILES} className="hidden"
                onChange={(e) => handleAttach(e.target.files[0])}
              />
              <motion.button
                whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                onClick={() => fileRef.current?.click()}
                disabled={attaching || loading}
                title={t('lumi.attachTitle')}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition disabled:opacity-40"
                style={accentBtn}
              >
                {attaching
                  ? <div className="h-4 w-4 rounded-full border-2 border-lavender-300 border-t-lavender-600 animate-spin" />
                  : <Paperclip size={15} />}
              </motion.button>
              <textarea
                ref={inputRef}
                rows={1}
                dir="auto"
                className="flex-1 bg-transparent outline-none resize-none text-sm text-ink dark:text-white placeholder:text-ink/35 dark:placeholder:text-white/30 py-2 px-2 max-h-32"
                placeholder={
                  attachments.length > 0
                    ? t('lumi.askAttachment')
                    : mode === 'search'
                    ? t('lumi.askSearch')
                    : mode === 'think'
                    ? t('lumi.askThink')
                    : t('lumi.ask')
                }
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
                onClick={() => setSettingsOpen((s) => !s)}
                title={t('lumi.settingsBtn')}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition"
                style={settingsOpen
                  ? { background:'rgb(var(--accent-500) / 0.22)', border:'1px solid rgb(var(--accent-500) / 0.50)', color:'rgb(var(--accent-500))' }
                  : accentBtn}
              >
                <SlidersHorizontal size={15} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                onClick={() => sendMessage()}
                disabled={(!input.trim() && attachments.length === 0) || loading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, rgb(var(--accent-500)) 0%, rgb(var(--accent-600)) 100%)', boxShadow: '0 4px 12px rgb(var(--accent-500) / 0.35)' }}
              >
                <Send size={15} className="rtl:-scale-x-100" />
              </motion.button>
            </div>
            <LumiSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} isDark={isDark} t={t} />
          </div>

          <div className="flex items-center justify-between mt-2 px-2">
            <p className="text-[10px] text-ink/25 dark:text-white/20">
              {t('lumi.disclaimer')}
            </p>
            <p className="text-[10px] text-ink/25 dark:text-white/20 font-medium shrink-0">
              {t('lumi.sendHint')}
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          >
            <motion.div
              initial={{ x: isRTL ? '100%' : '-100%' }} animate={{ x: 0 }} exit={{ x: isRTL ? '100%' : '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="absolute top-0 bottom-0 start-0 w-64 p-5"
              style={{
                ...(isDark ? glassDark : glassLight),
                background: isDark ? 'rgba(18,14,35,0.95)' : 'rgba(255,255,255,0.95)',
                borderRadius: isRTL ? '2rem 0 0 2rem' : '0 2rem 2rem 0',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <ConversationList
                convos={convos}
                activeId={activeConvId}
                onSelect={loadConversation}
                onNew={startNew}
                onDelete={deleteConvo}
                t={t}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}