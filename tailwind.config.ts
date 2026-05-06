import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"]
      },
      colors: {
        // Bordeaux Maya Couture — calibré sur #691524 (couleur du logo).
        brand: {
          50: "#fcf3f5",
          100: "#f7e0e4",
          200: "#ecbfc7",
          300: "#db95a3",
          400: "#c4677a",
          500: "#a93f51",
          600: "#8a2737",
          700: "#691524",
          800: "#56112a",
          900: "#470f25",
          950: "#280811"
        },
        gold: {
          50: "#fbf6ec",
          100: "#f5ead0",
          200: "#ecd5a3",
          300: "#dfba6e",
          400: "#caa05a",
          500: "#b48a47",
          600: "#977137",
          700: "#785a2e",
          800: "#5e4626",
          900: "#4b381f"
        }
      },
      boxShadow: {
        soft: "0 1px 2px rgba(35, 12, 18, 0.05), 0 4px 16px rgba(35, 12, 18, 0.07)",
        glow: "0 0 0 1px rgba(105, 21, 36, 0.18), 0 12px 32px rgba(105, 21, 36, 0.16)"
      },
      backgroundImage: {
        "brand-radial":
          "radial-gradient(ellipse at top left, rgba(105, 21, 36, 0.08), transparent 60%), radial-gradient(ellipse at bottom right, rgba(180, 138, 71, 0.08), transparent 55%)"
      }
    }
  },
  plugins: []
};

export default config;
