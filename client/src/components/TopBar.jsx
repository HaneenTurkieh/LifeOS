import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Sparkles, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import WeatherWidget from './WeatherWidget.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TopBar({ level, xpIntoLevel, streak }) {
  const { user, logout } = useAuth();
  const firstName = user?.name?.split(' ')[0] || 'there';
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      className="glass-panel sticky top-4 z-40 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-3.5"
    >
      <div>
        <p className="text-sm font-medium text-ink/50">{today}</p>
        <h1 className="font-display text-lg font-bold text-ink">{greeting()}, {firstName} 👋</h1>
      </div>
      <div className="flex items-center gap-2">
        <WeatherWidget />
        {streak > 0 && (
          <div className="pill bg-coral-500/10 text-coral-500">
            <Flame size={13} /> {streak}-day streak
          </div>
        )}
        {level && (
          <div className="pill bg-lavender-100 text-lavender-700">
            <Sparkles size={13} /> Level {level.level} · {xpIntoLevel}/100 XP
          </div>
        )}
        <ThemeToggle />
        <button
          onClick={logout}
          title="Log out"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-ink/40 hover:bg-coral-500/10 hover:text-coral-500 transition"
        >
          <LogOut size={15} />
        </button>
      </div>
    </motion.div>
  );
}