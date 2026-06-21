import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TreePine, Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      // Backend always returns the same generic response whether or not
      // the email exists — that's intentional (prevents enumeration).
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
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

        {!sent ? (
          <>
            <div className="text-center mb-7">
              <h1 className="font-display text-xl font-bold text-white">Forgot your password?</h1>
              <p className="text-sm text-white/45 mt-1.5">Enter your email and we'll send you a reset link.</p>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl bg-coral-500/15 border border-coral-500/30 px-3.5 py-2.5 text-xs text-coral-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-white/55 mb-1.5 block">Email address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                  <input
                    type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-white/20 bg-white/[0.04] pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-lavender-400 focus:ring-2 focus:ring-lavender-400/30"
                  />
                </div>
              </div>

              <motion.button
                type="submit" disabled={submitting} whileTap={{ scale: 0.98 }}
                className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-lavender-400 via-lavender-500 to-lavender-600 py-3 text-sm font-bold text-white shadow-glow transition hover:brightness-110 disabled:opacity-60 disabled:pointer-events-none"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Send reset link'}
              </motion.button>
            </form>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-500/15 text-sage-400">
              <CheckCircle2 size={26} />
            </div>
            <h1 className="font-display text-lg font-bold text-white mb-2">Check your email</h1>
            <p className="text-sm text-white/45 leading-relaxed">
              If an account exists for <span className="text-white/70">{email}</span>, we've sent a password reset link.
              It expires in 30 minutes.
            </p>
          </motion.div>
        )}

        <Link to="/login" className="mt-6 flex items-center justify-center gap-1.5 text-xs text-white/45 hover:text-white/70 transition">
          <ArrowLeft size={12} /> Back to login
        </Link>
      </motion.div>
    </div>
  );
}