import React from 'react';

// Circular progress indicator used for productivity score, goal %, etc.
export default function ProgressRing({ value = 0, size = 84, strokeWidth = 8, colorFrom = '#7C6AF0', colorTo = '#5B47E0', label, sublabel }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;
  const gradientId = `ring-${colorFrom.replace('#', '')}-${colorTo.replace('#', '')}`;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorFrom} />
            <stop offset="100%" stopColor={colorTo} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(124,106,240,0.12)" strokeWidth={strokeWidth} fill="none" />
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