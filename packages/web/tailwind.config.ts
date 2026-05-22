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
        // Brand navy ramp. DEFAULT is the deep authority navy #0B1F33.
        // Class name kept (`abak-blue`) — it now literally is blue again, and
        // the 155 existing occurrences re-resolve to navy automatically.
        'abak-blue': {
          DEFAULT: '#0B1F33',
          50: '#EAF0F7',
          100: '#C7D5E5',
          200: '#9CB3CC',
          300: '#6F8DAE',
          400: '#3D6590',
          500: '#0B1F33',
          600: '#091929',
          700: '#07131F',
          800: '#040D15',
          900: '#02060B',
        },
        // Brand copper ramp — burnt-sienna accent replacing the former gold.
        // Reserved for VIP / featured / brand-emphasis. NOT success.
        'abak-gold': {
          DEFAULT: '#B45C2C',
          50: '#FBEEE5',
          100: '#F6DCC8',
          200: '#EDBA92',
          300: '#E0985C',
          400: '#CC7B3F',
          500: '#B45C2C',
          600: '#904A23',
          700: '#6C381A',
          800: '#482512',
          900: '#241309',
        },
        // Surface tokens (pre-existing aliases kept for callers).
        'dark-text': 'hsl(var(--foreground))',
        'off-white': 'hsl(var(--background))',

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
        // Semantic tokens — gold is no longer success.
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        error: 'hsl(var(--destructive))',
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
        // Editorial display tier: Noto Naskh in Arabic, Cormorant in Latin.
        // The :root selector in globals.css picks the right one by [dir].
        display: [
          'var(--font-display)',
          'var(--font-naskh)',
          'Cormorant Garamond',
          'Noto Naskh Arabic',
          'Georgia',
          'serif',
        ],
        naskh: [
          'var(--font-naskh)',
          'Noto Naskh Arabic',
          'Cairo',
          'system-ui',
          'serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
      // Type scale — display / heading / body / caption.
      // Pair `font-display` with display sizes for editorial heroes.
      fontSize: {
        'display-lg': [
          '2.5rem',
          { lineHeight: '3rem', letterSpacing: '-0.02em', fontWeight: '600' },
        ],
        'display-md': [
          '2rem',
          {
            lineHeight: '2.5rem',
            letterSpacing: '-0.015em',
            fontWeight: '600',
          },
        ],
        'heading-lg': [
          '1.5rem',
          { lineHeight: '2rem', letterSpacing: '-0.01em', fontWeight: '600' },
        ],
        'heading-md': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'heading-sm': ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        body: ['0.875rem', { lineHeight: '1.375rem' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.25rem' }],
        caption: [
          '0.75rem',
          { lineHeight: '1.125rem', letterSpacing: '0.02em' },
        ],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        // Sand-on-cream surface hierarchy means most cards need NO shadow.
        // These are reserved for genuinely-elevated surfaces (popovers, modals, sheets).
        // Shadow tint is rgba(navy) for cool elevation against warm surfaces.
        sm: '0 1px 2px 0 rgba(11, 31, 51, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(11, 31, 51, 0.09)',
        md: '0 4px 12px -2px rgba(11, 31, 51, 0.11)',
        lg: '0 12px 24px -6px rgba(11, 31, 51, 0.13)',
        xl: '0 24px 40px -12px rgba(11, 31, 51, 0.15)',
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
  plugins: [require('tailwindcss-animate'), require('tailwindcss-rtl')],
};

export default config;
