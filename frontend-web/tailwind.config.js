/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#f2fafa",
          100: "#dff7ff",
          200: "#b9edf3",
          300: "#7edce5",
          400: "#3fc2cc",
          500: "#00afa8",
          600: "#0c878e",
          700: "#087078",
          800: "#075966",
          900: "#0e2e38",
        },
        lumo: {
          DEFAULT: "#00afa8",
          light:   "#4fcaf4",
          dark:    "#0e2e38",
        },
        accent: {
          50:  "#fff5f2",
          100: "#ffe4dd",
          200: "#ffcabb",
          300: "#ffad99",
          400: "#ff947b",
          500: "#ff846b",
        },
      },
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui"],
        display: ["Be Vietnam Pro", "Manrope", "ui-sans-serif", "system-ui"],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'glow': '0 0 20px rgba(0, 175, 168, 0.15)',
      },
    },
  },
  plugins: [],
};
