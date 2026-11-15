import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "rgb(var(--color-navy) / <alpha-value>)",
        teal: "rgb(var(--color-teal) / <alpha-value>)",
        bronze: "rgb(var(--color-bronze) / <alpha-value>)",
        cloud: "rgb(var(--color-cloud) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        error: "rgb(var(--color-error) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Aptos", "Segoe UI", "Helvetica Neue", "sans-serif"],
        display: ["Georgia", "Times New Roman", "serif"],
      },
      boxShadow: {
        soft: "0 16px 40px rgb(var(--color-navy) / 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
