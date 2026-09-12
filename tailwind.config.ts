import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
  ],

  theme: {
    extend: {
      /* =====================================================
         FONT FAMILY
      ====================================================== */

      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Arial",
          "sans-serif",
        ],

        inter: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],

        jakarta: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],

        dm: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },

      /* =====================================================
         TYPOGRAPHY
         Slightly more readable than previous setup
      ====================================================== */

      fontSize: {
        micro: [
          "9px",
          {
            lineHeight: "1.25",
            letterSpacing: "0.01em",
          },
        ],

        tiny: [
          "10px",
          {
            lineHeight: "1.3",
          },
        ],

        xs: [
          "11px",
          {
            lineHeight: "1.4",
          },
        ],

        sm: [
          "12px",
          {
            lineHeight: "1.45",
          },
        ],

        base: [
          "14px",
          {
            lineHeight: "1.55",
          },
        ],

        md: [
          "15px",
          {
            lineHeight: "1.5",
          },
        ],

        lg: [
          "16px",
          {
            lineHeight: "1.45",
          },
        ],

        xl: [
          "18px",
          {
            lineHeight: "1.35",
          },
        ],

        "2xl": [
          "21px",
          {
            lineHeight: "1.25",
            letterSpacing: "-0.02em",
          },
        ],

        "3xl": [
          "25px",
          {
            lineHeight: "1.18",
            letterSpacing: "-0.025em",
          },
        ],

        "4xl": [
          "30px",
          {
            lineHeight: "1.12",
            letterSpacing: "-0.03em",
          },
        ],

        "5xl": [
          "36px",
          {
            lineHeight: "1.05",
            letterSpacing: "-0.04em",
          },
        ],
      },

      /* =====================================================
         FONT WEIGHTS
      ====================================================== */

      fontWeight: {
        light: "300",
        regular: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
        extrabold: "800",
        black: "900",
      },

      /* =====================================================
         BRAND COLORS
      ====================================================== */

      colors: {
        brand: {
          primary:
            "rgb(var(--brand-primary-rgb) / <alpha-value>)",

          hover:
            "rgb(var(--brand-hover-rgb) / <alpha-value>)",

          dark:
            "rgb(var(--brand-dark-rgb) / <alpha-value>)",

          background:
            "rgb(var(--brand-background-rgb) / <alpha-value>)",

          surface: "#FFFFFF",

          secondary:
            "rgb(var(--brand-secondary-rgb) / <alpha-value>)",

          soft:
            "rgb(var(--brand-soft-rgb) / <alpha-value>)",

          link: "#49651A",

          green: "#123D27",

          muted: "#6E756C",

          line: "#E7E9E2",
        },

        primaryBlue: "#49651A",

        primaryYellow:
          "rgb(var(--brand-primary-rgb) / <alpha-value>)",

        darkBlue: "#111111",

        lightGray:
          "rgb(var(--brand-background-rgb) / <alpha-value>)",

        darkText:
          "rgb(var(--brand-dark-rgb) / <alpha-value>)",

        borderGray: "#E7E9E2",

        footerDark:
          "rgb(var(--brand-dark-rgb) / <alpha-value>)",
      },

      /* =====================================================
         SHADOWS
      ====================================================== */

      boxShadow: {
        xs:
          "0 2px 8px rgba(17,17,17,0.035)",

        brand:
          "0 12px 36px rgba(17,17,17,0.12)",

        card:
          "0 6px 20px rgba(17,17,17,0.055)",

        cardHover:
          "0 16px 34px rgba(17,17,17,0.105)",

        lime:
          "0 8px 24px rgba(183,227,58,0.20)",

        panel:
          "0 10px 30px rgba(17,17,17,0.055)",
      },

      /* =====================================================
         RADIUS
      ====================================================== */

      borderRadius: {
        card: "16px",

        panel: "22px",

        button: "12px",

        soft: "14px",
      },

      /* =====================================================
         SPACING
      ====================================================== */

      spacing: {
        "4.5": "1.125rem",

        "5.5": "1.375rem",

        "7.5": "1.875rem",

        "18": "4.5rem",
      },

      /* =====================================================
         TRANSITIONS
      ====================================================== */

      transitionDuration: {
        250: "250ms",
      },
    },
  },

  plugins: [],
};

export default config;