import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const DEMO_EMAIL    = 'demo@aurora.app';
const DEMO_PASSWORD = 'password123';

export default function Login() {
  const [mode,            setMode]            = useState('login');
  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [error,           setError]           = useState('');
  const [submitting,      setSubmitting]      = useState(false);

  const { login, register } = useAuth();
  const navigate            = useNavigate();
  const location            = useLocation();
  const redirectTo          = location.state?.from?.pathname || '/';
  const isLogin             = mode === 'login';

  const switchMode = () => { setMode(isLogin ? 'signup' : 'login'); setError(''); };

  const fillDemo = () => { setMode('login'); setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (!isLogin && password !== confirmPassword) { setError("Passwords don't match"); return; }
    setSubmitting(true);
    try {
      isLogin
        ? await login(email.trim(), password)
        : await register(name.trim(), email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) { setError(err.message || 'Something went wrong'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 py-10">
      {/* GlobalBackground already provides the orbs — just the card here */}
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm"
        style={{
          background:           'rgba(255,255,255,0.08)',
          backdropFilter:       'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border:               '1px solid rgba(255,255,255,0.16)',
          borderRadius:         '2rem',
          boxShadow:            '0 32px 80px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.20)',
          padding:              '2.5rem 2.25rem',
        }}
      >
        {/* Inner shimmer line */}
        <span className="pointer-events-none absolute inset-x-8 top-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.40), transparent)' }} />

        {/* ── Logo ────────────────────────────────────────────── */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] text-white mb-3"
            style={{
              background: 'linear-gradient(135deg, #9B8AFF 0%, #7C6AF0 50%, #5B47E0 100%)',
              boxShadow:  '0 12px 32px rgba(124,106,240,0.55), inset 0 1px 0 rgba(255,255,255,0.30)',
              fontSize:   28,
              fontFamily: 'serif',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            ✦
          </motion.div>
          <p className="font-display text-xs font-bold tracking-[0.4em] text-white/70">AURORA</p>
        </div>

        {/* ── Heading ──────────────────────────────────────────── */}
        <div className="text-center mb-7">
          <AnimatePresence mode="wait">
            <motion.h1
              key={mode}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="font-display text-2xl font-bold text-white"
            >
              {isLogin ? 'Welcome back' : 'Create account'}
            </motion.h1>
          </AnimatePresence>
          <p className="text-sm text-white/40 mt-1.5">
            {isLogin ? 'Pick up where you left off.' : 'Start building your second brain.'}
          </p>
        </div>

        {/* ── Error ────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs text-coral-300 overflow-hidden"
              style={{ background: 'rgba(255,122,99,0.12)', border: '1px solid rgba(255,122,99,0.25)' }}
            >
              <AlertCircle size={14} className="shrink-0" /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Form ─────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <AnimatePresence mode="popLayout">
            {!isLogin && (
              <motion.div key="name"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <label className="text-xs font-semibold text-white/50 mb-1.5 block">Full name</label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input type="text" required value={name} onChange={e => setName(e.target.value)}
                    placeholder="Haneen Turkieh"
                    className="w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 outline-none transition"
                    style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)' }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="text-xs font-semibold text-white/50 mb-1.5 block">Email address</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 outline-none transition"
                style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)' }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-white/50 mb-1.5 block">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input type={showPassword ? 'text' : 'password'} required value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" minLength={8}
                className="w-full rounded-2xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-white/25 outline-none transition"
                style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)' }}
              />
              <button type="button" onClick={() => setShowPassword(s => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/65 transition">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {!isLogin && (
              <motion.div key="confirm"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <label className="text-xs font-semibold text-white/50 mb-1.5 block">Confirm password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input type={showPassword ? 'text' : 'password'} required value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••" minLength={8}
                    className="w-full rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 outline-none transition"
                    style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.14)' }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isLogin && (
            <Link to="/forgot-password"
              className="self-end text-xs text-white/40 hover:text-white/65 transition -mt-1">
              Forgot password?
            </Link>
          )}

          {/* Submit */}
          <motion.button
            type="submit" disabled={submitting} whileTap={{ scale: 0.98 }}
            className="mt-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition disabled:opacity-55 disabled:pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, #9B8AFF 0%, #7C6AF0 50%, #5B47E0 100%)',
              boxShadow:  '0 8px 28px rgba(124,106,240,0.50), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            {submitting
              ? <Loader2 size={16} className="animate-spin" />
              : isLogin ? 'Sign in' : 'Create account'
            }
          </motion.button>
        </form>

        {/* Demo account */}
        <button onClick={fillDemo} type="button"
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[11px] font-medium text-white/35 hover:text-white/60 transition"
          style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)' }}
        >
          <Sparkles size={11} /> Try the demo account
        </button>

        {/* Switch mode */}
        <p className="text-center text-xs text-white/40 mt-5">
          {isLogin ? 'New to Aurora?' : 'Already have an account?'}{' '}
          <button type="button" onClick={switchMode}
            className="font-bold text-white/80 hover:text-white transition">
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </p>

        {/* Footer shimmer */}
        <span className="pointer-events-none absolute inset-x-8 bottom-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)' }} />
      </motion.div>
    </div>
  );
}