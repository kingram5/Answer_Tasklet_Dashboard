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
          900: '#0a0a0f',
          800: '#12121a',
          700: '#1a1a25',
          600: '#252530',
        },
        accent: {
          blue: '#3b82f6',
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
        },
        teal: {
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
        },
      },
    },
  },
  plugins: [],
};
