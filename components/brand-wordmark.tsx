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
          0.82em — deliberately taller than the x-height it replaces. Matching
          the "o" exactly (0.58em) made the mark disappear into the word at a
          glance; the artwork draws it above cap height for the same reason, so
          the emblem reads as the logo rather than as a slightly odd letter.
          The nudge down sits it on the baseline rather than the text box, and
          the side margins stop a round glyph crowding the flat-sided c and n.
        */}
        <span
          className="relative inline-block shrink-0"
          style={{
            width: "0.82em",
            height: "0.82em",
            marginInline: "0.04em",
            transform: "translateY(0.12em)",
          }}
        >
          <BrandLogo fill sizes="24px" className="object-contain" />
        </span>
        nnex
      </span>
    </span>
  );
}
