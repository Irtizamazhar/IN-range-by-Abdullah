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
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        inter: ["Inter", "sans-serif"],
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
      fontSize: {
        tiny: ["10px", { lineHeight: "1.2" }],
        xs: ["12px", { lineHeight: "1.35" }],
        sm: ["13px", { lineHeight: "1.5" }],
        base: ["14px", { lineHeight: "1.5" }],
        md: ["15px", { lineHeight: "1.5" }],
        lg: ["16px", { lineHeight: "1.5" }],
        xl: ["18px", { lineHeight: "1.35" }],
        "2xl": ["20px", { lineHeight: "1.35" }],
        "3xl": ["24px", { lineHeight: "1.2" }],
        "4xl": ["28px", { lineHeight: "1.2" }],
        "5xl": ["32px", { lineHeight: "1.1" }],
      },
      fontWeight: {
        light: "300",
        regular: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
        extrabold: "800",
        black: "900",
      },
      colors: {
        primaryBlue: "#29ABE2",
        /** Brand accent (amber); matches `globals.css` `--brand-accent` */
        primaryYellow: "#F59E0B",
        darkBlue: "#1A7FA8",
        lightGray: "#F8F9FA",
        darkText: "#1A1A1A",
        borderGray: "#E5E7EB",
        footerDark: "#1A1A1A",
      },
      boxShadow: {
        card: "0 4px 14px rgba(0,0,0,0.06)",
        cardHover: "0 8px 24px rgba(41,171,226,0.15)",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};
export default config;
