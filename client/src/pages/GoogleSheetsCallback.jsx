// GoogleSheetsCallback.jsx — where Google redirects back to after an
// instructor approves the Sheets connection (see Channels.jsx's
// "Connect Google Sheets" button, which sends them to
// GET /sheets/auth-url first). This page's only job is: grab the `code`
// Google appended to the URL, hand it to the server to exchange for
// real tokens (POST /sheets/callback), then bounce back to Channels.
// Registered at /auth/google-sheets/callback — must exactly match the
// "Authorized redirect URI" configured on the Google OAuth client, or
// Google refuses the whole flow with redirect_uri_mismatch.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../api/client.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const STATE_KEY = 'nuvora_gsheets_oauth_state';

export default function GoogleSheetsCallback() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const toast = useToast();
  const [phase, setPhase] = useState('working'); // working | ok | error

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code  = params.get('code');
      const state = params.get('state');
      const error = params.get('error');
      const expected = sessionStorage.getItem(STATE_KEY);
      sessionStorage.removeItem(STATE_KEY);

      if (error) { setPhase('error'); toast.error(t('channels.sheetsConnectFailed')); return; }
      if (!code || !state || state !== expected) { setPhase('error'); toast.error(t('channels.sheetsConnectFailed')); return; }

      try {
        await api.post('/sheets/callback', { code });
        setPhase('ok');
        toast.success(t('channels.sheetsConnected'));
      } catch (err) {
        setPhase('error');
        toast.error(err.message || t('channels.sheetsConnectFailed'));
      } finally {
        setTimeout(() => navigate('/channels', { replace: true }), 1200);
      }
    };
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center">
      {phase === 'working' && <Loader2 size={28} className="animate-spin text-[rgb(var(--accent-500))]" />}
      {phase === 'ok'      && <CheckCircle2 size={28} className="text-sage-500" />}
      {phase === 'error'   && <XCircle size={28} className="text-coral-500" />}
      <p className="text-sm text-ink/50 dark:text-white/40">
        {phase === 'working' ? t('channels.sheetsConnecting')
          : phase === 'ok'   ? t('channels.sheetsConnected')
          : t('channels.sheetsConnectFailed')}
      </p>
    </div>
  );
}
