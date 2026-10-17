import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/content/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        "2xl": "1200px",
      },
    },
    extend: {
      colors: {
        brand: {
          50: "#eff8ff",
          100: "#dbeefe",
          200: "#bfe1fe",
          300: "#93ceFD",
          400: "#60b1fa",
          500: "#3b92f6",
          600: "#2574eb",
          700: "#1d5dd8",
          800: "#1e4caf",
          900: "#1d428a",
          950: "#162a54",
        },
        accent: {
          50: "#fffaeb",
          100: "#fef0c7",
          200: "#fedf89",
          300: "#fec84b",
          400: "#fdb022",
          500: "#f79009",
          600: "#dc6803",
          700: "#b54708",
          800: "#93370d",
          900: "#7a2e0e",
        },
      },
      fontFamily: {
        sans: [
          "Hind Siliguri",
          "Inter",
          "Noto Sans Bengali",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.08)",
        "card-hover":
          "0 10px 25px -5px rgb(16 24 40 / 0.10), 0 8px 10px -6px rgb(16 24 40 / 0.06)",
      },
      backgroundImage: {
        "mesh-grid":
          "linear-gradient(to right, rgb(37 116 235 / 0.10) 1px, transparent 1px), linear-gradient(to bottom, rgb(37 116 235 / 0.10) 1px, transparent 1px)",
        "mesh-diagonal":
          "repeating-linear-gradient(45deg, rgb(37 116 235 / 0.14) 0 2px, transparent 2px 12px), repeating-linear-gradient(-45deg, rgb(37 116 235 / 0.14) 0 2px, transparent 2px 12px)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "fade-in": "fade-in 0.3s ease-out both",
        "scale-in": "scale-in 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
