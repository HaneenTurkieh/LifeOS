import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ListChecks, Target, BookOpen, Dumbbell, BarChart3,
  Briefcase, User, FolderKanban, Sparkles, TreePine,
} from 'lucide-react';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tasks', icon: ListChecks, label: 'Tasks' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/habits', icon: Dumbbell, label: 'Habits' },
  { to: '/learning', icon: BookOpen, label: 'Learning' },
  { to: '/ai', icon: Sparkles, label: 'AI Tools' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/internships', icon: Briefcase, label: 'Internships' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/cv', icon: User, label: 'CV Builder' },
];

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col items-center w-20 shrink-0 py-6">
      <div className="glass-panel flex flex-col items-center gap-1 rounded-[2rem] px-2.5 py-4 sticky top-6">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-lavender-500 to-lavender-700 text-white shadow-glow">
          <TreePine size={20} />
        </div>
        <nav className="flex flex-col gap-1.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={label}
              className={({ isActive }) =>
                `group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-br from-lavender-500 to-lavender-700 text-white shadow-glow scale-105'
                    : 'text-ink/40 hover:bg-white/70 hover:text-lavender-600'
                }`
              }
            >
              <Icon size={19} strokeWidth={2.1} />
              <span className="pointer-events-none absolute left-[3.25rem] z-50 whitespace-nowrap rounded-xl bg-ink/90 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                {label}
              </span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}