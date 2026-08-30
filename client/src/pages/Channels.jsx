import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Copy, Mail, Trash2, Send, BarChart3, Download,
  Megaphone, ListChecks, Target, ChevronLeft, LogIn, Sheet, Timer,
  MessageCircle, Upload, GraduationCap,
} from 'lucide-react';
import { api, getToken } from '../api/client.js';
import { useAuth }     from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast }    from '../context/ToastContext.jsx';
import GlassCard        from '../components/GlassCard.jsx';
import Modal             from '../components/Modal.jsx';

// api.js always JSON.stringify()s and never exposes raw response bodies
// (see api/client.js) — the CSV export needs an actual file download, so
// it goes around api.post/get the same way CVBuilder.jsx's LinkedIn
// import already does for FormData: a local BASE_URL + raw fetch with a
// manual auth header.
const BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:4000/api'
  : 'https://lifeos-0l81.onrender.com/api';

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold mb-1.5 block text-ink/55 dark:text-white/50">{label}</label>
      {children}
    </div>
  );
}
const inputCls = 'w-full rounded-2xl px-4 py-2.5 text-sm bg-ink/5 dark:bg-white/8 border border-ink/10 dark:border-white/12 text-ink dark:text-white outline-none focus:border-[rgb(var(--accent-500))]';

export default function Channels() {
  const { user } = useAuth();
  const { t }     = useLanguage();
  const toast     = useToast();
  const isInstructor = user?.role === 'instructor';

  const [channels,   setChannels]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [activeId,   setActiveId]   = useState(null);
  const [detail,     setDetail]     = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newName,    setNewName]    = useState('');
  const [creating,   setCreating]   = useState(false);
  const [joinCode,   setJoinCode]   = useState('');
  const [joining,    setJoining]    = useState(false);

  const loadChannels = useCallback(async () => {
    setLoading(true);
    try { setChannels(await api.get('/channels/mine')); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line
  useEffect(() => { loadChannels(); }, [loadChannels]);

  const loadDetail = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const [ch, msgs, analytics] = await Promise.all([
        api.get(`/channels/${id}`),
        api.get(`/channels/${id}/messages`),
        isInstructor ? api.get(`/channels/${id}/analytics`).catch(() => []) : Promise.resolve([]),
      ]);
      setDetail({ ...ch, messages: msgs, analytics });
    } catch (err) { toast.error(err.message); setActiveId(null); }
    finally { setDetailLoading(false); }
  }, [isInstructor]); // eslint-disable-line
  useEffect(() => { if (activeId) loadDetail(activeId); else setDetail(null); }, [activeId, loadDetail]);

  const createChannel = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const ch = await api.post('/channels', { name: newName.trim() });
      setNewName(''); setShowCreate(false);
      await loadChannels();
      setActiveId(ch.id);
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const joinChannel = async () => {
    if (!joinCode.trim() || joining) return;
    setJoining(true);
    try {
      const ch = await api.post('/channels/join', { code: joinCode.trim() });
      toast.success(t('channels.joinSuccess', { name: ch.name }));
      setJoinCode('');
      await loadChannels();
      setActiveId(ch.id);
    } catch (err) { toast.error(err.message || t('channels.joinFailed')); }
    finally { setJoining(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[40vh] text-ink/30 dark:text-white/30">…</div>;
  }

  if (activeId && detail) {
    return (
      <ChannelDetail
        channel={detail} isInstructor={isInstructor} t={t} toast={toast}
        loading={detailLoading}
        onBack={() => setActiveId(null)}
        onRefresh={() => loadDetail(activeId)}
        onDeleted={() => { setActiveId(null); loadChannels(); }}
      />
    );
  }

  const totalStudents = channels.reduce((sum, ch) => sum + (ch.member_count || 0), 0);
  const instructorNames = [...new Set(channels.map((ch) => ch.instructor_name).filter(Boolean))];

  return (
    <div className="flex flex-col gap-6">
      <GlassCard className="p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink dark:text-white flex items-center gap-2">
              <Users size={22} className="text-[rgb(var(--accent-500))]" /> {t('channels.title')}
            </h1>
            <p className="text-sm text-ink/45 dark:text-white/40 mt-1">
              {isInstructor ? t('channels.subtitleInstructor') : t('channels.subtitleStudent')}
            </p>
          </div>
          {isInstructor ? (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)' }}>
              <Plus size={16} /> {t('channels.createChannel')}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input id="channels-join-input" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder={t('channels.joinCodePh')} maxLength={6} dir="ltr"
                className={`${inputCls} w-44 text-center font-mono tracking-widest`} />
              <button onClick={joinChannel} disabled={joining}
                className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)' }}>
                <LogIn size={16} /> {t('channels.join')}
              </button>
            </div>
          )}
        </div>
        {channels.length > 0 && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-ink/5 dark:border-white/8 text-xs font-medium text-ink/50 dark:text-white/40 flex-wrap">
            <span className="flex items-center gap-1.5"><Users size={13} />
              {isInstructor ? t('channels.statChannelCount', { n: channels.length }) : t('channels.statJoinedCount', { n: channels.length })}
            </span>
            {isInstructor && (
              <span className="flex items-center gap-1.5"><GraduationCap size={13} />
                {t('channels.statStudentCount', { n: totalStudents })}
              </span>
            )}
            {!isInstructor && instructorNames.length > 0 && (
              <span className="truncate">{t('channels.statInstructors', { names: instructorNames.join(', ') })}</span>
            )}
          </div>
        )}
      </GlassCard>

      {channels.length === 0 ? (
        <GlassCard className="p-10 text-center text-sm text-ink/40 dark:text-white/35">
          {isInstructor ? t('channels.noChannelsInstructor') : t('channels.noChannelsStudent')}
        </GlassCard>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((ch) => (
            <GlassCard key={ch.id} interactive onClick={() => setActiveId(ch.id)} className="p-5 cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-display font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)' }}>
                  {ch.name.trim().slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display font-bold text-ink dark:text-white truncate">{ch.name}</h3>
                  {isInstructor ? (
                    <p className="text-xs text-ink/45 dark:text-white/40 mt-0.5 flex items-center gap-1">
                      <Users size={11} /> {t('channels.members', { n: ch.member_count || 0 })}
                    </p>
                  ) : (
                    <p className="text-xs text-ink/45 dark:text-white/40 mt-0.5 truncate">{ch.instructor_name}</p>
                  )}
                </div>
              </div>
              {isInstructor && (
                <span className="inline-block mt-3 rounded-lg px-2 py-1 text-[11px] font-mono font-bold tracking-widest bg-ink/5 dark:bg-white/10 text-ink/60 dark:text-white/50">
                  {ch.join_code}
                </span>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('channels.createChannel')}>
        <div className="flex flex-col gap-4">
          <Field label={t('channels.channelName')}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder={t('channels.channelNamePh')} className={inputCls} />
          </Field>
          <button onClick={createChannel} disabled={creating || !newName.trim()}
            className="rounded-full py-3 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)' }}>
            {t('channels.create')}
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ── Channel detail — owner (instructor) sees management tools,
// members and analytics; a student sees the read-only announcement
// feed plus a note that assigned work shows up in their normal
// Tasks/Calendar/Goals. ──────────────────────────────────────────
const TABS_INSTRUCTOR = ['announcements', 'chat', 'tasks', 'flow', 'analytics'];
const TABS_STUDENT    = ['announcements', 'chat', 'flow'];

function ChannelDetail({ channel, isInstructor, t, toast, loading, onBack, onRefresh, onDeleted }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('announcements');
  const tabs = isInstructor ? TABS_INSTRUCTOR : TABS_STUDENT;
  const tabIcons = { announcements: Megaphone, chat: MessageCircle, tasks: ListChecks, flow: Timer, analytics: BarChart3 };
  const tabLabels = {
    announcements: t('channels.announcements'), chat: t('channels.chat'),
    tasks: t('channels.tasksGoalsTab'), flow: t('channels.flowTab'), analytics: t('channels.analytics'),
  };

  // ── Chat ──────────────────────────────────────────────────────
  const [activeChatId, setActiveChatId] = useState(null); // instructor: which member's thread
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading,  setChatLoading]  = useState(false);
  const [chatInput,    setChatInput]    = useState('');
  const [sendingChat,  setSendingChat]  = useState(false);

  const chatThreadId = isInstructor ? activeChatId : user?.id;

  const loadChat = async (studentId) => {
    if (!studentId) return;
    setChatLoading(true);
    try { setChatMessages(await api.get(`/channels/${channel.id}/chat/${studentId}`)); }
    catch (err) { toast.error(err.message); }
    finally { setChatLoading(false); }
  };
  useEffect(() => {
    if (tab !== 'chat') return;
    if (isInstructor && !activeChatId && channel.members?.length) { setActiveChatId(channel.members[0].id); return; }
    loadChat(chatThreadId);
  }, [tab, chatThreadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendChat = async () => {
    if (!chatInput.trim() || sendingChat || !chatThreadId) return;
    setSendingChat(true);
    try {
      await api.post(`/channels/${channel.id}/chat/${chatThreadId}`, { body: chatInput.trim() });
      setChatInput('');
      await loadChat(chatThreadId);
    } catch (err) { toast.error(err.message); }
    finally { setSendingChat(false); }
  };

  // ── Bulk invite from an uploaded file (extracts emails, then reuses
  // the normal invite send path) ──────────────────────────────────
  const bulkFileRef = useRef(null);
  const [extracting, setExtracting] = useState(false);
  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const handleBulkFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setExtracting(true);
    try {
      let text = '';
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'csv' || ext === 'txt') {
        text = await file.text();
      } else {
        const BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:4000/api' : 'https://lifeos-0l81.onrender.com/api';
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch(`${BASE_URL}/exam/extract`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not read file');
        text = data.text;
      }
      const found = [...new Set((text.match(EMAIL_RE) || []).map((e2) => e2.toLowerCase()))];
      if (!found.length) { toast.error(t('channels.noEmailsFound')); return; }
      setInviteEmails((prev) => (prev ? prev + '\n' : '') + found.join('\n'));
      toast.success(t('channels.emailsExtracted', { n: found.length }));
    } catch (err) { toast.error(err.message); }
    finally { setExtracting(false); }
  };

  const [postBody,   setPostBody]   = useState('');
  const [postDate,   setPostDate]   = useState('');
  const [postTime,   setPostTime]   = useState('');
  const [posting,    setPosting]    = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviting,   setInviting]   = useState(false);
  const [taskForm,   setTaskForm]   = useState({ title: '', priority: 'medium', deadline: '' });
  const [assigningTask, setAssigningTask] = useState(false);
  const [goalTitle,  setGoalTitle]  = useState('');
  const [assigningGoal, setAssigningGoal] = useState(false);
  const [roomName,   setRoomName]   = useState('');
  const [invitingRoom, setInvitingRoom] = useState(false);
  const [createdRoom, setCreatedRoom] = useState(null); // { code, roomName } — shown to the instructor after creating
  const [copied,     setCopied]     = useState(false);
  const [sheetsStatus, setSheetsStatus] = useState(null); // { connected, configured }
  const [syncing,    setSyncing]    = useState(false);

  useEffect(() => {
    if (!isInstructor) return;
    api.get('/sheets/status').then(setSheetsStatus).catch(() => setSheetsStatus({ connected: false, configured: false }));
  }, [isInstructor]);

  const connectSheets = async () => {
    try {
      const state = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('nuvora_gsheets_oauth_state', state);
      const { url } = await api.get(`/sheets/auth-url?state=${encodeURIComponent(state)}`);
      window.location.href = url;
    } catch (err) { toast.error(err.message || t('channels.sheetsNotConfigured')); }
  };
  const syncSheets = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const r = await api.post(`/channels/${channel.id}/sheets/sync`, {});
      toast.success(t('channels.sheetsSynced'));
      window.open(r.spreadsheetUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      if (err.code === 'NOT_CONNECTED') setSheetsStatus((s) => ({ ...s, connected: false }));
      toast.error(err.message);
    } finally { setSyncing(false); }
  };

  const post = async () => {
    if (!postBody.trim() || posting) return;
    setPosting(true);
    try {
      await api.post(`/channels/${channel.id}/messages`, {
        body: postBody.trim(), event_date: postDate || null, event_time: postDate ? (postTime || null) : null,
      });
      setPostBody(''); setPostDate(''); setPostTime('');
      onRefresh();
    }
    catch (err) { toast.error(err.message); }
    finally { setPosting(false); }
  };
  const sendInvites = async () => {
    const emails = inviteEmails.split(/[,\n]/).map((e) => e.trim()).filter(Boolean);
    if (!emails.length || inviting) return;
    setInviting(true);
    try {
      const r = await api.post(`/channels/${channel.id}/invite`, { emails });
      toast.success(`${t('channels.invitesSent')}: ${r.sent}/${r.total}`);
      setInviteEmails('');
    } catch (err) { toast.error(err.message); }
    finally { setInviting(false); }
  };
  const removeMember = async (studentId, name) => {
    if (!window.confirm(t('channels.confirmRemoveMember', { name }))) return;
    try { await api.del(`/channels/${channel.id}/members/${studentId}`); onRefresh(); }
    catch (err) { toast.error(err.message); }
  };
  const assignTask = async () => {
    if (!taskForm.title.trim() || assigningTask) return;
    setAssigningTask(true);
    try {
      const r = await api.post(`/channels/${channel.id}/assign-task`, {
        title: taskForm.title.trim(), priority: taskForm.priority, deadline: taskForm.deadline || null,
      });
      toast.success(t('channels.assignSuccess', { n: r.assigned }));
      setTaskForm({ title: '', priority: 'medium', deadline: '' });
    } catch (err) { toast.error(err.message); }
    finally { setAssigningTask(false); }
  };
  const assignGoal = async () => {
    if (!goalTitle.trim() || assigningGoal) return;
    setAssigningGoal(true);
    try {
      const r = await api.post(`/channels/${channel.id}/assign-goal`, { title: goalTitle.trim() });
      toast.success(t('channels.assignSuccess', { n: r.assigned }));
      setGoalTitle('');
    } catch (err) { toast.error(err.message); }
    finally { setAssigningGoal(false); }
  };
  const inviteToRoom = async () => {
    if (!roomName.trim() || invitingRoom) return;
    setInvitingRoom(true);
    try {
      const r = await api.post(`/channels/${channel.id}/invite-to-room`, { roomName: roomName.trim() });
      toast.success(`${t('channels.roomInviteSent')} (${r.notified})`);
      setCreatedRoom({ code: r.code, roomName: r.roomName });
      setRoomName('');
    } catch (err) { toast.error(err.message); }
    finally { setInvitingRoom(false); }
  };
  const deleteChannel = async () => {
    if (!window.confirm(t('channels.confirmDelete'))) return;
    try { await api.del(`/channels/${channel.id}`); onDeleted(); }
    catch (err) { toast.error(err.message); }
  };
  const copyCode = () => {
    navigator.clipboard?.writeText(channel.join_code);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const exportCsv = async () => {
    try {
      const res = await fetch(`${BASE_URL}/channels/${channel.id}/export.csv`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${channel.name.replace(/[^a-z0-9]+/gi, '_')}_analytics.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink/5 dark:bg-white/8 text-ink/50 dark:text-white/45">
          <ChevronLeft size={17} />
        </button>
        <h1 className="font-display text-xl font-bold text-ink dark:text-white">{channel.name}</h1>
        {isInstructor && (
          <button onClick={copyCode} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold tracking-widest bg-ink/5 dark:bg-white/10 text-ink/60 dark:text-white/50 ms-auto">
            <Copy size={12} /> {copied ? t('channels.codeCopied') : channel.join_code}
          </button>
        )}
      </div>

      {isInstructor && (
        <GlassCard className="p-5">
          <h3 className="text-sm font-bold text-ink dark:text-white flex items-center gap-2 mb-3">
            <Users size={16} /> {t('channels.memberList')} ({channel.members?.length || 0})
          </h3>
          {(!channel.members || channel.members.length === 0) ? (
            <p className="text-xs text-ink/40 dark:text-white/35">{t('channels.noMembers')}</p>
          ) : (
            <div className="flex flex-col gap-1.5 mb-4">
              {channel.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-xl px-3 py-2 bg-ink/[0.03] dark:bg-white/5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink dark:text-white truncate">{m.name}</p>
                    <p className="text-xs text-ink/40 dark:text-white/35 truncate">{m.email}</p>
                  </div>
                  <button onClick={() => removeMember(m.id, m.name)} className="text-coral-500 hover:text-coral-600 shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Field label={t('channels.inviteByEmail')}>
            <textarea value={inviteEmails} onChange={(e) => setInviteEmails(e.target.value)}
              placeholder={t('channels.inviteEmailsPh')} rows={2} className={inputCls} />
          </Field>
          <div className="flex items-center gap-2 mt-2">
            <button onClick={sendInvites} disabled={inviting || !inviteEmails.trim()}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)' }}>
              <Mail size={13} /> {t('channels.sendInvites')}
            </button>
            <button onClick={() => bulkFileRef.current?.click()} disabled={extracting}
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold bg-ink/5 dark:bg-white/8 text-ink dark:text-white disabled:opacity-50">
              <Upload size={13} /> {extracting ? t('channels.extracting') : t('channels.uploadStudentList')}
            </button>
            <input ref={bulkFileRef} type="file" accept=".csv,.txt,.pdf,.docx" className="hidden" onChange={handleBulkFile} />
          </div>
        </GlassCard>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((tb) => {
          const Icon = tabIcons[tb];
          const active = tab === tb;
          return (
            <button key={tb} onClick={() => setTab(tb)}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold whitespace-nowrap transition"
              style={active
                ? { background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)', color: 'white' }
                : { background: 'rgba(120,120,120,0.08)', color: 'inherit', opacity: 0.6 }}>
              <Icon size={13} /> {tabLabels[tb]}
            </button>
          );
        })}
      </div>

      {tab === 'announcements' && (
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold text-ink dark:text-white flex items-center gap-2 mb-3">
          <Megaphone size={16} /> {t('channels.announcements')}
        </h3>
        {isInstructor ? (
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex gap-2">
              <input value={postBody} onChange={(e) => setPostBody(e.target.value)}
                placeholder={t('channels.announcementPh')} className={inputCls}
                onKeyDown={(e) => e.key === 'Enter' && post()} />
              <button onClick={post} disabled={posting || !postBody.trim()}
                className="shrink-0 flex h-11 w-11 items-center justify-center rounded-2xl text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)' }}>
                <Send size={16} />
              </button>
            </div>
            <div className="flex gap-2">
              <input type="date" value={postDate} onChange={(e) => setPostDate(e.target.value)}
                title={t('channels.announcementDate')} className={`${inputCls} w-40`} />
              {postDate && (
                <input type="time" value={postTime} onChange={(e) => setPostTime(e.target.value)}
                  title={t('channels.announcementTime')} className={`${inputCls} w-32`} />
              )}
              <span className="text-[11px] text-ink/35 dark:text-white/30 self-center">{t('channels.announcementDateHint')}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink/40 dark:text-white/35 mb-4">{t('channels.readOnlyHint')}</p>
        )}
        {(!channel.messages || channel.messages.length === 0) ? (
          <p className="text-xs text-ink/40 dark:text-white/35">{t('channels.noAnnouncements')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {channel.messages.map((m) => (
              <div key={m.id} className="rounded-xl px-3 py-2.5 bg-ink/[0.03] dark:bg-white/5">
                {m.event_date && (
                  <span className="inline-block mb-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: 'rgb(var(--accent-500) / 0.15)', color: 'rgb(var(--accent-600))' }}>
                    📅 {m.event_date}{m.event_time ? ` · ${m.event_time}` : ''}
                  </span>
                )}
                <p className="text-sm text-ink dark:text-white">{m.body}</p>
                <p className="text-[11px] text-ink/35 dark:text-white/30 mt-1">{m.sender_name} · {new Date(m.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
        {!isInstructor && <p className="text-[11px] text-ink/35 dark:text-white/30 mt-3">{t('channels.studentTasksNote')}</p>}
      </GlassCard>
      )}

      {tab === 'chat' && (
      <GlassCard className="p-0 overflow-hidden">
        <div className="flex" style={{ minHeight: 360 }}>
          {isInstructor && (
            <div className="w-40 shrink-0 border-e border-ink/5 dark:border-white/8 p-2 flex flex-col gap-1 overflow-y-auto">
              {(channel.members || []).map((m) => (
                <button key={m.id} onClick={() => setActiveChatId(m.id)}
                  className="text-start rounded-xl px-2.5 py-2 text-xs font-medium truncate"
                  style={activeChatId === m.id
                    ? { background: 'rgb(var(--accent-500) / 0.15)', color: 'rgb(var(--accent-600))' }
                    : { color: 'inherit', opacity: 0.6 }}>
                  {m.name}
                </button>
              ))}
              {(!channel.members || channel.members.length === 0) && (
                <p className="text-[11px] text-ink/35 dark:text-white/25 px-2">{t('channels.noMembers')}</p>
              )}
            </div>
          )}
          <div className="flex-1 flex flex-col p-4">
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 mb-3" style={{ maxHeight: 320 }}>
              {chatLoading ? (
                <p className="text-xs text-ink/35 dark:text-white/25">…</p>
              ) : chatMessages.length === 0 ? (
                <p className="text-xs text-ink/35 dark:text-white/25">{t('channels.noMessagesYet')}</p>
              ) : chatMessages.map((m) => (
                <div key={m.id} className="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
                  style={m.sender_role === (isInstructor ? 'instructor' : 'student')
                    ? { alignSelf: 'flex-end', background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)', color: 'white' }
                    : { alignSelf: 'flex-start', background: 'rgba(120,120,120,0.10)' }}>
                  {m.body}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                placeholder={t('channels.chatPlaceholder')} className={inputCls}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()} disabled={!chatThreadId} />
              <button onClick={sendChat} disabled={sendingChat || !chatInput.trim() || !chatThreadId}
                className="shrink-0 flex h-11 w-11 items-center justify-center rounded-2xl text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)' }}>
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </GlassCard>
      )}

      {isInstructor && tab === 'tasks' && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <GlassCard className="p-5">
              <h3 className="text-sm font-bold text-ink dark:text-white flex items-center gap-2 mb-3">
                <ListChecks size={16} /> {t('channels.assignTask')}
              </h3>
              <div className="flex flex-col gap-2.5">
                <input value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={t('channels.taskTitlePh')} className={inputCls} />
                <div className="flex gap-2">
                  <select value={taskForm.priority} onChange={(e) => setTaskForm((f) => ({ ...f, priority: e.target.value }))}
                    className={inputCls}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <input type="date" value={taskForm.deadline} onChange={(e) => setTaskForm((f) => ({ ...f, deadline: e.target.value }))}
                    className={inputCls} />
                </div>
                <button onClick={assignTask} disabled={assigningTask || !taskForm.title.trim()}
                  className="rounded-full py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)' }}>
                  {t('channels.assignTo')}: {t('channels.allStudents')}
                </button>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="text-sm font-bold text-ink dark:text-white flex items-center gap-2 mb-3">
                <Target size={16} /> {t('channels.assignGoal')}
              </h3>
              <div className="flex flex-col gap-2.5">
                <input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder={t('channels.taskTitlePh')} className={inputCls} />
                <button onClick={assignGoal} disabled={assigningGoal || !goalTitle.trim()}
                  className="rounded-full py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)' }}>
                  {t('channels.assignTo')}: {t('channels.allStudents')}
                </button>
              </div>
            </GlassCard>
          </div>
        </>
      )}

      {isInstructor && tab === 'flow' && (
        <>
          <GlassCard className="p-5">
            <h3 className="text-sm font-bold text-ink dark:text-white flex items-center gap-2 mb-3">
              <Timer size={16} /> {t('channels.inviteToRoom')}
            </h3>
            <p className="text-xs text-ink/40 dark:text-white/35 mb-3">{t('channels.roomNameHint')}</p>
            <div className="flex gap-2">
              <input value={roomName} onChange={(e) => setRoomName(e.target.value)}
                placeholder={t('channels.roomNamePh')} maxLength={80}
                className={`${inputCls} flex-1`} />
              <button onClick={inviteToRoom} disabled={invitingRoom || !roomName.trim()}
                className="rounded-full px-4 text-sm font-bold text-white disabled:opacity-50 shrink-0"
                style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)' }}>
                {t('channels.sendRoomInvite')}
              </button>
            </div>
            {createdRoom && (
              <div className="mt-3 rounded-xl px-3 py-2 bg-ink/[0.03] dark:bg-white/5 text-xs text-ink/60 dark:text-white/50">
                {t('channels.roomCreatedInfo', { name: createdRoom.roomName, code: createdRoom.code })}
              </div>
            )}
          </GlassCard>
        </>
      )}

      {!isInstructor && tab === 'flow' && (
        <GlassCard className="p-6 text-center">
          <Timer size={28} className="mx-auto mb-3 text-[rgb(var(--accent-500))]" />
          <h3 className="text-sm font-bold text-ink dark:text-white mb-1">{t('flow.rankingsTitle')}</h3>
          <p className="text-xs text-ink/50 dark:text-white/40 mb-4">{t('channels.flowTabStudentHint')}</p>
          <Link to="/rankings" className="inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-600)) 100%)' }}>
            {t('nav.rankings')}
          </Link>
        </GlassCard>
      )}

      {isInstructor && tab === 'analytics' && (
        <>
          <GlassCard className="p-5">
            <h3 className="text-sm font-bold text-ink dark:text-white flex items-center gap-2 mb-3">
              <BarChart3 size={16} /> {t('channels.analytics')}
            </h3>
            {(!channel.analytics || channel.analytics.length === 0) ? (
              <p className="text-xs text-ink/40 dark:text-white/35 mb-3">{t('channels.noMembers')}</p>
            ) : (
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-ink/40 dark:text-white/35 text-left">
                      <th className="py-1.5 pe-2 font-semibold">#</th>
                      <th className="py-1.5 pe-3 font-semibold">{t('channels.memberList')}</th>
                      <th className="py-1.5 pe-3 font-semibold">{t('channels.assignTask')}</th>
                      <th className="py-1.5 pe-3 font-semibold">{t('channels.assignGoal')}</th>
                      <th className="py-1.5 font-semibold">{t('channels.points')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channel.analytics.slice().sort((a, b) => b.total_xp - a.total_xp).map((a, i) => (
                      <tr key={a.id} className="border-t border-ink/5 dark:border-white/8 text-ink dark:text-white">
                        <td className="py-1.5 pe-2 text-ink/35 dark:text-white/30">{i + 1}</td>
                        <td className="py-1.5 pe-3">{a.name}</td>
                        <td className="py-1.5 pe-3">{a.tasks_done}/{a.tasks_assigned}</td>
                        <td className="py-1.5 pe-3">{a.goals_done}/{a.goals_assigned}</td>
                        <td className="py-1.5 font-bold text-[rgb(var(--accent-500))]">{a.total_xp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={exportCsv}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold bg-ink/5 dark:bg-white/8 text-ink dark:text-white">
                <Download size={13} /> {t('channels.exportCsv')}
              </button>
              {!sheetsStatus?.configured ? (
                <button onClick={() => toast.error(t('channels.sheetsNotConfigured'))}
                  className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold bg-ink/5 dark:bg-white/8 text-ink/40 dark:text-white/30">
                  <Sheet size={13} /> {t('channels.connectSheets')}
                </button>
              ) : sheetsStatus?.connected ? (
                <button onClick={syncSheets} disabled={syncing}
                  className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold disabled:opacity-50"
                  style={{ background: 'rgba(15,157,88,0.10)', border: '1px solid rgba(15,157,88,0.30)', color: '#0F9D58' }}>
                  <Sheet size={13} /> {syncing ? t('channels.syncing') : t('channels.syncToSheets')}
                </button>
              ) : (
                <button onClick={connectSheets}
                  className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold"
                  style={{ background: 'rgba(10,102,194,0.10)', border: '1px solid rgba(10,102,194,0.30)', color: '#0A66C2' }}>
                  <Sheet size={13} /> {t('channels.connectSheets')}
                </button>
              )}
            </div>
          </GlassCard>

          <button onClick={deleteChannel}
            className="self-start flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-coral-500 bg-coral-500/10">
            <Trash2 size={13} /> {t('channels.deleteChannel')}
          </button>
        </>
      )}
    </div>
  );
}
