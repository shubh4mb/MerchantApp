/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/context/**/*.{js,jsx,ts,tsx}",
    "./src/utils/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#1A1A1A",      // Elegant black primary theme
        secondary: "#64748B",    // Slate secondary
        accent: "#EF4444",       // Warning/Red accent
        success: "#10B981",      // Success green
        warning: "#F59E0B",      // Warning amber
        background: "#F8FAFC",   // Clean light background
        surface: "#FFFFFF",      // Surface cards background
        men: "#0F172A",
        women: "#DB2777",
        kids: "#F59E0B",
      }
    },
  },
  plugins: [],
}
