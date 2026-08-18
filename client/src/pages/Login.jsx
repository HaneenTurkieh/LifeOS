import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, Sparkles, ChevronLeft } from 'lucide-react';
import { useAuth }  from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import NuvoraBuddy  from '../components/NuvoraBuddy.jsx';

const DEMO_EMAIL       = 'demo@nuvora.app';
const DEMO_PASSWORD    = 'password123';
// Public Client ID, not a secret — safe to ship in the bundle. Blank until
// a real one is set (see client/.env.example): the Google button quietly
// stays off instead of rendering something broken.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// lucide-react doesn't ship brand logos — small inline multicolor "G" mark,
// the standard Google asset shape.
function GoogleG({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.4-8 19.4-19.5 0-1.4-.1-2.4-.4-4z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.6 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6 29.6 4 24 4 16 4 9 8.5 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.4 0 10.4-2 14.1-5.4l-6.5-5.4C29.4 34.9 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9 39.5 16 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.5 5.4C41.4 36 44 30.6 44 24c0-1.4-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

// ── Welcome stage ─────────────────────────────────────────────
// The actual first thing anyone sees now — not a one-time overlay gated
// behind localStorage (that was the bug: it only ever played once per
// browser, so it could never wave again after the first visit). This is
// a real page stage, shown fresh every time /login mounts: wordmark
// glows in, buddy waves in after it, the "what it means" brief is right
// here where a first impression actually happens, then two clear paths
// forward — Log in / Sign up — same two options moimoi's reference
// leads with, just carrying Nuvora's own identity instead.
function WelcomeStage({ onPick, t }) {
  const letters = 'NUVORA'.split('');
  const letterStagger = 0.09;
  const taglineDelay  = 0.15 + letters.length * letterStagger + 0.3;
  const buddyDelay    = taglineDelay + 0.45;
  const ctaDelay      = buddyDelay + 0.7;
  const [showBuddy, setShowBuddy] = useState(false);
  const [showMeaning, setShowMeaning] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowBuddy(true), buddyDelay * 1000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.4 }}
      className="relative w-full max-w-sm flex flex-col items-center text-center"
    >
      <div className="flex">
        {letters.map((ch, i) => (
          <motion.span key={i}
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.15 + i * letterStagger, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-4xl sm:text-5xl font-bold tracking-[0.15em]"
            style={{ color: 'rgb(var(--accent-500))', textShadow: '0 0 34px rgb(var(--accent-400) / 0.35)' }}
          >
            {ch}
          </motion.span>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: taglineDelay, duration: 0.6 }}
        className="mt-3 text-xs sm:text-sm tracking-[0.2em] uppercase text-ink/45 dark:text-white/40"
      >
        {t('login.introTagline')}
      </motion.p>

      <AnimatePresence>
        {showBuddy && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, type: 'spring', stiffness: 220, damping: 16 }}
            className="mt-6"
          >
            <NuvoraBuddy size={92} wave title={t('login.introTagline')} />
          </motion.div>
        )}
      </AnimatePresence>

      <button type="button" onClick={() => setShowMeaning((s) => !s)}
        className="mt-6 text-[11px] font-medium underline decoration-dotted underline-offset-2 text-ink/50 dark:text-white/45">
        {t('login.whatItMeans')}
      </button>
      <AnimatePresence>
        {showMeaning && (
          <motion.p
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden px-2 font-display font-normal text-[13px] leading-[1.6] tracking-wide text-ink/65 dark:text-white/55"
          >
            {t('login.nameMeaning')}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: ctaDelay, duration: 0.5 }}
        className="mt-9 flex flex-col gap-2.5 w-full"
      >
        <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => onPick('login')}
          className="rounded-full py-3.5 text-sm font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-500)) 50%, rgb(var(--accent-600)) 100%)',
            boxShadow:  '0 8px 28px rgb(var(--accent-500) / 0.45)',
          }}>
          {t('login.signIn')}
        </motion.button>
        <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => onPick('signup')}
          className="rounded-full py-3.5 text-sm font-bold"
          style={{ background: 'rgb(var(--accent-500) / 0.10)', border: '1px solid rgb(var(--accent-500) / 0.25)', color: 'rgb(var(--accent-600))' }}>
          {t('login.signUp')}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

export default function Login() {
  // 'welcome' shows first on every visit; picking Log in / Sign up moves
  // to 'form'. Two different stages, not to be confused with `mode`
  // below (login vs signup — only meaningful once inside 'form').
  const [stage,           setStage]           = useState('welcome');
  const [mode,            setMode]            = useState('login');
  // What's actually rendered — swaps while the block is off-screen as a
  // small circle, so content never visibly snaps underneath a half-open
  // card. See the effect below for the full sequence.
  const [displayMode,     setDisplayMode]      = useState('login');
  const [isMorphing,      setIsMorphing]       = useState(false);
  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [error,           setError]           = useState('');
  const [submitting,      setSubmitting]      = useState(false);

  const { login, register, loginWithGoogle } = useAuth();
  const { resolvedTheme }   = useTheme();
  const { t }               = useLanguage();
  const toast                = useToast();
  const navigate            = useNavigate();
  const location            = useLocation();
  const redirectTo          = location.state?.from?.pathname || '/';
  const isLogin             = mode === 'login';        // real mode — drives actual submit logic
  const isDisplayLogin      = displayMode === 'login';  // what's currently on screen
  const isDark              = resolvedTheme === 'dark';

  const cardControls    = useAnimationControls();
  const contentControls = useAnimationControls();
  const firstRun         = useRef(true);
  const googleBtnRef     = useRef(null);

  // Leaving Welcome for a specific form — sets mode/displayMode directly
  // instead of going through the morph effect below (the card isn't even
  // visible yet, there's nothing to roll). firstRun=true makes the effect
  // treat this as its initial mount and skip the animation, exactly like
  // it already does on the component's real first render.
  const enterForm = (selectedMode) => {
    firstRun.current = true;
    setDisplayMode(selectedMode);
    setMode(selectedMode);
    setError('');
    setStage('form');
  };
  const backToWelcome = () => { if (isMorphing) return; setStage('welcome'); };

  // The whole login block rolls off to one side as a shrinking circle,
  // then swaps what's inside while it's off-screen, then rolls back in
  // from the other side and unfolds into a rectangle again — left/right,
  // not an in-place spin. Plain `x` translation on purpose, not a 3D
  // rotateY flip: this card sits on top of a backdrop-blur layer, and
  // Safari silently flattens 3D transforms on anything that also blurs
  // behind itself — a 2D slide sidesteps that entirely. Only runs for
  // swaps that happen *within* the form stage (Log in ↔ Sign up link at
  // the bottom) — entries from Welcome are skipped via firstRun above.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    let cancelled = false;
    const dir = mode === 'signup' ? 1 : -1;
    setIsMorphing(true);
    (async () => {
      contentControls.start({ opacity: 0, transition: { duration: 0.2 } });
      await cardControls.start({
        x: dir > 0 ? '-125%' : '125%',
        scale: 0.55,
        borderRadius: '50%',
        transition: { duration: 0.4, ease: [0.65, 0, 0.35, 1] },
      });
      if (cancelled) return;
      setDisplayMode(mode);
      cardControls.set({ x: dir > 0 ? '125%' : '-125%', scale: 0.55, borderRadius: '50%' });
      await cardControls.start({
        x: '0%',
        scale: 1,
        borderRadius: '1.75rem',
        transition: { duration: 0.42, ease: [0.65, 0, 0.35, 1] },
      });
      contentControls.start({ opacity: 1, transition: { duration: 0.25 } });
      if (!cancelled) setIsMorphing(false);
    })();
    return () => { cancelled = true; };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = () => { if (isMorphing) return; setMode(isLogin ? 'signup' : 'login'); setError(''); };
  const fillDemo   = () => { setMode('login'); setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (!isLogin && password !== confirmPassword) { setError(t('login.pwMismatch')); return; }
    setSubmitting(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        const newUser = await register(name.trim(), email.trim(), password);
        if (newUser?.welcomeXp) toast.success(t('login.welcomeXp', { n: newUser.welcomeXp }));
      }
      navigate(redirectTo, { replace: true });
    } catch (err) { setError(err.message || t('login.wentWrong')); }
    finally { setSubmitting(false); }
  };

  const handleGoogleCredential = async (response) => {
    if (!response?.credential) return;
    setError('');
    setSubmitting(true);
    try {
      const u = await loginWithGoogle(response.credential);
      if (u?.welcomeXp) toast.success(t('login.welcomeXp', { n: u.welcomeXp }));
      navigate(redirectTo, { replace: true });
    } catch (err) { setError(err.message || t('login.wentWrong')); }
    finally { setSubmitting(false); }
  };

  // Renders Google's real button (verified, functional) into our own
  // container once the GIS script and a Client ID are both available.
  // Re-runs on stage/isDark so it (re)renders correctly whenever the form
  // stage mounts and matches the current theme.
  useEffect(() => {
    if (stage !== 'form' || !GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    const tryInit = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id) { setTimeout(tryInit, 250); return; }
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
      if (googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard', shape: 'pill', theme: isDark ? 'filled_black' : 'outline',
          size: 'large', text: 'continue_with', width: 288,
        });
      }
    };
    tryInit();
    return () => { cancelled = true; };
  }, [stage, isDark]); // eslint-disable-line react-hooks/exhaustive-deps

  // Card body (the white/glass form panel under the colored hero).
  const cardBg      = isDark ? 'rgba(255,255,255,0.08)'              : 'rgba(255,255,255,0.92)';
  const cardBorder  = isDark ? '1px solid rgba(255,255,255,0.16)'    : '1px solid rgba(255,255,255,0.95)';
  const cardShadow  = isDark ? '0 32px 80px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.20)'
                             : '0 32px 80px rgb(var(--accent-500) / 0.18), inset 0 1px 0 rgba(255,255,255,1)';
  const titleClr    = isDark ? 'white'                               : '#1a1430';
  const subClr      = isDark ? 'rgba(255,255,255,0.42)'              : 'rgba(30,34,51,0.50)';
  const labelClr    = isDark ? 'rgba(255,255,255,0.52)'              : 'rgba(30,34,51,0.58)';
  const inputBg     = isDark ? 'rgba(255,255,255,0.06)'              : 'rgba(30,34,51,0.05)';
  const inputBorder = isDark ? '1px solid rgba(255,255,255,0.14)'    : '1px solid rgba(30,34,51,0.14)';
  const inputClr    = isDark ? 'white'                               : '#1a1430';
  const iconClr     = isDark ? 'rgba(255,255,255,0.30)'              : 'rgba(30,34,51,0.35)';
  const linkClr     = isDark ? 'rgba(255,255,255,0.40)'              : 'rgba(30,34,51,0.45)';
  const switchClr   = isDark ? 'rgba(255,255,255,0.42)'              : 'rgba(30,34,51,0.50)';
  const switchBold  = isDark ? 'rgba(255,255,255,0.85)'              : '#1a1430';
  const demoBg      = isDark ? 'rgba(255,255,255,0.04)'              : 'rgba(30,34,51,0.04)';
  const demoBorder  = isDark ? '1px solid rgba(255,255,255,0.09)'    : '1px solid rgba(30,34,51,0.10)';
  const demoClr     = isDark ? 'rgba(255,255,255,0.35)'              : 'rgba(30,34,51,0.40)';
  const errorBg     = isDark ? 'rgba(255,122,99,0.12)'               : 'rgba(255,122,99,0.08)';
  const errorBorder = isDark ? 'rgba(255,122,99,0.25)'               : 'rgba(255,122,99,0.30)';
  const errorClr    = isDark ? '#FCA5A5'                             : '#ef4444';
  const dividerClr  = isDark ? 'rgba(255,255,255,0.10)'              : 'rgba(30,34,51,0.10)';

  // Hero strip sits on a solid accent gradient regardless of site theme —
  // it's never the page background, so it needs its own fixed, legible set.
  const heroTitleClr = 'rgba(255,255,255,0.95)';

  const inputStyle = {
    background: inputBg,
    border:     inputBorder,
    color:      inputClr,
    width:      '100%',
    borderRadius: '999px', // pill fields, closer to the reference style
    paddingBlock: '0.75rem',
    paddingInlineStart: '2.75rem',
    paddingInlineEnd:   '1rem',
    fontSize:   '0.875rem',
    outline:    'none',
  };
  const iconPos = { insetInlineStart: '1rem', top: '50%', transform: 'translateY(-50%)', position: 'absolute', color: iconClr };

  // Ambient glossy blobs behind the card — soft blurred accent-color
  // circles standing in for the reference images' rendered 3D spheres,
  // built from the same --accent-* tokens the rest of the app already
  // uses, plus one warm highlight for depth. Decorative only.
  const bgBlobs = (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-28 -left-20 h-80 w-80 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle at 35% 30%, rgb(var(--accent-300) / 0.55), rgb(var(--accent-600) / 0.35) 60%, transparent 75%)' }} />
      <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle at 40% 35%, rgb(var(--accent-400) / 0.45), rgb(var(--accent-700) / 0.30) 60%, transparent 75%)' }} />
      <div className="absolute top-[10%] right-[10%] h-28 w-28 rounded-full blur-2xl opacity-60"
        style={{ background: 'radial-gradient(circle at 40% 30%, #FFD98A, rgb(var(--accent-500) / 0.4) 70%, transparent 80%)' }} />
    </div>
  );

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-10 overflow-hidden">
      {bgBlobs}

      <AnimatePresence mode="wait">
        {stage === 'welcome' ? (
          <WelcomeStage key="welcome" onPick={enterForm} t={t} />
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-sm"
          >
            <motion.div
              initial={{ borderRadius: '1.75rem', scale: 1, x: '0%' }}
              animate={cardControls}
              className="relative overflow-hidden"
              style={{ boxShadow: cardShadow }}
            >
              <motion.div animate={contentControls}>
                {/* ── Compact hero strip — identity carries over from
                     Welcome (icon + wordmark), full meaning brief stays
                     back there so it isn't shown twice. Back button
                     returns to Welcome. ─────────────────────────────── */}
                <div className="relative overflow-hidden px-8 pt-8 pb-10"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-500)) 55%, rgb(var(--accent-700)) 100%)' }}>
                  <div className="pointer-events-none absolute -top-10 -right-12 h-36 w-36 rounded-full blur-xl"
                    style={{ background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55), rgba(255,255,255,0.06) 60%, transparent 75%)' }} />
                  <div className="pointer-events-none absolute -bottom-16 -left-10 h-28 w-28 rounded-full blur-xl"
                    style={{ background: 'radial-gradient(circle at 38% 32%, rgba(255,255,255,0.35), rgba(255,255,255,0.04) 60%, transparent 75%)' }} />
                  <div className="pointer-events-none absolute top-2 right-16 h-14 w-14 rounded-full blur-md"
                    style={{ background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.65), rgba(255,255,255,0.05) 55%, transparent 70%)' }} />

                  <button type="button" onClick={backToWelcome} disabled={isMorphing}
                    className="absolute top-4 start-4 z-10 flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.16)', color: 'white' }}
                    title={t('login.back')}>
                    <ChevronLeft size={16} className="rtl:rotate-180" />
                  </button>

                  <div className="relative z-[1] flex flex-col items-center text-center">
                    <motion.div
                      animate={{ y:[0,-4,0] }}
                      transition={{ duration:3.5, repeat:Infinity, ease:'easeInOut' }}
                      className="flex h-14 w-14 items-center justify-center mb-2.5 rounded-2xl"
                      style={{ background: 'rgba(255,255,255,0.16)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)' }}
                    >
                      <img src="/icon-192.png" alt="Nuvora" className="h-9 w-9 drop-shadow-lg" />
                    </motion.div>
                    <p className="font-display text-xs font-bold tracking-[0.4em]" style={{ color: heroTitleClr }}>
                      NUVORA
                    </p>
                  </div>
                </div>

                {/* ── Form panel ──────────────────────────────────── */}
                <div className="relative -mt-7 rounded-t-[1.75rem] px-8 pt-7 pb-8"
                  style={{ background:cardBg, backdropFilter:'blur(40px)', WebkitBackdropFilter:'blur(40px)', border:cardBorder, borderTop:'none' }}
                >
                  <div className="text-center mb-6">
                    <AnimatePresence mode="wait">
                      <motion.h1 key={displayMode}
                        initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
                        transition={{ duration:0.2 }}
                        style={{ fontFamily:'var(--font-display)', fontSize:'1.3rem', fontWeight:700, color:titleClr }}
                      >
                        {isDisplayLogin ? t('login.welcomeBack') : t('login.createAcct')}
                      </motion.h1>
                    </AnimatePresence>
                    <p className="text-sm mt-1.5" style={{ color:subClr }}>
                      {isDisplayLogin ? t('login.pickUp') : t('login.startBrain')}
                    </p>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                        className="mb-4 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs overflow-hidden"
                        style={{ background:errorBg, border:`1px solid ${errorBorder}`, color:errorClr }}>
                        <AlertCircle size={14} className="shrink-0" /> {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <AnimatePresence mode="popLayout">
                      {!isDisplayLogin && (
                        <motion.div key="name" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}>
                          <label className="text-xs font-semibold mb-1.5 block" style={{ color:labelClr }}>{t('login.fullName')}</label>
                          <div className="relative">
                            <User size={15} style={iconPos} />
                            <input type="text" required value={name} onChange={e => setName(e.target.value)}
                              placeholder={t('settings.yourName')} style={inputStyle} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div>
                      <label className="text-xs font-semibold mb-1.5 block" style={{ color:labelClr }}>{t('login.email')}</label>
                      <div className="relative">
                        <Mail size={15} style={iconPos} />
                        <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                          placeholder="you@example.com" style={inputStyle} dir="ltr" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold mb-1.5 block" style={{ color:labelClr }}>{t('login.password')}</label>
                      <div className="relative">
                        <Lock size={15} style={iconPos} />
                        <input type={showPassword ? 'text' : 'password'} required value={password}
                          onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={8}
                          style={{ ...inputStyle, paddingInlineEnd:'2.75rem' }} dir="ltr" />
                        <button type="button" onClick={() => setShowPassword(s=>!s)}
                          className="absolute top-1/2 -translate-y-1/2 transition"
                          style={{ insetInlineEnd:'1rem', color:iconClr }}>
                          {showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence mode="popLayout">
                      {!isDisplayLogin && (
                        <motion.div key="confirm" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}>
                          <label className="text-xs font-semibold mb-1.5 block" style={{ color:labelClr }}>{t('login.confirmPw')}</label>
                          <div className="relative">
                            <Lock size={15} style={iconPos} />
                            <input type={showPassword ? 'text' : 'password'} required value={confirmPassword}
                              onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" minLength={8}
                              style={inputStyle} dir="ltr" />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {isDisplayLogin && (
                      <Link to="/forgot-password" className="self-end text-xs transition -mt-1"
                        style={{ color:linkClr }}>
                        {t('login.forgotPw')}
                      </Link>
                    )}

                    <motion.button type="submit" disabled={submitting || isMorphing} whileTap={{ scale:0.98 }}
                      className="mt-1 flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-white disabled:opacity-55 disabled:pointer-events-none"
                      style={{
                        background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-500)) 50%, rgb(var(--accent-600)) 100%)',
                        boxShadow:  '0 8px 28px rgb(var(--accent-500) / 0.50), inset 0 1px 0 rgba(255,255,255,0.25)',
                      }}>
                      {submitting ? <Loader2 size={16} className="animate-spin"/> : isDisplayLogin ? t('login.signIn') : t('login.createAcct')}
                    </motion.button>
                  </form>

                  {/* ── Social — "or" divider + Continue with Google.
                       Real, verified sign-in (see AuthContext.loginWithGoogle)
                       once VITE_GOOGLE_CLIENT_ID is set; until then the
                       placeholder below explains what's missing instead of
                       pretending to work. ──────────────────────────────── */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="h-px flex-1" style={{ background: dividerClr }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: subClr }}>{t('login.or')}</span>
                    <div className="h-px flex-1" style={{ background: dividerClr }} />
                  </div>
                  {GOOGLE_CLIENT_ID ? (
                    <div ref={googleBtnRef} className="flex justify-center" />
                  ) : (
                    <button type="button"
                      onClick={() => toast.error('Add VITE_GOOGLE_CLIENT_ID (client) + GOOGLE_CLIENT_ID (server) to enable this')}
                      className="flex w-full items-center justify-center gap-2.5 rounded-full py-3 text-sm font-semibold transition"
                      style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'white', border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(30,34,51,0.14)', color: titleClr }}>
                      <GoogleG size={16} /> {t('login.continueGoogle')}
                    </button>
                  )}

                  <button onClick={fillDemo} type="button"
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full py-2.5 text-[11px] font-medium transition"
                    style={{ background:demoBg, border:demoBorder, color:demoClr }}>
                    <Sparkles size={11}/> {t('login.demo')}
                  </button>

                  <p className="text-center text-xs mt-5" style={{ color:switchClr }}>
                    {isDisplayLogin ? t('login.newTo') : t('login.already')}
                    <button type="button" onClick={switchMode} disabled={isMorphing} className="font-bold transition disabled:opacity-60" style={{ color:switchBold }}>
                      {isDisplayLogin ? t('login.signUp') : t('login.logIn')}
                    </button>
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent companion — waves on its own idle loop on every
          visit (see NuvoraBuddy), tapping it jumps back to the Welcome
          stage where the meaning brief lives. */}
      <div className="fixed bottom-16 start-4 lg:start-8 z-[60]">
        <NuvoraBuddy size={58} onClick={() => setStage('welcome')} title={t('login.whatItMeans')} />
      </div>

      {/* Legal footer — needs to be reachable without logging in (Paddle's
          domain review checks for this), and is a normal thing to have
          regardless. */}
      <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3 text-[11px] flex-wrap px-4"
        style={{ color: linkClr }} dir="ltr">
        <Link to="/pricing" className="hover:underline">Pricing</Link>
        <span>·</span>
        <Link to="/terms" className="hover:underline">Terms</Link>
        <span>·</span>
        <Link to="/privacy" className="hover:underline">Privacy</Link>
        <span>·</span>
        <Link to="/refund-policy" className="hover:underline">Refunds</Link>
      </div>
    </div>
  );
}
