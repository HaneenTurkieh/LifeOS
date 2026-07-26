import React from 'react';

export default function ProgressRing({ value = 0, size = 84, strokeWidth = 8, colorFrom, colorTo, label, sublabel }) {
  const from = colorFrom || 'rgb(var(--accent-500))';
  const to   = colorTo   || 'rgb(var(--accent-600))';
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;
  const gradientId = `ring-${size}-${strokeWidth}`;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgb(var(--accent-500) / 0.12)" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={`url(#${gradientId})`} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="font-display text-lg font-bold text-ink leading-none">{label ?? `${value}%`}</span>
        {sublabel && <span className="text-[10px] text-ink/50 mt-0.5">{sublabel}</span>}
      </div>
    </div>
  );
}