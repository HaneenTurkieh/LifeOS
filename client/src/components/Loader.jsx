import React from 'react';

export function CardSkeleton({ className = 'h-32' }) {
  return <div className={`glass-card skeleton ${className}`} />;
}

export default function PageLoader() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}