import React, { useState } from 'react';
import { Briefcase, FolderKanban, FileText } from 'lucide-react';
import Internships from './Internships.jsx';
import Projects    from './Projects.jsx';
import CVBuilder   from './CVBuilder.jsx';

const TABS = [
  { key: 'internships', label: 'Internships', icon: Briefcase },
  { key: 'projects',    label: 'Projects',    icon: FolderKanban },
  { key: 'cv',          label: 'CV Builder',  icon: FileText },
];

export default function Launchpad() {
  const [tab, setTab] = useState('internships');

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-white/40 dark:bg-white/[0.04] rounded-2xl p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === key
                ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-sm'
                : 'text-ink/50 dark:text-white/40 hover:text-ink/80 dark:hover:text-white/60'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'internships' && <Internships />}
      {tab === 'projects'    && <Projects />}
      {tab === 'cv'          && <CVBuilder />}
    </div>
  );
}