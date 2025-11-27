/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        rl: {
          dark: "#0f172a", // Deep slate background
          card: "#1e293b", // Lighter card background
          primary: "#0ea5e9", // Cyan
          accent: "#f97316", // Orange
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
