import type { Config } from 'tailwindcss';

// Charte officielle JOVKEY-1XBET (extraite de la maquette de référence + PDF).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: '#0f172a', // Deep Slate Night — fond principal
        ink: '#f8fafc',
        gold: { DEFAULT: '#f59e0b', dark: '#d97706' },
        electric: '#3b82f6', // bleu électrique
        live: '#22c55e', // vert succès live
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      fontWeight: {
        black: '900',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      },
      keyframes: {
        pulseGold: {
          '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(245,158,11,0.4)' },
          '70%': { transform: 'scale(1.05)', boxShadow: '0 0 0 15px rgba(245,158,11,0)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(245,158,11,0)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        pulseGold: 'pulseGold 2s infinite',
        shimmer: 'shimmer 2s infinite linear',
        marquee: 'marquee var(--marquee-duration, 20s) linear infinite',
      },
    },
  },
  plugins: [],
};
export default config;
