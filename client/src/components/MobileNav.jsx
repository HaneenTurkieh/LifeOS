import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ListChecks, Target, Dumbbell, Sparkles, BarChart3,
} from 'lucide-react';

// Trimmed-down nav for small screens — the full set lives in the
// desktop Sidebar; mobile keeps the most-used five plus "more" via Analytics page links.
const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/tasks', icon: ListChecks, label: 'Tasks' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/habits', icon: Dumbbell, label: 'Habits' },
  { to: '/ai', icon: Sparkles, label: 'AI' },
  { to: '/analytics', icon: BarChart3, label: 'Stats' },
];

export default function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-50 glass-panel rounded-3xl px-2 py-2">
      <div className="flex items-center justify-between">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-lavender-600' : 'text-ink/40'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${isActive ? 'bg-lavender-100' : ''}`}>
                  <Icon size={17} />
                </div>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}