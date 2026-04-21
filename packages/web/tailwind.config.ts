import type { Config } from 'tailwindcss';
import { join } from 'path';

const config: Config = {
  darkMode: ['class'],
  content: [
    join(__dirname, 'src/app/**/*.{js,ts,jsx,tsx,mdx}'),
    join(__dirname, 'src/components/**/*.{js,ts,jsx,tsx,mdx}'),
    join(__dirname, 'src/pages/**/*.{js,ts,jsx,tsx,mdx}'),
    join(__dirname, '../shared/ui/src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      colors: {
        'abak-blue': {
          DEFAULT: '#236382',
          50: '#E8F2F6',
          100: '#D1E5ED',
          200: '#A3CBD9',
          300: '#75B1C6',
          400: '#4997B3',
          500: '#236382',
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
          500: '#A78B42',
          600: '#866F35',
          700: '#645328',
          800: '#43371A',
          900: '#211C0D',
        },
        'dark-text': '#1B1B1B',
        'off-white': '#F9F7F5',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: '#A78B42',
        warning: '#D97706',
        error: '#DC2626',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: [
          'var(--font-cairo)',
          'var(--font-inter)',
          'Cairo',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        arabic: ['var(--font-cairo)', 'Cairo', 'system-ui', 'sans-serif'],
        latin: [
          'var(--font-inter)',
          'var(--font-cairo)',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
