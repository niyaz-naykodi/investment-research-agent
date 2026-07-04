import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EDE6D6",
        "paper-dark": "#E2D9C4",
        ledger: "#0B3D2E",
        "ledger-light": "#154D3B",
        ink: "#1C1B18",
        "ink-soft": "#3A382F",
        gold: "#B08D57",
        rust: "#A13D2C",
        moss: "#2F6F4E",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
        body: ["var(--font-body)"],
      },
      backgroundImage: {
        grain: "url('/grain.svg')",
      },
    },
  },
  plugins: [],
};
export default config;
