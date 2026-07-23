import React from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

export default function GlobalBackground() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{
        background: isDark ? '#080612' : '#F0EEFF',
      }} />

      <style>{`
        .orb {
          position: absolute;
          border-radius: 50%;
          will-change: transform;
        }
        .orb-1 { animation: drift1 18s ease-in-out infinite; }
        .orb-2 { animation: drift2 24s ease-in-out infinite; }
        .orb-3 { animation: drift3 20s ease-in-out infinite; }
        .orb-4 { animation: drift4 15s ease-in-out infinite; }
        .orb-5 { animation: drift1 22s ease-in-out infinite reverse; }

        @keyframes drift1 {
          0%,100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(25px,-20px) scale(1.06); }
          66%      { transform: translate(-18px,22px) scale(0.96); }
        }
        @keyframes drift2 {
          0%,100% { transform: translate(0,0) scale(1); }
          40%      { transform: translate(-30px,18px) scale(1.04); }
          70%      { transform: translate(20px,-25px) scale(0.97); }
        }
        @keyframes drift3 {
          0%,100% { transform: translate(0,0); }
          50%      { transform: translate(22px,28px); }
        }
        @keyframes drift4 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(-20px,-18px) scale(1.08); }
        }
      `}</style>

      {isDark ? (
        <>
          {/* Main — top left */}
          <div className="orb orb-1" style={{
            width: 480, height: 480,
            top: -140, left: -120,
            background: 'radial-gradient(circle at 35% 35%, #9B8AFF 0%, #5B47E0 45%, #2D1B8E 100%)',
            filter: 'blur(48px)',
            opacity: 0.38,
          }} />
          {/* Bottom right */}
          <div className="orb orb-2" style={{
            width: 340, height: 340,
            bottom: -80, right: -60,
            background: 'radial-gradient(circle at 40% 30%, #A78BFA 0%, #7C6AF0 50%, #3B2AA0 100%)',
            filter: 'blur(42px)',
            opacity: 0.30,
          }} />
          {/* Mid right */}
          <div className="orb orb-3" style={{
            width: 180, height: 180,
            top: '35%', right: '8%',
            background: 'radial-gradient(circle at 40% 40%, #C4B5FD 0%, #7C6AF0 60%, #4C35C8 100%)',
            filter: 'blur(30px)',
            opacity: 0.32,
          }} />
          {/* Tiny top right */}
          <div className="orb orb-4" style={{
            width: 100, height: 100,
            top: '10%', right: '22%',
            background: 'radial-gradient(circle, #DDD6FE 0%, #8B5CF6 100%)',
            filter: 'blur(20px)',
            opacity: 0.28,
          }} />
          {/* Bottom left */}
          <div className="orb orb-5" style={{
            width: 220, height: 220,
            bottom: '15%', left: '10%',
            background: 'radial-gradient(circle at 45% 40%, #818CF8 0%, #5B47E0 60%, #1E1270 100%)',
            filter: 'blur(38px)',
            opacity: 0.22,
          }} />
        </>
      ) : (
        <>
          {/* Main — top left */}
          <div className="orb orb-1" style={{
            width: 440, height: 440,
            top: -120, left: -100,
            background: 'radial-gradient(circle at 35% 35%, #C4B5FD 0%, #8B5CF6 45%, #6D28D9 100%)',
            filter: 'blur(44px)',
            opacity: 0.28,
          }} />
          {/* Bottom right */}
          <div className="orb orb-2" style={{
            width: 300, height: 300,
            bottom: -60, right: -50,
            background: 'radial-gradient(circle at 40% 35%, #DDD6FE 0%, #A78BFA 50%, #7C3AED 100%)',
            filter: 'blur(38px)',
            opacity: 0.24,
          }} />
          {/* Mid right */}
          <div className="orb orb-3" style={{
            width: 160, height: 160,
            top: '30%', right: '10%',
            background: 'radial-gradient(circle at 40% 35%, #EDE9FE 0%, #8B5CF6 60%, #5B21B6 100%)',
            filter: 'blur(26px)',
            opacity: 0.28,
          }} />
          {/* Tiny */}
          <div className="orb orb-4" style={{
            width: 90, height: 90,
            top: '12%', right: '25%',
            background: 'radial-gradient(circle, #F5F3FF 0%, #7C3AED 100%)',
            filter: 'blur(18px)',
            opacity: 0.25,
          }} />
          {/* Bottom left */}
          <div className="orb orb-5" style={{
            width: 200, height: 200,
            bottom: '18%', left: '8%',
            background: 'radial-gradient(circle at 40% 40%, #C4B5FD 0%, #7C6AF0 55%, #4C1D95 100%)',
            filter: 'blur(32px)',
            opacity: 0.18,
          }} />
        </>
      )}
    </div>
  );
}