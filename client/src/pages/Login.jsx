import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TreePine, Mail, Lock, User, Eye, EyeOff, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const DEMO_EMAIL = 'demo@aurora.app';
const DEMO_PASSWORD = 'password123';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || '/';

  const isLogin = mode === 'login';

  const switchMode = () => {
    setMode(isLogin ? 'signup' : 'login');
    setError('');
  };

  const fillDemoAccount = () => {
    setMode('login');
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return; // defensive guard against double-submit, in addition to the disabled button
    setError('');

    if (!isLogin && password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      if (isLogin) {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password);
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0c0a1a] flex items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-[26rem] w-[26rem] rounded-full bg-lavender-600/40 blur-[100px] animate-floaty" />
        <div className="absolute top-1/3 -right-32 h-[30rem] w-[30rem] rounded-full bg-lavender-400/30 blur-[110px] animate-floaty" style={{ animationDelay: '1.2s' }} />
        <div className="absolute -bottom-40 left-1/4 h-[24rem] w-[24rem] rounded-full bg-sage-500/20 blur-[100px] animate-floaty" style={{ animationDelay: '2.4s' }} />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm rounded-[2rem] border border-white/15 bg-white/[0.06] backdrop-blur-2xl shadow-glass-lg px-7 py-9 sm:px-9 sm:py-10"
      >
        <div className="flex flex-col items-center mb-7">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-lavender-400 to-lavender-700 shadow-glow">
            <TreePine className="text-white" size={26} />
          </div>
          <p className="mt-3 font-display text-sm font-bold tracking-[0.35em] text-white/80">AURORA</p>
        </div>

        <div className="text-center mb-7">
          <AnimatePresence mode="wait">
            <motion.h1
              key={mode}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="font-display text-xl font-bold text-white"
            >
              {isLogin ? 'Welcome back' : 'Create your account'}
            </motion.h1>
          </AnimatePresence>
          <p className="text-sm text-white/45 mt-1.5">
            {isLogin ? 'Log in to pick up where you left off.' : 'Start building your second brain.'}
          </p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex items-center gap-2 rounded-2xl bg-coral-500/15 border border-coral-500/30 px-3.5 py-2.5 text-xs text-coral-300 overflow-hidden"
            >
              <AlertCircle size={14} className="shrink-0" /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {!isLogin && (
              <motion.div key="name" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <label className="text-xs font-medium text-white/55 mb-1.5 block">Full name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                  <input
                    type="text" required value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Rahul Sharma"
                    className="w-full rounded-2xl border border-white/20 bg-white/[0.04] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-lavender-400 focus:ring-2 focus:ring-lavender-400/30"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="text-xs font-medium text-white/55 mb-1.5 block">Email address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-white/20 bg-white/[0.04] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-lavender-400 focus:ring-2 focus:ring-lavender-400/30"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-white/55 mb-1.5 block">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" minLength={8}
                className="w-full rounded-2xl border border-white/20 bg-white/[0.04] pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-lavender-400 focus:ring-2 focus:ring-lavender-400/30"
              />
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 transition">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {!isLogin && (
              <motion.div key="confirm" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <label className="text-xs font-medium text-white/55 mb-1.5 block">Confirm password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                  <input
                    type={showPassword ? 'text' : 'password'} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••" minLength={8}
                    className="w-full rounded-2xl border border-white/20 bg-white/[0.04] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-lavender-400 focus:ring-2 focus:ring-lavender-400/30"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isLogin && (
            <Link to="/forgot-password" className="self-start text-xs text-white/45 hover:text-white/70 transition -mt-1">
              Forgot Password ?
            </Link>
          )}

          <motion.button
            type="submit" disabled={submitting} whileTap={{ scale: 0.98 }}
            className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lavender-400 via-lavender-500 to-lavender-600 py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60 disabled:pointer-events-none"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : isLogin ? 'Login' : 'Create account'}
          </motion.button>
        </form>

        <button
          onClick={fillDemoAccount}
          type="button"
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] py-2 text-[11px] font-medium text-white/40 hover:text-white/70 hover:border-white/20 transition"
        >
          <Sparkles size={12} /> Use demo account ({DEMO_EMAIL})
        </button>

        <p className="text-center text-xs text-white/45 mt-6">
          {isLogin ? 'Are You New Member ?' : 'Already have an account?'}{' '}
          <button type="button" onClick={switchMode} className="font-bold text-white/85 hover:text-white transition">
            {isLogin ? 'Sign UP' : 'Log in'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}