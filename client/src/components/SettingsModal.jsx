import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Palette, MessageSquare, Trash2,
  AlertTriangle, LogOut, Mail, Camera, Check,
  Eye, EyeOff, X, ChevronRight, Crown, Snowflake,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api }       from '../api/client.js';
import { useAuth }   from '../context/AuthContext.jsx';
import { useTheme }  from '../context/ThemeContext.jsx';
import { useToast }  from '../context/ToastContext.jsx';
import Modal         from './Modal.jsx';
import AvatarCropper from './AvatarCropper.jsx';

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ user, size = 56, onClick }) {
  if (user?.avatar) {
    return (
      <img src={user.avatar} alt={user.name} onClick={onClick}
        className="rounded-2xl cursor-pointer object-cover shrink-0"
        style={{ width:size, height:size, minWidth:size, minHeight:size, objectPosition:'center', display:'block' }} />
    );
  }
  return (
    <div onClick={onClick}
      className="flex items-center justify-center rounded-2xl text-white font-bold cursor-pointer select-none shrink-0"
      style={{ width:size, height:size, fontSize:size*0.38, background:'linear-gradient(135deg,#7C6AF0,#5B47E0)', boxShadow:'0 4px 12px rgba(124,106,240,0.35)' }}>
      {user?.name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────
function ProfileTab() {
  const { user, updateUser } = useAuth();
  const toast   = useToast();
  const fileRef = useRef(null);
  const [name,     setName]     = useState(user?.name     || '');
  const [bio,      setBio]      = useState(user?.bio      || '');
  const [gender,   setGender]   = useState(user?.gender   || '');
  const [birthday, setBirthday] = useState(user?.birthday || '');
  const [saving,   setSaving]   = useState(false);
  const [cropSrc,  setCropSrc]  = useState(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (file.size > 10*1024*1024) { toast.error('Image must be under 10MB'); return; }
    const reader = new FileReader();
    reader.onload = e => setCropSrc(e.target.result);
    reader.readAsDataURL(file);
  }, [toast]);

  const handleCropSave = async (dataURL) => {
    setCropSrc(null);
    try { await updateUser({ avatar:dataURL }); toast.success('Photo updated! 📸'); }
    catch (err) { toast.error(err.message); }
  };

  const removeAvatar = async () => {
    try { await updateUser({ avatar:null }); toast.success('Photo removed'); }
    catch (err) { toast.error(err.message); }
  };

  const save = async () => {
    setSaving(true);
    try { await updateUser({ name:name.trim(), bio, gender, birthday }); toast.success('Profile saved!'); }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const isBirthday = (() => {
    if (!birthday) return false;
    const today = new Date();
    const [,m,d] = birthday.split('-');
    return Number(m)===today.getMonth()+1 && Number(d)===today.getDate();
  })();
  const age = birthday ? new Date().getFullYear() - Number(birthday.split('-')[0]) : null;

  return (
    <>
      <div className="flex flex-col gap-5">
        {isBirthday && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
            className="rounded-2xl px-4 py-3 text-sm font-semibold text-center"
            style={{ background:'linear-gradient(135deg,rgba(124,106,240,0.15),rgba(168,85,247,0.10))', border:'1px solid rgba(124,106,240,0.25)' }}>
            🎂 Happy Birthday, {user?.name?.split(' ')[0]}! {age?`You're ${age} today! `:''} 🎉
          </motion.div>
        )}

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar user={user} size={68} onClick={() => fileRef.current?.click()} />
            <button onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-xl text-white shadow-md"
              style={{ background:'linear-gradient(135deg,#7C6AF0,#5B47E0)' }}>
              <Camera size={13}/>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
          </div>
          <div>
            <p className="font-semibold text-ink dark:text-white text-sm">{user?.name}</p>
            <p className="text-xs text-ink/40 dark:text-white/30 mt-0.5">{user?.email}</p>
            <div className="flex gap-3 mt-1.5">
              <button onClick={() => fileRef.current?.click()} className="text-xs font-semibold text-lavender-600 hover:underline">
                Change photo
              </button>
              {user?.avatar && (
                <button onClick={removeAvatar} className="text-xs text-ink/35 dark:text-white/30 hover:text-coral-500 transition">
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1.5 block">Display name</label>
            <input className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"/>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1.5 block">Bio</label>
            <textarea className="input-field resize-none" rows={2} value={bio}
              onChange={e => setBio(e.target.value)} placeholder="A short bio — Lumi uses this"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1.5 block">Gender</label>
              <select className="input-field" value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non-binary">Non-binary</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1.5 block">
                Birthday {age && <span className="text-lavender-500 normal-case">· {age} yrs</span>}
              </label>
              <input type="date" className="input-field" value={birthday} onChange={e => setBirthday(e.target.value)}/>
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving} className="btn-primary justify-center">
          {saving ? 'Saving…' : <><Check size={15}/> Save profile</>}
        </button>
      </div>
      <AnimatePresence>
        {cropSrc && <AvatarCropper imageSrc={cropSrc} onSave={handleCropSave} onCancel={() => setCropSrc(null)}/>}
      </AnimatePresence>
    </>
  );
}

// ── Account tab ───────────────────────────────────────────────
function AccountTab() {
  const { user, changePassword } = useAuth();
  const toast = useToast();
  const [current,  setCurrent]  = useState('');
  const [newPass,  setNewPass]  = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  const strength = [
    newPass.length >= 8, /[A-Z]/.test(newPass),
    /[0-9]/.test(newPass), /[^A-Za-z0-9]/.test(newPass),
  ];
  const strengthColors = ['#FF7A63','#FFB84D','#60A5FA','#4CC38A'];

  const handleChange = async () => {
    if (newPass !== confirm) { toast.error('Passwords do not match'); return; }
    if (newPass.length < 8)  { toast.error('Min 8 characters'); return; }
    setSaving(true);
    try { await changePassword(current, newPass); toast.success('Password changed!'); setCurrent(''); setNewPass(''); setConfirm(''); }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1.5 block">Email address</label>
        <div className="input-field flex items-center gap-2 opacity-60" style={{ pointerEvents:'none' }}>
          <Mail size={14} className="text-ink/40 dark:text-white/30 shrink-0"/> {user?.email}
        </div>
        <p className="text-[11px] text-ink/30 dark:text-white/25 mt-1">Email cannot be changed.</p>
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-3 block">Change password</label>
        <div className="flex flex-col gap-3">
          <div className="relative">
            <input type={showCur?'text':'password'} className="input-field pr-10" placeholder="Current password"
              value={current} onChange={e => setCurrent(e.target.value)}/>
            <button onClick={() => setShowCur(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30 dark:text-white/30 hover:text-ink/60 transition">
              {showCur?<EyeOff size={15}/>:<Eye size={15}/>}
            </button>
          </div>
          <div className="relative">
            <input type={showNew?'text':'password'} className="input-field pr-10" placeholder="New password (min 8)"
              value={newPass} onChange={e => setNewPass(e.target.value)}/>
            <button onClick={() => setShowNew(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30 dark:text-white/30 hover:text-ink/60 transition">
              {showNew?<EyeOff size={15}/>:<Eye size={15}/>}
            </button>
          </div>
          <input type="password" className="input-field" placeholder="Confirm new password"
            value={confirm} onChange={e => setConfirm(e.target.value)}/>
          {newPass && (
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                {strength.map((met,i) => (
                  <div key={i} className="flex-1 h-1.5 rounded-full transition-all"
                    style={{ background: met ? strengthColors[i] : 'rgba(124,106,240,0.15)' }}/>
                ))}
              </div>
              <p className="text-[10px] text-ink/30 dark:text-white/25">
                {strength.filter(Boolean).length===4?'✓ Strong':strength.filter(Boolean).length>=2?'Add uppercase, numbers or symbols':'Weak — min 8 characters'}
              </p>
            </div>
          )}
          <button onClick={handleChange} disabled={!current||!newPass||!confirm||saving}
            className="btn-primary justify-center disabled:opacity-40">
            {saving?'Changing…':'Change password'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Appearance tab ────────────────────────────────────────────
function AppearanceTab() {
  const { mode, setMode } = useTheme();
  const THEMES = [
    { key:'light',  label:'Light',  icon:'☀️', desc:'Clean and bright'    },
    { key:'dark',   label:'Dark',   icon:'🌙', desc:'Easy on the eyes'    },
    { key:'system', label:'System', icon:'💻', desc:'Follows your device' },
  ];
  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1 block">Theme</label>
      {THEMES.map(t => (
        <button key={t.key} onClick={() => setMode(t.key)}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all"
          style={mode===t.key?{background:'rgba(124,106,240,0.10)',border:'1px solid rgba(124,106,240,0.28)'}:{background:'rgba(255,255,255,0.50)',border:'1px solid rgba(255,255,255,0.65)'}}>
          <span className="text-2xl">{t.icon}</span>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${mode===t.key?'text-lavender-700 dark:text-lavender-300':'text-ink dark:text-white'}`}>{t.label}</p>
            <p className="text-xs text-ink/40 dark:text-white/30">{t.desc}</p>
          </div>
          {mode===t.key && <Check size={16} className="text-lavender-500 shrink-0"/>}
        </button>
      ))}
    </div>
  );
}

// ── Premium tab ───────────────────────────────────────────────
function PremiumTab() {
  const toast = useToast();
  const [status,  setStatus]  = useState(null);   // { is_premium, freeze_date }
  const [busy,    setBusy]    = useState(false);

  const load = useCallback(() => {
    api.get('/focus/premium/status').then(setStatus).catch(() => setStatus({ is_premium:false, freeze_date:null }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    setBusy(true);
    try {
      const next = await api.post('/focus/premium/toggle', {});
      setStatus(next);
      toast.success(next.is_premium ? '👑 Premium activated!' : 'Premium turned off');
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const pause = async () => {
    setBusy(true);
    try {
      const res = await api.post('/focus/premium/pause', {});
      setStatus(s => ({ ...s, freeze_date: res.freeze_date }));
      toast.success('❄️ Streak frozen for today — your streak is safe!');
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const today       = new Date().toISOString().slice(0, 10);
  const frozenToday = status?.freeze_date === today;

  const PERKS = [
    { icon: '❄️', title: 'Streak pause',           desc: 'Freeze your streak for a day — like Duolingo',      live: true  },
    { icon: '🎨', title: 'Custom themes',           desc: 'Exclusive color themes for Aurora',                 live: false },
    { icon: '📚', title: 'Unlimited exam history',  desc: 'Keep every generated exam forever',                 live: false },
  ];

  if (!status) return <p className="text-xs text-ink/35 dark:text-white/30 py-6 text-center">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      {/* Status card */}
      <div className="rounded-2xl p-5 text-center"
        style={status.is_premium
          ? { background:'linear-gradient(135deg,rgba(255,184,77,0.14),rgba(124,106,240,0.10))', border:'1px solid rgba(255,184,77,0.35)' }
          : { background:'rgba(124,106,240,0.06)', border:'1px solid rgba(124,106,240,0.15)' }}>
        <Crown size={28} className={`mx-auto mb-2 ${status.is_premium ? 'text-sun-500' : 'text-ink/25 dark:text-white/20'}`}/>
        <p className="font-display font-bold text-ink dark:text-white">
          {status.is_premium ? 'Aurora Premium' : 'Aurora Free'}
        </p>
        <p className="text-xs text-ink/45 dark:text-white/35 mt-1">
          {status.is_premium
            ? 'All premium perks unlocked. Thanks for the support! 💜'
            : 'Unlock streak pause, custom themes, and unlimited exam history.'}
        </p>
        <button onClick={toggle} disabled={busy}
          className={`mt-4 w-full rounded-2xl py-2.5 text-sm font-bold transition disabled:opacity-40 ${
            status.is_premium ? '' : 'text-white'
          }`}
          style={status.is_premium
            ? { background:'rgba(30,34,51,0.05)', border:'1px solid rgba(30,34,51,0.10)', color:'rgba(30,34,51,0.55)' }
            : { background:'linear-gradient(135deg,#FFB84D,#7C6AF0)', boxShadow:'0 4px 14px rgba(255,184,77,0.35)' }}>
          {busy ? '…' : status.is_premium ? 'Switch back to Free' : '👑 Try Premium (free for now)'}
        </button>
      </div>

      {/* Streak pause */}
      <div className="rounded-2xl p-4"
        style={{ background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.18)' }}>
        <div className="flex items-start gap-3">
          <Snowflake size={18} className="text-blue-400 shrink-0 mt-0.5"/>
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink dark:text-white">Pause streak</p>
            <p className="text-xs text-ink/45 dark:text-white/35 mt-0.5">
              Can't do your habits today? Freeze today so your streak survives.
            </p>
            {frozenToday ? (
              <p className="mt-2 text-xs font-bold text-blue-500">❄️ Frozen for today — you're covered!</p>
            ) : (
              <button onClick={pause} disabled={busy || !status.is_premium}
                className="mt-2.5 rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-40"
                style={{ background:'rgba(96,165,250,0.14)', border:'1px solid rgba(96,165,250,0.30)', color:'#3B82F6' }}>
                {status.is_premium ? '❄️ Freeze my streak for today' : '🔒 Premium only'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Perks list */}
      <div className="flex flex-col gap-2">
        {PERKS.map(p => (
          <div key={p.title} className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background:'rgba(255,255,255,0.45)', border:'1px solid rgba(255,255,255,0.60)' }}>
            <span className="text-xl shrink-0">{p.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink dark:text-white">{p.title}</p>
              <p className="text-[11px] text-ink/40 dark:text-white/30">{p.desc}</p>
            </div>
            <span className="text-[10px] font-bold shrink-0 rounded-full px-2 py-1"
              style={p.live
                ? { background:'rgba(76,195,138,0.12)', color:'#2DA76E' }
                : { background:'rgba(30,34,51,0.05)', color:'rgba(30,34,51,0.35)' }}>
              {p.live ? 'LIVE' : 'SOON'}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-ink/30 dark:text-white/25 text-center">
        No payment needed yet — Premium is a free preview while Aurora grows.
      </p>
    </div>
  );
}

// ── Feedback tab ──────────────────────────────────────────────
function FeedbackTab() {
  const { user } = useAuth();
  const toast    = useToast();
  const [msg,    setMsg]    = useState('');
  const [sending,setSending] = useState(false);
  const [sent,   setSent]   = useState(false);

  const send = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      await api.post('/feedback', { message:msg, email:user?.email });
      setSent(true); setMsg(''); toast.success('Feedback sent! 💙');
      setTimeout(() => setSent(false), 3000);
    } catch (_) { toast.error('Could not send. Try again.'); }
    finally { setSending(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1 block">Send feedback</label>
      <textarea className="input-field resize-none" rows={5}
        placeholder="What's working, what's broken, what you'd love added…"
        value={msg} onChange={e => setMsg(e.target.value)}/>
      <button onClick={send} disabled={!msg.trim()||sending||sent} className="btn-primary justify-center">
        {sending?'Sending…':sent?'✓ Sent!':'Send feedback'}
      </button>
      <p className="text-[11px] text-ink/30 dark:text-white/25 text-center">Every message is read personally.</p>
    </div>
  );
}

// ── Danger tab ────────────────────────────────────────────────
function DangerTab({ onClose }) {
  const { logout, deleteAccount } = useAuth();
  const navigate     = useNavigate();
  const toast        = useToast();
  const [confirm,    setConfirm]    = useState('');
  const [deleting,   setDeleting]   = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const handleLogout = () => { logout(); onClose(); navigate('/login',{replace:true}); };
  const handleDelete = async () => {
    if (confirm!=='DELETE') return;
    setDeleting(true);
    try { await deleteAccount(); onClose(); navigate('/login',{replace:true}); }
    catch (err) { toast.error(err.message); setDeleting(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <button onClick={handleLogout}
        className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition"
        style={{ background:'rgba(255,122,99,0.08)', border:'1px solid rgba(255,122,99,0.20)', color:'#FF7A63' }}>
        <LogOut size={15}/> Log out
      </button>
      <div className="rounded-2xl overflow-hidden" style={{ border:'1px solid rgba(239,68,68,0.20)' }}>
        <button onClick={() => setShowDelete(s=>!s)}
          className="flex items-center justify-between w-full px-5 py-4 text-sm font-semibold text-red-500 hover:bg-red-500/5 transition">
          <span className="flex items-center gap-2"><Trash2 size={15}/> Delete my account</span>
          <ChevronRight size={15} className={`transition-transform ${showDelete?'rotate-90':''}`}/>
        </button>
        <AnimatePresence>
          {showDelete && (
            <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} className="overflow-hidden">
              <div className="px-5 pb-5 flex flex-col gap-3" style={{ borderTop:'1px solid rgba(239,68,68,0.15)', background:'rgba(239,68,68,0.03)' }}>
                <div className="flex items-start gap-2 mt-4">
                  <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5"/>
                  <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                    Permanently deletes your account and <strong>all data</strong>. Cannot be undone.
                  </p>
                </div>
                <p className="text-xs text-ink/50 dark:text-white/40">Type <strong>DELETE</strong> to confirm:</p>
                <input className="input-field" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="DELETE" autoFocus/>
                <div className="flex gap-2">
                  <button onClick={() => { setShowDelete(false); setConfirm(''); }}
                    className="flex-1 rounded-xl py-2 text-xs font-semibold text-ink/60 dark:text-white/50 bg-ink/5 dark:bg-white/5 hover:bg-ink/10 transition">
                    Cancel
                  </button>
                  <button onClick={handleDelete} disabled={confirm!=='DELETE'||deleting}
                    className="flex-1 rounded-xl py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-40">
                    {deleting?'Deleting…':'Delete forever'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key:'profile',    label:'Profile',     icon:User          },
  { key:'account',    label:'Account',     icon:Lock          },
  { key:'appearance', label:'Appearance',  icon:Palette       },
  { key:'premium',    label:'Premium',     icon:Crown         },
  { key:'feedback',   label:'Feedback',    icon:MessageSquare },
  { key:'danger',     label:'Danger',      icon:Trash2        },
];

export default function SettingsModal({ open, onClose }) {
  const [tab, setTab]         = useState('profile');
  const { user }              = useAuth();
  const { resolvedTheme }     = useTheme();
  const isDark                = resolvedTheme === 'dark';

  const closeAndReset = () => { setTab('profile'); onClose(); };

  const navBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(30,34,51,0.03)';
  const navBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(30,34,51,0.06)';
  const activeStyle = isDark
    ? { background:'rgba(124,106,240,0.15)', color:'#C4B5FD' }
    : { background:'rgba(124,106,240,0.10)', color:'#5B47E0' };
  const inactiveClr = isDark
    ? 'text-white/45 hover:text-white/70 hover:bg-white/5'
    : 'text-ink/50 hover:text-ink/80 hover:bg-ink/5';

  return (
    <Modal open={open} onClose={closeAndReset} title="Settings" maxWidth="max-w-xl">
      <div className="flex flex-col lg:flex-row -mx-6 -mb-6 mt-2" style={{ minHeight:400 }}>
        {/* ── Mobile: horizontal tab bar ── Desktop: sidebar ── */}
        <div
          className="flex lg:flex-col lg:w-40 shrink-0 overflow-x-auto lg:overflow-x-visible py-2 lg:py-3 px-2 lg:rounded-bl-3xl"
          style={{ background:navBg, borderBottom:`1px solid ${navBorder}`, borderRight:'none' }}
        >
          {/* Avatar — desktop only */}
          <div className="hidden lg:flex flex-col items-center gap-2 py-4 mb-1">
            <Avatar user={user} size={44}/>
            <p className={`text-xs font-semibold text-center truncate w-full px-2 ${isDark?'text-white/50':'text-ink/60'}`}>
              {user?.name?.split(' ')[0]}
            </p>
          </div>
          {/* Nav items */}
          <div className="flex lg:flex-col gap-1 lg:gap-0.5 flex-nowrap">
            {NAV_ITEMS.map(({ key, label, icon:Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition-all ${
                  tab===key ? '' : key==='danger'
                    ? 'text-red-400 hover:text-red-500 hover:bg-red-500/5'
                    : inactiveClr
                }`}
                style={tab===key && key!=='danger' ? activeStyle : {}}
              >
                <Icon size={14} className="shrink-0"/>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <p className={`hidden lg:block text-[10px] text-center pb-3 mt-auto ${isDark?'text-white/15':'text-ink/20'}`}>
            © {new Date().getFullYear()} Haneen
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 p-5 lg:p-6 overflow-y-auto" style={{ maxHeight:'65vh' }}>
          <AnimatePresence mode="wait">
            <motion.div key={tab}
              initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-8 }}
              transition={{ duration:0.18 }}
            >
              {tab==='profile'    && <ProfileTab/>}
              {tab==='account'    && <AccountTab/>}
              {tab==='appearance' && <AppearanceTab/>}
              {tab==='premium'    && <PremiumTab/>}
              {tab==='feedback'   && <FeedbackTab/>}
              {tab==='danger'     && <DangerTab onClose={closeAndReset}/>}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Modal>
  );
}