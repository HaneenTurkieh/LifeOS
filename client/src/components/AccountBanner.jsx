import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

// Slim notice shown above the page for two special account states:
//  • the shared DEMO account (read-only, short session) — nudges people to
//    make a real account instead of staying on the demo;
//  • a brand-new account whose email isn't confirmed yet.
export default function AccountBanner() {
  const { user, logout } = useAuth();
  const [sent,      setSent]      = useState(false);
  const [sending,   setSending]   = useState(false);
  const [error,     setError]     = useState('');
  const [dismissed, setDismissed] = useState(false);

  if (!user) return null;

  const bar = 'mb-4 rounded-2xl px-4 py-3 text-xs sm:text-sm flex flex-wrap items-center gap-x-3 gap-y-2 border';

  if (user.isDemo) {
    return (
      <div className={bar} style={{ background: 'rgba(124,106,240,0.12)', borderColor: 'rgba(124,106,240,0.30)' }} role="status">
        <span className="flex-1 min-w-[12rem]">
          <strong>Demo mode</strong> — you can look around, but nothing can be changed or saved,
          and this session ends after 30 minutes.
        </span>
        <button onClick={logout} className="rounded-xl px-3 py-1.5 font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#7C6AF0,#5B47E0)' }}>
          Create a free account
        </button>
      </div>
    );
  }

  if (user.emailVerified === false && !dismissed) {
    const resend = async () => {
      if (sending) return;
      setSending(true); setError('');
      try { await api.post('/auth/resend-verification', {}); setSent(true); }
      catch (e) { setError(e.message || 'Could not send the email. Try again later.'); }
      finally { setSending(false); }
    };
    return (
      <div className={bar} style={{ background: 'rgba(255,184,77,0.14)', borderColor: 'rgba(255,184,77,0.40)' }} role="status">
        <span className="flex-1 min-w-[12rem]">
          {sent
            ? <>We sent a confirmation link to <strong>{user.email}</strong>. Check your inbox (and spam folder).</>
            : <>Please confirm your email address (<strong>{user.email}</strong>) using the link we sent you.</>}
          {error && <span className="block text-red-500 mt-1">{error}</span>}
        </span>
        {!sent && (
          <button onClick={resend} disabled={sending} className="rounded-xl px-3 py-1.5 font-bold disabled:opacity-50"
            style={{ background: 'rgba(255,184,77,0.35)' }}>
            {sending ? 'Sending…' : 'Resend email'}
          </button>
        )}
        <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="opacity-50 hover:opacity-100 px-1">✕</button>
      </div>
    );
  }

  return null;
}
