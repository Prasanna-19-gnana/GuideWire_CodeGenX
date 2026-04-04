/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0a0f1c',
          800: '#111827',
          700: '#1f2937',
        },
        brand: {
          blue: '#3b82f6',
          teal: '#14b8a6',
          purple: '#8b5cf6',
          accent: '#00f2fe'
        }
      },
      fontFamily: {
        heading: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s infinite',
        'flow': 'flow 2s ease-out forwards',
        'fade-in': 'fadeIn 0.5s ease-in-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 1, boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)' },
          '50%': { opacity: .7, boxShadow: '0 0 25px rgba(239, 68, 68, 0.8)' },
        },
        flow: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 }
        }
      }
    },
  },
  plugins: [],
}
