import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Plus, X, Check,
  Clock, Pencil, Trash2, Calendar as CalIcon,
} from 'lucide-react';
import { api }      from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import PageHeader   from '../components/PageHeader.jsx';
import Modal        from '../components/Modal.jsx';

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
const emptyForm = { title:'', priority:'medium', category:'General', deadline_time:'', description:'' };

export default function Calendar() {
  const toast             = useToast();
  const { resolvedTheme } = useTheme();
  const { t, lang }       = useLanguage();
  const isDark            = resolvedTheme === 'dark';
  const now               = new Date();
  const dateLocale = lang === 'ar' ? 'ar' : 'en-US';
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
  const todayStr = localToday();
  const monthLabel = new Date(year, month, 1).toLocaleDateString(dateLocale, { month:'long' });

  const load = useCallback(async () => {
    try {
      const data = await api.get('/tasks');
      setTasks(data.filter(tk => tk.deadline));
    } catch (_) {}
  }, []);
  useEffect(() => { load(); }, [load]);

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
  const prevMonth = () => { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };
  const getTasksForDay = (cell) => {
    if (!cell.currentMonth) return [];
    const ds = toDateStr(year, month, cell.day);
    return tasks.filter(tk => tk.deadline === ds && tk.status !== 'done');
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
    setEditForm({
      title:         task.title,
      description:   task.description || '',
      priority:      task.priority || 'medium',
      deadline:      task.deadline,
      deadline_time: task.deadline_time || '',
      category:      task.category || 'General',
    });
    setSelected(null);
  };
  const saveTask = async () => {
    if (!selectedTask || !editForm) return;
    if (!editForm.title.trim()) { toast.error(t('calendar.titleEmpty')); return; }
    setSaving(true);
    try {
      await api.put(`/tasks/${selectedTask.id}`, {
        title:         editForm.title.trim(),
        description:   editForm.description || '',
        priority:      editForm.priority,
        category:      editForm.category || 'General',
        deadline:      editForm.deadline || null,
        deadline_time: editForm.deadline_time || null,
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
      await api.put(`/tasks/${task.id}`, { status:'done', progress:100 });
      setSelectedTask(null);
      load();
    } catch (err) { toast.error(err.message); }
  };
  const submitAdd = async (e) => {
    e.preventDefault();
    if (!addForm.title.trim()) return;
    setSaving(true);
    try {
      await api.post('/tasks', { ...addForm, deadline:addModalOpen, recurrence:null });
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
            <div className="grid grid-cols-7">
              {cells.map((cell, idx) => {
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
                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={e => onDragStart(e, task)}
                            onDragEnd={onDragEnd}
                            onClick={e => openTaskPanel(e, task)}
                            onTouchStart={e => onTouchStart(e, task)}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                            onTouchCancel={onTouchCancel}
                            className="truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-tight cursor-grab active:cursor-grabbing transition-all select-none"
                            style={{
                              background:   isDark ? colors.dark : colors.bg,
                              color:        colors.text,
                              opacity:      isDragging ? 0.40 : 1,
                              transform:    isDragging ? 'scale(0.95)' : 'scale(1)',
                              touchAction:  'none',
                              WebkitUserSelect: 'none',
                              WebkitTouchCallout: 'none',
                            }}
                            title={task.title}
                          >
                            {task.title}
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
                    <button
                      onClick={() => markDone(selectedTask)}
                      className="flex h-7 w-7 items-center justify-center rounded-xl transition text-sage-500 hover:bg-sage-500/10"
                      title={t('tasks.markDone')}
                    >
                      <Check size={14}/>
                    </button>
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
                  <input
                    className="input-field font-semibold"
                    value={editForm.title}
                    onChange={e => setEditForm({...editForm, title:e.target.value})}
                    placeholder={t('tasks.taskTitle')}
                  />
                  <textarea
                    className="input-field resize-none text-sm"
                    rows={2}
                    value={editForm.description}
                    onChange={e => setEditForm({...editForm, description:e.target.value})}
                    placeholder={t('tasks.description')}
                  />
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
                  <input type="time" className="input-field text-sm" value={editForm.deadline_time}
                    onChange={e => setEditForm({...editForm, deadline_time:e.target.value})}/>
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
            {!selectedTask && selected && (
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
                      {tasks.filter(tk=>tk.deadline===selected&&tk.status!=='done').length} {t('calendar.tasksCount')}
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
                {tasks.filter(tk=>tk.deadline===selected).length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <span className="text-3xl mb-2">📅</span>
                    <p className={`text-sm font-medium ${textSub}`}>{t('calendar.nothing')}</p>
                    <p className={`text-xs mt-1 ${isDark?'text-white/20':'text-ink/30'}`}>{t('calendar.tapAdd')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {tasks.filter(tk=>tk.deadline===selected&&tk.status!=='done').map(task => {
                      const colors = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low;
                      return (
                        <div key={task.id}
                          className="flex items-center gap-3 rounded-2xl px-3.5 py-3 cursor-pointer"
                          style={{ background:isDark?colors.dark:colors.bg, border:`1px solid ${colors.border}` }}
                          onClick={e => openTaskPanel(e, task)}
                        >
                          <div className="shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center"
                            style={{ borderColor:colors.text }}/>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color:colors.text }}>{task.title}</p>
                            {task.deadline_time && (
                              <p className="text-[10px] mt-0.5 flex items-center gap-1 opacity-70" style={{ color:colors.text }}>
                                <Clock size={9}/>{fmtTime(task.deadline_time)}
                              </p>
                            )}
                          </div>
                          <Pencil size={12} style={{ color:colors.text, opacity:0.50 }}/>
                        </div>
                      );
                    })}
                    {tasks.filter(tk=>tk.deadline===selected&&tk.status==='done').map(task => (
                      <div key={task.id}
                        className="flex items-center gap-3 rounded-2xl px-3.5 py-2.5 opacity-45"
                        style={{ background:'rgba(76,195,138,0.08)', border:'1px solid rgba(76,195,138,0.15)' }}>
                        <Check size={14} className="text-sage-500 shrink-0"/>
                        <p className={`text-xs line-through truncate ${isDark?'text-white/40':'text-ink/50'}`}>{task.title}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
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
          <input className="input-field" placeholder={t('tasks.taskTitle')}
            value={addForm.title} onChange={e => setAddForm({...addForm, title:e.target.value})}
            autoFocus required />
          <textarea className="input-field resize-none" placeholder={t('tasks.description')} rows={2}
            value={addForm.description} onChange={e => setAddForm({...addForm, description:e.target.value})} />
          <div className="grid grid-cols-2 gap-3">
            <select className="input-field" value={addForm.priority}
              onChange={e => setAddForm({...addForm, priority:e.target.value})}>
              <option value="high">{t('tasks.high')}</option>
              <option value="medium">{t('tasks.medium')}</option>
              <option value="low">{t('tasks.low')}</option>
            </select>
            <input className="input-field" placeholder={t('calendar.category')}
              value={addForm.category} onChange={e => setAddForm({...addForm, category:e.target.value})} />
          </div>
          <div className="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium"
            style={{ background:'rgb(var(--accent-500) / 0.08)', border:'1px solid rgb(var(--accent-500) / 0.15)', color:'rgb(var(--accent-500))' }}>
            📅 {addModalOpen && fmtLabel(addModalOpen)}
          </div>
          <input type="time" className="input-field" value={addForm.deadline_time}
            onChange={e => setAddForm({...addForm, deadline_time:e.target.value})} />
          <button type="submit" disabled={saving} className="btn-primary justify-center mt-1">
            {saving ? t('common.saving') : t('calendar.addToCalendar')}
          </button>
        </form>
      </Modal>
    </div>
  );
}