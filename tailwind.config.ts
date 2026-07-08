import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Manrope', 'system-ui', 'sans-serif']
      },
      colors: {
        app: {
          bg: '#F7F8FB',
          card: '#FFFFFF',
          line: '#E8ECF3',
          text: '#111827',
          muted: '#6B7280',
          faint: '#9CA3AF',
          purple: '#7C3AED',
          pink: '#EC4899',
          green: '#10B981',
          yellow: '#F59E0B',
          red: '#EF4444',
          blue: '#3B82F6'
        }
      },
      boxShadow: {
        soft: '0 8px 18px rgba(17, 24, 39, 0.04)',
        card: '0 4px 14px rgba(17, 24, 39, 0.04)'
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem'
      }
    }
  },
  plugins: []
};

export default config;
