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

// A handful of comets that streak across the whole page on their own
// loop, independent delays/repeatDelays so they never sync up into an
// obvious pattern. Page-level (not scoped to Welcome) so the cosmic feel
// carries through onto the form stage too, just at low frequency —
// something to catch out of the corner of your eye, not a light show.
const SHOOTING_STARS = [
  { top: '12%', angle: -22, length: 130, delay: 0.6,  repeatDelay: 9  },
  { top: '58%', angle: -16, length: 100, delay: 4.5,  repeatDelay: 13 },
  { top: '78%', angle: -26, length: 150, delay: 9.2,  repeatDelay: 11 },
];

function ShootingStars() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
      {SHOOTING_STARS.map((s, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            top: s.top, left: '-15%', width: s.length, height: 1.5,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)',
            filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.85))',
            transform: `rotate(${s.angle}deg)`,
          }}
          animate={{ x: ['0vw', '135vw'], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: s.repeatDelay, delay: s.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
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
// Scattered twinkling points behind the wordmark/buddy — fixed positions
// (not randomized per render, so nothing jumps on re-render) with staggered
// fade loops, standing in for the "starfield" feel of the reference image
// without needing any image assets.
const SPARKLES = [
  { top: '2%',  left: '8%',  size: 3, delay: 0.0 },
  { top: '14%', left: '88%', size: 2, delay: 0.7 },
  { top: '30%', left: '2%',  size: 2, delay: 1.4 },
  { top: '46%', left: '94%', size: 3, delay: 0.35 },
  { top: '62%', left: '4%',  size: 2, delay: 1.9 },
  { top: '80%', left: '90%', size: 2, delay: 0.55 },
  { top: '4%',  left: '48%', size: 2, delay: 2.2 },
  { top: '92%', left: '55%', size: 2, delay: 1.1 },
  { top: '54%', left: '14%', size: 2, delay: 2.6 },
];

function WelcomeStage({ onPick, t, parallax = { x: 0, y: 0 } }) {
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
      {/* nova ignition — a single bright point flashes and rips outward
          the instant Welcome mounts, right under the halo it settles
          into. Literal callback to the brand's own explanation a few
          lines below ("a star, at its dimmest, suddenly flares into the
          brightest light it has ever held") instead of just a fade-in. */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-[38%] -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
        style={{ width: 30, height: 30 }}
        initial={{ opacity: 0.95, scale: 0.4 }}
        animate={{ opacity: 0, scale: 16 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* big soft breathing halo centered behind the wordmark + buddy —
          the "glowing orb" feel from the reference, sized to the whole
          hero rather than just buddy's own small aura. Drifts slightly
          with the pointer for a layered, depth-y feel. */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-[38%] -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 340, height: 340,
          background: 'radial-gradient(circle, rgb(var(--accent-400) / 0.5) 0%, rgb(var(--accent-600) / 0.28) 45%, transparent 72%)',
          filter: 'blur(50px)',
          x: parallax.x * 10, y: parallax.y * 10,
        }}
        animate={{ opacity: [0.55, 0.9, 0.55], scale: [0.92, 1.05, 0.92] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* twinkling starfield — drifts a touch less than the halo, so the
          two layers separate instead of moving as one flat plane */}
      {SPARKLES.map((s, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute -z-10 rounded-full bg-white"
          style={{
            top: s.top, left: s.left, width: s.size, height: s.size,
            boxShadow: '0 0 6px 1px rgba(255,255,255,0.7)',
            x: parallax.x * 5, y: parallax.y * 5,
          }}
          animate={{ opacity: [0.15, 0.9, 0.15], scale: [0.8, 1.3, 0.8] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: s.delay }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.4rem]"
        style={{
          background: 'linear-gradient(135deg, rgb(var(--accent-400) / 0.22) 0%, rgb(var(--accent-600) / 0.14) 100%)',
          border: '1px solid rgb(var(--accent-400) / 0.30)',
          boxShadow: '0 10px 30px rgb(var(--accent-500) / 0.25), inset 0 1px 0 rgba(255,255,255,0.25)',
        }}
      >
        <img src="/icon-192.png" alt="Nuvora" className="h-10 w-10 drop-shadow-lg" />
      </motion.div>

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

// Mirrors the server's rule in server/lib/auth.js (validatePassword) so the
// bar never tells someone their password is "Strong" right before the
// server rejects it for missing a character class. 4 checks, 1 point each.
function getPasswordStrength(password) {
  if (!password) return { score: 0, ratio: 0 };
  const checks = [
    password.length >= 8,
    /[a-zA-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  return { score, ratio: score / checks.length };
}

const STRENGTH_META = [
  { labelKey: 'login.pwStrengthWeak',   color: '#ef4444' }, // 0-1
  { labelKey: 'login.pwStrengthWeak',   color: '#ef4444' },
  { labelKey: 'login.pwStrengthFair',   color: '#f59e0b' },
  { labelKey: 'login.pwStrengthGood',   color: '#eab308' },
  { labelKey: 'login.pwStrengthStrong', color: '#22c55e' },
];

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
  const { t, lang }         = useLanguage();
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

  // Subtle pointer-driven depth — background blobs drift a bit more than
  // the halo/starfield they sit behind, so the page reads as layered
  // instead of flat when you move the mouse. Plain state (not a motion
  // value) is fine here: this only updates on mousemove over a login
  // page, not a hot render path.
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const handlePointerMove = (e) => {
    const nx = (e.clientX / window.innerWidth  - 0.5) * 2;
    const ny = (e.clientY / window.innerHeight - 0.5) * 2;
    setParallax({ x: nx, y: ny });
  };

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
    if (!isLogin && getPasswordStrength(password).score < 4) { setError(t('login.pwRequirements')); return; }
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
  //
  // Has to retry on BOTH conditions — the script loading AND the ref
  // actually existing — not just the script. The Welcome→Form switch
  // above uses <AnimatePresence mode="wait">, which keeps Welcome
  // mounted for its ~0.4s exit animation before the form (and this
  // ref's div) mounts at all. This effect fires the instant `stage`
  // flips to 'form', which is *before* that div exists, so the old
  // version's one-shot `if (googleBtnRef.current)` check silently no-op'd
  // and never got another chance — the button was configured correctly
  // the whole time, it just always tried to render into a ref that
  // wasn't there yet.
  useEffect(() => {
    if (stage !== 'form' || !GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    const hl = lang === 'ar' ? 'ar' : 'en';

    // Loads (or re-loads) the GIS script with an explicit ?hl= locale.
    // Without this, Google infers the button's language/direction from
    // the browser's own Accept-Language header — which can silently
    // disagree with `lang` (the language the rest of the UI is actually
    // showing right now), producing a button in a different language
    // than the form around it. Re-injecting with the current `hl` keeps
    // it in sync if the person switches the app's language later too.
    const ensureScript = () => new Promise((resolve) => {
      const existing = document.getElementById('google-gsi-script');
      if (existing && existing.dataset.hl === hl) { resolve(); return; }
      if (existing) existing.remove();
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = `https://accounts.google.com/gsi/client?hl=${hl}`;
      script.async = true;
      script.defer = true;
      script.dataset.hl = hl;
      script.onload = resolve;
      document.head.appendChild(script);
    });

    const tryInit = async () => {
      if (cancelled) return;
      await ensureScript();
      if (cancelled) return;
      if (!window.google?.accounts?.id || !googleBtnRef.current) { setTimeout(tryInit, 150); return; }
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
      googleBtnRef.current.innerHTML = '';
      // Icon-only circle instead of the full text pill: in browsers that
      // block third-party storage (Safari's default, and Private
      // Browsing everywhere), GIS can't read/write its own session
      // cookie, so it silently drops the "standard" pill down to just
      // the bare G mark anyway — we were relying on an accidental
      // fallback instead of a deliberate one. Configuring it as 'icon'
      // + 'circle' outright makes that the actual design everywhere,
      // not just what shows up when Google's personalization fails.
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'icon', shape: 'circle', theme: isDark ? 'filled_black' : 'outline',
        size: 'medium',
      });
    };
    tryInit();
    return () => { cancelled = true; };
  }, [stage, isDark, lang]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <motion.div className="absolute -top-28 -left-20 h-80 w-80 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle at 35% 30%, rgb(var(--accent-300) / 0.55), rgb(var(--accent-600) / 0.35) 60%, transparent 75%)' }}
        animate={{ x: parallax.x * 16, y: parallax.y * 16 }} transition={{ type: 'spring', stiffness: 40, damping: 20 }} />
      <motion.div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle at 40% 35%, rgb(var(--accent-400) / 0.45), rgb(var(--accent-700) / 0.30) 60%, transparent 75%)' }}
        animate={{ x: parallax.x * -20, y: parallax.y * -20 }} transition={{ type: 'spring', stiffness: 40, damping: 20 }} />
      <motion.div className="absolute top-[10%] right-[10%] h-28 w-28 rounded-full blur-2xl opacity-60"
        style={{ background: 'radial-gradient(circle at 40% 30%, #FFD98A, rgb(var(--accent-500) / 0.4) 70%, transparent 80%)' }}
        animate={{ x: parallax.x * 24, y: parallax.y * 24 }} transition={{ type: 'spring', stiffness: 40, damping: 20 }} />
    </div>
  );

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center px-4 py-10 overflow-hidden"
      onMouseMove={handlePointerMove}
    >
      {bgBlobs}
      <ShootingStars />

      <AnimatePresence mode="wait">
        {stage === 'welcome' ? (
          <WelcomeStage key="welcome" onPick={enterForm} t={t} parallax={parallax} />
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
                      {!isDisplayLogin && password && (() => {
                        const { score, ratio } = getPasswordStrength(password);
                        const meta = STRENGTH_META[score];
                        return (
                          <div className="mt-1.5">
                            <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(120,120,120,0.25)' }}>
                              <div className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${ratio * 100}%`, background: meta.color }} />
                            </div>
                            <p className="mt-1 text-[11px]" style={{ color: meta.color }}>
                              {t(meta.labelKey)} — {t('login.pwRequirements')}
                            </p>
                          </div>
                        );
                      })()}
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
                    // Stacking the circle above its caption made it its
                    // own small island — noticeably narrower than the
                    // full-width "Sign in" pill above and "demo" pill
                    // below, so it read as a stray leftover between two
                    // rectangles instead of a row that belongs there. A
                    // single horizontal line (badge + label side by side)
                    // sits at the same visual height as a normal row of
                    // text, so it reads as "one line in the stack" instead
                    // of "one small shape floating between two bars."
                    <div className="flex items-center justify-center gap-2.5">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: isDark ? 'rgba(255,255,255,0.06)' : 'white',
                          border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(30,34,51,0.10)',
                          boxShadow: isDark
                            ? `0 2px 10px rgba(0,0,0,0.35), 0 0 0 1px rgb(var(--accent-500) / 0.10)`
                            : `0 2px 8px rgba(30,34,51,0.08)`,
                        }}
                      >
                        <div ref={googleBtnRef} className="flex items-center justify-center" />
                      </div>
                      <span className="text-[13px] font-medium" style={{ color: subClr }}>{t('login.continueGoogle')}</span>
                    </div>
                  ) : (
                    <button type="button"
                      onClick={() => toast.error(t('login.googleNotConfigured'))}
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
