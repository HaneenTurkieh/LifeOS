import React, { createContext, useContext, useState, useEffect } from 'react';

const PerformanceContext = createContext(null);
const STORAGE_KEY = 'aurora_low_power';

export function PerformanceProvider({ children }) {
  const [lowPower, setLowPowerState] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(lowPower));
  }, [lowPower]);

  const toggleLowPower = () => setLowPowerState((v) => !v);

  return (
    <PerformanceContext.Provider value={{ lowPower, toggleLowPower }}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformance() {
  const ctx = useContext(PerformanceContext);
  if (!ctx) throw new Error('usePerformance must be used inside PerformanceProvider');
  return ctx;
}
