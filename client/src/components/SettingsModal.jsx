import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Palette, MessageSquare, Trash2,
  AlertTriangle, LogOut, Mail, Camera, Check,
  Eye, EyeOff, X, ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Modal from './Modal.jsx';
import AvatarCropper from './AvatarCropper.jsx';

// ── Avatar display ────────────────────────────────────────────
function Avatar({ user, size = 56, onClick }) {
  if (user?.avatar) {
    return (
      <img
        src={user.avatar} alt={user.name} onClick={onClick}
        className="rounded-2xl cursor-pointer"
        style={{
          width:     size,
          height:    size,
          minWidth:  size,
          minHeight: size,
          objectFit: 'cover',
          objectPosition: 'center',
          flexShrink: 0,
          display: 'block',
        }}
      />
    );
  }
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-center rounded-2xl text-white font-bold cursor-pointer select-none shrink-0"
      style={{
        width:      size,
        height:     size,
        fontSize:   size * 0.38,
        background: 'linear-gradient(135deg, #7C6AF0 0%, #5B47E0 100%)',
        boxShadow:  '0 4px 12px rgba(124,106,240,0.35)',
      }}
    >
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

  // Open file picker → show cropper
  const handleFileChange = useCallback((file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    const reader = new FileReader();
    reader.onload = (e) => setCropSrc(e.target.result);
    reader.readAsDataURL(file);
  }, [toast]);

  // After crop confirmed — save to server
  const handleCropSave = async (dataURL) => {
    setCropSrc(null);
    try {
      await updateUser({ avatar: dataURL });
      toast.success('Profile photo updated! 📸');
    } catch (err) { toast.error(err.message); }
  };

  const removeAvatar = async () => {
    try { await updateUser({ avatar: null }); toast.success('Photo removed'); }
    catch (err) { toast.error(err.message); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateUser({ name: name.trim(), bio, gender, birthday });
      toast.success('Profile saved!');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  // Birthday helpers
  const isBirthday = (() => {
    if (!birthday) return false;
    const today = new Date();
    const [, m, d] = birthday.split('-');
    return Number(m) === today.getMonth() + 1 && Number(d) === today.getDate();
  })();

  const age = (() => {
    if (!birthday) return null;
    return new Date().getFullYear() - Number(birthday.split('-')[0]);
  })();

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Birthday banner */}
        {isBirthday && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl px-4 py-3 text-sm font-semibold text-center"
            style={{ background: 'linear-gradient(135deg,rgba(124,106,240,0.15),rgba(168,85,247,0.10))', border: '1px solid rgba(124,106,240,0.25)' }}>
            🎂 Happy Birthday, {user?.name?.split(' ')[0]}!
            {age ? ` You're ${age} today! ` : ' '}
            Aurora celebrates you 🎉
          </motion.div>
        )}

        {/* Avatar row */}
        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar user={user} size={72} onClick={() => fileRef.current?.click()} />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-xl text-white shadow-md"
              style={{ background: 'linear-gradient(135deg,#7C6AF0,#5B47E0)' }}
            >
              <Camera size={13} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => handleFileChange(e.target.files[0])} />
          </div>
          <div>
            <p className="font-semibold text-ink dark:text-white text-sm">{user?.name}</p>
            <p className="text-xs text-ink/40 dark:text-white/30 mt-0.5">{user?.email}</p>
            <div className="flex gap-3 mt-2">
              <button onClick={() => fileRef.current?.click()}
                className="text-xs font-semibold text-lavender-600 hover:underline">
                Change photo
              </button>
              {user?.avatar && (
                <button onClick={removeAvatar}
                  className="text-xs text-ink/35 dark:text-white/30 hover:text-coral-500 transition">
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1.5 block">
              Display name
            </label>
            <input className="input-field" value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name" />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1.5 block">
              Bio
            </label>
            <textarea className="input-field resize-none" rows={2}
              value={bio} onChange={(e) => setBio(e.target.value)}
              placeholder="A short bio — Lumi will use this to personalise responses" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1.5 block">
                Gender
              </label>
              <select className="input-field" value={gender}
                onChange={(e) => setGender(e.target.value)}>
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
              <input type="date" className="input-field" value={birthday}
                onChange={(e) => setBirthday(e.target.value)} />
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving} className="btn-primary justify-center">
          {saving ? 'Saving…' : <><Check size={15} /> Save profile</>}
        </button>
      </div>

      {/* Avatar cropper overlay */}
      <AnimatePresence>
        {cropSrc && (
          <AvatarCropper
            imageSrc={cropSrc}
            onSave={handleCropSave}
            onCancel={() => setCropSrc(null)}
          />
        )}
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
    newPass.length >= 8,
    /[A-Z]/.test(newPass),
    /[0-9]/.test(newPass),
    /[^A-Za-z0-9]/.test(newPass),
  ];
  const strengthColors = ['#FF7A63','#FFB84D','#60A5FA','#4CC38A'];

  const handleChange = async () => {
    if (newPass !== confirm) { toast.error('New passwords do not match'); return; }
    if (newPass.length < 8)  { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await changePassword(current, newPass);
      toast.success('Password changed successfully!');
      setCurrent(''); setNewPass(''); setConfirm('');
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Email — read only */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1.5 block">
          Email address
        </label>
        <div className="input-field flex items-center gap-2 opacity-60 select-none"
          style={{ pointerEvents: 'none' }}>
          <Mail size={14} className="text-ink/40 dark:text-white/30 shrink-0" />
          {user?.email}
        </div>
        <p className="text-[11px] text-ink/30 dark:text-white/25 mt-1">
          Email cannot be changed. Contact support if needed.
        </p>
      </div>

      {/* Change password */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-3 block">
          Change password
        </label>
        <div className="flex flex-col gap-3">
          {/* Current */}
          <div className="relative">
            <input type={showCur ? 'text' : 'password'} className="input-field pr-10"
              placeholder="Current password" value={current}
              onChange={(e) => setCurrent(e.target.value)} />
            <button onClick={() => setShowCur(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink/60 dark:text-white/30 dark:hover:text-white/60 transition">
              {showCur ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {/* New */}
          <div className="relative">
            <input type={showNew ? 'text' : 'password'} className="input-field pr-10"
              placeholder="New password (min 8 characters)" value={newPass}
              onChange={(e) => setNewPass(e.target.value)} />
            <button onClick={() => setShowNew(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink/60 dark:text-white/30 dark:hover:text-white/60 transition">
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {/* Confirm */}
          <input type="password" className="input-field"
            placeholder="Confirm new password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} />

          {/* Strength bar */}
          {newPass && (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1">
                {strength.map((met, i) => (
                  <div key={i} className="flex-1 h-1.5 rounded-full transition-all"
                    style={{ background: met ? strengthColors[i] : 'rgba(124,106,240,0.15)' }} />
                ))}
              </div>
              <p className="text-[10px] text-ink/30 dark:text-white/25">
                {strength.filter(Boolean).length === 4 ? '✓ Strong password' :
                 strength.filter(Boolean).length >= 2 ? 'Add uppercase, numbers, or symbols' :
                 'Weak — min 8 characters'}
              </p>
            </div>
          )}

          <button onClick={handleChange}
            disabled={!current || !newPass || !confirm || saving}
            className="btn-primary justify-center disabled:opacity-40">
            {saving ? 'Changing…' : 'Change password'}
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
    { key: 'light',  label: 'Light',  icon: '☀️', desc: 'Clean and bright'    },
    { key: 'dark',   label: 'Dark',   icon: '🌙', desc: 'Easy on the eyes'    },
    { key: 'system', label: 'System', icon: '💻', desc: 'Follows your device' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1 block">
        Theme
      </label>
      <div className="flex flex-col gap-2">
        {THEMES.map((t) => (
          <button key={t.key} onClick={() => setMode(t.key)}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all"
            style={mode === t.key ? {
              background: 'rgba(124,106,240,0.10)',
              border:     '1px solid rgba(124,106,240,0.28)',
            } : {
              background: 'rgba(255,255,255,0.50)',
              border:     '1px solid rgba(255,255,255,0.65)',
            }}>
            <span className="text-2xl">{t.icon}</span>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${mode === t.key ? 'text-lavender-700 dark:text-lavender-300' : 'text-ink dark:text-white'}`}>
                {t.label}
              </p>
              <p className="text-xs text-ink/40 dark:text-white/30">{t.desc}</p>
            </div>
            {mode === t.key && <Check size={16} className="text-lavender-500 shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Feedback tab ──────────────────────────────────────────────
function FeedbackTab() {
  const { user }  = useAuth();
  const toast     = useToast();
  const [msg,     setMsg]     = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  const send = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      await api.post('/feedback', { message: msg, email: user?.email });
      setSent(true); setMsg('');
      toast.success('Feedback sent! Thank you 💙');
      setTimeout(() => setSent(false), 3000);
    } catch (_) { toast.error('Could not send feedback. Try again.'); }
    finally { setSending(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1 block">
        Send feedback
      </label>
      <textarea className="input-field resize-none" rows={6}
        placeholder="Tell me what's working, what's broken, what you'd love to see added…"
        value={msg} onChange={(e) => setMsg(e.target.value)} />
      <button onClick={send} disabled={!msg.trim() || sending || sent}
        className="btn-primary justify-center">
        {sending ? 'Sending…' : sent ? '✓ Sent!' : 'Send feedback'}
      </button>
      <p className="text-[11px] text-ink/30 dark:text-white/25 text-center">
        Every message is read personally.
      </p>
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

  const handleLogout = () => { logout(); onClose(); navigate('/login', { replace: true }); };

  const handleDelete = async () => {
    if (confirm !== 'DELETE') return;
    setDeleting(true);
    try {
      await deleteAccount();
      onClose();
      navigate('/login', { replace: true });
    } catch (err) { toast.error(err.message); setDeleting(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Logout */}
      <button onClick={handleLogout}
        className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition"
        style={{ background: 'rgba(255,122,99,0.08)', border: '1px solid rgba(255,122,99,0.20)', color: '#FF7A63' }}>
        <LogOut size={15} /> Log out
      </button>

      {/* Delete account */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(239,68,68,0.20)' }}>
        <button
          onClick={() => setShowDelete((s) => !s)}
          className="flex items-center justify-between w-full px-5 py-4 text-sm font-semibold text-red-500 transition hover:bg-red-500/5"
        >
          <span className="flex items-center gap-2"><Trash2 size={15} /> Delete my account</span>
          <ChevronRight size={15} className={`transition-transform duration-200 ${showDelete ? 'rotate-90' : ''}`} />
        </button>

        <AnimatePresence>
          {showDelete && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{   height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 flex flex-col gap-3"
                style={{ borderTop: '1px solid rgba(239,68,68,0.15)', background: 'rgba(239,68,68,0.03)' }}>
                <div className="flex items-start gap-2 mt-4">
                  <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                    This permanently deletes your account and <strong>all data</strong> — tasks, habits,
                    goals, XP, conversations. This cannot be undone.
                  </p>
                </div>
                <p className="text-xs text-ink/50 dark:text-white/40">
                  Type <strong>DELETE</strong> to confirm:
                </p>
                <input className="input-field" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="DELETE" autoFocus />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDelete(false); setConfirm(''); }}
                    className="flex-1 rounded-xl py-2 text-xs font-semibold text-ink/60 dark:text-white/50 bg-ink/5 dark:bg-white/5 hover:bg-ink/10 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={confirm !== 'DELETE' || deleting}
                    className="flex-1 rounded-xl py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-40"
                  >
                    {deleting ? 'Deleting…' : 'Delete forever'}
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
export default function SettingsModal({ open, onClose }) {
  const [tab, setTab]         = useState('profile');
  const { user }              = useAuth();
  const { resolvedTheme }     = useTheme();
  const isDark                = resolvedTheme === 'dark';

  const closeAndReset = () => { setTab('profile'); onClose(); };

  const navBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(30,34,51,0.03)';
  const navBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(30,34,51,0.06)';
  const activeStyle = isDark
    ? { background: 'rgba(124,106,240,0.15)', color: '#C4B5FD' }
    : { background: 'rgba(124,106,240,0.10)', color: '#5B47E0' };
  const inactiveClr = isDark
    ? 'text-white/45 hover:text-white/70 hover:bg-white/5'
    : 'text-ink/50 hover:text-ink/80 hover:bg-ink/5';

  const NAV_ITEMS = [
    { key: 'profile',    label: 'Profile',     icon: User          },
    { key: 'account',    label: 'Account',     icon: Lock          },
    { key: 'appearance', label: 'Appearance',  icon: Palette       },
    { key: 'feedback',   label: 'Feedback',    icon: MessageSquare },
    { key: 'danger',     label: 'Danger zone', icon: Trash2        },
  ];

  return (
    <Modal open={open} onClose={closeAndReset} title="Settings" maxWidth="max-w-xl">
      <div className="flex -mx-6 -mb-6 mt-2" style={{ minHeight: 420 }}>

        {/* Left sidebar */}
        <div
          className="flex flex-col w-40 shrink-0 py-3 px-2 rounded-bl-3xl"
          style={{ background: navBg, borderRight: `1px solid ${navBorder}` }}
        >
          {/* Mini avatar */}
          <div className="flex flex-col items-center gap-2 py-4 mb-1">
            <Avatar user={user} size={44} />
            <p className={`text-xs font-semibold text-center truncate w-full px-2 ${isDark ? 'text-white/50' : 'text-ink/60'}`}>
              {user?.name?.split(' ')[0]}
            </p>
          </div>

          {/* Nav items */}
          <div className="flex flex-col gap-0.5 flex-1">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-left transition-all ${
                  tab === key ? '' : key === 'danger'
                    ? 'text-red-400 hover:text-red-500 hover:bg-red-500/5'
                    : inactiveClr
                }`}
                style={tab === key && key !== 'danger' ? activeStyle : {}}
              >
                <Icon size={14} className="shrink-0" />
                {label}
              </button>
            ))}
          </div>

          <p className={`text-[10px] text-center pb-3 ${isDark ? 'text-white/15' : 'text-ink/20'}`}>
            © {new Date().getFullYear()} Haneen
          </p>
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0 p-6 overflow-y-auto" style={{ maxHeight: '70vh' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{    opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              {tab === 'profile'    && <ProfileTab />}
              {tab === 'account'    && <AccountTab />}
              {tab === 'appearance' && <AppearanceTab />}
              {tab === 'feedback'   && <FeedbackTab />}
              {tab === 'danger'     && <DangerTab onClose={closeAndReset} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Modal>
  );
}