import React, { useEffect, useState, useCallback } from 'react';
import { Trash2, FolderGit2, Lightbulb, Award, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import GlassCard  from '../components/GlassCard.jsx';
import Modal      from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageLoader from '../components/Loader.jsx';

const TABS = [
  { key: 'projects',       label: 'Projects',       icon: FolderGit2 },
  { key: 'skills',         label: 'Skills',         icon: Lightbulb  },
  { key: 'certifications', label: 'Certifications', icon: Award      },
];

const LEVEL_STYLES = {
  beginner:     'bg-ink/5 text-ink/50',
  intermediate: 'bg-sun-500/15 text-sun-600',
  advanced:     'bg-sage-500/15 text-sage-600',
};

const FORMS = {
  projects:       { title: '', description: '', tech: '', link: '' },
  skills:         { name: '', level: 'intermediate', category: 'technical' },
  certifications: { title: '', issuer: '', date: '', link: '' },
};

export default function CVBuilder({ openTrigger = 0 }) {
  const [tab,        setTab]        = useState('projects');
  const [data,       setData]       = useState({ projects: [], skills: [], certifications: [] });
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [form,       setForm]       = useState(FORMS.projects);
  const [reviewing,  setReviewing]  = useState(false);
  const [review,     setReview]     = useState(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [projects, skills, certifications] = await Promise.all([
        api.get('/cv/projects'),
        api.get('/cv/skills'),
        api.get('/cv/certifications'),
      ]);
      setData({ projects, skills, certifications });
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (openTrigger > 0) openModal(tab);
  }, [openTrigger]); // eslint-disable-line

  const openModal  = (which) => { setTab(which); setForm(FORMS[which]); setModalOpen(true); };

  const createItem = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/cv/${tab}`, form);
      toast.success('Added to your CV');
      setModalOpen(false); load();
    } catch (err) { toast.error(err.message); }
  };

  const removeItem = async (which, id) => {
    await api.del(`/cv/${which}/${id}`);
    toast.success('Removed'); load();
  };

  // ── AI: Review CV as recruiter ────────────────────────────────
  const reviewCV = async () => {
    const totalItems = data.projects.length + data.skills.length + data.certifications.length;
    if (totalItems < 3) {
      toast.error('Add at least a few projects, skills, or certifications before reviewing.');
      return;
    }
    setReviewing(true);
    try {
      const cvSummary = `
PROJECTS (${data.projects.length}):
${data.projects.map((p) => `• ${p.title}${p.tech ? ` [${p.tech}]` : ''}${p.description ? ` — ${p.description}` : ''}`).join('\n') || 'None'}

SKILLS (${data.skills.length}):
${data.skills.map((s) => `• ${s.name} (${s.level})`).join('\n') || 'None'}

CERTIFICATIONS (${data.certifications.length}):
${data.certifications.map((c) => `• ${c.title} — ${c.issuer}`).join('\n') || 'None'}
      `.trim();

      const res = await api.post('/chat', {
        messages: [{
          role:    'user',
          content: `You are a senior technical recruiter at a top tech company. Review this CV content and give honest, specific feedback in 3 sections:

1. STRENGTHS (2-3 bullet points — what stands out)
2. GAPS & IMPROVEMENTS (2-3 specific things missing or weak)  
3. QUICK WINS (2-3 concrete actions to make this CV stronger this week)

Be direct and specific. No fluff. Here's the CV:

${cvSummary}`,
        }],
      });
      setReview(res.text);
    } catch (err) { toast.error('Could not generate review. Try again.'); }
    finally { setReviewing(false); }
  };

  if (loading) return <PageLoader />;

  const hasContent = data.projects.length + data.skills.length + data.certifications.length > 0;

  return (
    <div>
      {/* Internal tab bar + AI review button */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex gap-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                tab === key
                  ? 'bg-lavender-600 text-white shadow-glow'
                  : 'bg-white/60 dark:bg-white/[0.06] text-ink/50 dark:text-white/40 hover:bg-white dark:hover:bg-white/10'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Lumi review button — only if content exists */}
        {hasContent && (
          <button
            onClick={reviewCV}
            disabled={reviewing}
            className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(124,58,237,0.08))',
              border:     '1px solid rgba(168,85,247,0.30)',
              color:      '#A855F7',
            }}
          >
            {reviewing ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-violet-400 border-t-violet-600 animate-spin" />
                Reviewing…
              </>
            ) : (
              <>
                <Sparkles size={14} /> Lumi reviews my CV
              </>
            )}
          </button>
        )}
      </div>

      {/* ── AI Review panel ─────────────────────────────────── */}
      <AnimatePresence>
        {review && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 rounded-3xl p-6 relative"
            style={{
              background:   'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(124,58,237,0.04))',
              border:       '1px solid rgba(168,85,247,0.20)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">✦</span>
                <span className="font-display font-bold text-ink dark:text-white text-sm">
                  Lumi's CV Review
                </span>
                <span className="text-xs text-violet-500 font-medium px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(168,85,247,0.10)' }}>
                  Senior Recruiter Perspective
                </span>
              </div>
              <button onClick={() => setReview(null)}
                className="text-ink/30 dark:text-white/30 hover:text-coral-500 transition">
                <X size={16} />
              </button>
            </div>
            <div className="text-sm text-ink/70 dark:text-white/60 leading-relaxed whitespace-pre-line">
              {review}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Projects tab ────────────────────────────────────── */}
      {tab === 'projects' && (
        data.projects.length === 0 ? (
          <EmptyState icon={FolderGit2} title="No projects yet"
            message="Add a project you've built to showcase on your CV." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.projects.map((p, i) => (
              <GlassCard key={p.id} delay={i * 0.04} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-bold text-ink dark:text-white">{p.title}</h3>
                  <button onClick={() => removeItem('projects', p.id)}
                    className="text-ink/25 hover:text-coral-500 transition shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
                {p.description && <p className="text-sm text-ink/50 mt-1.5">{p.description}</p>}
                {p.tech        && <p className="text-xs text-lavender-600 font-medium mt-2">{p.tech}</p>}
                {p.link        && (
                  <a href={p.link} target="_blank" rel="noreferrer"
                    className="text-xs text-ink/40 hover:underline mt-1 block truncate">{p.link}</a>
                )}
              </GlassCard>
            ))}
          </div>
        )
      )}

      {/* ── Skills tab ───────────────────────────────────────── */}
      {tab === 'skills' && (
        data.skills.length === 0 ? (
          <EmptyState icon={Lightbulb} title="No skills yet"
            message="Add the skills you want recruiters to see." />
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {data.skills.map((s) => (
              <div key={s.id} className="glass-card flex items-center gap-2 px-4 py-2.5">
                <span className="text-sm font-semibold text-ink dark:text-white">{s.name}</span>
                <span className={`pill ${LEVEL_STYLES[s.level]} capitalize`}>{s.level}</span>
                <button onClick={() => removeItem('skills', s.id)}
                  className="text-ink/25 hover:text-coral-500 transition">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Certifications tab ───────────────────────────────── */}
      {tab === 'certifications' && (
        data.certifications.length === 0 ? (
          <EmptyState icon={Award} title="No certifications yet"
            message="Add certifications you've earned." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.certifications.map((c, i) => (
              <GlassCard key={c.id} delay={i * 0.04} className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sun-400 to-sun-600 text-white shadow-sm shrink-0">
                  <Award size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink dark:text-white text-sm truncate">{c.title}</p>
                  <p className="text-xs text-ink/45 dark:text-white/35">{c.issuer}{c.date && ` · ${c.date}`}</p>
                </div>
                <button onClick={() => removeItem('certifications', c.id)}
                  className="text-ink/25 hover:text-coral-500 transition shrink-0">
                  <Trash2 size={14} />
                </button>
              </GlassCard>
            ))}
          </div>
        )
      )}

      {/* ── Add item modal ───────────────────────────────────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Add ${tab.slice(0, -1)}`}>
        <form onSubmit={createItem} className="flex flex-col gap-3.5">
          {tab === 'projects' && (
            <>
              <input className="input-field" placeholder="Project title" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus required />
              <textarea className="input-field" placeholder="Description" rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <input className="input-field" placeholder="Tech stack (e.g. React, Node)"
                value={form.tech}
                onChange={(e) => setForm({ ...form, tech: e.target.value })} />
              <input className="input-field" placeholder="Link (optional)" value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })} />
            </>
          )}
          {tab === 'skills' && (
            <>
              <input className="input-field" placeholder="Skill name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus required />
              <select className="input-field" value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <select className="input-field" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="technical">Technical</option>
                <option value="soft">Soft skill</option>
              </select>
            </>
          )}
          {tab === 'certifications' && (
            <>
              <input className="input-field" placeholder="Certification title" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus required />
              <input className="input-field" placeholder="Issuer" value={form.issuer}
                onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
              <input type="date" className="input-field" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <input className="input-field" placeholder="Link (optional)" value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })} />
            </>
          )}
          <button type="submit" className="btn-primary justify-center mt-1">Add</button>
        </form>
      </Modal>
    </div>
  );
}