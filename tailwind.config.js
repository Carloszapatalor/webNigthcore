/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./routes/**/*.{ts,tsx}", "./views/**/*.{ts,tsx}", "./main.ts"],
  theme: {
    extend: {
      fontFamily: {
        rpg: ['Orbitron', 'sans-serif'],
        subtitle: ['Exo 2', 'sans-serif'],
      },
      colors: {
        stone: {
          950: '#0B0D13',
        },
        violet: {
          950: '#1c0a2e',
        }
      },
      boxShadow: {
        'neon-violet': '0 0 20px rgba(139, 92, 246, 0.3)',
        'neon-cyan': '0 0 20px rgba(6, 182, 212, 0.3)',
        'neon-pink': '0 0 20px rgba(236, 72, 153, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}