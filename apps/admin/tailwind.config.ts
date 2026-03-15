import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
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
          600: '#A60E0E',
          700: '#8a0b0b',
          800: '#730909',
          900: '#5f0808',
          950: '#370404',
        },
        charcoal: '#3E4144',
        graphite: '#666666',
        'gray-mid': '#A0A0A0',
        'gray-soft': '#CCCCCC',
        surface: '#F2F2F2',
      },
    },
  },
  plugins: [],
};

export default config;
