import React, { useEffect, useRef, useState } from 'react';
import { useSpring, useMotionValueEvent } from 'framer-motion';

// Smoothly counts up/down to `value` whenever it changes — used for XP,
// streaks, productivity score, etc. so numbers feel alive instead of
// snapping. Falls back to a plain number if `prefers-reduced-motion` is set.
export default function AnimatedNumber({ value = 0, suffix = '', className = '' }) {
  const isFirstRender = useRef(true);
  const spring = useSpring(value, { stiffness: 120, damping: 20, mass: 0.6 });
  const [display, setDisplay] = useState(Math.round(value));
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useMotionValueEvent(spring, 'change', (latest) => {
    setDisplay(Math.round(latest));
  });

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      spring.jump(value); // no animation on initial mount, only on subsequent changes
      setDisplay(Math.round(value));
      return;
    }
    spring.set(value);
  }, [value, spring]);

  const shown = reducedMotion ? value : display;

  return (
    <span className={className}>
      {shown.toLocaleString()}{suffix}
    </span>
  );
}