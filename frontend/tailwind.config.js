/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: '#f7f9fb',
        primary: {
          DEFAULT: '#004ac6',
          secondary: '#2563eb'
        },
        border: '#e2e8f0',
        dark: {
          bg: '#08090f',
          surface: '#0d0f1b',
          card: '#121526',
          elevated: '#171b30',
          border: '#1e233d',
          hover: '#1a1f38',
          muted: '#7a879e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
