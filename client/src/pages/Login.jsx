import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth }  from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const DEMO_EMAIL    = 'demo@nuvora.app';
const DEMO_PASSWORD = 'password123';

export default function Login() {
  const [mode,            setMode]            = useState('login');
  const [showMeaning,     setShowMeaning]     = useState(false);
  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [error,           setError]           = useState('');
  const [submitting,      setSubmitting]      = useState(false);

  const { login, register } = useAuth();
  const { resolvedTheme }   = useTheme();
  const { t }               = useLanguage();
  const toast                = useToast();
  const navigate            = useNavigate();
  const location            = useLocation();
  const redirectTo          = location.state?.from?.pathname || '/';
  const isLogin             = mode === 'login';
  const isDark              = resolvedTheme === 'dark';

  const switchMode = () => { setMode(isLogin ? 'signup' : 'login'); setError(''); };
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

  const cardBg      = isDark ? 'rgba(255,255,255,0.08)'              : 'rgba(255,255,255,0.85)';
  const cardBorder  = isDark ? '1px solid rgba(255,255,255,0.16)'    : '1px solid rgba(255,255,255,0.95)';
  const cardShadow  = isDark ? '0 32px 80px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.20)'
                             : '0 32px 80px rgb(var(--accent-500) / 0.15), inset 0 1px 0 rgba(255,255,255,1)';
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
  const shimmer     = isDark ? 'rgba(255,255,255,0.40)'              : 'rgb(var(--accent-500) / 0.30)';
  const errorBg     = isDark ? 'rgba(255,122,99,0.12)'               : 'rgba(255,122,99,0.08)';
  const errorBorder = isDark ? 'rgba(255,122,99,0.25)'               : 'rgba(255,122,99,0.30)';
  const errorClr    = isDark ? '#FCA5A5'                             : '#ef4444';

  const inputStyle = {
    background: inputBg,
    border:     inputBorder,
    color:      inputClr,
    width:      '100%',
    borderRadius: '1rem',
    paddingBlock: '0.75rem',
    paddingInlineStart: '2.75rem',
    paddingInlineEnd:   '1rem',
    fontSize:   '0.875rem',
    outline:    'none',
  };
  const iconPos = { insetInlineStart: '0.875rem', top: '50%', transform: 'translateY(-50%)', position: 'absolute', color: iconClr };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity:0, y:28, scale:0.96 }}
        animate={{ opacity:1, y:0,   scale:1    }}
        transition={{ duration:0.55, ease:[0.16,1,0.3,1] }}
        className="relative w-full max-w-sm"
        style={{ background:cardBg, backdropFilter:'blur(40px)', WebkitBackdropFilter:'blur(40px)', border:cardBorder, borderRadius:'2rem', boxShadow:cardShadow, padding:'2.5rem 2.25rem' }}
      >
        <span className="pointer-events-none absolute inset-x-8 top-0 h-px"
          style={{ background:`linear-gradient(90deg,transparent,${shimmer},transparent)` }} />

        <div className="flex flex-col items-center mb-8">
          <motion.div
            animate={{ y:[0,-4,0] }}
            transition={{ duration:3.5, repeat:Infinity, ease:'easeInOut' }}
            className="flex h-16 w-16 items-center justify-center mb-3"
          >
            <img src="/icon-192.png" alt="Nuvora" className="h-16 w-16 drop-shadow-lg" />
          </motion.div>
          <p className="font-display text-xs font-bold tracking-[0.4em]"
            style={{ color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(30,34,51,0.55)' }}>
            NUVORA
          </p>
          {/* Every user eventually asks what the name means — this puts a
              real, correct answer where they'll actually see it once,
              instead of that falling on Haneen to explain every time.
              Collapsed by default so it doesn't add friction to signing
              in; onboarding stays untouched by this (that flow already
              needed trimming, not more content). */}
          <button type="button" onClick={() => setShowMeaning((s) => !s)}
            className="mt-1.5 text-[11px] font-medium transition underline decoration-dotted underline-offset-2"
            style={{ color: linkClr }}>
            {t('login.whatItMeans')}
          </button>
          <AnimatePresence>
            {showMeaning && (
              <motion.p
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.25 }}
                className="text-xs leading-relaxed text-center overflow-hidden"
                style={{ color: subClr }}
              >
                {t('login.nameMeaning')}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center mb-7">
          <AnimatePresence mode="wait">
            <motion.h1 key={mode}
              initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
              transition={{ duration:0.2 }}
              style={{ fontFamily:'var(--font-display)', fontSize:'1.4rem', fontWeight:700, color:titleClr }}
            >
              {isLogin ? t('login.welcomeBack') : t('login.createAcct')}
            </motion.h1>
          </AnimatePresence>
          <p className="text-sm mt-1.5" style={{ color:subClr }}>
            {isLogin ? t('login.pickUp') : t('login.startBrain')}
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
            {!isLogin && (
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
                style={{ insetInlineEnd:'0.875rem', color:iconClr }}>
                {showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {!isLogin && (
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

          {isLogin && (
            <Link to="/forgot-password" className="self-end text-xs transition -mt-1"
              style={{ color:linkClr }}>
              {t('login.forgotPw')}
            </Link>
          )}

          <motion.button type="submit" disabled={submitting} whileTap={{ scale:0.98 }}
            className="mt-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white disabled:opacity-55 disabled:pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-500)) 50%, rgb(var(--accent-600)) 100%)',
              boxShadow:  '0 8px 28px rgb(var(--accent-500) / 0.50), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}>
            {submitting ? <Loader2 size={16} className="animate-spin"/> : isLogin ? t('login.signIn') : t('login.createAcct')}
          </motion.button>
        </form>

        <button onClick={fillDemo} type="button"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[11px] font-medium transition"
          style={{ background:demoBg, border:demoBorder, color:demoClr }}>
          <Sparkles size={11}/> {t('login.demo')}
        </button>

        <p className="text-center text-xs mt-5" style={{ color:switchClr }}>
          {isLogin ? t('login.newTo') : t('login.already')}
          <button type="button" onClick={switchMode} className="font-bold transition" style={{ color:switchBold }}>
            {isLogin ? t('login.signUp') : t('login.logIn')}
          </button>
        </p>

        <span className="pointer-events-none absolute inset-x-8 bottom-0 h-px"
          style={{ background:`linear-gradient(90deg,transparent,${shimmer},transparent)` }} />
      </motion.div>

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