import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, X, Check,
  Pencil, Trash2, Calendar as CalIcon,
} from 'lucide-react';
import { api }      from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import PageHeader   from '../components/PageHeader.jsx';
import Modal        from '../components/Modal.jsx';
import VoiceInputButton, { appendText } from '../components/VoiceInputButton.jsx';
import ReminderPicker from '../components/ReminderPicker.jsx';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
function byPriorityThenNothing(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
}
const PRIORITY_COLORS = {
  high:   { bg:'rgba(255,122,99,0.20)', border:'rgba(255,122,99,0.45)', text:'#FF7A63', dark:'rgba(255,122,99,0.25)' },
  medium: { bg:'rgba(255,184,77,0.20)', border:'rgba(255,184,77,0.45)', text:'#d97706', dark:'rgba(255,184,77,0.25)' },
  low:    { bg:'rgb(var(--accent-500) / 0.15)', border:'rgb(var(--accent-500) / 0.35)', text:'rgb(var(--accent-500))', dark:'rgb(var(--accent-500) / 0.20)' },
};
function daysUntil(deadline) {
  if (!deadline) return null;
  const [dy, dm, dd] = deadline.split('-').map(Number);
  const now    = new Date();
  const local  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dy, dm - 1, dd);
  return Math.ceil((target - local) / (1000 * 60 * 60 * 24));
}
function toDateStr(year, month, day) {
  return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function localToday() {
  const now = new Date();
  return toDateStr(now.getFullYear(), now.getMonth(), now.getDate());
}
const emptyForm = {
  title:'', priority:'medium', category:'general', categorySelect:'general', categoryCustom:'',
  deadline_time:'', description:'',
  remindOffsets:[60], recurrenceType:'', customDays:[], isBirthday:false, recurrenceUntil:'',
};
// Same category vocabulary as Tasks.jsx — a proper dropdown instead of a
// freeform text box, so a task added from Calendar lands in the same
// known buckets ('general', 'university', ...) that Tasks/Analytics
// already group and filter by, rather than an arbitrary typed string.
const CATEGORY_OPTIONS = [
  { value: 'general',    labelKey: 'tasks.categoryGeneral' },
  { value: 'university', labelKey: 'tasks.categoryUniversity' },
  { value: 'personal',   labelKey: 'tasks.categoryPersonal' },
  { value: 'health',     labelKey: 'tasks.categoryHealth' },
  { value: 'finance',    labelKey: 'tasks.categoryFinance' },
  { value: 'other',      labelKey: 'tasks.categoryOther' },
];
const KNOWN_CATEGORY_VALUES = new Set(CATEGORY_OPTIONS.map(o => o.value).filter(v => v !== 'other'));
function categoryToSelect(cat) {
  const norm = (cat || 'general').trim().toLowerCase();
  if (KNOWN_CATEGORY_VALUES.has(norm)) return { select: norm, custom: '' };
  return { select: 'other', custom: cat || '' };
}
// Recurrence encode/decode — same convention as the Tasks page
// (`recurrence` is null, 'daily'/'weekly'/'monthly', or 'custom:0,2,4').
function formToRecurrence(form) {
  if (!form.recurrenceType) return null;
  if (form.recurrenceType === 'custom') {
    if (!form.customDays.length) return null;
    return `custom:${[...form.customDays].sort((a,b)=>a-b).join(',')}`;
  }
  return form.recurrenceType;
}
function recurrenceToForm(recurrence) {
  if (!recurrence) return { recurrenceType:'', customDays:[] };
  if (['daily','weekly','monthly','yearly'].includes(recurrence)) return { recurrenceType: recurrence, customDays:[] };
  if (recurrence.startsWith('custom:')) return { recurrenceType:'custom', customDays: recurrence.split(':')[1].split(',').map(Number) };
  return { recurrenceType:'', customDays:[] };
}
// Row height for the hourly day-view timeline below — 24 of these stacked
// gives the scrollable grid its real height (1248px), which the absolutely
// positioned task blocks and "now" line are then offset against.
const HOUR_H = 52;
// Every timed task renders at this same fixed cosmetic height regardless
// of how long it actually takes — deadline_time is a single point in
// time, there's no real duration anywhere in the data. Two tasks a few
// minutes apart (e.g. 10:52 PM and 11:00 PM) still had this same block
// height, so their absolutely-positioned boxes visually overlapped even
// though nothing in the data called them "the same time" — every task
// rendered at inset-x-0 (full width), so a second one starting inside
// the first's box just stacked directly on top of it, unreadable.
const TASK_BLOCK_MIN = HOUR_H * 0.72;

// Classic calendar side-by-side layout: cluster together any tasks whose
// rendered boxes actually overlap (chained — if A overlaps B and B
// overlaps C, all three share a cluster even if A and C don't directly
// touch, since they still have to split the same width), then within
// each cluster greedily assign the lowest column whose previous
// occupant has already "ended" by the time this one starts. Returns the
// original tasks, each tagged with which column it's in and how many
// columns its cluster needs total.
function layoutTimedTasks(tasks) {
  const items = tasks
    .map((task) => {
      const [hh, mm] = task.deadline_time.split(':').map(Number);
      const start = hh * 60 + mm;
      return { task, start, end: start + (TASK_BLOCK_MIN / HOUR_H) * 60 };
    })
    .sort((a, b) => a.start - b.start);

  const clusters = [];
  let current = [];
  let clusterEnd = -Infinity;
  for (const item of items) {
    if (current.length && item.start >= clusterEnd) {
      clusters.push(current);
      current = [];
      clusterEnd = -Infinity;
    }
    current.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (current.length) clusters.push(current);

  const result = [];
  for (const cluster of clusters) {
    const colEnds = [];
    for (const item of cluster) {
      let col = colEnds.findIndex((end) => item.start >= end);
      if (col === -1) { col = colEnds.length; colEnds.push(item.end); }
      else { colEnds[col] = item.end; }
      item.col = col;
    }
    const cols = colEnds.length;
    for (const item of cluster) result.push({ task: item.task, col: item.col, cols });
  }
  return result;
}

export default function Calendar() {
  const toast             = useToast();
  const { resolvedTheme } = useTheme();
  const { t, lang }       = useLanguage();
  const isDark            = resolvedTheme === 'dark';
  const now               = new Date();
  const dateLocale = lang === 'ar' ? 'ar' : 'en-US';
  const dayLetter = (i) => new Date(2023, 0, 1 + i).toLocaleDateString(dateLocale, { weekday:'narrow' });
  const RECURRENCE_OPTIONS = [
    { value:'',        label:t('tasks.never')   },
    { value:'daily',   label:t('tasks.daily')   },
    { value:'custom',  label:t('tasks.custom')  },
    { value:'weekly',  label:t('tasks.weekly')  },
    { value:'monthly', label:t('tasks.monthly') },
    { value:'yearly',  label:t('tasks.yearly')  },
  ];
  const fmtTime = (tm) => {
    if (!tm) return null;
    const [h, m] = tm.split(':').map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString(dateLocale, { hour:'numeric', minute:'2-digit' });
  };
  const fmtLabel = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m-1, d).toLocaleDateString(dateLocale, { weekday:'long', month:'long', day:'numeric' });
  };
  const fmtDayShort = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m-1, d).toLocaleDateString(dateLocale, { weekday:'long' });
  };
  const DAYS = Array.from({ length: 7 }, (_, i) =>
    new Date(2023, 0, 1 + i).toLocaleDateString(dateLocale, { weekday: 'short' }));

  const [year,          setYear]          = useState(now.getFullYear());
  const [month,         setMonth]         = useState(now.getMonth());
  const [tasks,         setTasks]         = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [selectedTask,  setSelectedTask]  = useState(null);
  const [editForm,      setEditForm]      = useState(null);
  const [addModalOpen,  setAddModalOpen]  = useState(null);
  const [addForm,       setAddForm]       = useState(emptyForm);
  const [saving,        setSaving]        = useState(false);
  const [draggedId,     setDraggedId]     = useState(null);
  const [dragOverDate,  setDragOverDate]  = useState(null);
  const [touchGhost,    setTouchGhost]    = useState(null);
  const touchRef         = useRef({ task:null, startX:0, startY:0, dragging:false });
  const suppressClickRef = useRef(false);
  const dayScrollRef     = useRef(null);
  const todayStr = localToday();
  const monthLabel = new Date(year, month, 1).toLocaleDateString(dateLocale, { month:'long' });

  const load = useCallback(async () => {
    try {
      const data = await api.get('/tasks');
      setTasks(data.filter(tk => tk.deadline));
    } catch (_) {}
  }, []);
  useEffect(() => { load(); }, [load]);

  // Opens the day timeline scrolled to something useful instead of
  // midnight: current time if it's today, otherwise a reasonable 8am start.
  useEffect(() => {
    if (!selected || !dayScrollRef.current) return;
    const isToday = selected === todayStr;
    const targetMinutes = isToday ? (now.getHours() * 60 + now.getMinutes()) : 8 * 60;
    dayScrollRef.current.scrollTop = Math.max(0, (targetMinutes / 60) * HOUR_H - 80);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = firstDay-1; i >= 0; i--)
    cells.push({ day: daysInPrev-i, currentMonth:false });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day:d, currentMonth:true });
  while (cells.length < 42)
    cells.push({ day: cells.length-firstDay-daysInMonth+1, currentMonth:false });
  // Weeks as their own rows (not one flat 42-cell grid) so tapping a day
  // can collapse every OTHER week down to height 0 — Apple Calendar's
  // month-to-week move — while leaving the tapped week as a strip up
  // top. Collapsing is driven by `selected`, which already existed for
  // the side detail panel; this just gives it a second job.
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const selectedWeekIndex = selected
    ? weeks.findIndex((week) => week.some((c) => c.currentMonth && toDateStr(year, month, c.day) === selected))
    : -1;
  const prevMonth = () => { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };
  const getTasksForDay = (cell) => {
    if (!cell.currentMonth) return [];
    const ds = toDateStr(year, month, cell.day);
    // Completed tasks stay on the day they belong to (Apple Calendar-style)
    // instead of vanishing — sorted so open tasks lead and done ones trail,
    // and (per the same priority-first ordering used in the expanded day
    // view below) high priority leads within each group. Array.sort is
    // stable (ES2019+), so pre-sorting by priority first and then only
    // grouping by done-status on top preserves that priority order inside
    // each group without needing a compound comparator.
    return tasks
      .filter(tk => tk.deadline === ds)
      .sort(byPriorityThenNothing)
      .sort((a, b) => (a.status === 'done') - (b.status === 'done'));
  };

  const moveTask = async (task, dateStr) => {
    if (!task || !dateStr || task.deadline === dateStr) return;
    setTasks(prev => prev.map(tk => tk.id === task.id ? { ...tk, deadline:dateStr } : tk));
    if (selectedTask?.id === task.id) {
      setSelectedTask(tk => ({ ...tk, deadline:dateStr }));
      setEditForm(f => f ? { ...f, deadline:dateStr } : f);
    }
    try {
      await api.put(`/tasks/${task.id}`, { deadline: dateStr });
      toast.success(t('calendar.movedTo', { day: fmtDayShort(dateStr) }));
    } catch (err) { toast.error(err.message); load(); }
  };

  const onDragStart = (e, task) => {
    setDraggedId(task.id);
    e.dataTransfer.effectAllowed = 'move';
    const ghost = document.createElement('div');
    ghost.textContent = task.title;
    ghost.style.cssText = `
      position:fixed;top:-100px;left:-100px;
      background:rgb(var(--accent-500));color:white;padding:6px 12px;
      border-radius:8px;font-size:12px;font-weight:600;
      box-shadow:0 4px 16px rgb(var(--accent-500) / 0.5);
    `;
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 60, 20);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };
  const onDragOver = (e, dateStr) => {
    if (!draggedId || !dateStr) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateStr);
  };
  const onDragLeave = () => setDragOverDate(null);
  const onDrop = async (e, dateStr) => {
    e.preventDefault();
    setDragOverDate(null);
    const task = tasks.find(tk => tk.id === draggedId);
    setDraggedId(null);
    await moveTask(task, dateStr);
  };
  const onDragEnd = () => { setDraggedId(null); setDragOverDate(null); };

  const cellFromPoint = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el?.closest?.('[data-date]')?.getAttribute('data-date') || null;
  };
  const onTouchStart = (e, task) => {
    const tp = e.touches[0];
    touchRef.current = { task, startX:tp.clientX, startY:tp.clientY, dragging:false };
  };
  const onTouchMove = (e) => {
    const st = touchRef.current;
    if (!st.task) return;
    const tp = e.touches[0];
    const dx = tp.clientX - st.startX;
    const dy = tp.clientY - st.startY;
    if (!st.dragging && Math.hypot(dx, dy) > 8) {
      st.dragging = true;
      setDraggedId(st.task.id);
      if (navigator.vibrate) navigator.vibrate(10);
    }
    if (st.dragging) {
      setTouchGhost({ x:tp.clientX, y:tp.clientY, title:st.task.title });
      setDragOverDate(cellFromPoint(tp.clientX, tp.clientY));
    }
  };
  const onTouchEnd = (e) => {
    const st = touchRef.current;
    if (!st.task) return;
    if (st.dragging) {
      suppressClickRef.current = true;
      const tp = e.changedTouches[0];
      const dateStr = cellFromPoint(tp.clientX, tp.clientY);
      const task = st.task;
      setTouchGhost(null);
      setDragOverDate(null);
      setDraggedId(null);
      moveTask(task, dateStr);
    }
    touchRef.current = { task:null, startX:0, startY:0, dragging:false };
  };
  const onTouchCancel = () => {
    setTouchGhost(null);
    setDragOverDate(null);
    setDraggedId(null);
    touchRef.current = { task:null, startX:0, startY:0, dragging:false };
  };

  const openTaskPanel = (e, task) => {
    e.stopPropagation();
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    setSelectedTask(task);
    // remind_offsets_min comes back as a JSON string (or null/undefined
    // for tasks created before this feature existed) — fall back to the
    // same [60] default the server assumes when nothing was ever saved.
    let remindOffsets = [60];
    if (task.remind_offsets_min) {
      try {
        const parsed = JSON.parse(task.remind_offsets_min);
        if (Array.isArray(parsed)) remindOffsets = parsed;
      } catch { /* leave default */ }
    }
    const { recurrenceType, customDays } = recurrenceToForm(task.recurrence);
    setEditForm({
      title:         task.title,
      description:   task.description || '',
      priority:      task.priority || 'medium',
      deadline:      task.deadline,
      deadline_time: task.deadline_time || '',
      category:      task.category || 'General',
      remindOffsets,
      recurrenceType,
      customDays,
      isBirthday:    Boolean(task.is_birthday),
      recurrenceUntil: task.recurrence_until || '',
    });
    setSelected(null);
  };
  const saveTask = async () => {
    if (!selectedTask || !editForm) return;
    if (!editForm.title.trim()) { toast.error(t('calendar.titleEmpty')); return; }
    setSaving(true);
    try {
      const recurrence = formToRecurrence(editForm);
      await api.put(`/tasks/${selectedTask.id}`, {
        title:         editForm.title.trim(),
        description:   editForm.description || '',
        priority:      editForm.priority,
        category:      editForm.category || 'General',
        deadline:      editForm.deadline || null,
        deadline_time: editForm.deadline_time || null,
        remind_offsets_min: editForm.deadline_time ? editForm.remindOffsets : null,
        recurrence,
        recurrence_until: recurrence ? (editForm.recurrenceUntil || null) : null,
      });
      setSelectedTask(null);
      toast.success(t('tasks.updated'));
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };
  const deleteTask = async (id) => {
    try {
      await api.del(`/tasks/${id}`);
      setSelectedTask(null);
      toast.success(t('tasks.deleted'));
      load();
    } catch (err) { toast.error(err.message); }
  };
  const markDone = async (task) => {
    try {
      // The server always awards XP here (PUT /tasks/:id — same call
      // Tasks.jsx makes) regardless of which page sent the request, so
      // marking done from Calendar was never actually skipping points.
      // What it WAS skipping is this response's xpAwarded/unlocked
      // fields — Tasks.jsx's own markDone reads and toasts them, this
      // one just threw them away, so completing something a day late
      // from Calendar silently gave XP with zero on-screen confirmation.
      // Easy to read as "I didn't get points" when really you just
      // weren't told you did.
      const { xpAwarded, unlocked } = await api.put(`/tasks/${task.id}`, { status:'done', progress:100 });
      if (xpAwarded) toast.xp(xpAwarded, task.title);
      unlocked?.forEach((k) => toast.achievement(k.replace(/_/g, ' ')));
      setSelectedTask(null);
      load();
    } catch (err) { toast.error(err.message); }
  };
  const submitAdd = async (e) => {
    e.preventDefault();
    if (!addForm.title.trim()) return;
    setSaving(true);
    try {
      const recurrence = formToRecurrence(addForm);
      await api.post('/tasks', {
        ...addForm,
        deadline: addModalOpen,
        recurrence,
        recurrence_until: recurrence ? (addForm.recurrenceUntil || null) : null,
        remind_offsets_min: addForm.deadline_time ? addForm.remindOffsets : null,
        is_birthday: addForm.isBirthday,
      });
      toast.success(t('tasks.added'));
      setAddModalOpen(null);
      setAddForm(emptyForm);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const panelStyle = {
    background:           isDark ? 'rgba(18,14,35,0.72)'              : 'rgba(255,255,255,0.75)',
    border:               isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.90)',
    backdropFilter:       'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    boxShadow:            '0 8px 32px rgba(0,0,0,0.12)',
  };
  const divider  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(30,34,51,0.06)';
  const textMain = isDark ? 'text-white'             : 'text-ink';
  const textSub  = isDark ? 'text-white/40'          : 'text-ink/45';

  return (
    <div>
      <PageHeader
        eyebrow={t('calendar.eyebrow')} title={t('calendar.title')}
        subtitle={t('calendar.subtitle')}
      />
      {touchGhost && (
        <div
          style={{
            position:'fixed', left:touchGhost.x, top:touchGhost.y,
            transform:'translate(-50%,-130%)', pointerEvents:'none', zIndex:9999,
            background:'rgb(var(--accent-500))', color:'white', padding:'7px 14px',
            borderRadius:10, fontSize:12, fontWeight:600, maxWidth:190,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            boxShadow:'0 6px 20px rgb(var(--accent-500) / 0.55)',
          }}
        >
          {touchGhost.title}
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <div className="rounded-3xl overflow-hidden" style={panelStyle}>
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom:`1px solid ${divider}` }}>
              <motion.button whileHover={{ scale:1.08 }} whileTap={{ scale:0.94 }} onClick={prevMonth}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${isDark?'text-white/40 hover:bg-white/10':'text-ink/50 hover:bg-ink/5'}`}>
                <ChevronLeft size={18} className="rtl:rotate-180"/>
              </motion.button>
              <div className="text-center">
                <h2 className={`font-display font-bold text-lg ${textMain}`}>{monthLabel}</h2>
                <p className={`text-xs ${textSub}`}>{year}</p>
              </div>
              <motion.button whileHover={{ scale:1.08 }} whileTap={{ scale:0.94 }} onClick={nextMonth}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${isDark?'text-white/40 hover:bg-white/10':'text-ink/50 hover:bg-ink/5'}`}>
                <ChevronRight size={18} className="rtl:rotate-180"/>
              </motion.button>
            </div>
            <div className="grid grid-cols-7" style={{ borderBottom:`1px solid ${divider}` }}>
              {DAYS.map(d => (
                <div key={d} className={`py-3 text-center text-[11px] font-bold uppercase tracking-widest ${textSub}`}>{d}</div>
              ))}
            </div>
            <AnimatePresence>
              {selected && (
                <motion.button
                  initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}
                  transition={{ duration:0.25 }}
                  onClick={() => setSelected(null)}
                  className={`w-full flex items-center justify-center gap-1.5 overflow-hidden py-2 text-[11px] font-semibold transition ${isDark?'text-white/35 hover:text-white/60':'text-ink/40 hover:text-ink/70'}`}
                  style={{ borderBottom:`1px solid ${divider}` }}
                >
                  <ChevronDown size={13}/> {t('calendar.backToMonth')}
                </motion.button>
              )}
            </AnimatePresence>
            <div className="flex flex-col">
              {weeks.map((week, wIdx) => (
                <motion.div
                  key={wIdx}
                  className="grid grid-cols-7 overflow-hidden"
                  animate={{
                    height:  selected && wIdx !== selectedWeekIndex ? 0 : 'auto',
                    opacity: selected && wIdx !== selectedWeekIndex ? 0 : 1,
                  }}
                  transition={{ duration:0.35, ease:[0.65,0,0.35,1] }}
                >
                  {week.map((cell, i) => {
                    const idx        = wIdx * 7 + i;
                    const dateStr    = cell.currentMonth ? toDateStr(year, month, cell.day) : null;
                    const cellTasks  = getTasksForDay(cell);
                    const isToday    = dateStr === todayStr;
                    const isSelected = dateStr === selected;
                    const isDragOver = dateStr === dragOverDate;
                    const isWeekend  = idx%7===0 || idx%7===6;
                    return (
                      <div
                        key={idx}
                        data-date={dateStr || undefined}
                        className="relative min-h-[88px] p-2 transition-all"
                        style={{
                          borderBottom: `1px solid ${divider}`,
                          borderInlineEnd: `1px solid ${divider}`,
                          cursor:        cell.currentMonth ? 'pointer' : 'default',
                          opacity:       cell.currentMonth ? 1 : 0.25,
                          background:    isDragOver
                            ? isDark ? 'rgb(var(--accent-500) / 0.25)' : 'rgb(var(--accent-500) / 0.12)'
                            : isSelected
                            ? isDark ? 'rgb(var(--accent-500) / 0.15)' : 'rgb(var(--accent-500) / 0.08)'
                            : isWeekend && cell.currentMonth
                            ? isDark ? 'rgba(255,255,255,0.015)' : 'rgba(30,34,51,0.01)'
                            : 'transparent',
                          outline: isDragOver ? '2px solid rgb(var(--accent-500) / 0.50)' : 'none',
                          outlineOffset: '-2px',
                        }}
                        onClick={() => cell.currentMonth && setSelected(isSelected ? null : dateStr)}
                        onDragOver={e => onDragOver(e, dateStr)}
                        onDragLeave={onDragLeave}
                        onDrop={e => onDrop(e, dateStr)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                            isToday
                              ? 'bg-gradient-to-br from-[rgb(var(--accent-500))] to-[rgb(var(--accent-600))] text-white shadow-md'
                              : isSelected
                              ? 'text-lavender-500 dark:text-lavender-300'
                              : isDark ? 'text-white/55' : 'text-ink/60'
                          }`}>
                            {cell.day}
                          </span>
                          {cell.currentMonth && (
                            <button
                              onClick={e => { e.stopPropagation(); setAddModalOpen(dateStr); setAddForm(emptyForm); }}
                              className={`opacity-0 hover:opacity-100 flex h-5 w-5 items-center justify-center rounded-lg transition ${isDark?'text-lavender-300 hover:bg-white/10':'text-lavender-500 hover:bg-lavender-100'}`}
                            >
                              <Plus size={11}/>
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {cellTasks.slice(0, 3).map(task => {
                            const colors     = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low;
                            const isDragging = draggedId === task.id;
                            const isDone     = task.status === 'done';
                            return (
                              <div
                                key={task.id}
                                draggable={!isDone}
                                onDragStart={e => !isDone && onDragStart(e, task)}
                                onDragEnd={onDragEnd}
                                onClick={e => openTaskPanel(e, task)}
                                onTouchStart={e => !isDone && onTouchStart(e, task)}
                                onTouchMove={onTouchMove}
                                onTouchEnd={onTouchEnd}
                                onTouchCancel={onTouchCancel}
                                className={`truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-tight transition-all select-none flex items-center gap-1 ${isDone ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
                                style={{
                                  background:   isDone ? 'rgba(76,195,138,0.08)' : isDark ? colors.dark : colors.bg,
                                  color:        isDone ? (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(30,34,51,0.40)') : colors.text,
                                  opacity:      isDragging ? 0.40 : isDone ? 0.75 : 1,
                                  transform:    isDragging ? 'scale(0.95)' : 'scale(1)',
                                  touchAction:  'none',
                                  WebkitUserSelect: 'none',
                                  WebkitTouchCallout: 'none',
                                }}
                                title={task.title}
                              >
                                {isDone && <Check size={9} className="text-sage-500 shrink-0"/>}
                                <span className={`truncate ${isDone ? 'line-through' : ''}`}>{task.title}</span>
                              </div>
                            );
                          })}
                          {cellTasks.length > 3 && (
                            <div className={`text-[9px] px-1 ${isDark?'text-white/25':'text-ink/35'}`}>
                              {t('dash.moreTasks', { n: cellTasks.length - 3 })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-5 mt-3 px-1">
            {Object.entries(PRIORITY_COLORS).map(([key, colors]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ background:colors.bg, border:`1px solid ${colors.border}` }}/>
                <span className={`text-[11px] ${isDark?'text-white/30':'text-ink/40'}`}>{t(`tasks.${key}`)}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm" style={{ background:'rgb(var(--accent-500) / 0.20)', border:'2px solid rgb(var(--accent-500) / 0.50)' }}/>
              <span className={`text-[11px] ${isDark?'text-white/30':'text-ink/40'}`}>{t('calendar.dropTarget')}</span>
            </div>
          </div>
        </div>
        <div className="xl:col-span-1">
          <AnimatePresence mode="wait">
            {selectedTask && editForm && (
              <motion.div key={`task-${selectedTask.id}`}
                initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
                transition={{ duration:0.2 }}
                className="rounded-3xl p-5 sticky top-6"
                style={panelStyle}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full shrink-0"
                      style={{ background: PRIORITY_COLORS[editForm.priority]?.text || 'rgb(var(--accent-500))' }}/>
                    <p className={`text-xs font-bold uppercase tracking-widest ${textSub}`}>{t('calendar.editTask')}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!selectedTask.is_birthday && (
                      <button
                        onClick={() => markDone(selectedTask)}
                        className="flex h-7 w-7 items-center justify-center rounded-xl transition text-sage-500 hover:bg-sage-500/10"
                        title={t('tasks.markDone')}
                      >
                        <Check size={14}/>
                      </button>
                    )}
                    <button
                      onClick={() => deleteTask(selectedTask.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-xl transition text-coral-500 hover:bg-coral-500/10"
                      title={t('common.delete')}
                    >
                      <Trash2 size={14}/>
                    </button>
                    <button onClick={() => setSelectedTask(null)}
                      className={`flex h-7 w-7 items-center justify-center rounded-xl transition ${isDark?'text-white/30 hover:text-white/60':'text-ink/30 hover:text-ink/60'}`}>
                      <X size={14}/>
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      className="input-field font-semibold flex-1"
                      value={editForm.title}
                      onChange={e => setEditForm({...editForm, title:e.target.value})}
                      placeholder={t('tasks.taskTitle')}
                    />
                    <VoiceInputButton size="sm" onText={(c) => setEditForm((f) => ({ ...f, title: appendText(f.title, c) }))} />
                  </div>
                  <div className="flex items-center gap-2">
                    <textarea
                      className="input-field resize-none text-sm flex-1"
                      rows={2}
                      value={editForm.description}
                      onChange={e => setEditForm({...editForm, description:e.target.value})}
                      placeholder={t('tasks.description')}
                    />
                    <VoiceInputButton size="sm" onText={(c) => setEditForm((f) => ({ ...f, description: appendText(f.description, c) }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="input-field text-sm" value={editForm.priority}
                      onChange={e => setEditForm({...editForm, priority:e.target.value})}>
                      <option value="high">🔴 {t('tasks.high')}</option>
                      <option value="medium">🟡 {t('tasks.medium')}</option>
                      <option value="low">🟣 {t('tasks.low')}</option>
                    </select>
                    <input type="date" className="input-field text-sm" value={editForm.deadline || ''}
                      onChange={e => setEditForm({...editForm, deadline:e.target.value})}/>
                  </div>
                  {editForm.isBirthday ? (
                    <p className={`text-[11px] ${isDark?'text-white/25':'text-ink/35'}`}>{t('calendar.birthdayHint')}</p>
                  ) : (
                    <>
                      <input type="time" className="input-field text-sm" value={editForm.deadline_time}
                        onChange={e => setEditForm({...editForm, deadline_time:e.target.value})}
                        onClick={e => e.currentTarget.showPicker?.()}/>
                      {editForm.deadline_time && (
                        <ReminderPicker
                          value={editForm.remindOffsets}
                          onChange={(remindOffsets) => setEditForm(f => ({ ...f, remindOffsets }))}
                          t={t} compact
                        />
                      )}
                      <div>
                        <label className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 block ${textSub}`}>
                          {t('tasks.repeat')}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {RECURRENCE_OPTIONS.map(opt => (
                            <button key={opt.value} type="button"
                              onClick={() => setEditForm(f => ({ ...f, recurrenceType:opt.value, customDays: opt.value==='custom'?[1,2,3,4,5]:[] }))}
                              className="rounded-xl px-3 py-1 text-[11px] font-semibold transition-all"
                              style={editForm.recurrenceType === opt.value ? {
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
                        {editForm.recurrenceType === 'custom' && (
                          <div className="flex gap-1.5 mt-2">
                            {Array.from({ length: 7 }, (_, i) => {
                              const isOn = editForm.customDays.includes(i);
                              return (
                                <button key={i} type="button"
                                  onClick={() => setEditForm(f => ({ ...f, customDays: isOn ? f.customDays.filter(x=>x!==i) : [...f.customDays, i] }))}
                                  className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all"
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
                        )}
                        {editForm.recurrenceType && (
                          <div className="mt-2">
                            <label className={`text-[10px] mb-1 block ${textSub}`}>{t('tasks.repeatUntil')}</label>
                            <input type="date" className="input-field text-sm" style={{ maxWidth: 180 }}
                              value={editForm.recurrenceUntil}
                              min={editForm.deadline || undefined}
                              onChange={e => setEditForm({...editForm, recurrenceUntil: e.target.value})} />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  <button onClick={saveTask} disabled={saving}
                    className="btn-primary justify-center text-sm py-2.5">
                    {saving ? t('common.saving') : t('calendar.saveChanges')}
                  </button>
                </div>
                {editForm.deadline && (() => {
                  const dl = daysUntil(editForm.deadline);
                  if (dl === null) return null;
                  return (
                    <div className="mt-3 flex items-center gap-1.5 text-xs"
                      style={{ color: dl < 0 ? '#FF7A63' : dl === 0 ? '#d97706' : 'rgb(var(--accent-500))' }}>
                      <CalIcon size={11}/>
                      {dl < 0  ? t('dash.overdue')
                      : dl === 0 ? t('dash.dueToday')
                      : dl === 1 ? t('dash.dueTomorrow')
                      : t('calendar.daysAway', { n: dl })}
                    </div>
                  );
                })()}
              </motion.div>
            )}
            {!selectedTask && selected && (() => {
              const dayTasksAll = tasks.filter(tk => tk.deadline === selected);
              // High → low priority first; layoutTimedTasks then sorts by
              // start time on top of this (JS array sort is stable), so
              // same-time tasks keep this priority order instead of
              // whatever order the API happened to return them in.
              const timedTasks  = dayTasksAll.filter(tk => tk.deadline_time).sort(byPriorityThenNothing);
              const allDayTasks = dayTasksAll.filter(tk => !tk.deadline_time).sort(byPriorityThenNothing);
              const isToday     = selected === todayStr;
              const nowMinutes  = now.getHours() * 60 + now.getMinutes();
              return (
              <motion.div key={`date-${selected}`}
                initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
                transition={{ duration:0.2 }}
                className="rounded-3xl p-5 sticky top-6"
                style={panelStyle}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className={`font-display font-bold ${textMain}`}>{fmtLabel(selected)}</p>
                    <p className={`text-xs mt-0.5 ${textSub}`}>
                      {dayTasksAll.filter(tk=>tk.status!=='done').length} {t('calendar.tasksCount')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <motion.button whileHover={{ scale:1.06 }} whileTap={{ scale:0.94 }}
                      onClick={() => { setAddModalOpen(selected); setAddForm(emptyForm); }}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-lavender-500 dark:text-lavender-300"
                      style={{ background:'rgb(var(--accent-500) / 0.12)', border:'1px solid rgb(var(--accent-500) / 0.22)' }}>
                      <Plus size={12}/> {t('common.add')}
                    </motion.button>
                    <button onClick={() => setSelected(null)}
                      className={`flex h-8 w-8 items-center justify-center rounded-xl transition ${isDark?'text-white/30 hover:text-white/60':'text-ink/30 hover:text-ink/60'}`}>
                      <X size={14}/>
                    </button>
                  </div>
                </div>

                {dayTasksAll.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <span className="text-3xl mb-2">📅</span>
                    <p className={`text-sm font-medium ${textSub}`}>{t('calendar.nothing')}</p>
                    <p className={`text-xs mt-1 ${isDark?'text-white/20':'text-ink/30'}`}>{t('calendar.tapAdd')}</p>
                  </div>
                ) : (
                  <>
                    {allDayTasks.length > 0 && (
                      <div className="flex flex-col gap-1.5 mb-3 pb-3" style={{ borderBottom:`1px solid ${divider}` }}>
                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${textSub}`}>{t('calendar.allDay')}</p>
                        {allDayTasks.map(task => {
                          const colors = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low;
                          const isDone = task.status === 'done';
                          return (
                            <div key={task.id}
                              className="flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer"
                              style={{ background:isDark?colors.dark:colors.bg, border:`1px solid ${colors.border}`, opacity:isDone?0.5:1 }}
                              onClick={e => openTaskPanel(e, task)}
                            >
                              {isDone && <Check size={11} className="text-sage-500 shrink-0"/>}
                              <p className={`text-xs font-semibold truncate flex-1 ${isDone?'line-through':''}`} style={{ color:colors.text }}>{task.title}</p>
                              <Pencil size={11} style={{ color:colors.text, opacity:0.5 }}/>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Hourly timeline — the actual iOS-style day view: 24
                        hour rows give the container its scrollable height,
                        timed tasks + the live "now" line sit absolutely
                        positioned on top of it by minute-of-day. */}
                    <div ref={dayScrollRef} className="max-h-[420px] overflow-y-auto pe-1">
                      <div className="relative">
                        {Array.from({ length: 24 }, (_, h) => h).map(h => {
                          const label = new Date(2000,0,1,h).toLocaleTimeString(dateLocale, { hour:'numeric' });
                          return (
                            <div key={h}
                              className="flex items-start gap-2 cursor-pointer group"
                              style={{ height: HOUR_H, borderTop:`1px solid ${divider}` }}
                              onClick={() => { setAddModalOpen(selected); setAddForm({ ...emptyForm, deadline_time: `${String(h).padStart(2,'0')}:00` }); }}
                            >
                              <span className={`text-[10px] w-11 shrink-0 pt-1 text-end ${isDark?'text-white/25':'text-ink/35'}`}>{label}</span>
                              <div className="flex-1 h-full rounded-lg transition-colors group-hover:bg-[rgb(var(--accent-500)/0.05)]" />
                            </div>
                          );
                        })}
                        <div className="absolute top-0 pointer-events-none" style={{ insetInlineStart: 52, insetInlineEnd: 2 }}>
                          {layoutTimedTasks(timedTasks).map(({ task, col, cols }) => {
                            const [hh, mm] = task.deadline_time.split(':').map(Number);
                            const top    = ((hh * 60 + mm) / 60) * HOUR_H;
                            const colors = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low;
                            const isDone = task.status === 'done';
                            // Tasks that collide in time now split the row
                            // into side-by-side columns instead of every
                            // block claiming the full width and stacking
                            // directly on top of each other.
                            const gapPct = 1.5;
                            const widthPct = 100 / cols;
                            return (
                              <div key={task.id}
                                className="absolute rounded-lg px-2 py-1 pointer-events-auto cursor-pointer overflow-hidden"
                                style={{
                                  top, minHeight: TASK_BLOCK_MIN,
                                  insetInlineStart: `${col * widthPct}%`,
                                  width: `calc(${widthPct}% - ${gapPct * 2}px)`,
                                  marginInlineStart: gapPct,
                                  background: isDark ? colors.dark : colors.bg,
                                  borderInlineStart: `3px solid ${colors.text}`,
                                  opacity: isDone ? 0.5 : 1,
                                }}
                                onClick={e => openTaskPanel(e, task)}
                              >
                                <p className={`text-[11px] font-bold truncate ${isDone?'line-through':''}`} style={{ color:colors.text }}>{task.title}</p>
                                <p className="text-[9px] opacity-70" style={{ color:colors.text }}>{fmtTime(task.deadline_time)}</p>
                              </div>
                            );
                          })}
                          {isToday && (
                            // Was a flat 8px dot + a solid 1px line, same
                            // opacity start to end — easy to mistake for
                            // just another divider, and it visually
                            // flattened straight through whatever task
                            // block happened to sit at the current time.
                            // Now a glowing, gently pulsing marker with
                            // the line fading out as it goes, so it
                            // reads as "you are here" at a glance instead
                            // of blending into the grid.
                            <div className="absolute inset-x-0 flex items-center z-10" style={{ top: (nowMinutes / 60) * HOUR_H }}>
                              <motion.div
                                animate={{ scale: [1, 1.35, 1], opacity: [0.9, 1, 0.9] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                className="h-2.5 w-2.5 rounded-full bg-coral-500 shrink-0"
                                style={{ marginInlineStart: -5, boxShadow: '0 0 0 4px rgba(248,113,113,0.18), 0 0 10px rgba(248,113,113,0.55)' }}
                              />
                              <div className="h-px flex-1" style={{ background: `linear-gradient(${lang === 'ar' ? 'to left' : 'to right'}, rgba(248,113,113,0.85), rgba(248,113,113,0.10))` }} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
              );
            })()}
            {!selectedTask && !selected && (
              <motion.div key="empty" initial={{ opacity:0 }} animate={{ opacity:1 }}
                className="rounded-3xl p-6 flex flex-col items-center justify-center text-center sticky top-6"
                style={{
                  background:  isDark?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.40)',
                  border:      isDark?'1px dashed rgba(255,255,255,0.10)':'1px dashed rgb(var(--accent-500) / 0.20)',
                  backdropFilter:'blur(12px)', minHeight:200,
                }}
              >
                <span className="text-4xl mb-3">📅</span>
                <p className={`font-semibold text-sm ${isDark?'text-white/40':'text-ink/50'}`}>{t('calendar.subtitle')}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <Modal
        open={!!addModalOpen}
        onClose={() => setAddModalOpen(null)}
        title={addModalOpen ? `${t('calendar.addTo')} · ${fmtLabel(addModalOpen)}` : t('calendar.addTo')}
      >
        <form onSubmit={submitAdd} className="flex flex-col gap-3.5">
          {/* This field IS where the birthday person's name goes once the
              toggle below is on — Dashboard's birthday card literally
              displays this title as the sub-line under "Birthday in N
              days". It wasn't obvious from a generic "Task title"
              placeholder that this same box does double duty, which is
              exactly the "what does someone's birthday do?" confusion. */}
          <div className="flex items-center gap-2">
            <input className="input-field flex-1"
              placeholder={addForm.isBirthday ? t('calendar.birthdayNamePh') : t('tasks.taskTitle')}
              value={addForm.title} onChange={e => setAddForm({...addForm, title:e.target.value})}
              autoFocus required />
            <VoiceInputButton size="sm" onText={(c) => setAddForm((f) => ({ ...f, title: appendText(f.title, c) }))} />
          </div>
          <div className="flex items-center gap-2">
            <textarea className="input-field resize-none flex-1" placeholder={t('tasks.description')} rows={2}
              value={addForm.description} onChange={e => setAddForm({...addForm, description:e.target.value})} />
            <VoiceInputButton size="sm" onText={(c) => setAddForm((f) => ({ ...f, description: appendText(f.description, c) }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className="input-field" value={addForm.priority}
              onChange={e => setAddForm({...addForm, priority:e.target.value})}>
              <option value="high">{t('tasks.high')}</option>
              <option value="medium">{t('tasks.medium')}</option>
              <option value="low">{t('tasks.low')}</option>
            </select>
            <select className="input-field" value={addForm.categorySelect}
              onChange={e => {
                const categorySelect = e.target.value;
                setAddForm(f => ({
                  ...f, categorySelect,
                  category: categorySelect === 'other' ? f.categoryCustom : categorySelect,
                }));
              }}>
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
          </div>
          {addForm.categorySelect === 'other' && (
            <input className="input-field" placeholder={t('tasks.categoryCustomPlaceholder')}
              value={addForm.categoryCustom}
              onChange={e => setAddForm(f => ({ ...f, categoryCustom: e.target.value, category: e.target.value }))} />
          )}
          {/* Was a bare "Someone's birthday" toggle with no explanation
              until after you clicked it — the hint only rendered once
              addForm.isBirthday was already true. Showing the hint
              unconditionally means it reads as a mini-description of the
              toggle itself ("this switches the task into birthday mode"),
              not just a confirmation after the fact. */}
          <div className="flex flex-col gap-1">
            <button type="button"
              onClick={() => setAddForm(f => f.isBirthday
                ? { ...f, isBirthday: false, recurrenceType: '', customDays: [] }
                : { ...f, isBirthday: true, recurrenceType: 'yearly', customDays: [], deadline_time: '' })}
              className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all self-start"
              style={addForm.isBirthday ? {
                background:'linear-gradient(135deg, rgb(var(--accent-500)), rgb(var(--accent-600)))', color:'white',
                boxShadow:'0 4px 12px rgb(var(--accent-500) / 0.30)',
              } : {
                background:'rgb(var(--accent-500) / 0.08)', border:'1px solid rgb(var(--accent-500) / 0.15)',
                color:'rgb(var(--accent-500) / 0.65)',
              }}
            >
              🎂 {t('calendar.birthdayToggle')}
            </button>
            <p className="text-[11px] text-ink/35 dark:text-white/25">{t('calendar.birthdayHint')}</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium"
            style={{ background:'rgb(var(--accent-500) / 0.08)', border:'1px solid rgb(var(--accent-500) / 0.15)', color:'rgb(var(--accent-500))' }}>
            📅 {addModalOpen && fmtLabel(addModalOpen)}
          </div>
          {!addForm.isBirthday && (
            <div>
              <label className="text-[11px] text-ink/35 dark:text-white/25 mb-1 block">{t('tasks.deadlineTimeLabel')}</label>
              <div className="relative">
                <input type="time" className="input-field" value={addForm.deadline_time}
                  autoComplete="off" name="nuvora-calendar-task-time"
                  style={!addForm.deadline_time ? { color: 'transparent', WebkitTextFillColor: 'transparent' } : undefined}
                  onChange={e => setAddForm({...addForm, deadline_time:e.target.value})}
                  onClick={e => e.currentTarget.showPicker?.()} />
                {!addForm.deadline_time && (
                  <span className="pointer-events-none absolute inset-y-0 start-4 flex items-center text-sm text-ink/40 dark:text-white/30">
                    {t('tasks.selectTime')}
                  </span>
                )}
              </div>
            </div>
          )}
          {addForm.deadline_time && !addForm.isBirthday && (
            <ReminderPicker
              value={addForm.remindOffsets}
              onChange={(remindOffsets) => setAddForm(f => ({ ...f, remindOffsets }))}
              t={t}
            />
          )}
          {!addForm.isBirthday && (
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-ink/40 dark:text-white/30 mb-2 block">
              {t('tasks.repeat')}
            </label>
            <div className="flex flex-wrap gap-2">
              {RECURRENCE_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setAddForm(f => ({ ...f, recurrenceType:opt.value, customDays: opt.value==='custom'?[1,2,3,4,5]:[] }))}
                  className="rounded-2xl px-4 py-2 text-xs font-semibold transition-all"
                  style={addForm.recurrenceType === opt.value ? {
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
            {addForm.recurrenceType === 'custom' && (
              <div className="flex gap-2 mt-3">
                {Array.from({ length: 7 }, (_, i) => {
                  const isOn = addForm.customDays.includes(i);
                  return (
                    <button key={i} type="button"
                      onClick={() => setAddForm(f => ({ ...f, customDays: isOn ? f.customDays.filter(x=>x!==i) : [...f.customDays, i] }))}
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
            )}
            {addForm.recurrenceType && (
              <div className="mt-3">
                <label className="text-[11px] text-ink/35 dark:text-white/25 mb-1 block">{t('tasks.repeatUntil')}</label>
                <input type="date" className="input-field" style={{ maxWidth: 200 }}
                  value={addForm.recurrenceUntil}
                  min={addModalOpen || undefined}
                  onChange={e => setAddForm({...addForm, recurrenceUntil: e.target.value})} />
              </div>
            )}
          </div>
          )}
          <button type="submit" disabled={saving} className="btn-primary justify-center mt-1">
            {saving ? t('common.saving') : t('calendar.addToCalendar')}
          </button>
        </form>
      </Modal>
    </div>
  );
}