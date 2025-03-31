/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{vue,js,ts,jsx,tsx}",
    "./entrypoints/**/*.{vue,js,ts,jsx,tsx}",
    "./components/**/*.{vue,js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#70c1b3',
          light: '#a5d8d2',
          dark: '#4d8c82'
        }
      }
    },
  },
  daisyui: {
    themes: [
      {
        mytheme: {
          "primary": "#70c1b3",
          "primary-focus": "#4d8c82",
          "primary-content": "#ffffff",
          "secondary": "#a5d8d2",
          "accent": "#f39c12",
          "neutral": "#333333",
          "base-100": "#f5f5f5",
          "info": "#3498db",
          "success": "#2ecc71",
          "warning": "#f39c12",
          "error": "#e74c3c"
        },
      },
    ],
  }
}