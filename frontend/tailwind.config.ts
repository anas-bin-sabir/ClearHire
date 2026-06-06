import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },

      colors: {
        background: "rgb(var(--background-rgb) / var(--tw-bg-opacity, 1))",
        foreground: "rgb(var(--foreground-rgb) / var(--tw-text-opacity, 1))",

        card: {
          DEFAULT: "rgb(var(--card-rgb) / var(--tw-bg-opacity, 1))",
          elevated: "rgb(var(--card-elevated-rgb) / var(--tw-bg-opacity, 1))",
        },

        border: "rgb(var(--border-rgb) / var(--tw-border-opacity, 1))",

        muted: {
          DEFAULT: "rgb(var(--muted-rgb) / var(--tw-text-opacity, 1))",
          foreground: "rgb(var(--muted-rgb) / 0.7)",
        },

        primary: "rgb(var(--primary-rgb) / var(--tw-bg-opacity, 1))",
        secondary: "rgb(var(--secondary-rgb) / var(--tw-bg-opacity, 1))",
        success: "rgb(var(--success-rgb) / var(--tw-bg-opacity, 1))",
        warning: "rgb(var(--warning-rgb) / var(--tw-bg-opacity, 1))",
        danger: "rgb(var(--danger-rgb) / var(--tw-bg-opacity, 1))",

        ring: "rgb(var(--ring-rgb) / var(--tw-ring-opacity, 1))",

        accent: "rgb(var(--primary-rgb) / var(--tw-bg-opacity, 1))",
      },

      spacing: {
        4.5: "1.125rem",
        13: "3.25rem",
        18: "4.5rem",
      },

      borderRadius: {
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",

        xl: "1rem",
        "2xl": "1.25rem",

        full: "9999px",
      },

      boxShadow: {
        sm: "var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))",
        md: "var(--shadow-md, 0 4px 10px rgba(0,0,0,0.08))",
        lg: "var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.12))",
      },
    },
  },

  plugins: [],
};

export default config;
