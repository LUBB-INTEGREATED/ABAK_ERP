import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ABAK Brand Colors
        'abak-blue': {
          DEFAULT: '#236382',
          50: '#E8F2F6',
          100: '#D1E5ED',
          200: '#A3CBD9',
          300: '#75B1C6',
          400: '#4997B3',
          500: '#236382', // Main brand color
          600: '#1C4F68',
          700: '#153B4E',
          800: '#0E2734',
          900: '#07141A',
        },
        'abak-gold': {
          DEFAULT: '#A78B42',
          50: '#F5F1E8',
          100: '#EBE3D1',
          200: '#D7C7A3',
          300: '#C3AB75',
          400: '#AF8F47',
          500: '#A78B42', // Main brand color
          600: '#866F35',
          700: '#645328',
          800: '#43371A',
          900: '#211C0D',
        },

        // UI Colors
        'dark-text': '#1B1B1B',
        'off-white': '#F9F7F5',

        // shadcn/ui color system (using ABAK colors)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: '#236382',
        background: '#F9F7F5',
        foreground: '#1B1B1B',

        primary: {
          DEFAULT: '#236382', // ABAK Blue
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#A78B42', // ABAK Gold
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#F3F4F6',
          foreground: '#6B7280',
        },
        accent: {
          DEFAULT: '#A78B42', // ABAK Gold for accents
          foreground: '#FFFFFF',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#1B1B1B',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#1B1B1B',
        },

        // Status colors
        success: '#A78B42', // Use brand gold for success
        warning: '#D97706',
        error: '#DC2626',
        info: '#3B82F6',
      },

      fontFamily: {
        sans: ['Inter', 'Cairo', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },

      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },

      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
