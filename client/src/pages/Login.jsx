import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth }  from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const DEMO_EMAIL    = 'demo@nuvora.app';
const DEMO_PASSWORD = 'password123';

export default function Login() {
  const [mode,            setMode]            = useState('login');
  // What's actually rendered — swaps while the block is off-screen as a
  // small circle, so content never visibly snaps underneath a half-open
  // card. See the effect below for the full sequence.
  const [displayMode,     setDisplayMode]      = useState('login');
  const [isMorphing,      setIsMorphing]       = useState(false);
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
  const isLogin             = mode === 'login';        // real mode — drives actual submit logic
  const isDisplayLogin      = displayMode === 'login';  // what's currently on screen
  const isDark              = resolvedTheme === 'dark';

  const cardControls    = useAnimationControls();
  const contentControls = useAnimationControls();
  const firstRun         = useRef(true);

  // The whole login block rolls off to one side as a shrinking circle,
  // swaps what's inside while it's off-screen, then rolls back in from
  // the other side and unfolds into a rectangle again — left/right,
  // not an in-place spin. Plain `x` translation on purpose, not a 3D
  // rotateY flip: this card sits on top of a backdrop-blur layer, and
  // Safari silently flattens 3D transforms on anything that also
  // blurs behind itself (same constraint noted on the onboarding
  // card's page-turn) — a 2D slide sidesteps that entirely.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    let cancelled = false;
    const dir = mode === 'signup' ? 1 : -1; // forward (→ signup) exits left/enters right; back exits right/enters left
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

  // Card body (the white/glass form panel under the colored hero) —
  // still theme-aware like before.
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

  // Hero strip sits on a solid accent gradient regardless of site theme
  // (same reasoning as CVExportModal's "always light" surfaces) — it's
  // never the page background, so it needs its own fixed, legible set.
  const heroTitleClr = 'rgba(255,255,255,0.95)';
  const heroSubClr   = 'rgba(255,255,255,0.72)';

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
  // uses (so it reads as Nuvora, not a generic template) plus one warm
  // highlight for depth. Decorative only — never intercepts clicks.
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

      <motion.div
        initial={{ opacity:0, y:28, scale:0.96 }}
        animate={{ opacity:1, y:0,   scale:1    }}
        transition={{ duration:0.55, ease:[0.16,1,0.3,1] }}
        className="relative w-full max-w-sm"
      >
        {/* Morph layer — the piece that becomes a circle and rolls
            side to side. Kept separate from the entrance animation
            above (which only ever plays once, on mount) so the two
            don't fight over the same transform. */}
        <motion.div
          initial={{ borderRadius: '1.75rem', scale: 1, x: '0%' }}
          animate={cardControls}
          className="relative overflow-hidden"
          style={{ boxShadow: cardShadow }}
        >
          <motion.div animate={contentControls}>
            {/* ── Hero strip — colored block carrying the identity
                 (icon, wordmark, the name's meaning), curved white
                 form panel rises up over its square bottom edge. This
                 two-tone split is the actual design change: not a
                 uniform card anymore. ─────────────────────────────── */}
            <div className="relative overflow-hidden px-8 pt-9 pb-14"
              style={{ background: 'linear-gradient(135deg, rgb(var(--accent-400)) 0%, rgb(var(--accent-500)) 55%, rgb(var(--accent-700)) 100%)' }}>
              <div className="pointer-events-none absolute -top-10 -right-12 h-36 w-36 rounded-full"
                style={{ background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.30), transparent 70%)' }} />
              <div className="pointer-events-none absolute -bottom-16 -left-10 h-28 w-28 rounded-full"
                style={{ background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.16), transparent 70%)' }} />

              <div className="relative z-10 flex flex-col items-center text-center">
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

                {/* The nova moment, staged instead of just stated: the dot
                    flares into light the instant you ask, and the answer
                    itself sweeps in left-to-right like light crossing
                    dark — the meaning demonstrated, not just described. */}
                <button type="button" onClick={() => setShowMeaning((s) => !s)}
                  className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium transition">
                  <span className="relative flex h-2.5 w-2.5 items-center justify-center shrink-0">
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      style={{ background: 'white' }}
                      animate={showMeaning ? { scale: [1, 2.8, 1], opacity: [0.95, 0, 0] } : { scale: 1, opacity: 0 }}
                      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                    />
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: 'white',
                        opacity: showMeaning ? 1 : 0.55,
                        boxShadow: showMeaning ? '0 0 10px 2px rgba(255,255,255,0.8)' : 'none',
                      }}
                      animate={{ scale: showMeaning ? 1.2 : 1 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </span>
                  <span className="underline decoration-dotted underline-offset-2" style={{ color: heroSubClr }}>
                    {t('login.whatItMeans')}
                  </span>
                </button>
                <AnimatePresence>
                  {showMeaning && (
                    <motion.p
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 10 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ duration: 0.25 }}
                      className="text-center overflow-hidden px-1"
                      style={{ color: heroSubClr }}
                    >
                      {/* Display font (Outfit — same as headings), not
                          italic: Outfit isn't loaded with a true italic
                          face here, so forcing one just fakes a slant
                          on a geometric sans, which reads worse, not
                          more "beautiful." A touch bigger, lighter
                          weight, and more line-height instead — reads
                          like a line worth pausing on rather than
                          another line of body copy. */}
                      <motion.span
                        initial={{ clipPath: 'inset(0 100% 0 0)' }}
                        animate={{ clipPath: 'inset(0 0% 0 0)' }}
                        transition={{ duration: 0.9, delay: 0.15, ease: [0.65, 0, 0.35, 1] }}
                        className="block font-display font-normal text-[13px] leading-[1.6] tracking-wide"
                      >
                        {t('login.nameMeaning')}
                      </motion.span>
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ── Form panel — rises up over the hero's square bottom
                 edge via the negative margin + top radius. ─────────── */}
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
