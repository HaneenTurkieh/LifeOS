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
            50: '#F4F3FF',
            100: '#EBE8FF',
            200: '#D9D4FF',
            300: '#BBB0FF',
            400: '#9A8BFB',
            500: '#7C6AF0',
            600: '#5B47E0',
            700: '#4634B8',
          },
          sun: {
            400: '#FFC773',
            500: '#FFB84D',
            600: '#F59E0B',
          },
          sage: {
            400: '#7FD8A6',
            500: '#4CC38A',
            600: '#2DA76E',
          },
          coral: {
            400: '#FF9C8A',
            500: '#FF7A63',
          },
        },
        boxShadow: {
          glass: '0 8px 32px 0 rgba(76, 70, 150, 0.12)',
          'glass-lg': '0 20px 60px -10px rgba(76, 70, 150, 0.25)',
          glow: '0 0 0 1px rgba(255,255,255,0.4) inset, 0 8px 32px 0 rgba(76, 70, 150, 0.12)',
        },
        backgroundImage: {
          'app-gradient': 'radial-gradient(circle at 10% 0%, #EFEAFF 0%, #F4F6FB 35%, #EAF4F6 100%)',
          'card-sheen': 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.25) 100%)',
        },
        borderRadius: {
          '2xl': '1.25rem',
          '3xl': '1.75rem',
          '4xl': '2.25rem',
        },
        keyframes: {
          floaty: { '0%, 100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-8px)' } },
          popIn: { '0%': { opacity: 0, transform: 'scale(0.9) translateY(8px)' }, '100%': { opacity: 1, transform: 'scale(1) translateY(0)' } },
          shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        },
        animation: {
          floaty: 'floaty 5s ease-in-out infinite',
          popIn: 'popIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          shimmer: 'shimmer 2.5s linear infinite',
        },
      },
    },
    plugins: [],
  };