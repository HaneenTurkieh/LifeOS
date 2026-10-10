import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TreePine, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../api/client.js';

// Landing page for the link in the "Confirm your email" message.
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [state, setState] = useState('checking'); // checking | ok | bad
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setState('bad'); return; }
    api.post('/auth/verify-email', { token })
      .then((r) => { setMessage(r?.message || ''); setState('ok'); })
      .catch((e) => { setMessage(e?.message || ''); setState('bad'); });
  }, [token]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0c0a1a] flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm rounded-[2rem] border border-white/15 bg-white/[0.06] backdrop-blur-2xl px-7 py-9 text-center"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-lavender-400 to-lavender-700">
            <TreePine className="text-white" size={26} />
          </div>
          <p className="mt-3 font-display text-sm font-bold tracking-[0.35em] text-white/80">NUVORA</p>
        </div>

        {state === 'checking' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 size={24} className="animate-spin text-lavender-400" />
            <p className="text-sm text-white/55">Confirming your email…</p>
          </div>
        )}
        {state === 'ok' && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 size={36} className="text-emerald-400" />
            <p className="text-base font-semibold text-white">Email confirmed</p>
            <p className="text-sm text-white/55">{message || 'Thank you!'}</p>
            <Link to="/" className="mt-3 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#7C6AF0,#5B47E0)' }}>Continue to Nuvora</Link>
          </div>
        )}
        {state === 'bad' && (
          <div className="flex flex-col items-center gap-3">
            <XCircle size={36} className="text-red-400" />
            <p className="text-base font-semibold text-white">This link didn't work</p>
            <p className="text-sm text-white/55">{message || 'It may have expired. Log in and tap “Resend email” to get a new one.'}</p>
            <Link to="/login" className="mt-3 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#7C6AF0,#5B47E0)' }}>Go to login</Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
