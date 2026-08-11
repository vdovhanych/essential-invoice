import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter Variable', ...defaultTheme.fontFamily.sans],
      },
      // "Calm Indigo" design tokens. Values live as CSS custom properties in
      // index.css; the dark skin is a variable swap on `.dark` — never add
      // separate dark: layout variants for these colors.
      colors: {
        canvas: 'var(--canvas)',
        surface: {
          DEFAULT: 'var(--surface)',
          sunken: 'var(--surface-sunken)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        hairline: {
          DEFAULT: 'var(--hairline)',
          soft: 'var(--hairline-soft)',
        },
        text: {
          DEFAULT: 'var(--text)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          faint: 'var(--text-faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
          tint: 'var(--accent-tint)',
          quiet: 'var(--accent-quiet)',
          link: 'var(--accent-link)',
        },
        success: {
          DEFAULT: 'var(--success)',
          bg: 'var(--success-bg)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          bg: 'var(--danger-bg)',
        },
        'neutral-chip': {
          bg: 'var(--neutral-chip-bg)',
          fg: 'var(--neutral-chip-fg)',
        },
        'chart-secondary': 'var(--chart-secondary)',
        'row-hover': 'var(--row-hover)',
        'nav-hover': 'var(--nav-hover)',
      },
    },
  },
  plugins: [],
}
