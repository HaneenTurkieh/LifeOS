/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Outfit"', 'sans-serif'],
        body:    ['"Inter"', 'sans-serif'],
      },
      colors: {
        ink: '#1E2233',
        mist: '#F4F6FB',
        // Neutral navy — background layers
        navy: {
          950: '#070B14',
          900: '#0A0F1E',
          800: '#0D1528',
          700: '#111B35',
        },
        // Blue — buttons, active states, interactive only
        blue: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
        },
        // Cyan — aurora light accent
        cyan: {
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',
          600: '#0891B2',
        },
        // Indigo — aurora atmosphere
        indigo: {
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
        // Violet — AI, XP, achievements, premium ONLY
        violet: {
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
        },
        // Semantic chart / status colors
        sun:    { 400: '#FCD34D', 500: '#F59E0B', 600: '#D97706' },
        sage:   { 400: '#6EE7B7', 500: '#34D399', 600: '#10B981' },
        coral:  { 400: '#FCA5A5', 500: '#EF4444', 600: '#DC2626' },
        // Keep lavender mapped to blue so existing components don't break
        lavender: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        midnight: {
          950: '#070B14',
          900: '#0A0F1E',
          800: '#0D1528',
          700: '#111B35',
        },
        aurora: {
          navy:   '#070B14',
          royal:  '#2563EB',
          sky:    '#3B82F6',
          cyan:   '#06B6D4',
          indigo: '#4F46E5',
          violet: '#7C3AED',
        },
      },
      boxShadow: {
        // Neutral glass depth — no color tint
        glass:    '0 4px 24px 0 rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glass-lg': '0 12px 48px -8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10)',
        'glass-xl': '0 24px 72px -16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)',
        // Blue glow — active/hover states only
        glow:        '0 0 0 1px rgba(255,255,255,0.08) inset, 0 8px 32px rgba(37,99,235,0.20)',
        'glow-lg':   '0 0 0 1px rgba(255,255,255,0.10) inset, 0 16px 48px rgba(37,99,235,0.28)',
        'glow-blue': '0 0 20px rgba(37,99,235,0.22), 0 0 0 1px rgba(59,130,246,0.18)',
        'glow-cyan': '0 0 20px rgba(6,182,212,0.18), 0 0 0 1px rgba(6,182,212,0.14)',
        'glow-violet':'0 0 20px rgba(124,58,237,0.22), 0 0 0 1px rgba(139,92,246,0.16)',
        'glow-ring': '0 0 0 1px rgba(37,99,235,0.18), 0 0 20px rgba(37,99,235,0.14)',
        // Inner light — glass highlight
        'inner-highlight': 'inset 0 1px 0 rgba(255,255,255,0.12)',
        // Tactile
        clay:      '0 1px 3px rgba(0,0,0,0.12), 0 8px 24px -4px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.55)',
        'clay-dark':'0 1px 3px rgba(0,0,0,0.30), 0 8px 24px -4px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        // App backgrounds
        'app-gradient':      'radial-gradient(circle at 12% 8%, #EEF2FF 0%, #F4F6FB 40%, #ECFEFF 100%)',
        'app-gradient-dark': 'linear-gradient(180deg, #070B14 0%, #0A0F1E 100%)',
        // Buttons — blue is the primary color accent
        'btn-blue':   'linear-gradient(145deg, #3B82F6 0%, #2563EB 55%, #1D4ED8 100%)',
        'btn-violet': 'linear-gradient(145deg, #8B5CF6 0%, #7C3AED 55%, #6D28D9 100%)',
        // Neutral card sheen
        'card-sheen': 'linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%)',
        // Mesh — very subtle
        'mesh-light': 'radial-gradient(at 20% 10%, rgba(37,99,235,0.06) 0px, transparent 55%), radial-gradient(at 80% 5%, rgba(6,182,212,0.04) 0px, transparent 55%)',
        'mesh-dark':  'radial-gradient(at 20% 10%, rgba(37,99,235,0.10) 0px, transparent 55%), radial-gradient(at 80% 5%, rgba(6,182,212,0.06) 0px, transparent 55%)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },
      keyframes: {
        // Gentle float — VisionOS-like
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-5px)' },
        },
        popIn: {
          '0%':   { opacity: '0', transform: 'scale(0.96) translateY(6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        flicker: {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
          '33%':  { transform: 'scale(1.03) rotate(-1deg)', opacity: '0.94' },
          '66%':  { transform: 'scale(0.98) rotate(0.5deg)', opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(37,99,235,0.30)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(37,99,235,0)' },
        },
      },
      animation: {
        floaty:    'floaty 7s ease-in-out infinite',
        popIn:     'popIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer:   'shimmer 1.6s linear infinite',
        flicker:   'flicker 4s ease-in-out infinite',
        glowPulse: 'glowPulse 2.2s ease-out infinite',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};