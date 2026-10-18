import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eefbff',
          100: '#d7f4ff',
          500: '#1f9ae8',
          600: '#0f7dcb',
          700: '#0d659a',
        },
        slate: {
          950: '#081120',
        },
      },
      boxShadow: {
        soft: '0 20px 60px rgba(15, 23, 42, 0.18)',
      },
    },
  },
  plugins: [],
};

export default config;
