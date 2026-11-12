/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        nexus: {
          orange: '#FF5500',
          orangeLight: '#FF7733',
          orangeDark: '#E04800',
          orangeGlow: 'rgba(255, 85, 0, 0.15)',
          surface: '#FFFFFF',
          bg: '#F8FAFC',
        }
      },
      boxShadow: {
        'futuristic': '0 10px 30px -10px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(226, 232, 240, 0.8)',
        'orange-glow': '0 8px 25px -5px rgba(255, 85, 0, 0.35), 0 0 0 1px rgba(255, 85, 0, 0.4)',
        'orange-subtle': '0 4px 20px -2px rgba(255, 85, 0, 0.12)',
      }
    },
  },
  plugins: [],
}
