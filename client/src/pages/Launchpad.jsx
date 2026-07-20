import React, { useState } from 'react';
import { Plus, Briefcase, FolderKanban, FileText } from 'lucide-react';
import Internships from './Internships.jsx';
import Projects    from './Projects.jsx';
import CVBuilder   from './CVBuilder.jsx';
import PageHeader  from '../components/PageHeader.jsx';

const TABS = [
  { key: 'internships', label: 'Internships', icon: Briefcase },
  { key: 'projects',    label: 'Projects',    icon: FolderKanban },
  { key: 'cv',          label: 'CV Builder',  icon: FileText },
];

const META = {
  internships: {
    eyebrow: 'Launchpad · Internships',
    title: 'Land the role',
    subtitle: 'Track every application from first click to offer.',
    action: 'Add application',
  },
  projects: {
    eyebrow: 'Launchpad · Projects',
    title: 'From idea to deployed',
    subtitle: 'Track every side project through its full lifecycle.',
    action: 'New project',
  },
  cv: {
    eyebrow: 'Launchpad · CV Builder',
    title: 'Your story, organized',
    subtitle: 'Collect projects, skills and certifications so your CV writes itself.',
    action: 'Add',
  },
};

export default function Launchpad() {
  const [tab, setTab] = useState('internships');
  // Incrementing triggers the active sub-page to open its modal
  const [triggers, setTriggers] = useState({ internships: 0, projects: 0, cv: 0 });

  const fireAdd = () => setTriggers((t) => ({ ...t, [tab]: t[tab] + 1 }));
  const meta = META[tab];

  return (
    <div>
      <PageHeader
        eyebrow={meta.eyebrow}
        title={meta.title}
        subtitle={meta.subtitle}
        action={
          <button className="btn-primary" onClick={fireAdd}>
            <Plus size={16} /> {meta.action}
          </button>
        }
      />

      {/* Tab switcher */}
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
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'internships' && <Internships openTrigger={triggers.internships} />}
      {tab === 'projects'    && <Projects    openTrigger={triggers.projects} />}
      {tab === 'cv'          && <CVBuilder   openTrigger={triggers.cv} />}
    </div>
  );
}