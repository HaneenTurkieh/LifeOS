import React, { useEffect, useRef, useState } from 'react';
import { Clock, X } from 'lucide-react';

// Custom time picker — replaces the native <input type="time"> that used
// to sit here. That native control renders completely differently per
// browser: Chrome shows an actual clock-style dropdown, Safari shows tiny
// inline up/down steppers with no dropdown at all — which reads as
// "broken" to someone who only ever tested in Chrome. This renders the
// exact same scrollable hour/minute dropdown everywhere, in both light
// and dark mode and both LTR/RTL (uses logical start/end, not left/right).
//
// value/onChange use the same 24h "HH:MM" string the rest of the app
// already stores in deadline_time, so it's a drop-in swap for the two
// spots that used to render <input type="time"> directly (the add-task
// and edit-task modals in Calendar.jsx).
export default function TimeDropdown({ value, onChange, placeholder, clearLabel, isDark, className = '' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const [rawHour, rawMinute] = value ? value.split(':') : ['', ''];
  const hour   = rawHour   || '00';
  const minute = rawMinute || '00';

  // Picking a column before the other has any value yet defaults the
  // other half to '00' — matches how a native time input behaves when
  // you fill in just one segment.
  const setHour   = (h) => onChange(`${h}:${value ? minute : '00'}`);
  const setMinute = (m) => onChange(`${value ? hour : '00'}:${m}`);

  const hours   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  // 5-minute steps (12 rows) instead of all 60 — plenty precise for a
  // task deadline/reminder time, and keeps the dropdown short enough to
  // scan without scrolling through a huge list.
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  const mutedClr = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(30,34,51,0.40)';
  const textClr  = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(30,34,51,0.85)';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input-field pe-9 w-full text-start flex items-center gap-2"
      >
        <Clock size={14} style={{ color: mutedClr, flexShrink: 0 }} />
        <span style={{ color: value ? textClr : mutedClr }}>
          {value ? `${hour}:${minute}` : (placeholder || 'Select time')}
        </span>
      </button>

      {value && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false); }}
          aria-label={clearLabel}
          className="absolute inset-y-0 end-2 flex items-center px-1.5"
          style={{ color: mutedClr }}
        >
          <X size={14} />
        </button>
      )}

      {open && (
        <div
          className="absolute z-50 top-full start-0 mt-1 flex rounded-xl overflow-hidden"
          style={{
            background:     isDark ? 'rgba(24,20,40,0.98)' : 'rgba(255,255,255,0.98)',
            border:         isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow:      '0 12px 32px rgba(0,0,0,0.18)',
          }}
        >
          <div className="max-h-48 overflow-y-auto py-1 w-16">
            {hours.map((h) => {
              const active = value && h === hour;
              return (
                <button
                  key={h} type="button" onClick={() => setHour(h)}
                  className="w-full text-center text-xs py-1.5"
                  style={{
                    background: active ? 'rgb(var(--accent-500) / 0.15)' : 'transparent',
                    color:      active ? 'rgb(var(--accent-500))' : textClr,
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {h}
                </button>
              );
            })}
          </div>
          <div
            className="max-h-48 overflow-y-auto py-1 w-16"
            style={{ borderInlineStart: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)' }}
          >
            {minutes.map((m) => {
              const active = value && m === minute;
              return (
                <button
                  key={m} type="button" onClick={() => setMinute(m)}
                  className="w-full text-center text-xs py-1.5"
                  style={{
                    background: active ? 'rgb(var(--accent-500) / 0.15)' : 'transparent',
                    color:      active ? 'rgb(var(--accent-500))' : textClr,
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
