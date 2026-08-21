import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

// Shared "remind me before" chip picker — used by the Tasks page's edit
// modal and Calendar's edit panel + quick-add modal. All three used to
// duplicate this by hand, which is how Calendar quietly fell behind
// when this feature first shipped. One component now, three call sites.
const PRESETS = [
  { minutes: 1440, label: 'tasks.remind1Day'  },
  { minutes: 60,   label: 'tasks.remind1Hour' },
  { minutes: 15,   label: 'tasks.remind15Min' },
];

function formatOffset(minutes, t) {
  if (minutes % 1440 === 0) return t('tasks.customDays',  { n: minutes / 1440 });
  if (minutes % 60   === 0) return t('tasks.customHours',  { n: minutes / 60 });
  return t('tasks.customMins', { n: minutes });
}

export default function ReminderPicker({ value, onChange, t, compact = false }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [amount, setAmount] = useState(45);
  const [unit, setUnit] = useState('minutes');

  const toggle = (minutes) => {
    onChange(value.includes(minutes) ? value.filter(m => m !== minutes) : [...value, minutes]);
  };
  const addCustom = () => {
    const n = Math.max(1, Math.round(Number(amount) || 0));
    const mult = unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1;
    const minutes = n * mult;
    if (!value.includes(minutes)) onChange([...value, minutes]);
    setPickerOpen(false);
  };

  const chipPad   = compact ? 'px-3 py-1 text-[11px]'    : 'px-3.5 py-1.5 text-xs';
  const labelSize = compact ? 'text-[10px] mb-1.5'       : 'text-xs mb-2';
  const gap       = compact ? 'gap-1.5'                  : 'gap-2';

  const customOffsets = value.filter(m => !PRESETS.some(p => p.minutes === m));

  return (
    <div>
      <label className={`font-bold uppercase tracking-widest block ${labelSize} text-ink/40 dark:text-white/30`}>
        {t('tasks.remindBefore')}
      </label>
      <div className={`flex flex-wrap items-center ${gap}`}>
        {PRESETS.map(({ minutes, label }) => {
          const active = value.includes(minutes);
          return (
            <button key={minutes} type="button"
              onClick={() => toggle(minutes)}
              className={`rounded-2xl font-semibold transition-all ${chipPad}`}
              style={active ? {
                background:'linear-gradient(135deg, rgb(var(--accent-500)), rgb(var(--accent-600)))', color:'white',
                boxShadow:'0 4px 12px rgb(var(--accent-500) / 0.30)',
              } : {
                background:'rgb(var(--accent-500) / 0.08)', border:'1px solid rgb(var(--accent-500) / 0.15)',
                color:'rgb(var(--accent-500) / 0.65)',
              }}
            >
              {t(label)}
            </button>
          );
        })}
        {customOffsets.map((minutes) => (
          <button key={minutes} type="button"
            onClick={() => toggle(minutes)}
            className={`flex items-center gap-1 rounded-2xl font-semibold transition-all ${chipPad}`}
            style={{
              background:'linear-gradient(135deg, rgb(var(--accent-500)), rgb(var(--accent-600)))', color:'white',
              boxShadow:'0 4px 12px rgb(var(--accent-500) / 0.30)',
            }}
          >
            {formatOffset(minutes, t)}
            <X size={compact ? 10 : 11} />
          </button>
        ))}
        {!pickerOpen && (
          <button type="button" onClick={() => setPickerOpen(true)}
            className={`flex items-center gap-1 rounded-2xl font-semibold transition-all ${chipPad}`}
            style={{ background:'rgb(var(--accent-500) / 0.08)', border:'1px dashed rgb(var(--accent-500) / 0.30)', color:'rgb(var(--accent-500) / 0.65)' }}
          >
            <Plus size={compact ? 10 : 11} /> {t('tasks.customReminder')}
          </button>
        )}
      </div>
      {pickerOpen && (
        <div className={`flex items-center gap-1.5 mt-2 flex-wrap`}>
          <input type="number" min={1} value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-field text-xs w-16 py-1.5 px-2"
          />
          <select value={unit} onChange={(e) => setUnit(e.target.value)}
            className="input-field text-xs py-1.5 px-2">
            <option value="minutes">{t('tasks.unitMinutes')}</option>
            <option value="hours">{t('tasks.unitHours')}</option>
            <option value="days">{t('tasks.unitDays')}</option>
          </select>
          <button type="button" onClick={addCustom}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background:'linear-gradient(135deg, rgb(var(--accent-500)), rgb(var(--accent-600)))' }}>
            {t('common.add')}
          </button>
          <button type="button" onClick={() => setPickerOpen(false)}
            className="text-xs text-ink/35 dark:text-white/30 px-1.5">
            {t('common.cancel')}
          </button>
        </div>
      )}
      {value.length === 0 && (
        <p className="text-[11px] text-ink/35 dark:text-white/25 mt-1.5">{t('tasks.remindNone')}</p>
      )}
    </div>
  );
}
