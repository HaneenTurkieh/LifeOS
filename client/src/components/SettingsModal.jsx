import React from 'react';
import { LogOut, Mail } from 'lucide-react';
import Modal from './Modal.jsx';
import ThemeSettings from './ThemeSettings.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SettingsModal({ open, onClose }) {
  const { user, logout } = useAuth();

  return (
    <Modal open={open} onClose={onClose} title="Settings" maxWidth="max-w-sm">
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

        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 rounded-2xl border border-coral-500/20 bg-coral-500/5 py-2.5 text-sm font-semibold text-coral-500 hover:bg-coral-500/10 transition"
        >
          <LogOut size={15} /> Log out
        </button>
      </div>
    </Modal>
  );
}