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
