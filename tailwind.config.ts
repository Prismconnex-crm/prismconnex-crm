import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "group",
    "relative",
    "overflow-hidden",
    "hover:bg-[rgba(var(--marketing-card-accent),0.05)]",
    "dark:hover:bg-[rgba(var(--marketing-card-accent),0.1)]",
    "hover:border-[rgba(var(--marketing-card-accent),0.18)]",
    "dark:hover:border-[rgba(var(--marketing-card-accent),0.16)]",
    "hover:-translate-y-1.5",
    "hover:-translate-y-1",
    "hover:scale-[1.01]",
    "hover:shadow-[0_12px_40px_rgba(var(--marketing-card-accent),0.12),0_0_0_1px_rgba(var(--marketing-card-accent),0.08)]",
    "dark:hover:shadow-[0_20px_60px_rgba(var(--marketing-card-accent),0.18),0_0_0_1px_rgba(var(--marketing-card-accent),0.1)]",
    "group-hover:bg-[rgba(var(--marketing-card-accent),0.05)]",
    "dark:group-hover:bg-[rgba(var(--marketing-card-accent),0.1)]",
    "group-hover:rotate-[3deg]",
    "group-hover:w-20",
    "group-hover:w-24",
    "group-hover:bg-[rgba(var(--accent),0.12)]",
    "group-hover:shadow-[0_10px_30px_rgba(var(--marketing-card-accent),0.28)]",
    "dark:group-hover:shadow-[0_12px_36px_rgba(var(--marketing-card-accent),0.35)]",
    "group-hover:shadow-[0_0_0_1px_rgba(var(--accent),0.35),0_20px_60px_rgba(var(--accent),0.18)]",
    "group-hover:shadow-[0_8px_18px_rgba(var(--marketing-card-accent),0.22)]",
    "dark:group-hover:shadow-[0_10px_24px_rgba(var(--marketing-card-accent),0.28)]",
    "group-hover:animate-[float_1.2s_ease-in-out_infinite]",
    "dark:group-hover:animate-[pulse-glow_1.6s_ease-in-out_infinite]",
    "group-hover:animate-[float_1.2s_ease-in-out_infinite]",
    "group-hover:animate-[pulse-glow_1.6s_ease-in-out_infinite]",
    "group-hover:opacity-100",
    "rounded-[inherit]",
    "before:content-['']",
    "after:content-['']",
    "before:absolute",
    "after:absolute",
    "before:inset-0",
    "after:inset-0",
    "before:rounded-[inherit]",
    "after:rounded-[inherit]",
    "before:bg-gradient-to-r",
    "after:bg-gradient-to-b",
    "before:bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06)_0%,transparent_72%)]",
    "before:opacity-0",
    "after:opacity-0",
    "before:transition-opacity",
    "after:transition-opacity",
    "before:duration-300",
    "after:duration-300",
    "group-hover:before:opacity-100",
    "group-hover:after:opacity-100",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      colors: {
        background: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        elevated: "rgb(var(--card) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        foreground: "rgb(var(--text) / <alpha-value>)",
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted) / <alpha-value>)",
        },
        accent: "rgb(var(--accent) / <alpha-value>)",
        // Primary brand colour (#2563EB), defined once in app/globals.css.
        // `bg-brand`, `text-brand`, `ring-brand`, `shadow-brand/20` etc. all
        // resolve through it, and the `/<alpha-value>` form keeps Tailwind's
        // opacity modifiers working.
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          hover: "rgb(var(--brand-hover) / <alpha-value>)",
        },
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
      },
      borderRadius: {
        xl: "var(--radius)",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(6, 14, 26, 0.15)",
        glow: "0 0 0 1px rgba(99, 102, 241, 0.2), 0 6px 18px rgba(79, 70, 229, 0.35)",
        "glow-sm": "0 0 0 1px rgba(99, 102, 241, 0.15), 0 2px 8px rgba(79, 70, 229, 0.2)",
        "glow-lg": "0 0 0 1px rgba(99, 102, 241, 0.3), 0 8px 32px rgba(79, 70, 229, 0.4)",
        "card-hover": "0 20px 50px rgba(6, 14, 26, 0.2), 0 0 0 1px rgba(99, 102, 241, 0.1)",
      },
      keyframes: {
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        shimmer: {
          from: { backgroundPosition: "200% 0" },
          to: { backgroundPosition: "-200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(16px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        // Entrance for a viewport-centred dialog. The -50%/-50% translate has
        // to be repeated in both keyframes because an animation's `transform`
        // REPLACES the element's own: running plain `scale-in` on a
        // `-translate-x-1/2 -translate-y-1/2` panel silently drops the
        // centring and (with `forwards`) parks its top-left corner at the
        // middle of the screen, so the panel hangs off towards the bottom.
        "dialog-in": {
          from: { opacity: "0", transform: "translate(-50%, -50%) scale(0.95)" },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.5s ease-out forwards",
        "fade-in": "fade-in 0.3s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 8s linear infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.4s ease-out forwards",
        "scale-in": "scale-in 0.3s ease-out forwards",
        "dialog-in": "dialog-in 0.3s ease-out forwards",
      },
    },
  },
  plugins: [],
};
export default config;
