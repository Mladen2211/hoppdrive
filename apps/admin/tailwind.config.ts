import type { Config } from 'tailwindcss';

// Loaded via plain `require` (not `import`) — the config-loading pipeline for
// tailwind.config.ts doesn't reliably apply ES default-export interop, so a
// literal CommonJS `export =` + `require()` avoids that ambiguity entirely.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hoppdrivePreset: Partial<Config> = require('@hoppdrive/tailwind-config');

const config: Config = {
  presets: [hoppdrivePreset],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  plugins: [],
};

export default config;
