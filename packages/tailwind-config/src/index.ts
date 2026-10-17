import type { Config } from 'tailwindcss';

/**
 * Shared brand tokens for HoppDrive's Tailwind apps (web, admin).
 * Values sourced from "HoppDrive Brand Identity Handbook.md".
 * Consuming apps add this as a `preset` and keep their own `content` globs.
 */
const preset: Pick<Config, 'theme' | 'plugins'> = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Fira Sans', 'Open Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fdf2f2',
          100: '#fce4e4',
          200: '#f9cccc',
          300: '#f4a3a3',
          400: '#e05a5a',
          500: '#c72020',
          600: '#A60E0E', // Brand Ruby Red – primary
          700: '#8a0b0b',
          800: '#730909',
          900: '#5f0808',
          950: '#370404',
        },
        charcoal: '#3E4144', // Deep Charcoal – body text, nav, icons
        graphite: '#666666', // Soft Graphite – sub-headings, taglines
        'gray-mid': '#A0A0A0', // Cool Gray (Mid) – dividers, borders
        'gray-soft': '#CCCCCC', // Soft Cool Gray – hover states, secondary bg
        surface: '#F2F2F2', // Background Neutral
      },
      // Shared motion tokens — single source for compound animations that
      // previously hand-typed several near-identical durations/curves
      // (e.g. the admin sidebar collapse: 400ms/300ms/200ms across 3 elements).
      transitionTimingFunction: {
        'collapse': 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
    },
  },
  plugins: [],
};

export = preset;
