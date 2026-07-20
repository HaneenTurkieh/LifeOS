/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Outfit"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
      colors: {
        ink: '#1E2233',
        mist: '#F4F6FB',
        lavender: {
          50: '#F4F3FF', 100: '#EBE8FF', 200: '#D9D4FF', 300: '#BBB0FF',
          400: '#9A8BFB', 500: '#7C6AF0', 600: '#5B47E0', 700: '#4634B8',
        },
        sun: { 400: '#FFC773', 500: '#FFB84D', 600: '#F59E0B' },
        sage: { 400: '#7FD8A6', 500: '#4CC38A', 600: '#2DA76E' },
        coral: { 400: '#FF9C8A', 500: '#FF7A63' },
        midnight: { 950: '#08070F', 900: '#0C0A1A', 800: '#161329', 700: '#1F1A3D' },
        aurora: {
          purple: '#7C5CFF', violet: '#8B5CF6', indigo: '#6366F1',
          sky: '#60A5FA', emerald: '#34D399', amber: '#FBBF24',
        },
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(76, 70, 150, 0.12)',
        'glass-lg': '0 20px 60px -10px rgba(76, 70, 150, 0.25)',
        'glass-xl': '0 30px 80px -16px rgba(76, 70, 150, 0.35)',
        glow: '0 0 0 1px rgba(255,255,255,0.4) inset, 0 8px 32px 0 rgba(76, 70, 150, 0.12)',
        'glow-lg': '0 0 0 1px rgba(255,255,255,0.5) inset, 0 12px 40px 0 rgba(124,106,240,0.35)',
        'inner-highlight': 'inset 0 1px 0 0 rgba(255,255,255,0.5)',
        clay: '0 1px 2px rgba(124,92,255,0.06), 0 8px 24px -4px rgba(124,92,255,0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
        'clay-dark': '0 1px 2px rgba(0,0,0,0.2), 0 8px 24px -4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glow-ring': '0 0 0 1px rgba(124,92,255,0.15), 0 0 24px rgba(124,92,255,0.18)',
      },
      backgroundImage: {
        'app-gradient': 'radial-gradient(circle at 10% 0%, #EFEAFF 0%, #F4F6FB 35%, #EAF4F6 100%)',
        'app-gradient-dark': 'radial-gradient(circle at 10% 0%, #1b1633 0%, #0c0a1a 45%, #11182b 100%)',
        'card-sheen': 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.25) 100%)',
        'hero-gradient': 'linear-gradient(135deg, #7C6AF0 0%, #5B47E0 45%, #4634B8 100%)',
        'mesh-light': 'radial-gradient(at 15% 10%, rgba(124,92,255,0.10) 0px, transparent 50%), radial-gradient(at 85% 0%, rgba(96,165,250,0.08) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(52,211,153,0.06) 0px, transparent 50%)',
        'mesh-dark': 'radial-gradient(at 15% 10%, rgba(124,92,255,0.22) 0px, transparent 50%), radial-gradient(at 85% 0%, rgba(139,92,246,0.18) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(96,165,250,0.12) 0px, transparent 50%)',
      },
      borderRadius: {
        '2xl': '1.25rem', '3xl': '1.75rem', '4xl': '2.25rem',
      },
      keyframes: {
        floaty: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
        popIn: { '0%': { opacity: '0', transform: 'scale(0.9) translateY(8px)' }, '100%': { opacity: '1', transform: 'scale(1) translateY(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        flicker: {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
          '25%': { transform: 'scale(1.05) rotate(-2deg)', opacity: '0.92' },
          '50%': { transform: 'scale(0.97) rotate(1deg)', opacity: '1' },
          '75%': { transform: 'scale(1.03) rotate(-1deg)', opacity: '0.95' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(124,106,240,0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(124,106,240,0)' },
        },
      },
      animation: {
        floaty: 'floaty 5s ease-in-out infinite',
        popIn: 'popIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.6s linear infinite',
        flicker: 'flicker 2.2s ease-in-out infinite',
        glowPulse: 'glowPulse 1.8s ease-out infinite',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};