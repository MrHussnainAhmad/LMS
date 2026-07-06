import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53', // Deep navy primary
          900: '#102a43', // Ink navy
          950: '#0b1d2e',
        },
        stone: {
          50: '#faf9f8',
          100: '#f4f2f0',
          200: '#e8e5e1',
          300: '#d6d1cb',
          400: '#b4afa9',
          500: '#948f88',
          600: '#757069',
          700: '#5c5852',
          800: '#4a4642',
          900: '#3f3c38',
          950: '#23211f',
        },
        accent: {
          DEFAULT: '#e63946', // Sharp accent
          hover: '#d62828',
        },
        success: '#2a9d8f',
        warning: '#e9c46a',
        danger: '#e76f51',
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        border: "var(--border)",
        ring: "var(--ring)",
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'sans-serif'],
        display: ['var(--font-bricolage)', 'sans-serif'],
      },
      borderRadius: {
        sm: '0.125rem',
        DEFAULT: '0.25rem', // Restrained
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        elevation: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'slide-up': 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
