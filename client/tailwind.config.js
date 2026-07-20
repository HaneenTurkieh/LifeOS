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
        // Primary brand — Royal Blue family
        blue: {
          50:  '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE',
          300: '#93C5FD', 400: '#60A5FA', 500: '#3B82F6',
          600: '#2563EB', 700: '#1D4ED8', 800: '#1E40AF',
        },
        cyan: {
          50:  '#ECFEFF', 100: '#CFFAFE', 200: '#A5F3FC',
          300: '#67E8F9', 400: '#22D3EE', 500: '#06B6D4',
          600: '#0891B2',
        },
        indigo: {
          50:  '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE',
          300: '#A5B4FC', 400: '#818CF8', 500: '#6366F1',
          600: '#4F46E5', 700: '#4338CA',
        },
        // Violet — sparingly for AI, XP, achievements, premium only
        violet: {
          50:  '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE',
          300: '#C4B5FD', 400: '#A78BFA', 500: '#8B5CF6',
          600: '#7C3AED', 700: '#6D28D9',
        },
        // Semantic
        sun:     { 400: '#FFC773', 500: '#FFB84D', 600: '#F59E0B' },
        sage:    { 400: '#6EE7B7', 500: '#34D399', 600: '#10B981' },
        coral:   { 400: '#FCA5A5', 500: '#EF4444' },
        emerald: { 400: '#6EE7B7', 500: '#34D399', 600: '#10B981' },
        amber:   { 400: '#FCD34D', 500: '#F59E0B' },
        midnight: {
          950: '#030712', 900: '#060B18', 800: '#0A1128', 700: '#0F172A',
        },
        // Aurora atmosphere palette
        aurora: {
          navy:    '#060B18',
          royal:   '#2563EB',
          sky:     '#3B82F6',
          cyan:    '#06B6D4',
          indigo:  '#4F46E5',
          violet:  '#7C3AED',
          emerald: '#34D399',
          amber:   '#FBBF24',
        },
        // Keep lavender as alias so existing components don't break
        lavender: {
          50: '#EFF6FF', 100: '#DBEAFE', 200: '#BFDBFE', 300: '#93C5FD',
          400: '#60A5FA', 500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8',
        },
      },
      boxShadow: {
        // Glass surfaces
        glass:    '0 8px 32px 0 rgba(15, 23, 42, 0.12)',
        'glass-lg': '0 20px 60px -10px rgba(15, 23, 42, 0.22)',
        'glass-xl': '0 30px 80px -16px rgba(15, 23, 42, 0.32)',
        // Blue ambient glow — primary interactions
        glow:     '0 0 0 1px rgba(255,255,255,0.35) inset, 0 8px 32px 0 rgba(37,99,235,0.18)',
        'glow-lg': '0 0 0 1px rgba(255,255,255,0.4) inset, 0 12px 40px 0 rgba(37,99,235,0.28)',
        'glow-blue': '0 0 24px rgba(37,99,235,0.25), 0 0 0 1px rgba(59,130,246,0.2)',
        'glow-cyan': '0 0 24px rgba(6,182,212,0.2), 0 0 0 1px rgba(6,182,212,0.15)',
        // Violet glow — premium/AI only
        'glow-violet': '0 0 24px rgba(124,58,237,0.25), 0 0 0 1px rgba(139,92,246,0.2)',
        'glow-ring': '0 0 0 1px rgba(37,99,235,0.2), 0 0 24px rgba(37,99,235,0.15)',
        // Inner highlight
        'inner-highlight': 'inset 0 1px 0 0 rgba(255,255,255,0.45)',
        // Clay/tactile
        clay: '0 1px 2px rgba(37,99,235,0.06), 0 8px 24px -4px rgba(37,99,235,0.1), inset 0 1px 0 rgba(255,255,255,0.6)',
        'clay-dark': '0 1px 2px rgba(0,0,0,0.25), 0 8px 24px -4px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      backgroundImage: {
        // App backgrounds
        'app-gradient':      'radial-gradient(circle at 10% 0%, #EFF6FF 0%, #F4F6FB 35%, #ECFEFF 100%)',
        'app-gradient-dark': 'radial-gradient(circle at 10% 0%, #060B18 0%, #0A1128 50%, #060B18 100%)',
        // Button gradients
        'btn-blue':   'linear-gradient(135deg, #3B82F6 0%, #2563EB 60%, #1D4ED8 100%)',
        'btn-violet': 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 60%, #6D28D9 100%)',
        // Card sheen
        'card-sheen': 'linear-gradient(135deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.2) 100%)',
        // Mesh backgrounds
        'mesh-light': 'radial-gradient(at 15% 10%, rgba(37,99,235,0.08) 0px, transparent 50%), radial-gradient(at 85% 0%, rgba(6,182,212,0.06) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(52,211,153,0.04) 0px, transparent 50%)',
        'mesh-dark':  'radial-gradient(at 15% 10%, rgba(37,99,235,0.18) 0px, transparent 50%), radial-gradient(at 85% 0%, rgba(6,182,212,0.12) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(99,102,241,0.1) 0px, transparent 50%)',
        // Chart semantic gradients
        'chart-productivity': 'linear-gradient(135deg, #3B82F6, #2563EB)',
        'chart-xp':           'linear-gradient(135deg, #8B5CF6, #7C3AED)',
        'chart-mood':         'linear-gradient(135deg, #FBBF24, #F59E0B)',
        'chart-habits':       'linear-gradient(135deg, #34D399, #10B981)',
        'chart-tasks':        'linear-gradient(135deg, #22D3EE, #06B6D4)',
      },
      borderRadius: {
        '2xl': '1.25rem', '3xl': '1.75rem', '4xl': '2.25rem',
      },
      keyframes: {
        floaty:    { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-6px)' } },
        popIn:     { '0%': { opacity: 0, transform: 'scale(0.95) translateY(6px)' }, '100%': { opacity: 1, transform: 'scale(1) translateY(0)' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        flicker: {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)', opacity: 1 },
          '25%':  { transform: 'scale(1.04) rotate(-1.5deg)', opacity: 0.93 },
          '50%':  { transform: 'scale(0.97) rotate(1deg)', opacity: 1 },
          '75%':  { transform: 'scale(1.02) rotate(-0.5deg)', opacity: 0.96 },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(37,99,235,0.35)' },
          '50%':       { boxShadow: '0 0 0 10px rgba(37,99,235,0)' },
        },
        // Ultra-slow aurora drift — almost imperceptible
        auroraDrift: {
          '0%, 100%': { transform: 'scale-x-150 scaleY(1.75) translateY(0px)' },
          '50%':       { transform: 'scale-x-150 scaleY(1.75) translateY(-12px)' },
        },
      },
      animation: {
        floaty:     'floaty 6s ease-in-out infinite',
        popIn:      'popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer:    'shimmer 1.6s linear infinite',
        flicker:    'flicker 3s ease-in-out infinite',
        glowPulse:  'glowPulse 2s ease-out infinite',
        auroraDrift:'auroraDrift 20s ease-in-out infinite',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};