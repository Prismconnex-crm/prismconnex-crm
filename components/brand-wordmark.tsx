import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

/**
 * "Prismconnex" with the logo's emblem standing in for the second "o", the way
 * the wordmark is drawn in the brand artwork.
 *
 * The emblem is BrandLogo, so it inherits the same per-theme treatment as every
 * other placement — brand blue on light, one step lighter on dark — and needs
 * no separate light/dark asset here.
 *
 * Sized in `em` rather than pixels so the substitution tracks whatever
 * font-size the surrounding text uses: the sidebar renders this at 14px and the
 * public navbar at 15px from the same component.
 *
 * Accessibility: the visible characters are split around the image, which a
 * screen reader would otherwise announce as "Prismc nnex". The split text is
 * hidden and the whole word is exposed once, via sr-only.
 */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline whitespace-nowrap", className)}>
      <span className="sr-only">Prismconnex</span>
      <span aria-hidden="true" className="inline-flex items-baseline">
        Prismc
        {/*
          0.58em ≈ the x-height of the surrounding type, plus the optical
          overshoot a round glyph needs to look the same size as a square one.
          The nudge down sits it on the baseline rather than the text box.
        */}
        <span
          className="relative inline-block shrink-0"
          style={{ width: "0.58em", height: "0.58em", transform: "translateY(0.04em)" }}
        >
          <BrandLogo fill sizes="16px" className="object-contain" />
        </span>
        nnex
      </span>
    </span>
  );
}
