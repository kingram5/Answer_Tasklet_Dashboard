/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './contexts/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#050507',
          900: '#08080c',
          850: '#0c0c12',
          800: '#101018',
          750: '#15151e',
          700: '#1a1a24',
          600: '#22222e',
          500: '#2e2e3a',
        },
        teal: {
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        },
        cosmic: {
          purple: '#6366f1',
          'purple-dim': '#4338ca',
          violet: '#8b5cf6',
          nebula: '#1e1b4b',
        },
        accent: {
          blue: '#3b82f6',
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
          pink: '#ec4899',
          orange: '#f97316',
        },
      },
      boxShadow: {
        'glow-teal-sm': '0 0 8px 0 rgba(20, 184, 166, 0.15)',
        'glow-teal': '0 0 15px 0 rgba(20, 184, 166, 0.20)',
        'glow-teal-lg': '0 0 25px 0 rgba(20, 184, 166, 0.25)',
        'glow-purple-sm': '0 0 8px 0 rgba(99, 102, 241, 0.15)',
        'glow-purple': '0 0 15px 0 rgba(99, 102, 241, 0.20)',
        'glow-purple-lg': '0 0 25px 0 rgba(99, 102, 241, 0.25)',
        'glow-blue-sm': '0 0 8px 0 rgba(59, 130, 246, 0.15)',
        'glow-red-sm': '0 0 8px 0 rgba(239, 68, 68, 0.15)',
        'glow-green-sm': '0 0 8px 0 rgba(16, 185, 129, 0.15)',
        'glow-amber-sm': '0 0 8px 0 rgba(245, 158, 11, 0.15)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.4s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.2s ease-out',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'star-drift': 'starDrift 40s linear infinite',
        'border-rotate': 'borderRotate 4s linear infinite',
        'shimmer-sweep': 'shimmerSweep 2s ease-in-out infinite',
        'twinkle-1': 'twinkle 3s ease-in-out infinite',
        'twinkle-2': 'twinkle 4s ease-in-out 1s infinite',
        'twinkle-3': 'twinkle 5s ease-in-out 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        starDrift: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-50%)' },
        },
        borderRotate: {
          '0%': { '--border-angle': '0deg' },
          '100%': { '--border-angle': '360deg' },
        },
        shimmerSweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.15' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};
