import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Briefcase, FolderKanban, FileText } from 'lucide-react';
import Internships from './Internships.jsx';
import Projects    from './Projects.jsx';
import CVBuilder   from './CVBuilder.jsx';
import PageHeader  from '../components/PageHeader.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const TABS = [
  { key: 'internships', label: 'launch.internships', icon: Briefcase },
  { key: 'projects',    label: 'launch.projects',    icon: FolderKanban },
  { key: 'cv',          label: 'launch.cv',          icon: FileText },
];

export default function Launchpad() {
  const [tab,      setTab]      = useState('internships');
  const [triggers, setTriggers] = useState({ internships: 0, projects: 0, cv: 0 });
  const { t } = useLanguage();

  const META = {
    internships: { eyebrow:`${t('nav.launchpad')} · ${t('launch.internships')}`, title:t('launch.internTitle'), subtitle:t('launch.internSub'), action:t('launch.internAction') },
    projects:    { eyebrow:`${t('nav.launchpad')} · ${t('launch.projects')}`,    title:t('launch.projTitle'),   subtitle:t('launch.projSub'),   action:t('launch.projAction')   },
    cv:          { eyebrow:`${t('nav.launchpad')} · ${t('launch.cv')}`,          title:t('launch.cvTitle'),     subtitle:t('launch.cvSub'),     action:t('launch.cvAction')     },
  };

  const fireAdd = () => setTriggers((tr) => ({ ...tr, [tab]: tr[tab] + 1 }));
  const meta    = META[tab];

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

      <div className="flex gap-1 mb-6 bg-white/40 dark:bg-white/[0.04] rounded-2xl p-1 max-w-full overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <motion.button
            key={key}
            onClick={() => setTab(key)}
            whileHover={tab !== key ? { y: -2, scale: 1.04, transition: { type: 'spring', stiffness: 500, damping: 22 } } : {}}
            whileTap={{ scale: 0.96 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 whitespace-nowrap ${
              tab === key
                ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-sm'
                : 'text-ink/50 dark:text-white/40 hover:text-ink/80 dark:hover:text-white/60'
            }`}
          >
            <Icon size={14} /> {t(label)}
          </motion.button>
        ))}
      </div>

      {tab === 'internships' && <Internships openTrigger={triggers.internships} />}
      {tab === 'projects'    && <Projects    openTrigger={triggers.projects} />}
      {tab === 'cv'          && <CVBuilder   openTrigger={triggers.cv} />}
    </div>
  );
}