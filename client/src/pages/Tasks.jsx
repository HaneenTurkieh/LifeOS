import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus, Trash2, Pencil, Calendar, Clock, ListChecks,
  Circle, CheckCircle2, ChevronDown, ChevronRight, RefreshCw, Timer, Sparkles,
} from 'lucide-react';
import { api }       from '../api/client.js';
import { useToast }  from '../context/ToastContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import PageHeader    from '../components/PageHeader.jsx';
import PriorityPill  from '../components/PriorityPill.jsx';
import Modal         from '../components/Modal.jsx';
import EmptyState    from '../components/EmptyState.jsx';
import PageLoader    from '../components/Loader.jsx';
import VoiceInputButton, { appendText } from '../components/VoiceInputButton.jsx';
import ReminderPicker from '../components/ReminderPicker.jsx';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
function localTodayStr()   { return new Date().toLocaleDateString('en-CA'); }
function localOffsetStr(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}
function daysUntil(deadline) {
  if (!deadline) return null;
  const [dy, dm, dd] = deadline.split('-').map(Number);
  const now    = new Date();
  const local  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dy, dm - 1, dd);
  return Math.ceil((target - local) / (1000 * 60 * 60 * 24));
}
function formatDate(s) {
  if (!s) return null;
  const [, mo, d] = s.split('-');
  return `${d}/${mo}`;
}
function sortByPriority(tasks) {
  return [...tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 1;
    const pb = PRIORITY_ORDER[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    if (a.deadline_time && b.deadline_time) return a.deadline_time.localeCompare(b.deadline_time);
    if (a.deadline_time) return -1;
    if (b.deadline_time) return 1;
    return 0;
  });
}
// Fixed set on purpose — this used to be a freeform text input, which
// meant every user invented their own spelling ("uni", "Uni", "School",
// "university stuff"...) and analytics could never group tasks by
// category since there was no shared vocabulary. Stored as a stable
// English slug regardless of UI language (same pattern as `priority`:
// 'high'/'medium'/'low' stored, translated only for display) so category
// grouping in Stats stays consistent no matter what language someone's
// using Nuvora in. 'other' is the escape hatch — picking it reveals a
// free-text field, and whatever's typed there is what actually gets
// saved (not the literal word "other").
const CATEGORY_OPTIONS = [
  { value: 'general',    labelKey: 'tasks.categoryGeneral' },
  { value: 'university', labelKey: 'tasks.categoryUniversity' },
  { value: 'personal',   labelKey: 'tasks.categoryPersonal' },
  { value: 'health',     labelKey: 'tasks.categoryHealth' },
  { value: 'finance',    labelKey: 'tasks.categoryFinance' },
  { value: 'other',      labelKey: 'tasks.categoryOther' },
];
const KNOWN_CATEGORY_VALUES = new Set(CATEGORY_OPTIONS.map(o => o.value).filter(v => v !== 'other'));
// Given whatever's stored in a task's `category` column (old freeform
// text, a known slug, or empty), figure out which dropdown option should
// be selected — falls back to 'other' with the raw value preserved so
// legacy freeform categories never silently disappear when you edit an
// older task.
function categoryToSelect(cat) {
  const norm = (cat || '').trim().toLowerCase();
  if (!norm) return { select: 'general', custom: '' };
  if (KNOWN_CATEGORY_VALUES.has(norm)) return { select: norm, custom: '' };
  return { select: 'other', custom: cat };
}
const emptyForm = {
  title:'', description:'', priority:'medium',
  category:'general', categorySelect:'general', categoryCustom:'',
  deadline:'', deadline_time:'',
  recurrenceType:'', customDays:[], remindOffsets:[60], recurrenceUntil:'',
};
function formToRecurrence(form) {
  if (!form.recurrenceType) return null;
  if (form.recurrenceType === 'custom') {
    if (!form.customDays.length) return null;
    return `custom:${form.customDays.sort((a,b)=>a-b).join(',')}`;
  }
  return form.recurrenceType;
}
function recurrenceToForm(recurrence) {
  if (!recurrence) return { recurrenceType:'', customDays:[] };
  if (['daily','weekly','monthly','yearly'].includes(recurrence))
    return { recurrenceType: recurrence, customDays:[] };
  if (recurrence.startsWith('custom:'))
    return { recurrenceType:'custom', customDays: recurrence.split(':')[1].split(',').map(Number) };
  return { recurrenceType:'', customDays:[] };
}

export default function Tasks() {
  const [tasks,         setTasks]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [form,          setForm]          = useState(emptyForm);
  const [editingTask,   setEditingTask]   = useState(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [stuckTask,     setStuckTask]     = useState(null);
  const toast = useToast();
  const { t, lang } = useLanguage();
  const dateLocale = lang === 'ar' ? 'ar' : 'en-US';
  const dayLetter = (i) => new Date(2023, 0, 1 + i).toLocaleDateString(dateLocale, { weekday:'narrow' });
  const dayShort  = (i) => new Date(2023, 0, 1 + i).toLocaleDateString(dateLocale, { weekday:'short'  });
  const formatTime = (tm) => {
    if (!tm) return null;
    const [h, m] = tm.split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(dateLocale, { hour:'numeric', minute:'2-digit' });
  };
  // Rows sit under a per-day header now, so each one only needs to show
  // its own time — repeating the date on every row would be redundant.
  const formatCompletedTime = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString(dateLocale, { hour:'numeric', minute:'2-digit' });
  };
  const recurrenceLabel = (r) => {
    if (!r) return null;
    if (r === 'daily')   return t('tasks.daily');
    if (r === 'weekly')  return t('tasks.weekly');
    if (r === 'monthly') return t('tasks.monthly');
    if (r === 'yearly')  return t('tasks.yearly');
    if (r?.startsWith('custom:')) {
      const days = r.split(':')[1].split(',').map(Number);
      if (days.length === 7) return t('tasks.everyDay');
      if (JSON.stringify([...days].sort()) === JSON.stringify([1,2,3,4,5])) return t('tasks.weekdays');
      if (JSON.stringify([...days].sort()) === JSON.stringify([0,6]))       return t('tasks.weekends');
      return days.map(d => dayShort(d)).join('، ');
    }
    return null;
  };
  const RECURRENCE_OPTIONS = [
    { value:'',        label:t('tasks.never')   },
    { value:'daily',   label:t('tasks.daily')   },
    { value:'custom',  label:t('tasks.custom')  },
    { value:'weekly',  label:t('tasks.weekly')  },
    { value:'monthly', label:t('tasks.monthly') },
    { value:'yearly',  label:t('tasks.yearly')  },
  ];
  const load = useCallback(async () => {
    try {
      const data = await api.get('/tasks');
      // The Nuvora-added birthday entry (source: 'nuvora') belongs on
      // the Calendar only — it's not something to manage from a task
      // list (mark done, edit, delete), just a date marker.
      setTasks(data.filter(tk => tk.source !== 'nuvora').map(tk => ({ ...tk, priority: (tk.priority||'medium').toLowerCase() })));
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handler = () => { setEditingTask(null); setForm(emptyForm); setModalOpen(true); };
    window.addEventListener('nuvora:new-task', handler);
    return () => window.removeEventListener('nuvora:new-task', handler);
  }, []);
  const today    = localTodayStr();
  const tomorrow = localOffsetStr(1);
  const in7Days  = localOffsetStr(7);
  const active    = tasks.filter(tk => tk.status !== 'done');
  const completed = tasks.filter(tk => tk.status === 'done');
  const groups = {
    // Overdue used to be folded into "Today" (anything with deadline <=
    // today landed here) so it was never actually invisible — each card
    // still shows its own red "🚨 Overdue" pill (see TaskCard below) —
    // but it took reading every card's pill to tell "genuinely late"
    // apart from "due today," especially once there were more than a
    // couple. Its own section makes that obvious at a glance instead.
    overdue:  sortByPriority(active.filter(tk => tk.deadline && tk.deadline < today)),
    today:    sortByPriority(active.filter(tk => !tk.deadline || tk.deadline === today)),
    tomorrow: sortByPriority(active.filter(tk => tk.deadline === tomorrow)),
    week:     sortByPriority(active.filter(tk => tk.deadline && tk.deadline > tomorrow && tk.deadline <= in7Days)),
    later:    sortByPriority(active.filter(tk => tk.deadline && tk.deadline > in7Days)),
  };
  const yesterday = localOffsetStr(-1);
  // Group completed tasks by the day they were finished — a flat list
  // of 50 done tasks is unscannable, but "Today / Yesterday / Aug 3 /
  // Jul 30 ..." clusters read the way Messages or Photos group by day.
  const completedGroups = useMemo(() => {
    const buckets = new Map();
    for (const tk of completed) {
      const key = tk.completed_at ? tk.completed_at.slice(0, 10) : 'unknown';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(tk);
    }
    const labelFor = (key) => {
      if (key === today)     return t('common.today');
      if (key === yesterday) return t('common.yesterday');
      if (key === 'unknown') return t('tasks.earlier');
      const d = new Date(`${key}T00:00:00`);
      const sameYear = d.getFullYear() === new Date().getFullYear();
      return d.toLocaleDateString(dateLocale, sameYear ? { day:'numeric', month:'short' } : { day:'numeric', month:'short', year:'numeric' });
    };
    return [...buckets.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, list]) => ({
        key,
        label: labelFor(key),
        tasks: list.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || '')),
      }));
  }, [completed, today, yesterday, dateLocale, t]);
  const markDone = async (task) => {
    setTasks(prev => prev.map(tk => tk.id === task.id ? { ...tk, status:'done', progress:100 } : tk));
    try {
      const { xpAwarded, unlocked, nextTask } = await api.put(`/tasks/${task.id}`, { status:'done', progress:100 });
      if (xpAwarded) toast.xp(xpAwarded, task.title);
      unlocked?.forEach(k => toast.achievement(k.replace(/_/g,' ')));
      if (nextTask) {
        const norm = { ...nextTask, priority: (nextTask.priority||'medium').toLowerCase() };
        setTasks(prev => [
          ...prev.filter(tk => tk.id !== task.id),
          { ...prev.find(tk => tk.id === task.id), status:'done', progress:100 },
          norm,
        ]);
        toast.success(t('tasks.nextOccur', { date: formatDate(nextTask.deadline) }));
      }
    } catch (err) { toast.error(err.message); load(); }
  };
  const markUndone = async (task) => {
    setTasks(prev => prev.map(tk => tk.id === task.id ? { ...tk, status:'todo', progress:0 } : tk));
    try { await api.put(`/tasks/${task.id}`, { status:'todo', progress:0 }); }
    catch (err) { toast.error(err.message); load(); }
  };
  const openCreateModal = () => { setEditingTask(null); setForm(emptyForm); setModalOpen(true); };
  const openEditModal   = (task) => {
    setEditingTask(task);
    const { recurrenceType, customDays } = recurrenceToForm(task.recurrence);
    let remindOffsets = [60];
    if (task.remind_offsets_min) {
      try {
        const parsed = JSON.parse(task.remind_offsets_min);
        if (Array.isArray(parsed)) remindOffsets = parsed;
      } catch (_) { /* malformed — fall back to the default */ }
    }
    const { select: categorySelect, custom: categoryCustom } = categoryToSelect(task.category);
    setForm({
      title: task.title, description: task.description||'',
      priority: (task.priority||'medium').toLowerCase(),
      category: task.category, categorySelect, categoryCustom,
      deadline: task.deadline||'',
      deadline_time: task.deadline_time||'', recurrenceType, customDays,
      remindOffsets, recurrenceUntil: task.recurrence_until || '',
    });
    setModalOpen(true);
  };
  const submitForm = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      const recurrence = formToRecurrence(form);
      const payload = {
        title: form.title.trim(), description: form.description,
        // "Other" picked but left blank on submit → don't save an empty
        // category string, fall back to 'general' rather than leaving the
        // task uncategorized.
        priority: form.priority, category: form.category.trim() || 'general',
        deadline: form.deadline||null, deadline_time: form.deadline_time||null,
        recurrence,
        // No recurrence means there's no chain for an end date to cut
        // off — same reasoning as remind_offsets_min just below not
        // persisting for a task with no deadline_time to count from.
        recurrence_until: recurrence ? (form.recurrenceUntil || null) : null,
        // No time set means "remind before" has nothing to count from —
        // don't persist a stale offset list for a task that can't use it.
        remind_offsets_min: form.deadline_time ? form.remindOffsets : null,
      };
      if (editingTask) { await api.put(`/tasks/${editingTask.id}`, payload); toast.success(t('tasks.updated')); }
      else             { await api.post('/tasks', payload);                   toast.success(t('tasks.added'));   }
      setForm(emptyForm); setEditingTask(null); setModalOpen(false); load();
    } catch (err) { toast.error(err.message); }
  };
  const removeTask = async (id) => {
    setTasks(prev => prev.filter(tk => tk.id !== id));
    try { await api.del(`/tasks/${id}`); toast.success(t('tasks.deleted')); }
    catch (err) { toast.error(err.message); load(); }
  };
  if (loading) return <PageLoader />;
  const isEmpty = active.length === 0 && completed.length === 0;
  return (
    <div>
      <PageHeader
        eyebrow={t('tasks.eyebrow')} title={t('tasks.title')}
        subtitle={t('tasks.subtitle')}
        action={<button className="btn-primary" onClick={openCreateModal}><Plus size={16}/> {t('tasks.newTask')}</button>}
      />
      {isEmpty ? (
        <EmptyState icon={ListChecks} title={t('tasks.emptyTitle')}
          description={t('tasks.emptyDesc')}
          action={<button className="btn-primary w-full justify-center" onClick={openCreateModal}><Plus size={16}/> {t('tasks.addFirst')}</button>}
        />
      ) : (
        <div className="flex flex-col gap-8">
          <TaskGroup label={t('tasks.overdue')}    tasks={groups.overdue}  onEdit={openEditModal} onDelete={removeTask} onMarkDone={markDone} onAskLumi={setStuckTask} t={t} formatTime={formatTime} recurrenceLabel={recurrenceLabel} urgent />
          <TaskGroup label={t('common.today')}    tasks={groups.today}    onEdit={openEditModal} onDelete={removeTask} onMarkDone={markDone} onAskLumi={setStuckTask} t={t} formatTime={formatTime} recurrenceLabel={recurrenceLabel} />
          <TaskGroup label={t('common.tomorrow')} tasks={groups.tomorrow} onEdit={openEditModal} onDelete={removeTask} onMarkDone={markDone} onAskLumi={setStuckTask} t={t} formatTime={formatTime} recurrenceLabel={recurrenceLabel} />
          <TaskGroup label={t('tasks.next7')}     tasks={groups.week}     onEdit={openEditModal} onDelete={removeTask} onMarkDone={markDone} onAskLumi={setStuckTask} t={t} formatTime={formatTime} recurrenceLabel={recurrenceLabel} />
          <TaskGroup label={t('tasks.later')}     tasks={groups.later}    onEdit={openEditModal} onDelete={removeTask} onMarkDone={markDone} onAskLumi={setStuckTask} t={t} formatTime={formatTime} recurrenceLabel={recurrenceLabel} />
          {completed.length > 0 && (
            <div>
              <button onClick={() => setCompletedOpen(o=>!o)}
                className="flex items-center gap-2 text-sm font-medium text-ink/50 dark:text-white/40 hover:text-ink/70 dark:hover:text-white/60 transition mb-3">
                {completedOpen ? <ChevronDown size={15}/> : <ChevronRight size={15} className="rtl:rotate-180"/>}
                {t('tasks.showCompleted', { n: completed.length })}
              </button>
              <AnimatePresence>
                {completedOpen && (
                  <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }} className="overflow-hidden">
                    <div className="flex flex-col gap-4">
                      {completedGroups.map(group => (
                        <div key={group.key}>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-ink/30 dark:text-white/25 mb-1.5 px-1">
                            {group.label}
                          </p>
                          <div className="flex flex-col gap-1">
                            {group.tasks.map(task => (
                              <TaskCard key={task.id} task={task} onDelete={removeTask} onMarkUndone={markUndone} done t={t} formatCompletedTime={formatCompletedTime} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingTask ? t('tasks.editTask') : t('tasks.newTask')}>
        <form onSubmit={submitForm} className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2">
            <input className="input-field flex-1" placeholder={t('tasks.taskTitle')} value={form.title}
              onChange={e => setForm({...form, title:e.target.value})} autoFocus required />
            <VoiceInputButton size="sm" onText={(chunk) => setForm(f => ({...f, title: appendText(f.title, chunk)}))} />
          </div>
          <div className="flex items-start gap-2">
            <textarea className="input-field flex-1" placeholder={t('goals.descPh')} rows={2}
              value={form.description} onChange={e => setForm({...form, description:e.target.value})} />
            <VoiceInputButton size="sm" className="mt-1" onText={(chunk) => setForm(f => ({...f, description: appendText(f.description, chunk)}))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className="input-field" value={form.priority} onChange={e => setForm({...form, priority:e.target.value})}>
              <option value="high">{t('tasks.priorityHigh')}</option>
              <option value="medium">{t('tasks.priorityMed')}</option>
              <option value="low">{t('tasks.priorityLow')}</option>
            </select>
            <select className="input-field" value={form.categorySelect}
              onChange={e => {
                const categorySelect = e.target.value;
                setForm(f => ({
                  ...f, categorySelect,
                  // Known option → that's the stored category outright.
                  // 'other' → stored category is whatever's already in the
                  // custom field (empty until they type something).
                  category: categorySelect === 'other' ? f.categoryCustom : categorySelect,
                }));
              }}>
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
          </div>
          {form.categorySelect === 'other' && (
            <input className="input-field" placeholder={t('tasks.categoryCustomPlaceholder')}
              value={form.categoryCustom}
              onChange={e => setForm(f => ({ ...f, categoryCustom: e.target.value, category: e.target.value }))} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-ink/40 dark:text-white/35 mb-1 block">{t('tasks.deadlineDateLabel')}</label>
              {/* input type="date"/"time" ignore the placeholder attribute
                  entirely — there's no native way to show dim hint text in
                  an empty one. Some browsers fill that gap with their own
                  "dd/mm/yyyy"-style hint, but iOS Safari renders truly
                  blank, which read as a broken/dead field. This overlay
                  (pointer-events-none, so every click still reaches the
                  real input underneath) fakes the same dim placeholder
                  look everywhere, consistently. */}
              <div className="relative">
                {/* color:transparent when empty hides the browser's OWN
                    built-in empty-state text (desktop Chrome shows a real
                    "dd/mm/yyyy" here) so it can't visually double up with
                    the overlay below on browsers that don't render blank
                    like iOS Safari does — only one placeholder ever shows. */}
                {/* autoComplete="off" + a name Safari's autofill heuristics
                    won't recognize — without these, Safari sometimes
                    "suggests" a guessed date into an untyped date input and
                    paints its own text on top using -webkit-text-fill-color,
                    which our color:transparent trick above can't override
                    (that's the stray pre-filled date some people were
                    seeing here instead of an empty field). */}
                <input type="date" className="input-field" value={form.deadline}
                  autoComplete="off" name="nuvora-task-deadline-date"
                  style={!form.deadline ? { color: 'transparent', WebkitTextFillColor: 'transparent' } : undefined}
                  onChange={e => setForm({...form, deadline:e.target.value})}
                  onClick={e => e.currentTarget.showPicker?.()} />
                {!form.deadline && (
                  <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-sm text-ink/40 dark:text-white/30">
                    {t('tasks.selectDate')}
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="text-[11px] text-ink/40 dark:text-white/35 mb-1 block">{t('tasks.deadlineTimeLabel')}</label>
              <div className="relative">
                <input type="time" className="input-field" value={form.deadline_time}
                  autoComplete="off" name="nuvora-task-deadline-time"
                  style={!form.deadline_time ? { color: 'transparent', WebkitTextFillColor: 'transparent' } : undefined}
                  onChange={e => setForm({...form, deadline_time:e.target.value})}
                  onClick={e => e.currentTarget.showPicker?.()} />
                {!form.deadline_time && (
                  <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-sm text-ink/40 dark:text-white/30">
                    {t('tasks.selectTime')}
                  </span>
                )}
              </div>
            </div>
          </div>
          {form.deadline_time && (
            <ReminderPicker
              value={form.remindOffsets}
              onChange={(remindOffsets) => setForm(f => ({ ...f, remindOffsets }))}
              t={t}
            />
          )}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-2 block">{t('tasks.repeat')}</label>
            <div className="flex flex-wrap gap-2">
              {RECURRENCE_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setForm({...form, recurrenceType:opt.value, customDays: opt.value==='custom'?[1,2,3,4,5]:[]})}
                  className="rounded-2xl px-4 py-2 text-xs font-semibold transition-all"
                  style={form.recurrenceType === opt.value ? {
                    background:'linear-gradient(135deg, rgb(var(--accent-500)), rgb(var(--accent-600)))', color:'white',
                    boxShadow:'0 4px 12px rgb(var(--accent-500) / 0.30)',
                  } : {
                    background:'rgb(var(--accent-500) / 0.08)', border:'1px solid rgb(var(--accent-500) / 0.15)',
                    color:'rgb(var(--accent-500) / 0.65)',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {form.recurrenceType === 'custom' && (
              <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}>
                <p className="text-[11px] text-ink/35 dark:text-white/25 mt-3 mb-1">{t('tasks.pickDays')}</p>
                <div className="flex gap-2 mt-2">
                  {Array.from({ length: 7 }, (_, i) => {
                    const isOn = form.customDays.includes(i);
                    return (
                      <button key={i} type="button"
                        onClick={() => setForm({...form, customDays: isOn ? form.customDays.filter(x=>x!==i) : [...form.customDays, i]})}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all"
                        style={isOn ? {
                          background:'linear-gradient(135deg, rgb(var(--accent-500)), rgb(var(--accent-600)))',
                          color:'white', boxShadow:'0 4px 12px rgb(var(--accent-500) / 0.35)',
                        } : {
                          background:'rgb(var(--accent-500) / 0.08)',
                          border:'1px solid rgb(var(--accent-500) / 0.18)',
                          color:'rgb(var(--accent-500) / 0.60)',
                        }}>
                        {dayLetter(i)}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
            {form.recurrenceType && (
              // Repeat had no way to ever stop on its own — a task tied
              // to a class, a season, a course, etc. either repeated
              // forever or had to be deleted by hand once it was over.
              // Optional: leaving this blank keeps today's "repeats
              // forever" behavior exactly as-is.
              <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} className="mt-3">
                <label className="text-[11px] text-ink/35 dark:text-white/25 mb-1 block">{t('tasks.repeatUntil')}</label>
                <input type="date" value={form.recurrenceUntil}
                  min={form.deadline || undefined}
                  onChange={(e) => setForm({...form, recurrenceUntil: e.target.value})}
                  className="input-field" style={{ maxWidth: 200 }} />
              </motion.div>
            )}
          </div>
          <button type="submit" className="btn-primary justify-center mt-1">
            {editingTask ? t('calendar.saveChanges') : t('tasks.addTask')}
          </button>
        </form>
      </Modal>
      <AntiProcrastinationModal task={stuckTask} onClose={() => setStuckTask(null)} t={t} lang={lang} />
    </div>
  );
}
// Anti-procrastination helper — no penalty, no coins taken, nothing
// tracked against the user. Lumi reads the actual task (and description,
// if there is one) and proposes three differently-sized, task-specific
// on-ramps (5 min / 15 min / 1 hour) for a task that's been sitting
// untouched — a real model call per click, not a fill-in-the-blank
// template, so the suggestions actually fit what the task involves.
function AntiProcrastinationModal({ task, onClose, t, lang }) {
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState(null);
  useEffect(() => {
    if (!task) { setVersions(null); return; }
    // Real bug that used to live here: switching from one "stuck?" task
    // to another before the first request finished had no guard against
    // the responses landing out of order — whichever network response
    // arrived LAST won via setVersions, even if it was for the task that
    // was no longer showing. `ignore` (the standard React pattern for
    // this) makes a stale response for an already-superseded task a
    // no-op instead.
    let ignore = false;
    setLoading(true);
    setVersions(null);
    api.post('/ai/anti-procrastination', { title: task.title, description: task.description || '' })
      .then((res) => { if (!ignore) setVersions(res); })
      .catch(() => { if (!ignore) setVersions(null); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [task]);
  const OPTIONS = versions ? [
    { key: 'five_minute',    label: t('tasks.stuck5min'),  text: versions.five_minute },
    { key: 'fifteen_minute', label: t('tasks.stuck15min'), text: versions.fifteen_minute },
    { key: 'one_hour',       label: t('tasks.stuck1hr'),   text: versions.one_hour },
  ] : [];
  return (
    <Modal open={!!task} onClose={onClose} title={t('tasks.stuckTitle')}>
      <div className="flex items-start gap-2.5 mb-4">
        <Sparkles size={16} className="shrink-0 mt-0.5" style={{ color: 'rgb(var(--accent-500))' }} />
        <p className="text-sm text-ink/60 dark:text-white/50 leading-relaxed">
          {t('tasks.stuckIntro', { title: task?.title || '' })}
        </p>
      </div>
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="h-5 w-5 rounded-full border-2 border-lavender-400/30 border-t-lavender-500 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {OPTIONS.map(opt => (
            <div key={opt.key} className="rounded-2xl p-3.5"
              style={{ background: 'rgb(var(--accent-500) / 0.06)', border: '1px solid rgb(var(--accent-500) / 0.16)' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgb(var(--accent-500))' }}>
                {opt.label}
              </p>
              <p className="text-sm text-ink/70 dark:text-white/60 leading-relaxed">{opt.text}</p>
            </div>
          ))}
          {!OPTIONS.length && (
            <p className="text-sm text-ink/40 dark:text-white/30 text-center py-4">{t('tasks.stuckError')}</p>
          )}
        </div>
      )}
    </Modal>
  );
}
function TaskGroup({ label, tasks, onEdit, onDelete, onMarkDone, onAskLumi, t, formatTime, recurrenceLabel, urgent = false }) {
  if (!tasks.length) return null;
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <h2 className={`font-display font-semibold text-xs uppercase tracking-widest ${
          urgent ? 'text-coral-500' : 'text-ink/50 dark:text-white/40'
        }`}>{label}</h2>
        <span className={`text-xs rounded-full px-2 py-0.5 ${
          urgent ? 'text-coral-500 bg-coral-500/10' : 'text-ink/30 dark:text-white/25 bg-white/50 dark:bg-white/5'
        }`}>{tasks.length}</span>
        <div className="flex-1 h-px bg-ink/5 dark:bg-white/5" />
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map(task => <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} onMarkDone={onMarkDone} onAskLumi={onAskLumi} t={t} formatTime={formatTime} recurrenceLabel={recurrenceLabel} />)}
      </div>
    </div>
  );
}
function TaskCard({ task, onEdit, onDelete, onMarkDone, onMarkUndone, onAskLumi, done = false, t, formatTime, recurrenceLabel, formatCompletedTime }) {
  // Completed tasks get a deliberately quiet, compact treatment —
  // no priority pill, no "Overdue" alarm (misleading once it's done),
  // no recurrence badge. Just what got done and, since it's already
  // grouped under a day header, just the time it happened.
  if (done) {
    const timeLabel = formatCompletedTime?.(task.completed_at);
    return (
      <motion.div layout
        className="group flex items-center gap-2.5 rounded-xl px-3 py-2 transition
                   bg-sage-500/[0.05] hover:bg-sage-500/[0.09] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
      >
        <button onClick={() => onMarkUndone(task)} className="shrink-0 transition">
          <CheckCircle2 size={15} className="text-sage-500" />
        </button>
        <p className="flex-1 min-w-0 truncate text-[13px] text-ink/40 dark:text-white/30 line-through">
          {task.title}
        </p>
        {timeLabel && (
          <span className="shrink-0 text-[10px] text-ink/30 dark:text-white/25">{timeLabel}</span>
        )}
        <button onClick={() => onDelete(task.id)}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-ink/25 dark:text-white/20 hover:text-coral-500 transition">
          <Trash2 size={12}/>
        </button>
      </motion.div>
    );
  }

  const time  = formatTime(task.deadline_time);
  const date  = formatDate(task.deadline);
  const dl    = daysUntil(task.deadline);
  const label = recurrenceLabel(task.recurrence);
  const isOverdue = dl !== null && dl < 0;
  const isToday   = dl !== null && dl === 0;
  const isSoon    = dl !== null && dl > 0 && dl <= 3;
  return (
    <motion.div layout
      className="group flex items-start gap-3 rounded-2xl border border-white/70 bg-white/70
                  dark:border-white/10 dark:bg-white/[0.04] p-3.5 shadow-sm transition
                  hover:bg-white/90 dark:hover:bg-white/[0.07]"
    >
      {task.is_birthday ? (
        // Birthdays aren't a "done/not done" thing — there's no
        // meaningful completed state for a date that just passes and
        // comes back next year, so no clickable circle at all here.
        <span className="mt-0.5 shrink-0 text-base leading-none" title={t('tasks.birthdayNoDone')}>🎂</span>
      ) : (
        <button onClick={() => onMarkDone(task)} className="mt-0.5 shrink-0 transition">
          <Circle size={18} className="text-ink/25 dark:text-white/25 hover:text-lavender-500" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-ink dark:text-white leading-snug">
            {task.title}
          </p>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
            <button onClick={() => onAskLumi(task)} title={t('tasks.feelingStuck')}
              className="text-ink/30 dark:text-white/25 hover:text-lavender-600 transition">
              <Sparkles size={14}/>
            </button>
            <button onClick={() => onEdit(task)} className="text-ink/30 dark:text-white/25 hover:text-lavender-600 transition">
              <Pencil size={14}/>
            </button>
            <button onClick={() => onDelete(task.id)} className="text-ink/30 dark:text-white/25 hover:text-coral-500 transition">
              <Trash2 size={14}/>
            </button>
          </div>
        </div>
        {task.description && (
          <p className="text-xs text-ink/45 dark:text-white/35 mt-0.5 line-clamp-1">{task.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <PriorityPill priority={task.priority} />
          {task.deadline && (
            <span className={`flex items-center gap-1 text-[11px] font-medium ${
              isOverdue || isToday ? 'text-coral-500'
              : isSoon ? 'text-sun-600'
              : 'text-ink/40 dark:text-white/30'
            }`}>
              <Calendar size={10}/>
              {isOverdue ? t('dash.overdue')
              : isToday  ? t('dash.dueToday')
              : dl === 1 ? t('dash.dueTomorrow')
              : isSoon   ? t('dash.dueInDays', { n: dl })
              : date}
            </span>
          )}
          {time && (
            <span className="flex items-center gap-1 text-[11px] text-ink/40 dark:text-white/30">
              <Clock size={10}/> {time}
            </span>
          )}
          {label && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-lavender-500"
              style={{ background:'rgb(var(--accent-500) / 0.10)', borderRadius:6, padding:'1px 7px' }}>
              <RefreshCw size={9}/> {label}
            </span>
          )}
          {Number(task.time_spent_minutes) > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-ink/40 dark:text-white/30">
              <Timer size={10}/> {t('tasks.focusedTime', { n: Number(task.time_spent_minutes) })}
            </span>
          )}
          {task.source === 'nuvora' && (
            <span className="flex items-center gap-1 text-[11px] font-semibold"
              style={{ color: 'rgb(var(--accent-500))' }}>
              ✨ {t('tasks.addedByNuvora')}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}