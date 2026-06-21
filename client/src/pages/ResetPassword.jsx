import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TreePine, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../api/client.js';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [checkingToken, setCheckingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setCheckingToken(false);
      setTokenValid(false);
      return;
    }
    api.get(`/auth/reset-password/${encodeURIComponent(token)}`)
      .then((res) => setTokenValid(!!res.valid))
      .catch(() => setTokenValid(false))
      .finally(() => setCheckingToken(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please request a new reset link.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0c0a1a] flex items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-[26rem] w-[26rem] rounded-full bg-lavender-600/40 blur-[100px] animate-floaty" />
        <div className="absolute top-1/3 -right-32 h-[30rem] w-[30rem] rounded-full bg-lavender-400/30 blur-[110px] animate-floaty" style={{ animationDelay: '1.2s' }} />
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

        {checkingToken ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 size={24} className="animate-spin text-lavender-400" />
            <p className="text-sm text-white/45">Verifying your reset link…</p>
          </div>
        ) : success ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-2">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-500/15 text-sage-400">
              <CheckCircle2 size={26} />
            </div>
            <h1 className="font-display text-lg font-bold text-white mb-2">Password reset</h1>
            <p className="text-sm text-white/45">Redirecting you to login…</p>
          </motion.div>
        ) : !tokenValid ? (
          <div className="text-center py-2">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-500/15 text-coral-400">
              <XCircle size={26} />
            </div>
            <h1 className="font-display text-lg font-bold text-white mb-2">Link expired or invalid</h1>
            <p className="text-sm text-white/45 mb-6">This password reset link is no longer valid. Please request a new one.</p>
            <Link to="/forgot-password" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lavender-400 via-lavender-500 to-lavender-600 py-3 px-6 text-sm font-bold text-white shadow-glow transition hover:brightness-110">
              Request new link
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-7">
              <h1 className="font-display text-xl font-bold text-white">Set a new password</h1>
              <p className="text-sm text-white/45 mt-1.5">Choose a strong password for your account.</p>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl bg-coral-500/15 border border-coral-500/30 px-3.5 py-2.5 text-xs text-coral-300">
                <AlertCircle size={14} className="shrink-0" /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-white/55 mb-1.5 block">New password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                  <input
                    type={showPassword ? 'text' : 'password'} required minLength={8} autoFocus
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-white/20 bg-white/[0.04] pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-lavender-400 focus:ring-2 focus:ring-lavender-400/30"
                  />
                  <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70 transition">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-white/55 mb-1.5 block">Confirm new password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                  <input
                    type={showPassword ? 'text' : 'password'} required minLength={8}
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-white/20 bg-white/[0.04] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-lavender-400 focus:ring-2 focus:ring-lavender-400/30"
                  />
                </div>
              </div>

              <motion.button
                type="submit" disabled={submitting} whileTap={{ scale: 0.98 }}
                className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lavender-400 via-lavender-500 to-lavender-600 py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60 disabled:pointer-events-none"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Reset password'}
              </motion.button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}