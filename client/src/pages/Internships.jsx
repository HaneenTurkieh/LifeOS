import React, { useEffect, useState, useCallback } from 'react';
import { Trash2, Briefcase, Link as LinkIcon, Sparkles } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import GlassCard from '../components/GlassCard.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageLoader from '../components/Loader.jsx';
import VoiceInputButton, { appendText } from '../components/VoiceInputButton.jsx';

const COLUMNS = [
  { key: 'applied',   title: 'Applied',   accent: 'bg-lavender-400' },
  { key: 'interview', title: 'Interview',  accent: 'bg-sun-500' },
  { key: 'accepted',  title: 'Accepted',   accent: 'bg-sage-500' },
  { key: 'rejected',  title: 'Rejected',   accent: 'bg-coral-500' },
];

const emptyForm = { company: '', role: '', status: 'applied', applied_date: '', notes: '', link: '' };

export default function Internships({ openTrigger = 0 }) {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]         = useState(emptyForm);
  const [quickText,    setQuickText]    = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const toast = useToast();
  const { t } = useLanguage();

  const load = useCallback(async () => {
    try { setItems(await api.get('/internships')); } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Launchpad fires this by incrementing openTrigger
  useEffect(() => {
    if (openTrigger > 0) { setForm(emptyForm); setModalOpen(true); }
  }, [openTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // AI quick-add — same extraction pipeline as Tasks/Calendar/Goals'
  // quick-add. Fills this modal's own fields in place.
  const runQuickAdd = async () => {
    const sentence = quickText.trim();
    if (!sentence || quickLoading) return;
    setQuickLoading(true);
    try {
      const res = await api.post('/chat', {
        messages: [{
          role: 'user',
          content: `Extract a job/internship application from this sentence: "${sentence}"

Today's date is ${new Date().toLocaleDateString('en-CA')}. Resolve relative dates ("today", "yesterday", "last Monday") against today.

Return ONLY a JSON object with keys:
- company: string, required
- role: string, required — the job/internship title
- status: "applied", "interview", "accepted", or "rejected" — default "applied" unless the sentence says otherwise (e.g. "got an interview" → "interview", "got rejected" → "rejected", "got the offer" → "accepted")
- applied_date: "YYYY-MM-DD" or null if no date was mentioned
- link: string — a URL if one was actually said/included, else ""
- notes: string — any extra detail beyond company/role, or ""

No explanation, no markdown fences, just the JSON object.`,
        }],
        no_history: true,
        mode: 'chat',
        local_date: new Date().toLocaleDateString('en-CA'),
      });
      let parsed = null;
      try {
        parsed = JSON.parse(res.text.replace(/```json|```/g, '').trim());
      } catch (_) {
        const match = res.text.match(/\{[\s\S]*\}/);
        if (match) { try { parsed = JSON.parse(match[0]); } catch (_) {} }
      }
      if (!parsed?.company || !parsed?.role) { toast.error(t('tasks.quickAddFailed')); return; }
      const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
      const STATUS_VALUES = ['applied','interview','accepted','rejected'];
      setForm(f => ({
        ...f,
        company: parsed.company,
        role: parsed.role,
        status: STATUS_VALUES.includes(parsed.status) ? parsed.status : 'applied',
        applied_date: DATE_RE.test(parsed.applied_date) ? parsed.applied_date : '',
        link: parsed.link || f.link,
        notes: parsed.notes || f.notes,
      }));
      setQuickText('');
    } catch (err) {
      toast.error(err.message || t('tasks.quickAddFailed'));
    } finally {
      setQuickLoading(false);
    }
  };
  const createItem = async (e) => {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    try {
      await api.post('/internships', { ...form, applied_date: form.applied_date || null });
      toast.success(t('internships.addSuccess'));
      setForm(emptyForm);
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.message); }
  };

  const setStatus   = async (item, status) => {
    try { await api.put(`/internships/${item.id}`, { status }); load(); }
    catch (err) { toast.error(err.message); }
  };
  const removeItem  = async (id) => {
    try { await api.del(`/internships/${id}`); toast.success(t('internships.removeSuccess')); load(); }
    catch (err) { toast.error(err.message); }
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      {items.length === 0 ? (
        <EmptyState
          icon={Briefcase} title="No applications yet"
          message="Add the first internship you're applying to."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {COLUMNS.map((col) => (
            <div key={col.key} className="glass-panel rounded-3xl p-4 min-h-[200px]">
              <div className="flex items-center gap-2 px-1 mb-3">
                <span className={`h-2 w-2 rounded-full ${col.accent}`} />
                <h3 className="font-display font-semibold text-sm text-ink">{col.title}</h3>
                <span className="ml-auto text-xs text-ink/40 bg-white/60 rounded-full px-2 py-0.5">
                  {items.filter((i) => i.status === col.key).length}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {items.filter((i) => i.status === col.key).map((item, idx) => (
                  <GlassCard key={item.id} delay={idx * 0.03} className="p-3.5 bg-white/70">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{item.company}</p>
                        <p className="text-xs text-ink/50 truncate">{item.role}</p>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-ink/25 hover:text-coral-500 transition shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {item.applied_date && <p className="text-[11px] text-ink/40 mt-1.5">Applied {item.applied_date}</p>}
                    {item.notes        && <p className="text-xs text-ink/45 mt-1.5">{item.notes}</p>}
                    {item.link         && (
                      <a href={item.link} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[11px] text-lavender-600 hover:underline mt-1.5">
                        <LinkIcon size={10}/> Listing
                      </a>
                    )}
                    <select
                      value={item.status}
                      onChange={(e) => setStatus(item, e.target.value)}
                      className="mt-2.5 w-full rounded-xl border border-white/70 bg-white/60 px-2 py-1.5 text-xs"
                    >
                      {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
                    </select>
                  </GlassCard>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add application">
        <form onSubmit={createItem} className="flex flex-col gap-3.5">
          {/* AI quick-add — type OR speak one sentence and Lumi fills the
              fields below (company/role/status/date/link/notes) for you
              to glance over before hitting "Add application". */}
          <div className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/70
                           dark:border-white/10 dark:bg-white/[0.04] p-2 pl-3.5 shadow-sm">
            <Sparkles size={16} className="shrink-0" style={{ color: 'rgb(var(--accent-500))' }} />
            <input
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-ink dark:text-white
                         placeholder:text-ink/35 dark:placeholder:text-white/30"
              placeholder={t('internships.quickAddPlaceholder')}
              value={quickText}
              onChange={e => setQuickText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !quickLoading) { e.preventDefault(); runQuickAdd(); } }}
              disabled={quickLoading}
            />
            <VoiceInputButton size="sm" onText={(chunk) => setQuickText(v => appendText(v, chunk))} />
            <button type="button" className="btn-primary shrink-0 px-3.5" onClick={runQuickAdd}
              disabled={quickLoading || !quickText.trim()}>
              {quickLoading
                ? <span className="block h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                : t('tasks.quickAddGo')}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input className="input-field flex-1" placeholder={t('internships.companyPh')} value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })} autoFocus required />
            <VoiceInputButton size="sm" onText={(c) => setForm((f) => ({ ...f, company: appendText(f.company, c) }))} />
          </div>
          <div className="flex items-center gap-2">
            <input className="input-field flex-1" placeholder={t('internships.rolePh')} value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })} required />
            <VoiceInputButton size="sm" onText={(c) => setForm((f) => ({ ...f, role: appendText(f.role, c) }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
            </select>
            <input type="date" className="input-field" value={form.applied_date}
              onChange={(e) => setForm({ ...form, applied_date: e.target.value })} />
          </div>
          <input className="input-field" placeholder={t('internships.linkPh')} value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <div className="flex items-center gap-2">
            <textarea className="input-field flex-1" placeholder={t('internships.notesPh')} rows={2} value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <VoiceInputButton size="sm" onText={(c) => setForm((f) => ({ ...f, notes: appendText(f.notes, c) }))} />
          </div>
          <button type="submit" className="btn-primary justify-center mt-1">Add application</button>
        </form>
      </Modal>
    </div>
  );
}