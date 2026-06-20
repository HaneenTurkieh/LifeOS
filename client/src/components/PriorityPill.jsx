import React from 'react';

const STYLES = {
  high: 'bg-coral-500/15 text-coral-500',
  medium: 'bg-sun-500/15 text-sun-600',
  low: 'bg-sage-500/15 text-sage-600',
};

export default function PriorityPill({ priority = 'medium' }) {
  return <span className={`pill ${STYLES[priority] || STYLES.medium} capitalize`}>{priority}</span>;
}