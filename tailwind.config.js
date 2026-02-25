/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        foreground: '#0f172a',
        primary: {
          DEFAULT: '#1e40af',
          light: '#3b82f6',
          dark: '#1e3a5f',
        },
        accent: {
          DEFAULT: '#f59e0b',
          light: '#fbbf24',
        },
        surface: {
          DEFAULT: '#f8fafc',
          dark: '#f1f5f9',
        },
        border: '#e2e8f0',
        muted: '#64748b',
        success: '#10b981',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
}
