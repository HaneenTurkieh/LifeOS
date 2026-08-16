import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Palette, MessageSquare, Trash2,
  AlertTriangle, LogOut, Mail, Camera, Check,
  Eye, EyeOff, ChevronRight, Crown, Snowflake, Gift, Sparkles,
  BarChart3, Users, TrendingUp,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { api }       from '../api/client.js';
import { useAuth }   from '../context/AuthContext.jsx';
import { useTheme, FONT_SCALES } from '../context/ThemeContext.jsx';
import { useToast }  from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Modal         from './Modal.jsx';
import AvatarCropper from './AvatarCropper.jsx';
import { isTodayBirthday, getAge } from '../utils/birthday.js';
import VoiceInputButton, { appendText } from './VoiceInputButton.jsx';

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
      style={{
        width:size, height:size, fontSize:size*0.38,
        background: 'linear-gradient(135deg, rgb(var(--accent-500)), rgb(var(--accent-600)))',
        boxShadow: '0 4px 12px rgb(var(--accent-500) / 0.35)',
      }}>
      {user?.name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function ProfileTab() {
  const { user, updateUser } = useAuth();
  const toast   = useToast();
  const { t }   = useLanguage();
  const { setAccent } = useTheme();
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
    try { await updateUser({ avatar:dataURL }); toast.success('📸'); }
    catch (err) { toast.error(err.message); }
  };
  const removeAvatar = async () => {
    try { await updateUser({ avatar:null }); toast.success(t('settings.removePhoto')); }
    catch (err) { toast.error(err.message); }
  };
  const save = async () => {
    setSaving(true);
    try {
      await updateUser({ name:name.trim(), bio, gender, birthday });
      // A newly-set or changed gender gets a sensible default accent —
      // blue for male, pink for female — but only on an actual change,
      // so it doesn't quietly overwrite a color someone already picked
      // on purpose just because they saved their bio again.
      if (gender !== (user?.gender || '') && (gender === 'male' || gender === 'female')) {
        const preset = gender === 'male' ? 'blue' : 'pink';
        setAccent(preset);
        // Not /focus/premium/theme — that route is gated behind
        // is_premium, which would silently no-op for free accounts:
        // the color would flash on then get reverted a few seconds
        // later by ThemeContext's own periodic status poll reading
        // back the theme_preset that never actually got saved.
        api.post('/focus/premium/gender-theme', { theme_preset: preset }).catch(() => {});
      }
      toast.success(t('settings.profileSaved'));
    }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };
  const isBirthday = isTodayBirthday(birthday);
  const age = getAge(birthday);
  return (
    <>
      <div className="flex flex-col gap-5">
        {isBirthday && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
            className="rounded-2xl px-4 py-3 text-sm font-semibold text-center"
            style={{ background:'linear-gradient(135deg, rgb(var(--accent-500) / 0.15), rgba(168,85,247,0.10))', border:'1px solid rgb(var(--accent-500) / 0.25)' }}>
            🎂 {user?.name?.split(' ')[0]} 🎉
          </motion.div>
        )}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar user={user} size={68} onClick={() => fileRef.current?.click()} />
            <button onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -end-1 flex h-7 w-7 items-center justify-center rounded-xl text-white shadow-md"
              style={{ background: 'linear-gradient(135deg, rgb(var(--accent-500)), rgb(var(--accent-600)))' }}>
              <Camera size={13}/>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              // Real bug that used to live here: without resetting the
              // input's value, selecting a file, then canceling the
              // cropper without saving, then trying to reselect that
              // exact same file again did nothing — the browser only
              // fires onChange when the selected file actually changes,
              // and from the input's own perspective nothing had (same
              // CVBuilder.jsx already resets its own photo input this way).
              onChange={e => { handleFile(e.target.files[0]); e.target.value = ''; }} />
          </div>
          <div>
            <p className="font-semibold text-ink dark:text-white text-sm">{user?.name}</p>
            <p className="text-xs text-ink/40 dark:text-white/30 mt-0.5">{user?.email}</p>
            <div className="flex gap-3 mt-1.5">
              <button onClick={() => fileRef.current?.click()} className="text-xs font-semibold text-lavender-600 hover:underline">
                {t('settings.changePhoto')}
              </button>
              {user?.avatar && (
                <button onClick={removeAvatar} className="text-xs text-ink/35 dark:text-white/30 hover:text-coral-500 transition">
                  {t('settings.removePhoto')}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1.5 block">{t('settings.displayName')}</label>
            <input className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder={t('settings.yourName')}/>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1.5 block">{t('settings.bio')}</label>
            <div className="flex items-center gap-2">
              <textarea className="input-field resize-none flex-1" rows={2} value={bio}
                onChange={e => setBio(e.target.value)} placeholder={t('settings.bioPh')}/>
              <VoiceInputButton size="sm" onText={(c) => setBio((v) => appendText(v, c))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1.5 block">{t('settings.gender')}</label>
              <select className="input-field" value={gender} onChange={e => setGender(e.target.value)}>
                <option value="" disabled hidden></option>
                <option value="female">{t('settings.female')}</option>
                <option value="male">{t('settings.male')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1.5 block">
                {t('settings.birthday')} {age && <span className="text-lavender-500 normal-case">· {age}</span>}
              </label>
              <input type="date" className="input-field" value={birthday} onChange={e => setBirthday(e.target.value)}/>
            </div>
          </div>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary justify-center">
          {saving ? t('common.saving') : <><Check size={15}/> {t('settings.saveProfile')}</>}
        </button>
      </div>
      <AnimatePresence>
        {cropSrc && <AvatarCropper imageSrc={cropSrc} onSave={handleCropSave} onCancel={() => setCropSrc(null)}/>}
      </AnimatePresence>
    </>
  );
}

function AccountTab() {
  const { user, changePassword } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
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
    if (newPass !== confirm) { toast.error(t('settings.pwMismatch')); return; }
    if (newPass.length < 8)  { toast.error(t('settings.pwMin')); return; }
    setSaving(true);
    try { await changePassword(current, newPass); toast.success(t('settings.pwChanged')); setCurrent(''); setNewPass(''); setConfirm(''); }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1.5 block">{t('settings.emailAddr')}</label>
        <div className="input-field flex items-center gap-2 opacity-60" style={{ pointerEvents:'none' }}>
          <Mail size={14} className="text-ink/40 dark:text-white/30 shrink-0"/> {user?.email}
        </div>
        <p className="text-[11px] text-ink/30 dark:text-white/25 mt-1">{t('settings.emailFixed')}</p>
      </div>
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-3 block">{t('settings.changePw')}</label>
        <div className="flex flex-col gap-3">
          <div className="relative">
            <input type={showCur?'text':'password'} className="input-field pe-10" placeholder={t('settings.currentPw')}
              value={current} onChange={e => setCurrent(e.target.value)}/>
            <button onClick={() => setShowCur(s=>!s)} className="absolute end-3 top-1/2 -translate-y-1/2 text-ink/30 dark:text-white/30 hover:text-ink/60 transition">
              {showCur?<EyeOff size={15}/>:<Eye size={15}/>}
            </button>
          </div>
          <div className="relative">
            <input type={showNew?'text':'password'} className="input-field pe-10" placeholder={t('settings.newPw')}
              value={newPass} onChange={e => setNewPass(e.target.value)}/>
            <button onClick={() => setShowNew(s=>!s)} className="absolute end-3 top-1/2 -translate-y-1/2 text-ink/30 dark:text-white/30 hover:text-ink/60 transition">
              {showNew?<EyeOff size={15}/>:<Eye size={15}/>}
            </button>
          </div>
          <input type="password" className="input-field" placeholder={t('settings.confirmPw')}
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
                {strength.filter(Boolean).length===4?t('settings.pwStrong'):strength.filter(Boolean).length>=2?t('settings.pwAddMore'):t('settings.pwWeak')}
              </p>
            </div>
          )}
          <button onClick={handleChange} disabled={!current||!newPass||!confirm||saving}
            className="btn-primary justify-center disabled:opacity-40">
            {saving?t('settings.changing'):t('settings.changePw')}
          </button>
        </div>
      </div>
    </div>
  );
}

function AppearanceTab() {
  const { mode, setMode, fontScale, setFontScale } = useTheme();
  const { lang, setLang, t } = useLanguage();
  const THEMES = [
    { key:'light',  label:t('settings.light'),  icon:'☀️', desc:t('settings.lightDesc')  },
    { key:'dark',   label:t('settings.dark'),   icon:'🌙', desc:t('settings.darkDesc')   },
    { key:'system', label:t('settings.system'), icon:'💻', desc:t('settings.systemDesc') },
  ];
  const LANGS = [
    { key:'en', label:'English',  icon:'🇬🇧', desc:'Left to right'        },
    { key:'ar', label:'العربية', icon:'🇵🇸', desc:'من اليمين إلى اليسار' },
  ];
  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1 block">{t('settings.theme')}</label>
      {THEMES.map(th => (
        <button key={th.key} onClick={() => setMode(th.key)}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-start transition-all"
          style={mode===th.key?{background:'rgb(var(--accent-500) / 0.10)',border:'1px solid rgb(var(--accent-500) / 0.28)'}:{background:'rgba(255,255,255,0.50)',border:'1px solid rgba(255,255,255,0.65)'}}>
          <span className="text-2xl">{th.icon}</span>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${mode===th.key?'text-lavender-700 dark:text-lavender-300':'text-ink dark:text-white'}`}>{th.label}</p>
            <p className="text-xs text-ink/40 dark:text-white/30">{th.desc}</p>
          </div>
          {mode===th.key && <Check size={16} className="text-lavender-500 shrink-0"/>}
        </button>
      ))}
      <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1 mt-3 block">{t('settings.language')}</label>
      {LANGS.map(l => (
        <button key={l.key} onClick={() => setLang(l.key)}
          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-start transition-all"
          style={lang===l.key?{background:'rgb(var(--accent-500) / 0.10)',border:'1px solid rgb(var(--accent-500) / 0.28)'}:{background:'rgba(255,255,255,0.50)',border:'1px solid rgba(255,255,255,0.65)'}}>
          <span className="text-2xl">{l.icon}</span>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${lang===l.key?'text-lavender-700 dark:text-lavender-300':'text-ink dark:text-white'}`}>{l.label}</p>
            <p className="text-xs text-ink/40 dark:text-white/30">{l.desc}</p>
          </div>
          {lang===l.key && <Check size={16} className="text-lavender-500 shrink-0"/>}
        </button>
      ))}
      <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1 mt-3 block">
        {lang === 'ar' ? 'حجم الخط' : 'Text Size'}
      </label>
      <div className="rounded-2xl px-4 py-4" style={{ background:'rgba(255,255,255,0.50)', border:'1px solid rgba(255,255,255,0.65)' }}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: '0.75rem' }} className="text-ink/50 dark:text-white/40 font-semibold">A</span>
          <span style={{ fontSize: '1.375rem' }} className="text-ink dark:text-white font-semibold">A</span>
        </div>
        <input
          type="range" min="0" max="4" step="1"
          value={Object.keys(FONT_SCALES).indexOf(fontScale)}
          onChange={(e) => setFontScale(Object.keys(FONT_SCALES)[Number(e.target.value)])}
          className="w-full accent-lavender-600"
        />
        <p className="text-center text-xs text-ink/40 dark:text-white/30 mt-2 font-semibold">
          {FONT_SCALES[fontScale].label}
        </p>
      </div>
    </div>
  );
}

// ── Paddle.js — lazy singleton init ──────────────────────────────
// Paddle.js is loaded via a <script> tag in index.html, so window.Paddle
// may not exist yet the instant this component mounts, and — since this
// modal can mount/unmount many times in a session — Paddle.Initialize()
// must only ever be called once for the whole page. Its eventCallback is
// therefore a stable module-level function that just forwards to whatever
// the currently-mounted PremiumTab last registered, rather than trying to
// pass a fresh per-instance closure into an init call that may not
// actually run (because a previous instance already initialized it).
let paddleInitialized = false;
let paddleEventHandler = null;
function paddleEventDispatch(event) { paddleEventHandler?.(event); }
function ensurePaddleInitialized() {
  if (paddleInitialized) return true;
  if (!window.Paddle) return false;
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  if (!token) return false; // not configured yet — checkout button will no-op with a toast
  window.Paddle.Initialize({ token, eventCallback: paddleEventDispatch });
  paddleInitialized = true;
  return true;
}

// ── Premium tab ───────────────────────────────────────────────
function PremiumTab() {
  const toast = useToast();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { accent, setAccent, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [status,     setStatus]     = useState(null);
  const [plans,      setPlans]      = useState([]);
  const [busy,       setBusy]       = useState(false);
  const [requesting, setRequesting] = useState(null); // plan key currently being requested
  const [checkingOut, setCheckingOut] = useState(null); // plan key currently in Paddle checkout
  const [themeBusy,  setThemeBusy]  = useState(false);
  const [trial,      setTrial]      = useState(null);
  const [trialBusy,  setTrialBusy]  = useState(false);
  const [gracePasses, setGracePasses] = useState(null);
  const load = useCallback(() => {
    api.get('/focus/premium/status')
      .then((d) => {
        setStatus(d);
        if (d.theme_preset) setAccent(d.theme_preset);
      })
      .catch(() => setStatus({ is_premium:false, freeze_date:null, theme_preset:'purple', plan:null }));
    api.get('/focus/premium/plans').then((d) => setPlans(d.plans || [])).catch(() => setPlans([]));
    api.get('/focus/premium/trial-eligibility').then(setTrial).catch(() => setTrial(null));
    api.get('/focus/grace-passes').then(setGracePasses).catch(() => setGracePasses(null));
  }, [setAccent]);
  useEffect(() => { load(); }, [load]);

  // Paddle fires 'checkout.completed' the instant payment succeeds, but
  // our own is_premium flip only happens once the Paddle webhook reaches
  // our server (usually near-instant, but not guaranteed to beat the
  // client). So: show an "activating" state and poll status a few times
  // rather than assuming it's already flipped.
  useEffect(() => {
    paddleEventHandler = (event) => {
      if (event?.name === 'checkout.completed') {
        setCheckingOut(null);
        toast.success(t('settings.paymentActivating'));
        let tries = 0;
        const poll = setInterval(() => {
          tries += 1;
          api.get('/focus/premium/status')
            .then((d) => {
              setStatus(d);
              if (d.theme_preset) setAccent(d.theme_preset);
              if (d.is_premium || tries >= 6) clearInterval(poll);
            })
            .catch(() => {});
        }, 2500);
      } else if (event?.name === 'checkout.closed') {
        setCheckingOut(null);
      }
    };
    ensurePaddleInitialized();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkoutPlan = (plan) => {
    if (!ensurePaddleInitialized()) {
      toast.error(t('settings.paymentLoading'));
      return;
    }
    setCheckingOut(plan.key);
    window.Paddle.Checkout.open({
      items: [{ priceId: plan.priceId, quantity: 1 }],
      customer: user?.email ? { email: user.email } : undefined,
      customData: { user_id: String(user?.id || '') },
      settings: { theme: isDark ? 'dark' : 'light', displayMode: 'overlay' },
    });
  };
  const startTrial = async () => {
    setTrialBusy(true);
    try {
      const next = await api.post('/focus/premium/start-trial', {});
      setStatus(next);
      if (next.theme_preset) setAccent(next.theme_preset);
      toast.success(t('settings.trialStarted', { n: trial?.trialDays || 7 }));
      load();
    } catch (err) { toast.error(err.message); }
    finally { setTrialBusy(false); }
  };
  const trialDaysLeft = trial?.trialExpiresAt
    ? Math.max(0, Math.ceil((new Date(trial.trialExpiresAt) - new Date()) / (24 * 60 * 60 * 1000)))
    : 0;
  const toggle = async () => {
    setBusy(true);
    try {
      const next = await api.post('/focus/premium/toggle', {});
      setStatus(next);
      if (next.theme_preset) setAccent(next.theme_preset);
      toast.success(next.is_premium ? '👑' : t('settings.freeName'));
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };
  const requestPlan = async (planKey) => {
    setRequesting(planKey);
    try {
      const next = await api.post('/focus/premium/request', { plan_key: planKey });
      setStatus(next);
      if (next.theme_preset) setAccent(next.theme_preset);
      toast.success(t('settings.planRequested'));
    } catch (err) { toast.error(err.message); }
    finally { setRequesting(null); }
  };
  const periodLabel = (months, lang2) => {
    if (months === 1)  return lang2 === 'ar' ? 'شهريًا' : '/ month';
    if (months === 4)  return lang2 === 'ar' ? 'كل فصل دراسي (4 أشهر)' : '/ semester (4 months)';
    return lang2 === 'ar' ? `سنويًا (${months} شهرًا)` : `/ year (${months} months)`;
  };
  const monthlyEq = (plan) => Math.round((plan.price / plan.months) * 10) / 10;
  const pause = async () => {
    setBusy(true);
    try {
      const res = await api.post('/focus/premium/pause', {});
      setStatus(s => ({ ...s, freeze_date: res.freeze_date }));
      toast.success(t('settings.frozenToday'));
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };
  const THEME_PRESETS = [
    { key: 'purple', label: lang === 'ar' ? 'بنفسجي' : 'Purple', swatch: 'linear-gradient(135deg,#7C6AF0,#5B47E0)' },
    { key: 'orange', label: lang === 'ar' ? 'برتقالي' : 'Orange', swatch: 'linear-gradient(135deg,#FF8A42,#E85D04)' },
    { key: 'pink',   label: lang === 'ar' ? 'وردي'    : 'Pink',   swatch: 'linear-gradient(135deg,#FF6BA6,#D6247A)' },
    { key: 'blue',   label: lang === 'ar' ? 'أزرق'    : 'Blue',   swatch: 'linear-gradient(135deg,#5C9AFF,#2563EB)' },
  ];
  const themeSectionTitle = lang === 'ar' ? 'لون التطبيق' : 'App color';
  const themeLockedNote   = lang === 'ar' ? 'ميزة بريميوم' : 'Premium feature';
  const changeTheme = async (preset) => {
    if (!status?.is_premium || themeBusy || preset === accent) return;
    setThemeBusy(true);
    const prev = accent;
    setAccent(preset);
    try {
      await api.post('/focus/premium/theme', { theme_preset: preset });
      setStatus((s) => ({ ...s, theme_preset: preset }));
    } catch (err) {
      setAccent(prev);
      toast.error(err.message);
    } finally { setThemeBusy(false); }
  };
  const today       = new Date().toISOString().slice(0, 10);
  const frozenToday = status?.freeze_date === today;
  // Badge next to each perk reflects the viewer's own access (is_premium),
  // not just "this feature is built" — otherwise a free user sees "LIVE"
  // on things they can't actually use yet, which reads as a bug.
  const PERKS = [
    { icon: '✨', title: t('settings.perkUnlimited'), desc: t('settings.perkUnlimitedD') },
    { icon: '❄️', title: t('settings.perkFreeze'), desc: t('settings.perkFreezeD') },
    { icon: '🎨', title: t('settings.perkThemes'), desc: t('settings.perkThemesD') },
    { icon: '📚', title: t('settings.perkExam'),   desc: t('settings.perkExamD')   },
    { icon: '💧', title: t('settings.perkWatermark'), desc: t('settings.perkWatermarkD') },
  ];
  if (!status) return <p className="text-xs text-ink/35 dark:text-white/30 py-6 text-center">{t('common.loading')}</p>;
  const backToFreeStyle = isDark
    ? { background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.14)', color:'rgba(255,255,255,0.70)' }
    : { background:'rgba(30,34,51,0.05)',    border:'1px solid rgba(30,34,51,0.10)',    color:'rgba(30,34,51,0.55)' };
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl p-5 text-center"
        style={status.is_premium
          ? { background:'linear-gradient(135deg,rgba(255,184,77,0.14),rgb(var(--accent-500) / 0.10))', border:'1px solid rgba(255,184,77,0.35)' }
          : { background:'rgb(var(--accent-500) / 0.06)', border:'1px solid rgb(var(--accent-500) / 0.15)' }}>
        <Crown size={28} className={`mx-auto mb-2 ${status.is_premium ? 'text-sun-500' : 'text-ink/25 dark:text-white/20'}`}/>
        <p className="font-display font-bold text-ink dark:text-white">
          {status.is_premium ? t('settings.premiumName') : t('settings.freeName')}
        </p>
        <p className="text-xs text-ink/45 dark:text-white/35 mt-1">
          {status.is_premium ? t('settings.premiumDesc') : t('settings.freeDesc')}
        </p>
        {status.is_premium && status.plan && (
          <p className="text-[11px] font-bold mt-2 text-sun-500">
            {t('settings.yourPlan')}: {plans.find(p => p.key === status.plan)?.name || status.plan}
          </p>
        )}
        {status.is_premium && (
          <button onClick={toggle} disabled={busy}
            className="mt-4 w-full rounded-2xl py-2.5 text-sm font-bold transition disabled:opacity-40"
            style={backToFreeStyle}>
            {busy ? '…' : t('settings.backToFree')}
          </button>
        )}
      </div>

      {!status.is_premium && trial?.inGracePeriod && (
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background:'rgb(var(--accent-500) / 0.06)', border:'1px solid rgb(var(--accent-500) / 0.15)' }}>
          <Sparkles size={20} className="text-lavender-500 shrink-0" />
          <div>
            <p className="text-xs font-bold text-ink dark:text-white">
              {trial.graceDaysLeft > 1 ? t('settings.graceActive', { n: trial.graceDaysLeft }) : t('settings.graceEndingSoon')}
            </p>
            <p className="text-[11px] text-ink/50 dark:text-white/40 mt-0.5">
              {trial.graceDaysLeft > 1 ? t('settings.graceActiveDesc', { n: trial.gracePeriodDays }) : t('settings.graceEndingSoonDesc')}
            </p>
          </div>
        </div>
      )}
      {trial?.trialActive && (
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background:'linear-gradient(135deg,rgba(255,184,77,0.14),rgb(var(--accent-500) / 0.10))', border:'1px solid rgba(255,184,77,0.35)' }}>
          <Gift size={20} className="text-sun-500 shrink-0" />
          <div>
            <p className="text-xs font-bold text-ink dark:text-white">{t('settings.trialActive')}</p>
            <p className="text-[11px] text-ink/50 dark:text-white/40 mt-0.5">
              {t('settings.trialDaysLeft', { n: trialDaysLeft })}
            </p>
          </div>
        </div>
      )}
      {!status.is_premium && trial?.eligible && (
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background:'linear-gradient(135deg,rgba(255,184,77,0.14),rgb(var(--accent-500) / 0.10))', border:'1px solid rgba(255,184,77,0.35)' }}>
          <Gift size={20} className="text-sun-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-ink dark:text-white">{t('settings.trialUnlocked')}</p>
            <p className="text-[11px] text-ink/50 dark:text-white/40 mt-0.5">
              {t('settings.trialUnlockedDesc', { n: trial.trialDays })}
            </p>
          </div>
          <button onClick={startTrial} disabled={trialBusy}
            className="shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold text-white transition disabled:opacity-40"
            style={{ background:'linear-gradient(135deg,#FFB84D, rgb(var(--accent-500)))', boxShadow:'0 3px 10px rgba(255,184,77,0.30)' }}>
            {trialBusy ? t('settings.requesting') : t('settings.startTrial')}
          </button>
        </div>
      )}
      {!status.is_premium && trial && !trial.eligible && !trial.trialActive && !trial.trialUsed && trial.level < trial.requiredLevel && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5"
          style={{ background:'rgb(var(--accent-500) / 0.05)', border:'1px solid rgb(var(--accent-500) / 0.12)' }}>
          <Gift size={15} className="text-ink/30 dark:text-white/25 shrink-0" />
          <p className="text-[11px] text-ink/45 dark:text-white/35">
            {t('settings.trialTeaser', { level: trial.requiredLevel, current: trial.level })}
          </p>
        </div>
      )}
      {!status.is_premium && plans.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm font-semibold text-ink dark:text-white px-1">👑 {t('settings.choosePlan')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {plans.map((plan) => {
              const badgeLabel = plan.badge === 'popular' ? t('settings.mostPopular')
                                : plan.badge === 'value'   ? t('settings.bestValue')
                                : null;
              return (
                <div key={plan.key} className="relative rounded-2xl p-4 flex flex-col"
                  style={plan.badge
                    ? { background:'linear-gradient(135deg,rgba(255,184,77,0.12),rgb(var(--accent-500) / 0.08))', border:'1px solid rgba(255,184,77,0.35)' }
                    : { background:'rgb(var(--accent-500) / 0.05)', border:'1px solid rgb(var(--accent-500) / 0.12)' }}>
                  {badgeLabel && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold rounded-full px-2.5 py-1 whitespace-nowrap text-white"
                      style={{ background: plan.badge === 'popular' ? 'linear-gradient(135deg,#FFB84D,#E8940A)' : 'linear-gradient(135deg,#2DA76E,#1E8A57)' }}>
                      {badgeLabel}
                    </span>
                  )}
                  <p className="text-xs font-bold text-ink/60 dark:text-white/50 text-center mt-1">{plan.name}</p>
                  <p className="text-2xl font-display font-bold text-ink dark:text-white text-center mt-1">
                    {plan.price} <span className="text-xs font-semibold text-ink/40 dark:text-white/35">{plan.currency}</span>
                  </p>
                  <p className="text-[11px] text-ink/40 dark:text-white/30 text-center">{periodLabel(plan.months, lang)}</p>
                  <p className="text-[10px] font-semibold text-ink/35 dark:text-white/25 text-center mt-0.5">
                    {t('settings.durationMonths', { n: plan.months })}
                  </p>
                  {plan.months > 1 && (
                    <p className="text-[10px] text-ink/30 dark:text-white/25 text-center mt-0.5">
                      {t('settings.perMonthEq', { n: monthlyEq(plan) })}
                    </p>
                  )}
                  <button onClick={() => checkoutPlan(plan)} disabled={checkingOut !== null}
                    className="mt-3 w-full rounded-xl py-2 text-xs font-bold text-white transition disabled:opacity-40"
                    style={{ background:'linear-gradient(135deg,#FFB84D, rgb(var(--accent-500)))', boxShadow:'0 3px 10px rgba(255,184,77,0.30)' }}>
                    {checkingOut === plan.key ? t('settings.activating') : t('settings.subscribe')}
                  </button>
                </div>
              );
            })}
          </div>
          <button onClick={() => requestPlan(plans[0]?.key)} disabled={requesting !== null}
            className="text-[11px] text-ink/35 dark:text-white/30 underline decoration-dotted underline-offset-2 text-center disabled:opacity-40">
            {requesting ? t('settings.requesting') : t('settings.troubleWithPayment')}
          </button>
        </div>
      )}
      <div className="rounded-2xl p-4"
        style={{ background:'rgb(var(--accent-500) / 0.06)', border:'1px solid rgb(var(--accent-500) / 0.15)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-ink dark:text-white">🎨 {themeSectionTitle}</p>
          {!status.is_premium && (
            <span className="text-[10px] font-bold rounded-full px-2 py-1"
              style={isDark
                ? { background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.45)' }
                : { background:'rgba(30,34,51,0.05)', color:'rgba(30,34,51,0.35)' }}>
              {themeLockedNote}
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {THEME_PRESETS.map((p) => {
            const active = accent === p.key;
            const locked = !status.is_premium;
            return (
              <button
                key={p.key}
                onClick={() => changeTheme(p.key)}
                disabled={locked || themeBusy}
                title={locked ? themeLockedNote : p.label}
                className="flex flex-col items-center gap-1.5 rounded-2xl py-2.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={active ? { background:'rgb(var(--accent-500) / 0.10)', border:'1px solid rgb(var(--accent-500) / 0.30)' } : { border:'1px solid transparent' }}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: p.swatch, boxShadow: active ? '0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px rgb(var(--accent-500) / 0.4)' : '0 2px 6px rgba(0,0,0,0.15)' }}
                >
                  {active && <Check size={13} className="text-white" strokeWidth={3} />}
                </span>
                <span className="text-[10px] font-semibold text-ink/60 dark:text-white/50">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-2xl p-4"
        style={{ background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.18)' }}>
        <div className="flex items-start gap-3">
          <Snowflake size={18} className="text-blue-400 shrink-0 mt-0.5"/>
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink dark:text-white">{t('settings.pauseStreak')}</p>
            <p className="text-xs text-ink/45 dark:text-white/35 mt-0.5">{t('settings.pauseDesc')}</p>
            {frozenToday ? (
              <p className="mt-2 text-xs font-bold text-blue-500">{t('settings.frozenToday')}</p>
            ) : (
              <button onClick={pause} disabled={busy || !status.is_premium}
                className="mt-2.5 rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-40"
                style={{ background:'rgba(96,165,250,0.14)', border:'1px solid rgba(96,165,250,0.30)', color:'#3B82F6' }}>
                {status.is_premium ? t('settings.freezeBtn') : t('settings.premiumOnly')}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="rounded-2xl p-4"
        style={{ background:'rgba(76,195,138,0.06)', border:'1px solid rgba(76,195,138,0.18)' }}>
        <div className="flex items-start gap-3">
          <Sparkles size={18} className="text-emerald-400 shrink-0 mt-0.5"/>
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink dark:text-white">
              {lang === 'ar' ? 'بطاقات السماح' : 'Grace passes'}
            </p>
            <p className="text-xs text-ink/45 dark:text-white/35 mt-0.5">
              {lang === 'ar'
                ? 'إذا فاتتك مهلة الـ 10 ثوانٍ بعد الإيقاف المؤقت، تنقذ بطاقة سماح شجرتك تلقائيًا بدل ما تموت.'
                : "If you miss the 10s pause window, a grace pass auto-saves your tree instead of letting it die."}
            </p>
            {status.is_premium ? (
              <p className="mt-2 text-xs font-bold text-emerald-500">
                {gracePasses
                  ? (lang === 'ar'
                      ? `${gracePasses.remaining} من ${gracePasses.total} متبقية هذا الأسبوع`
                      : `${gracePasses.remaining} of ${gracePasses.total} left this week`)
                  : (lang === 'ar' ? '...جارٍ التحميل' : 'Loading…')}
              </p>
            ) : (
              <p className="mt-2 text-xs font-bold text-ink/30 dark:text-white/25">{t('settings.premiumOnly')}</p>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {PERKS.map(p => (
          <div key={p.title} className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={isDark
              ? { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }
              : { background:'rgba(255,255,255,0.45)', border:'1px solid rgba(255,255,255,0.60)' }}>
            <span className="text-xl shrink-0">{p.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink dark:text-white">{p.title}</p>
              <p className="text-[11px] text-ink/40 dark:text-white/30">{p.desc}</p>
            </div>
            <span className="text-[10px] font-bold shrink-0 rounded-full px-2 py-1"
              style={status.is_premium
                ? { background:'rgba(76,195,138,0.12)', color:'#2DA76E' }
                : isDark
                ? { background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.35)' }
                : { background:'rgba(30,34,51,0.05)', color:'rgba(30,34,51,0.35)' }}>
              {status.is_premium ? t('settings.live') : t('settings.premiumOnly')}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-ink/30 dark:text-white/25 text-center">{t('settings.noPayment')}</p>
      <p className="flex items-center justify-center gap-2 text-[10px] text-ink/25 dark:text-white/20" dir="ltr">
        <Link to="/terms" target="_blank" className="hover:underline">Terms</Link>
        <span>·</span>
        <Link to="/privacy" target="_blank" className="hover:underline">Privacy</Link>
        <span>·</span>
        <Link to="/refund-policy" target="_blank" className="hover:underline">Refunds</Link>
      </p>
    </div>
  );
}

function FeedbackTab() {
  const { user } = useAuth();
  const toast    = useToast();
  const { t }    = useLanguage();
  const [msg,     setMsg]     = useState('');
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);
  const send = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      await api.post('/feedback', { message:msg, email:user?.email });
      setSent(true); setMsg(''); toast.success(t('settings.feedbackSent'));
      setTimeout(() => setSent(false), 3000);
    } catch (_) { toast.error('✗'); }
    finally { setSending(false); }
  };
  return (
    <div className="flex flex-col gap-4">
      <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-1 block">{t('settings.sendFeedback')}</label>
      <div className="flex items-center gap-2">
        <textarea className="input-field resize-none flex-1" rows={5}
          placeholder={t('settings.feedbackPh')}
          value={msg} onChange={e => setMsg(e.target.value)}/>
        <VoiceInputButton size="sm" onText={(c) => setMsg((v) => appendText(v, c))} />
      </div>
      <button onClick={send} disabled={!msg.trim()||sending||sent} className="btn-primary justify-center">
        {sending?t('settings.sending'):sent?t('settings.sent'):t('settings.sendFeedback')}
      </button>
      <p className="text-[11px] text-ink/30 dark:text-white/25 text-center">{t('settings.feedbackRead')}</p>
    </div>
  );
}

function DangerTab({ onClose }) {
  const { logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const toast    = useToast();
  const { t }    = useLanguage();
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
        <LogOut size={15}/> {t('settings.logout')}
      </button>
      <div className="rounded-2xl overflow-hidden" style={{ border:'1px solid rgba(239,68,68,0.20)' }}>
        <button onClick={() => setShowDelete(s=>!s)}
          className="flex items-center justify-between w-full px-5 py-4 text-sm font-semibold text-red-500 hover:bg-red-500/5 transition">
          <span className="flex items-center gap-2"><Trash2 size={15}/> {t('settings.deleteAcct')}</span>
          <ChevronRight size={15} className={`transition-transform rtl:rotate-180 ${showDelete?'rotate-90':''}`}/>
        </button>
        <AnimatePresence>
          {showDelete && (
            <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} className="overflow-hidden">
              <div className="px-5 pb-5 flex flex-col gap-3" style={{ borderTop:'1px solid rgba(239,68,68,0.15)', background:'rgba(239,68,68,0.03)' }}>
                <div className="flex items-start gap-2 mt-4">
                  <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5"/>
                  <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{t('settings.deleteWarn')}</p>
                </div>
                <p className="text-xs text-ink/50 dark:text-white/40">{t('settings.typeDelete')}</p>
                <input className="input-field" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="DELETE" autoFocus/>
                <div className="flex gap-2">
                  <button onClick={() => { setShowDelete(false); setConfirm(''); }}
                    className="flex-1 rounded-xl py-2 text-xs font-semibold text-ink/60 dark:text-white/50 bg-ink/5 dark:bg-white/5 hover:bg-ink/10 transition">
                    {t('common.cancel')}
                  </button>
                  <button onClick={handleDelete} disabled={confirm!=='DELETE'||deleting}
                    className="flex-1 rounded-xl py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition disabled:opacity-40">
                    {deleting?t('settings.deleting'):t('settings.deleteForever')}
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

function StatCard({ icon: Icon, label, value, isDark }) {
  return (
    <div className="flex-1 rounded-2xl px-4 py-3.5"
      style={isDark
        ? { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }
        : { background:'rgba(30,34,51,0.03)', border:'1px solid rgba(30,34,51,0.06)' }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className="text-lavender-500" />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark?'text-white/35':'text-ink/35'}`}>{label}</span>
      </div>
      <p className={`text-2xl font-display font-bold ${isDark?'text-white':'text-ink'}`}>{value}</p>
    </div>
  );
}

function StatsTab() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [users,       setUsers]       = useState(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showUsers,   setShowUsers]   = useState(false);
  const [errors,        setErrors]        = useState(null);
  const [errorsLoading, setErrorsLoading] = useState(true);
  const [showErrors,    setShowErrors]    = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get('/admin/stats')
      .then((d) => { if (active) setStats(d); })
      .catch((e) => { if (active) setError(e.message || 'Could not load stats'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    api.get('/admin/users')
      .then((d) => { if (active) setUsers(d.users || []); })
      .catch(() => { if (active) setUsers([]); })
      .finally(() => { if (active) setUsersLoading(false); });
    return () => { active = false; };
  }, []);

  // "Recent failures" — actual visibility into how often Lumi/anti-
  // procrastination calls fail for real users, instead of only finding
  // out if someone happens to mention it.
  useEffect(() => {
    let active = true;
    api.get('/admin/errors')
      .then((d) => { if (active) setErrors(d); })
      .catch(() => { if (active) setErrors({ last_24h: 0, last_7_days: 0, recent: [] }); })
      .finally(() => { if (active) setErrorsLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <p className={`text-sm text-center py-8 ${isDark?'text-white/35':'text-ink/35'}`}>Loading…</p>;
  if (error)   return <p className="text-sm text-center py-8 text-coral-500">{error}</p>;
  if (!stats)  return null;

  const maxDay = Math.max(1, ...stats.by_day.map((d) => d.count));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-display font-bold text-ink dark:text-white mb-1">User growth</h3>
        <p className={`text-xs ${isDark?'text-white/40':'text-ink/45'}`}>Visible only to your account.</p>
      </div>
      <div className="flex gap-3">
        <StatCard icon={Users}      label="Total users" value={stats.total_users}      isDark={isDark} />
        <StatCard icon={TrendingUp} label="New today"   value={stats.new_today}        isDark={isDark} />
      </div>
      <div className="flex gap-3">
        <StatCard icon={BarChart3} label="Last 7 days"  value={stats.new_last_7_days}  isDark={isDark} />
        <StatCard icon={BarChart3} label="Last 30 days" value={stats.new_last_30_days} isDark={isDark} />
      </div>
      {stats.by_day.length > 0 && (
        <div className="rounded-2xl px-4 py-3.5"
          style={isDark
            ? { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }
            : { background:'rgba(30,34,51,0.03)', border:'1px solid rgba(30,34,51,0.06)' }}>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-2.5 ${isDark?'text-white/35':'text-ink/35'}`}>
            Signups — last 30 days
          </p>
          <div className="flex items-end gap-1 h-16">
            {stats.by_day.map((d) => (
              <div key={d.day} className="flex-1 min-w-[3px] rounded-t-sm bg-gradient-to-t from-lavender-600 to-lavender-400"
                style={{ height: `${Math.max(6, (d.count / maxDay) * 100)}%` }}
                title={`${d.day}: ${d.count}`} />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden"
        style={isDark
          ? { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }
          : { background:'rgba(30,34,51,0.03)', border:'1px solid rgba(30,34,51,0.06)' }}>
        <button onClick={() => setShowUsers((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-3.5">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark?'text-white/35':'text-ink/35'}`}>
            All users {users ? `(${users.length})` : ''}
          </span>
          <ChevronRight size={14} className={`transition-transform ${isDark?'text-white/35':'text-ink/35'} ${showUsers ? 'rotate-90' : ''}`} />
        </button>
        {showUsers && (
          <div className="px-4 pb-3.5 flex flex-col gap-1.5 max-h-64 overflow-y-auto">
            {usersLoading ? (
              <p className={`text-xs text-center py-4 ${isDark?'text-white/35':'text-ink/35'}`}>Loading…</p>
            ) : !users?.length ? (
              <p className={`text-xs text-center py-4 ${isDark?'text-white/35':'text-ink/35'}`}>No users yet.</p>
            ) : users.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 py-1.5"
                style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(30,34,51,0.05)' }}>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold truncate ${isDark?'text-white':'text-ink'}`}>{u.name || '—'}</p>
                  <p className={`text-[11px] truncate ${isDark?'text-white/40':'text-ink/45'}`}>{u.email}</p>
                </div>
                <p className={`text-[10px] shrink-0 ${isDark?'text-white/30':'text-ink/35'}`}>
                  {u.created_at ? String(u.created_at).slice(0, 10) : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display font-bold text-ink dark:text-white mb-1">Recent failures</h3>
        <p className={`text-xs ${isDark?'text-white/40':'text-ink/45'}`}>Lumi chat and anti-procrastination call failures.</p>
      </div>
      {!errorsLoading && errors && (
        <div className="flex gap-3">
          <StatCard icon={AlertTriangle} label="Last 24h"   value={errors.last_24h}    isDark={isDark} />
          <StatCard icon={AlertTriangle} label="Last 7 days" value={errors.last_7_days} isDark={isDark} />
        </div>
      )}
      <div className="rounded-2xl overflow-hidden"
        style={isDark
          ? { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }
          : { background:'rgba(30,34,51,0.03)', border:'1px solid rgba(30,34,51,0.06)' }}>
        <button onClick={() => setShowErrors((s) => !s)}
          className="w-full flex items-center justify-between px-4 py-3.5">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark?'text-white/35':'text-ink/35'}`}>
            Recent errors {errors ? `(${errors.recent.length})` : ''}
          </span>
          <ChevronRight size={14} className={`transition-transform ${isDark?'text-white/35':'text-ink/35'} ${showErrors ? 'rotate-90' : ''}`} />
        </button>
        {showErrors && (
          <div className="px-4 pb-3.5 flex flex-col gap-1.5 max-h-64 overflow-y-auto">
            {errorsLoading ? (
              <p className={`text-xs text-center py-4 ${isDark?'text-white/35':'text-ink/35'}`}>Loading…</p>
            ) : !errors?.recent?.length ? (
              <p className={`text-xs text-center py-4 ${isDark?'text-white/35':'text-ink/35'}`}>No failures logged. Good sign.</p>
            ) : errors.recent.map((e) => (
              <div key={e.id} className="py-1.5"
                style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(30,34,51,0.05)' }}>
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-xs font-semibold truncate ${isDark?'text-white':'text-ink'}`}>{e.source}{e.email ? ` — ${e.email}` : ''}</p>
                  <p className={`text-[10px] shrink-0 ${isDark?'text-white/30':'text-ink/35'}`}>
                    {e.created_at ? String(e.created_at).slice(0, 16).replace('T', ' ') : ''}
                  </p>
                </div>
                <p className={`text-[11px] truncate ${isDark?'text-white/40':'text-ink/45'}`}>{e.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { key:'profile',    label:'settings.profile',    icon:User          },
  { key:'account',    label:'settings.account',    icon:Lock          },
  { key:'appearance', label:'settings.appearance', icon:Palette       },
  { key:'premium',    label:'settings.premium',    icon:Crown         },
  { key:'feedback',   label:'settings.feedback',   icon:MessageSquare },
  { key:'danger',     label:'settings.danger',     icon:Trash2        },
];
export default function SettingsModal({ open, onClose }) {
  const [tab, setTab]     = useState('profile');
  const { user }          = useAuth();
  const { resolvedTheme } = useTheme();
  const { t }             = useLanguage();
  const isDark            = resolvedTheme === 'dark';
  const closeAndReset = () => { setTab('profile'); onClose(); };
  // Was its own hand-duplicated copy of server/routes/admin.js's owner
  // allowlist — now just reads the flag the server already computes from
  // its own single source of truth (see server/lib/ownerEmails.js) and
  // returns on the user object. This is purely a UI gate (hide the tab
  // from everyone else) either way; the real protection is still the
  // server route itself checking req.user.email, so nothing sensitive
  // leaks even if someone forces this tab open.
  const isOwner = Boolean(user?.isOwner);
  const navItems = isOwner
    ? [...NAV_ITEMS.slice(0, -1), { key:'stats', label:'settings.stats', icon:BarChart3 }, NAV_ITEMS[NAV_ITEMS.length - 1]]
    : NAV_ITEMS;
  const navBg     = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(30,34,51,0.03)';
  const navBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(30,34,51,0.06)';
  const activeStyle = isDark
    ? { background:'rgb(var(--accent-500) / 0.15)', color:'rgb(var(--accent-300))' }
    : { background:'rgb(var(--accent-500) / 0.10)', color:'rgb(var(--accent-600))' };
  const inactiveClr = isDark
    ? 'text-white/45 hover:text-white/70 hover:bg-white/5'
    : 'text-ink/50 hover:text-ink/80 hover:bg-ink/5';
  return (
    <Modal open={open} onClose={closeAndReset} title={t('settings.title')} maxWidth="max-w-xl">
      <div className="flex flex-col lg:flex-row -mx-6 -mb-6 mt-2" style={{ minHeight:400 }}>
        <div
          className="flex lg:flex-col lg:w-40 shrink-0 overflow-x-auto lg:overflow-x-visible py-2 lg:py-3 px-2"
          style={{ background:navBg, borderBottom:`1px solid ${navBorder}` }}
        >
          <div className="hidden lg:flex flex-col items-center gap-2 py-4 mb-1">
            <Avatar user={user} size={44}/>
            <p className={`text-xs font-semibold text-center truncate w-full px-2 ${isDark?'text-white/50':'text-ink/60'}`}>
              {user?.name?.split(' ')[0]}
            </p>
          </div>
          <div className="flex lg:flex-col gap-1 lg:gap-0.5 flex-nowrap">
            {navItems.map(({ key, label, icon:Icon }) => (
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
                <span>{t(label)}</span>
              </button>
            ))}
          </div>
          <p className={`hidden lg:block text-[10px] text-center pb-3 mt-auto ${isDark?'text-white/15':'text-ink/20'}`}>
            © {new Date().getFullYear()} Haneen
          </p>
        </div>
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
              {tab==='stats' && isOwner && <StatsTab/>}
              {tab==='feedback'   && <FeedbackTab/>}
              {tab==='danger'     && <DangerTab onClose={closeAndReset}/>}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Modal>
  );
}