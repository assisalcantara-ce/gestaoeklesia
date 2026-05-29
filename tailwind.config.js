/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-blue': '#123b63',
        'medium-blue': '#4A6FA5',
        'light-blue': '#0284c7',
        // Dashboard 2.0 palette
        'blue-inst': '#1E3A5F',
        'blue-sec': '#2563EB',
        'golden': '#D4A017',
        'turquoise': '#0D9488',
        'bg-dark': '#0F172A',
        'bg-card': '#1E293B',
        'bg-card-hover': '#253047',
      },
      spacing: {
        'container': '24px',
        'section': '16px',
      },
      borderRadius: {
        'card': '16px',
      },
    },
  },
  plugins: [],
};
