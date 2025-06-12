/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        success: '#059669',
        warning: '#d97706',
        danger: '#dc2626',
      }
    },
  },
  plugins: [],
}
