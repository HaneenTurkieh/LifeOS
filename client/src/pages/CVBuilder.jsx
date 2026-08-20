import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Trash2, FolderGit2, Lightbulb, Award, Sparkles, X, Download, Briefcase, GraduationCap, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import GlassCard  from '../components/GlassCard.jsx';
import Modal      from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageLoader from '../components/Loader.jsx';
import CVExportModal from '../components/CVExportModal.jsx';
import AvatarCropper from '../components/AvatarCropper.jsx';
import VoiceInputButton, { appendText } from '../components/VoiceInputButton.jsx';

// Experience and Education come first — they're what a resume actually
// leads with. Projects/Skills/Certifications round it out below.
const TABS = [
  { key: 'experience',     label: 'Experience',     icon: Briefcase     },
  { key: 'education',      label: 'Education',      icon: GraduationCap },
  { key: 'projects',       label: 'Projects',       icon: FolderGit2    },
  { key: 'skills',         label: 'Skills',         icon: Lightbulb     },
  { key: 'certifications', label: 'Certifications', icon: Award         },
];

const TAB_SINGULAR = {
  experience:     'experience',
  education:      'education entry',
  projects:       'project',
  skills:         'skill',
  certifications: 'certification',
};

const LEVEL_STYLES = {
  beginner:     'bg-ink/5 text-ink/50',
  intermediate: 'bg-sun-500/15 text-sun-600',
  advanced:     'bg-sage-500/15 text-sage-600',
};

const FORMS = {
  experience:     { role: '', company: '', location: '', start_date: '', end_date: '', is_current: false, description: '' },
  education:      { school: '', degree: '', field: '', start_date: '', end_date: '', description: '' },
  projects:       { title: '', description: '', tech: '', link: '' },
  skills:         { name: '', level: 'intermediate', category: 'technical' },
  certifications: { title: '', issuer: '', date: '', link: '' },
};

const EMPTY_PROFILE = { cv_summary: '', cv_headline: '', cv_phone: '', cv_location: '', cv_photo: '' };

export default function CVBuilder({ openTrigger = 0 }) {
  const { user } = useAuth();
  const toast    = useToast();

  // Experience/Education lead the tab order (that's resume convention),
  // but defaulting the *selected* tab to Experience meant the header's
  // "+" button dropped straight into a required Job title form the
  // instant you opened this page — a bad first touch for anyone who
  // doesn't have formal work history yet, students especially. Land on
  // Projects instead, which is the lowest-friction starting point.
  const [tab,         setTab]         = useState('projects');
  const [data,        setData]        = useState({ experience: [], education: [], projects: [], skills: [], certifications: [] });
  const [profile,     setProfile]     = useState(EMPTY_PROFILE);
  const [profileDraft, setProfileDraft] = useState(EMPTY_PROFILE);
  const [savingProfile, setSavingProfile] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [form,        setForm]        = useState(FORMS.projects);
  const [reviewing,   setReviewing]   = useState(false);
  const [review,      setReview]      = useState(null);
  const [showExport,  setShowExport]  = useState(false);
  // Photo is optional — many CV conventions outside the US/UK expect one,
  // some don't, so this is opt-in rather than required. Reuses the same
  // crop-to-circle flow as the account avatar for a familiar UX.
  const [cropSrc,     setCropSrc]     = useState(null);
  const photoInputRef = useRef(null);

  // The Launchpad → Projects tab (kanban board, idea→deployment) is a
  // completely separate table from cv_projects here — this just reads
  // it read-only, purely to power the "pull from your projects" picker
  // below, so someone building a CV entry for a project they're already
  // tracking doesn't have to retype the title/description from scratch.
  const [launchpadProjects, setLaunchpadProjects] = useState([]);
  const load = useCallback(async () => {
    try {
      const [experience, education, projects, skills, certifications, prof, lp] = await Promise.all([
        api.get('/cv/experience'),
        api.get('/cv/education'),
        api.get('/cv/projects'),
        api.get('/cv/skills'),
        api.get('/cv/certifications'),
        api.get('/cv/profile'),
        api.get('/projects').catch(() => []),
      ]);
      setData({ experience, education, projects, skills, certifications });
      setProfile(prof || EMPTY_PROFILE);
      setProfileDraft(prof || EMPTY_PROFILE);
      setLaunchpadProjects(lp || []);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (openTrigger > 0) openModal(tab);
  }, [openTrigger]); // eslint-disable-line

  const openModal = (which) => {
    setTab(which);
    setForm(FORMS[which]);
    setModalOpen(true);
  };

  const createItem = async (e) => {
    e.preventDefault();
    try {
      // SQLite has no real boolean type — is_current is stored as
      // 0/1 like every other flag in this app, not a JS true/false.
      const payload = tab === 'experience' ? { ...form, is_current: form.is_current ? 1 : 0 } : form;
      await api.post(`/cv/${tab}`, payload);
      toast.success('Added to your CV');
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const removeItem = async (which, id) => {
    try { await api.del(`/cv/${which}/${id}`); toast.success('Removed'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const profileDirty = JSON.stringify(profile) !== JSON.stringify(profileDraft);
  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.put('/cv/profile', profileDraft);
      setProfile(profileDraft);
      toast.success('Profile saved');
    } catch (err) { toast.error(err.message); }
    finally { setSavingProfile(false); }
  };

  const handlePhotoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Same cap as SettingsModal.jsx's avatar upload — was missing here
    // entirely, so a huge image could be read into a data URL with no
    // limit at all before landing in profile.cv_photo (which also gets
    // embedded directly in the exported Word doc and printed PDF).
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result);
    reader.readAsDataURL(file);
    e.target.value = ''; // allow picking the same file again later
  };
  const handleCropSave = (dataUrl) => {
    setProfileDraft((p) => ({ ...p, cv_photo: dataUrl }));
    setCropSrc(null);
  };
  const removePhoto = () => setProfileDraft((p) => ({ ...p, cv_photo: '' }));

  const reviewCV = async () => {
    const total = data.experience.length + data.education.length + data.projects.length + data.skills.length + data.certifications.length;
    if (total < 3) {
      toast.error('Add at least a few experience, education, or project entries first.');
      return;
    }
    setReviewing(true);
    try {
      const cvSummary = `
SUMMARY:
${profile.cv_summary || 'None'}

EXPERIENCE (${data.experience.length}):
${data.experience.map((x) => `• ${x.role} at ${x.company || 'N/A'}${x.description ? ` — ${x.description}` : ''}`).join('\n') || 'None'}

EDUCATION (${data.education.length}):
${data.education.map((ed) => `• ${ed.degree || ''} ${ed.field ? `in ${ed.field}` : ''} — ${ed.school}`.trim()).join('\n') || 'None'}

PROJECTS (${data.projects.length}):
${data.projects.map((p) => `• ${p.title}${p.tech ? ` [${p.tech}]` : ''}${p.description ? ` — ${p.description}` : ''}`).join('\n') || 'None'}

SKILLS (${data.skills.length}):
${data.skills.map((s) => `• ${s.name} (${s.level})`).join('\n') || 'None'}

CERTIFICATIONS (${data.certifications.length}):
${data.certifications.map((c) => `• ${c.title} — ${c.issuer}`).join('\n') || 'None'}`.trim();

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
        no_history: true, // internal tool call, not a real Lumi conversation — keep it out of the chat history
        mode: 'review', // gets a real reasoning pass server-side, same as Deep Think — a CV review is exactly the kind of judgment call that benefits from it, unlike quick everyday chat
      });
      setReview(res.text);
    } catch (_) { toast.error('Could not generate review. Try again.'); }
    finally { setReviewing(false); }
  };

  if (loading) return <PageLoader />;

  const hasContent =
    data.experience.length + data.education.length + data.projects.length + data.skills.length + data.certifications.length > 0 ||
    Boolean(profile.cv_summary || profile.cv_headline);

  return (
    <div>
      {/* ── Profile: headline, contact, summary — the part every real
           resume leads with but nothing else here captures ────── */}
      <GlassCard className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3.5">
          <p className="text-xs font-bold uppercase tracking-widest text-ink/35 dark:text-white/25">Profile & Summary</p>
          {profileDirty && (
            <button onClick={saveProfile} disabled={savingProfile}
              className="btn-primary text-xs px-3.5 py-1.5 disabled:opacity-50">
              {savingProfile ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
        <div className="flex items-start gap-4 mb-3">
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="relative flex h-16 w-16 items-center justify-center rounded-full overflow-hidden shrink-0 group"
              style={{ background: 'rgb(var(--accent-500) / 0.10)', border: '1.5px dashed rgb(var(--accent-500) / 0.35)' }}
            >
              {profileDraft.cv_photo ? (
                <img src={profileDraft.cv_photo} alt="CV" className="h-full w-full object-cover" />
              ) : (
                <Camera size={18} className="text-lavender-500" />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-ink/50 opacity-0 group-hover:opacity-100 transition">
                <Camera size={16} className="text-white" />
              </div>
            </button>
            {profileDraft.cv_photo && (
              <button type="button" onClick={removePhoto}
                className="text-[10px] font-semibold text-coral-500 hover:underline">
                Remove
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            <div className="flex items-center gap-2">
              <input className="input-field flex-1" placeholder="Headline, e.g. Financial Analyst"
                value={profileDraft.cv_headline}
                onChange={(e) => setProfileDraft({ ...profileDraft, cv_headline: e.target.value })} />
              <VoiceInputButton size="sm" onText={(c) => setProfileDraft((p) => ({ ...p, cv_headline: appendText(p.cv_headline, c) }))} />
            </div>
            <div className="flex items-center gap-2">
              <input className="input-field flex-1" placeholder="Location, e.g. Ramallah, Palestine"
                value={profileDraft.cv_location}
                onChange={(e) => setProfileDraft({ ...profileDraft, cv_location: e.target.value })} />
              <VoiceInputButton size="sm" onText={(c) => setProfileDraft((p) => ({ ...p, cv_location: appendText(p.cv_location, c) }))} />
            </div>
            <input className="input-field sm:col-span-2" placeholder="Phone (optional)"
              value={profileDraft.cv_phone}
              onChange={(e) => setProfileDraft({ ...profileDraft, cv_phone: e.target.value })} />
          </div>
        </div>
        <div className="flex items-start gap-2">
          <textarea className="input-field flex-1" rows={3}
            placeholder="Professional summary — 2-3 sentences on who you are and what you bring."
            value={profileDraft.cv_summary}
            onChange={(e) => setProfileDraft({ ...profileDraft, cv_summary: e.target.value })} />
          <VoiceInputButton size="sm" className="mt-1" onText={(c) => setProfileDraft((p) => ({ ...p, cv_summary: appendText(p.cv_summary, c) }))} />
        </div>
      </GlassCard>

      {/* ── Top bar: tabs + action buttons ──────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        {/* Was a plain non-wrapping flex row — with 5 tabs (each icon +
            label) it had no way to fit on an iPhone-width screen, so every
            button just got squeezed/overlapped. Now scrolls horizontally
            on narrow screens instead of crushing itself. */}
        <div className="flex gap-2 overflow-x-auto max-w-full -mx-1 px-1 py-0.5" style={{ scrollbarWidth: 'thin' }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition shrink-0 whitespace-nowrap ${
                tab === key
                  ? 'bg-lavender-600 text-white shadow-glow'
                  : 'bg-white/60 dark:bg-white/[0.06] text-ink/50 dark:text-white/40 hover:bg-white dark:hover:bg-white/10'
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {hasContent && (
          <div className="flex items-center gap-2">
            {/* Export CV */}
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition"
              style={{
                background: 'linear-gradient(135deg, rgba(76,195,138,0.15), rgba(45,167,110,0.08))',
                border:     '1px solid rgba(76,195,138,0.30)',
                color:      '#2DA76E',
              }}
            >
              <Download size={14} /> Export CV
            </button>

            {/* Lumi review */}
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
                <><Sparkles size={14} /> Lumi reviews my CV</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ── Lumi review panel ────────────────────────────────── */}
      <AnimatePresence>
        {review && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 rounded-3xl p-6 relative"
            style={{
              background:           'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(124,58,237,0.04))',
              border:               '1px solid rgba(168,85,247,0.20)',
              backdropFilter:       'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg">✦</span>
                <span className="font-display font-bold text-ink dark:text-white text-sm">Lumi's CV Review</span>
                <span className="text-xs text-violet-500 font-medium px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(168,85,247,0.10)' }}>
                  Senior Recruiter Perspective
                </span>
              </div>
              <button onClick={() => setReview(null)}
                className="text-ink/30 dark:text-white/30 hover:text-coral-500 transition shrink-0">
                <X size={16} />
              </button>
            </div>
            <div className="text-sm text-ink/70 dark:text-white/60 leading-relaxed whitespace-pre-line">
              {review}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Experience ───────────────────────────────────────── */}
      {tab === 'experience' && (
        data.experience.length === 0 ? (
          <EmptyState icon={Briefcase} title="No experience yet"
            description="Add a role you've worked to show your career history." />
        ) : (
          <div className="flex flex-col gap-4">
            {data.experience.map((x, i) => (
              <GlassCard key={x.id} delay={i * 0.04} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-ink dark:text-white">{x.role}</h3>
                    <p className="text-sm text-ink/50 dark:text-white/40">
                      {x.company}{x.location && ` · ${x.location}`}
                    </p>
                    <p className="text-xs text-ink/35 dark:text-white/30 mt-0.5">
                      {x.start_date || '—'} – {x.is_current ? 'Present' : (x.end_date || '—')}
                    </p>
                  </div>
                  <button onClick={() => removeItem('experience', x.id)}
                    className="text-ink/25 hover:text-coral-500 transition shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
                {x.description && <p className="text-sm text-ink/60 dark:text-white/50 mt-2 whitespace-pre-line">{x.description}</p>}
              </GlassCard>
            ))}
          </div>
        )
      )}

      {/* ── Education ────────────────────────────────────────── */}
      {tab === 'education' && (
        data.education.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No education yet"
            description="Add your degrees or coursework." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.education.map((ed, i) => (
              <GlassCard key={ed.id} delay={i * 0.04} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-ink dark:text-white">{ed.school}</h3>
                    <p className="text-sm text-ink/50 dark:text-white/40">
                      {ed.degree}{ed.field && ` · ${ed.field}`}
                    </p>
                    <p className="text-xs text-ink/35 dark:text-white/30 mt-0.5">
                      {ed.start_date || '—'} – {ed.end_date || 'Present'}
                    </p>
                  </div>
                  <button onClick={() => removeItem('education', ed.id)}
                    className="text-ink/25 hover:text-coral-500 transition shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
                {ed.description && <p className="text-sm text-ink/60 dark:text-white/50 mt-2">{ed.description}</p>}
              </GlassCard>
            ))}
          </div>
        )
      )}

      {/* ── Projects ─────────────────────────────────────────── */}
      {tab === 'projects' && (
        data.projects.length === 0 ? (
          <EmptyState icon={FolderGit2} title="No projects yet"
            description="Add a project you've built to showcase on your CV." />
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
                {p.description && <p className="text-sm text-ink/50 dark:text-white/40 mt-1.5">{p.description}</p>}
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

      {/* ── Skills ───────────────────────────────────────────── */}
      {tab === 'skills' && (
        data.skills.length === 0 ? (
          <EmptyState icon={Lightbulb} title="No skills yet"
            description="Add the skills you want recruiters to see." />
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

      {/* ── Certifications ───────────────────────────────────── */}
      {tab === 'certifications' && (
        data.certifications.length === 0 ? (
          <EmptyState icon={Award} title="No certifications yet"
            description="Add certifications you've earned." />
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Add ${TAB_SINGULAR[tab]}`}>
        <form onSubmit={createItem} className="flex flex-col gap-3.5">
          {tab === 'experience' && (
            <>
              <div className="flex items-center gap-2">
                <input className="input-field flex-1" placeholder="Job title"
                  value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  autoFocus required />
                <VoiceInputButton size="sm" onText={(c) => setForm((f) => ({ ...f, role: appendText(f.role, c) }))} />
              </div>
              <div className="flex items-center gap-2">
                <input className="input-field flex-1" placeholder="Company"
                  value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                <VoiceInputButton size="sm" onText={(c) => setForm((f) => ({ ...f, company: appendText(f.company, c) }))} />
              </div>
              <div className="flex items-center gap-2">
                <input className="input-field flex-1" placeholder="Location (optional)"
                  value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                <VoiceInputButton size="sm" onText={(c) => setForm((f) => ({ ...f, location: appendText(f.location, c) }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="input-field" placeholder="Start (e.g. Jan 2023)"
                  value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                <input className="input-field" placeholder="End (e.g. Mar 2025)"
                  value={form.end_date} disabled={form.is_current}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink/60 dark:text-white/50 -mt-1">
                <input type="checkbox" checked={form.is_current}
                  onChange={(e) => setForm({ ...form, is_current: e.target.checked, end_date: e.target.checked ? '' : form.end_date })} />
                I currently work here
              </label>
              <div className="flex items-start gap-2">
                <textarea className="input-field flex-1" placeholder="What did you do? (bullet points work great)" rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <VoiceInputButton size="sm" className="mt-1" onText={(c) => setForm((f) => ({ ...f, description: appendText(f.description, c) }))} />
              </div>
            </>
          )}
          {tab === 'education' && (
            <>
              <div className="flex items-center gap-2">
                <input className="input-field flex-1" placeholder="School / University"
                  value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })}
                  autoFocus required />
                <VoiceInputButton size="sm" onText={(c) => setForm((f) => ({ ...f, school: appendText(f.school, c) }))} />
              </div>
              <div className="flex items-center gap-2">
                <input className="input-field flex-1" placeholder="Degree, e.g. Bachelor of Science"
                  value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} />
                <VoiceInputButton size="sm" onText={(c) => setForm((f) => ({ ...f, degree: appendText(f.degree, c) }))} />
              </div>
              <div className="flex items-center gap-2">
                <input className="input-field flex-1" placeholder="Field of study (optional)"
                  value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })} />
                <VoiceInputButton size="sm" onText={(c) => setForm((f) => ({ ...f, field: appendText(f.field, c) }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input className="input-field" placeholder="Start (e.g. 2021)"
                  value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                <input className="input-field" placeholder="End (e.g. 2025)"
                  value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div className="flex items-start gap-2">
                <textarea className="input-field flex-1" placeholder="Notes (optional) — honors, relevant coursework, GPA" rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <VoiceInputButton size="sm" className="mt-1" onText={(c) => setForm((f) => ({ ...f, description: appendText(f.description, c) }))} />
              </div>
            </>
          )}
          {tab === 'projects' && (
            <>
              {launchpadProjects.length > 0 && (
                <div>
                  <select
                    className="input-field"
                    defaultValue=""
                    onChange={(e) => {
                      const proj = launchpadProjects.find((p) => String(p.id) === e.target.value);
                      if (!proj) return;
                      setForm((f) => ({ ...f, title: proj.title || f.title, description: proj.description || f.description }));
                      e.target.value = ''; // reset to placeholder — this is a one-shot fill, not a bound field
                    }}
                  >
                    <option value="" disabled>Pull from your Projects tab…</option>
                    {launchpadProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-ink/35 mt-1">Fills the title and description below — tech stack and link still need a quick fill-in.</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input className="input-field flex-1" placeholder="Project title"
                  value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  autoFocus required />
                <VoiceInputButton size="sm" onText={(c) => setForm((f) => ({ ...f, title: appendText(f.title, c) }))} />
              </div>
              <div className="flex items-start gap-2">
                <textarea className="input-field flex-1" placeholder="Description" rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <VoiceInputButton size="sm" className="mt-1" onText={(c) => setForm((f) => ({ ...f, description: appendText(f.description, c) }))} />
              </div>
              <div className="flex items-center gap-2">
                <input className="input-field flex-1" placeholder="Tech stack (e.g. React, Node)"
                  value={form.tech}
                  onChange={(e) => setForm({ ...form, tech: e.target.value })} />
                <VoiceInputButton size="sm" onText={(c) => setForm((f) => ({ ...f, tech: appendText(f.tech, c) }))} />
              </div>
              <input className="input-field" placeholder="Link (optional)"
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })} />
            </>
          )}
          {tab === 'skills' && (
            <>
              <div className="flex items-center gap-2">
                <input className="input-field flex-1" placeholder="Skill name"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoFocus required />
                <VoiceInputButton size="sm" onText={(c) => setForm((f) => ({ ...f, name: appendText(f.name, c) }))} />
              </div>
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
              <div className="flex items-center gap-2">
                <input className="input-field flex-1" placeholder="Certification title"
                  value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  autoFocus required />
                <VoiceInputButton size="sm" onText={(c) => setForm((f) => ({ ...f, title: appendText(f.title, c) }))} />
              </div>
              <div className="flex items-center gap-2">
                <input className="input-field flex-1" placeholder="Issuer"
                  value={form.issuer}
                  onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
                <VoiceInputButton size="sm" onText={(c) => setForm((f) => ({ ...f, issuer: appendText(f.issuer, c) }))} />
              </div>
              <input type="date" className="input-field"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <input className="input-field" placeholder="Link (optional)"
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })} />
            </>
          )}
          <button type="submit" className="btn-primary justify-center mt-1">Add</button>
        </form>
      </Modal>

      {/* ── Export modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showExport && (
          <CVExportModal
            data={data}
            profile={profile}
            userName={user?.name || ''}
            userEmail={user?.email || ''}
            onClose={() => setShowExport(false)}
          />
        )}
      </AnimatePresence>

      {cropSrc && (
        <AvatarCropper
          imageSrc={cropSrc}
          onSave={handleCropSave}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}