import { usePerformance } from '../context/PerformanceContext.jsx';
import React, { useState } from 'react';
import { LogOut, Mail, Trash2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal.jsx';
import ThemeSettings from './ThemeSettings.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SettingsModal({ open, onClose }) {
  const { user, logout, deleteAccount } = useAuth();
const { lowPower, toggleLowPower } = usePerformance();
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      await deleteAccount();
      onClose();
      navigate('/login', { replace: true });
    } catch (err) {
      setDeleting(false);
    }
  };

  const closeAndReset = () => {
    setConfirming(false);
    setConfirmText('');
    onClose();
  };

  return (
    <Modal open={open} onClose={closeAndReset} title="Settings" maxWidth="max-w-sm">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 rounded-2xl bg-ink/5 dark:bg-white/5 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-lavender-500 to-lavender-700 text-white text-sm font-bold">
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink dark:text-white truncate">{user?.name}</p>
            <p className="text-xs text-ink/45 dark:text-white/40 flex items-center gap-1 truncate">
              <Mail size={11} /> {user?.email}
            </p>
          </div>
        </div>

        <ThemeSettings />
<div className="flex items-center justify-between rounded-2xl bg-ink/5 dark:bg-white/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink dark:text-white">Low power mode</p>
            <p className="text-xs text-ink/45 dark:text-white/40">Disables the 3D background if the app feels laggy</p>
          </div>
          <button
            onClick={toggleLowPower}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${lowPower ? 'bg-lavender-600' : 'bg-ink/20 dark:bg-white/20'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${lowPower ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 rounded-2xl border border-coral-500/20 bg-coral-500/5 py-2.5 text-sm font-semibold text-coral-500 hover:bg-coral-500/10 transition"
        >
          <LogOut size={15} /> Log out
        </button>

        <div className="pt-4 border-t border-ink/10 dark:border-white/10">
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-semibold text-red-500/70 hover:text-red-500 hover:bg-red-500/5 transition"
            >
              <Trash2 size={15} /> Delete my account
            </button>
          ) : (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                  This permanently deletes your account and <strong>everything</strong> in it —
                  tasks, habits, goals, XP, achievements. This cannot be undone.
                </p>
              </div>
              <p className="text-xs text-ink/50 dark:text-white/40 mb-2">
                Type <strong>DELETE</strong> to confirm:
              </p>
              <input
                className="input-field mb-3"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setConfirming(false); setConfirmText(''); }}
                  className="flex-1 rounded-xl py-2 text-xs font-semibold text-ink/60 dark:text-white/50 hover:bg-ink/5 dark:hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={confirmText !== 'DELETE' || deleting}
                  className="flex-1 rounded-xl bg-red-500 py-2 text-xs font-bold text-white hover:bg-red-600 transition disabled:opacity-40 disabled:pointer-events-none"
                >
                  {deleting ? 'Deleting…' : 'Delete forever'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
<p className="text-center text-[10px] text-ink/30 dark:text-white/25 pt-2">
          © {new Date().getFullYear()} Haneen Turkieh. All rights reserved.
        </p>
    </Modal>
  );
}
