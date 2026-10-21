import type { Config, PluginAPI } from 'tailwindcss/types/config';

/**
 * Shared brand tokens for HoppDrive's Tailwind apps (web, admin).
 * Values sourced from "HoppDrive Brand Identity Handbook.md" and the
 * design export in docs/design (b2c.css / admin.css).
 * Consuming apps add this as a `preset` and keep their own `content` globs.
 *
 * NOTE: the apps `require()` the compiled `dist/`, so run
 * `npm run build -w @hoppdrive/tailwind-config` after editing this file.
 *
 * THEMING: every colour token below is a CSS variable holding space-separated
 * RGB channels (`--c-ink: 62 65 68`), consumed as `rgb(var(--c-ink) / <alpha-value>)`
 * so opacity modifiers (`bg-ink/50`) keep working. The LIGHT values are declared
 * once, in `LIGHT`, and emitted on `:root` (and on `[data-theme="light"]`, so a
 * subtree can force the light palette, e.g. the admin's website preview) by the
 * plugin at the bottom. The website therefore renders exactly the colours it
 * always had. The admin overrides the variables under `[data-theme="dark"]`
 * (apps/admin/src/app/globals.css).
 */

/** Light palette: single source of truth for every colour token (hex). */
const LIGHT = {
  // ── Existing brand neutrals (do not rename) ───────────────────
  charcoal: '#3E4144', // Deep Charcoal – body text, nav, icons
  graphite: '#5F6265', // Graphite – secondary text (6.1:1 on white)
  'gray-mid': '#A0A0A0', // Cool Gray (Mid) – dividers, borders
  'gray-soft': '#CCCCCC', // Soft Cool Gray – hover states, secondary bg
  surface: '#F2F2F2', // Background Neutral

  // ── Design-system tokens (docs/design) ────────────────────────
  ruby: '#A60E0E', // primary action FILL (white text on it), prices
  'ruby-dark': '#850B0B', // hover, text on ruby-tint
  'ruby-tint': '#FBEBEB', // active nav item, price pill background
  'ruby-fg': '#A60E0E', // ruby used as TEXT / icon colour on card & paper
  'ruby-hover': '#850B0B', // hover fill of a ruby button
  ink: '#3E4144', // text, borders (same as charcoal)
  'ink-dark': '#2C2E30', // heavy text
  'on-ink': '#FFFFFF', // text on an `ink` fill (chips, avatars)
  inverse: '#2C2E30', // toast / tooltip background
  'on-inverse': '#FFFFFF', // text on `inverse`
  'on-fill': '#FFFFFF', // text on a status fill (ok / err / warn / info / vio)
  scrim: '#2C2E30', // modal & drawer backdrop (used with /[.62])
  cool: '#A0A0A0', // decorative only
  dim: '#6E7174', // placeholder, disabled text
  line: '#DADADA', // borders
  'line-soft': '#EBEBEB', // row separators, disabled fill
  paper: '#F2F2F2', // page background
  card: '#FFFFFF', // cards, panels, inputs, drawers
  row: '#FAFAFA', // table head / zebra
  field: '#8E9194', // input border (3.2:1 on white)
  focus: '#1B5FD1', // focus ring only (3 px, 2 px offset)

  // Admin-only surfaces and accents (not used by the website).
  tile: '#E9E9E9', // photo placeholder tile (stays light in both themes)
  canvas: '#FCFCFC', // document-like surface: signature canvas (stays light in both themes)
  weekend: '#EFEFEF', // weekend column in the calendar
  'edge-ok': '#9CCDB4', // borders next to the status fills
  'edge-info': '#A9C2EC',
  'edge-warn': '#C9962E',
  'edge-warn-soft': '#E3C98F',
  'edge-gray': '#C5C5C5',
  'edge-err': '#E3B1AD', // outline of destructive buttons
  map: '#E4E6E7', // location map placeholder
  'map-road': '#D3D6D8',
  star: '#9A5B00', // rating stars
  'star-off': '#C9CBCD',
  'chart-prev': '#C4C7C9', // previous-year bars
  'stripe-a': '#ECECEC', // hatching of finished calendar bars
  'stripe-b': '#DEDEDE',
  'toast-ok': '#7FD1A6', // icons on the toast (the toast surface is dark in both themes)
  'toast-err': '#FFB4AB',
  'toast-info': '#A9C5F5',

  // Status colours: DEFAULT = text/dot colour, tint = fill, ink = text on tint.
  ok: '#1B6E46',
  'ok-tint': '#E3F2EA',
  'ok-ink': '#124D31',
  warn: '#7A4A00', // admin amber text (6.7:1 on tint)
  'warn-b2c': '#8A5200', // B2C hint text (5.7:1 on tint)
  'warn-tint': '#FFF1D6',
  'warn-ink': '#5E3700',
  err: '#B3261E',
  'err-tint': '#FCE9E7',
  'err-ink': '#7D1913', // text on tint (alerts)
  'err-strong': '#8F1C15', // status pill text / destructive hover
  info: '#174C9E',
  'info-tint': '#E5EEFB',
  'info-ink': '#123F8C',
  'info-ring': '#1B5FD1',
  vio: '#5B3B9E',
  'vio-tint': '#EEE8F8',
  // Neutral pill ("Erledigt", "Archiviert", "Offline")
  'mute-tint': '#E6E6E6',
  'mute-ink': '#4F5254',
} as const;

type Token = keyof typeof LIGHT;

/** '#A60E0E' -> '166 14 14' (space-separated channels for `rgb(var(--x) / a)`). */
function channels(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Tailwind colour value reading the token's CSS variable, alpha-aware. */
function token(name: Token): string {
  return `rgb(var(--c-${name}) / <alpha-value>)`;
}

const lightVariables: Record<string, string> = {};
for (const name of Object.keys(LIGHT) as Token[]) {
  lightVariables[`--c-${name}`] = channels(LIGHT[name]);
}

const preset: Pick<Config, 'theme' | 'plugins' | 'darkMode'> = {
  // Dark palette = `[data-theme="dark"]` on <html> (set before paint by the admin).
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        // `--font-sans` / `--font-cond` are set by next/font in each root layout.
        sans: ['var(--font-sans)', 'Fira Sans', 'system-ui', 'sans-serif'],
        // Numbers and prices are always set in Fira Sans Condensed.
        cond: [
          'var(--font-cond)',
          'Fira Sans Condensed',
          'Fira Sans',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        // ── Existing brand scale (do not rename; static, not themed) ─
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
        charcoal: token('charcoal'),
        graphite: token('graphite'),
        'gray-mid': token('gray-mid'),
        'gray-soft': token('gray-soft'),
        surface: token('surface'),

        // ── Design-system tokens (docs/design) ──────────────────────
        ruby: {
          DEFAULT: token('ruby'),
          dark: token('ruby-dark'),
          tint: token('ruby-tint'),
          fg: token('ruby-fg'),
          hover: token('ruby-hover'),
        },
        ink: {
          DEFAULT: token('ink'),
          dark: token('ink-dark'),
        },
        'on-ink': token('on-ink'),
        inverse: token('inverse'),
        'on-inverse': token('on-inverse'),
        'on-fill': token('on-fill'),
        scrim: token('scrim'),
        cool: token('cool'),
        dim: token('dim'),
        line: {
          DEFAULT: token('line'),
          soft: token('line-soft'),
        },
        paper: token('paper'),
        card: token('card'),
        row: token('row'),
        field: token('field'),
        focus: token('focus'),

        tile: token('tile'),
        canvas: token('canvas'),
        weekend: token('weekend'),
        edge: {
          ok: token('edge-ok'),
          info: token('edge-info'),
          warn: token('edge-warn'),
          'warn-soft': token('edge-warn-soft'),
          gray: token('edge-gray'),
          err: token('edge-err'),
        },
        map: { DEFAULT: token('map'), road: token('map-road') },
        star: { DEFAULT: token('star'), off: token('star-off') },
        'chart-prev': token('chart-prev'),
        stripe: { a: token('stripe-a'), b: token('stripe-b') },
        toast: { ok: token('toast-ok'), err: token('toast-err'), info: token('toast-info') },

        ok: {
          DEFAULT: token('ok'),
          tint: token('ok-tint'),
          ink: token('ok-ink'),
        },
        warn: {
          DEFAULT: token('warn'),
          b2c: token('warn-b2c'),
          tint: token('warn-tint'),
          ink: token('warn-ink'),
        },
        err: {
          DEFAULT: token('err'),
          tint: token('err-tint'),
          ink: token('err-ink'),
          strong: token('err-strong'),
        },
        info: {
          DEFAULT: token('info'),
          tint: token('info-tint'),
          ink: token('info-ink'),
          ring: token('info-ring'),
        },
        vio: { DEFAULT: token('vio'), tint: token('vio-tint') },
        mute: { tint: token('mute-tint'), ink: token('mute-ink') },
      },
      borderRadius: {
        // Tailwind already has lg=8, xl=12, 2xl=16, 3xl=24.
        '10': '10px', // buttons, fields
        '14': '14px', // tiles, mobile cards
        '18': '18px', // dialogs, vehicle cards
        '20': '20px', // large cards, quick bar
        '28': '28px', // hero stage
      },
      boxShadow: {
        qbar: '0 18px 50px rgba(44,46,48,.16)',
        modal: '0 24px 60px rgba(44,46,48,.3)',
        toast: '0 12px 30px rgba(0,0,0,.25)',
        tab: '0 1px 3px rgba(0,0,0,.12)',
        sheet: '0 -10px 30px rgba(0,0,0,.12)',
      },
      spacing: {
        // 52 px field height (h-13); Tailwind has 11 = 44 and 12 = 48.
        '13': '3.25rem',
      },
      screens: {
        // Ultra-wide breakpoint from the boards (container 1680 px / third column).
        '3xl': '1600px',
      },
      keyframes: {
        shimmer: {
          to: { backgroundPosition: '-200% 0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(24px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        pop: {
          from: { opacity: '0', transform: 'scale(.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      // Motion only answers input (open, load). globals.css switches all of
      // these off under `prefers-reduced-motion` (spin stays: it signals loading).
      animation: {
        shimmer: 'shimmer 1.4s linear infinite',
        'fade-in': 'fade-in .16s ease-out both',
        'slide-up': 'slide-up .22s cubic-bezier(.25,1,.5,1) both',
        'sheet-up': 'sheet-up .28s cubic-bezier(.25,1,.5,1) both',
        'slide-in-right': 'slide-in-right .24s cubic-bezier(.25,1,.5,1) both',
        pop: 'pop .18s cubic-bezier(.25,1,.5,1) both',
      },
      // Shared motion tokens — single source for compound animations that
      // previously hand-typed several near-identical durations/curves
      // (e.g. the admin sidebar collapse: 400ms/300ms/200ms across 3 elements).
      transitionTimingFunction: {
        'collapse': 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
    },
  },
  plugins: [
    // Emits the light palette as CSS variables. `[data-theme="light"]` lets a
    // subtree opt back into light inside a dark page.
    ({ addBase }: PluginAPI) => {
      addBase({
        ':root, [data-theme="light"]': lightVariables,
      });
    },
  ],
};

export = preset;
