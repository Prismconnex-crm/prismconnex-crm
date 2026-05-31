import { describe, expect, it } from "vitest";
import tailwindConfig from "../../tailwind.config";
import {
  marketingCardHoverLiftClass,
  marketingCardHoverLiftSubtleClass,
  marketingCardIconMotionClass,
  marketingCardInteractiveClass,
  marketingCardSheenOverlayClass,
  marketingCardTintOverlayClass,
} from "../../components/landing/marketing-card-hover";

describe("marketing hover safety", () => {
  it("keeps the shared card wrapper group/relative contract intact", () => {
    expect(marketingCardInteractiveClass).toContain("group");
    expect(marketingCardInteractiveClass).toContain("relative");
    expect(marketingCardInteractiveClass).toContain("overflow-hidden");
    expect(marketingCardInteractiveClass).toContain("hover:border-[rgba(var(--marketing-card-accent),0.18)]");
    expect(marketingCardInteractiveClass).toContain("dark:hover:shadow-[0_20px_60px_rgba(var(--marketing-card-accent),0.18),0_0_0_1px_rgba(var(--marketing-card-accent),0.1)]");
  });

  it("keeps icon and overlay hover motion static", () => {
    expect(marketingCardIconMotionClass).toContain("group-hover:animate-[float_1.2s_ease-in-out_infinite]");
    expect(marketingCardTintOverlayClass).toContain("group-hover:opacity-100");
    expect(marketingCardSheenOverlayClass).toContain("group-hover:opacity-100");
    expect(marketingCardHoverLiftClass).toContain("hover:-translate-y-1.5");
    expect(marketingCardHoverLiftSubtleClass).toContain("hover:-translate-y-1");
  });

  it("safelists hover, pseudo-element, and glow utilities used by localized marketing cards", () => {
    const safelist = Array.isArray(tailwindConfig.safelist) ? tailwindConfig.safelist : [];

    expect(safelist).toEqual(
      expect.arrayContaining([
        "group",
        "relative",
        "overflow-hidden",
        "hover:-translate-y-1.5",
        "hover:-translate-y-1",
        "hover:scale-[1.01]",
        "group-hover:rotate-[3deg]",
        "before:content-['']",
        "after:content-['']",
        "before:transition-opacity",
        "after:transition-opacity",
        "group-hover:before:opacity-100",
        "group-hover:after:opacity-100",
        "group-hover:shadow-[0_10px_30px_rgba(var(--marketing-card-accent),0.28)]",
        "dark:group-hover:shadow-[0_12px_36px_rgba(var(--marketing-card-accent),0.35)]",
      ])
    );
  });
});
