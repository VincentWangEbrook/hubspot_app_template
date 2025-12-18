/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Token 颜色
        primary: {
          50: "var(--color-primary-50)",
          200: "var(--color-primary-200)",
          500: "var(--color-primary-500)",
          600: "var(--color-primary-600)",
          700: "var(--color-primary-700)",
        },
        gray: {
          50: "var(--color-gray-50)",
          100: "var(--color-gray-100)",
          300: "var(--color-gray-300)",
          500: "var(--color-gray-500)",
          700: "var(--color-gray-700)",
          900: "var(--color-gray-900)",
        },
        red: {
          500: "var(--color-red-500)",
        },
        green: {
          50: "var(--color-green-50)",
          500: "var(--color-green-500)",
          700: "var(--color-green-700)",
          800: "var(--color-green-800)",
          100: "var(--color-green-100)",
        },
        yellow: {
          500: "var(--color-yellow-500)",
        },
        orange: {
          500: "var(--color-orange-500)",
        },
        blue: {
          600: "var(--color-blue-600)",
          700: "var(--color-blue-700)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
  darkMode: "class", // 支持暗模式
};
