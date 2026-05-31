import type { CSSProperties } from "react";

export function getMarketingCardHoverStyle(accentRgb: string): CSSProperties {
  return {
    ["--marketing-card-accent" as string]: accentRgb,
  };
}

export const marketingCardInteractiveClass =
  "group relative overflow-hidden transition-[transform,background-color,border-color,box-shadow] duration-[250ms] ease-out hover:border-[rgba(var(--marketing-card-accent),0.18)] hover:shadow-[0_12px_40px_rgba(var(--marketing-card-accent),0.12),0_0_0_1px_rgba(var(--marketing-card-accent),0.08)] dark:hover:border-[rgba(var(--marketing-card-accent),0.16)] dark:hover:shadow-[0_20px_60px_rgba(var(--marketing-card-accent),0.18),0_0_0_1px_rgba(var(--marketing-card-accent),0.1)]";

export const marketingCardHoverLiftClass = "hover:-translate-y-1.5 hover:scale-[1.01]";
export const marketingCardHoverLiftSubtleClass = "hover:-translate-y-1 hover:scale-[1.01]";

export const marketingCardTintOverlayClass =
  "pointer-events-none absolute inset-0 rounded-[inherit] bg-[rgba(var(--marketing-card-accent),0.05)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:bg-[rgba(var(--marketing-card-accent),0.1)]";

export const marketingCardSheenOverlayClass =
  "pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06)_0%,transparent_72%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100";

export const marketingCardIconMotionClass =
  "transition-all duration-300 group-hover:animate-[float_1.2s_ease-in-out_infinite] group-hover:shadow-[0_10px_30px_rgba(var(--marketing-card-accent),0.28)] dark:group-hover:shadow-[0_12px_36px_rgba(var(--marketing-card-accent),0.35)]";

export const marketingCardPulseClass =
  "opacity-0 transition-[opacity,transform] duration-300 group-hover:opacity-100 dark:group-hover:animate-[pulse-glow_1.6s_ease-in-out_infinite]";

export const marketingCardTitleClass = "text-balance leading-tight";
export const marketingCardCopyClass = "text-balance leading-relaxed";
