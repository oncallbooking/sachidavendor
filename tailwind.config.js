/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        neo: {
          50: "#f6fbfb",
          100: "#eaf7ff",
          200: "#bfefff",
          300: "#99e7ff",
          400: "#66dfff",
          500: "#33d7ff",
          600: "#1fb3cc",
          700: "#178899",
          800: "#0f5c66",
          900: "#063033"
        }
      },
      backgroundImage: {
        'frost': 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'
      }
    }
  },
  plugins: []
}
