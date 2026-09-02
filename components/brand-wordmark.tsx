import { BrandMark } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

/**
 * "Prismconnex" with the logo's emblem standing in for the second "o", the way
 * the wordmark is drawn in the brand artwork.
 *
 * The emblem is BrandMark, so it inherits the same per-theme treatment as every
 * other placement — brand blue on light, one step lighter on dark — and needs
 * no separate light/dark asset here.
 *
 * This used to render BrandLogo, the full stacked lockup. `object-contain` fit
 * that 800x705 artwork into the square box, which left the emblem occupying
 * only the top ~74% of the height and painted the lockup's own "Prismconnex /
 * GLOBAL SOLUTIONS" underneath it — a two-pixel smear directly below the "o".
 * BrandMark is the emblem cropped out on its own, so nothing renders below it.
 *
 * Sizing. Measured off the source artwork's own wordmark, the emblem there is
 * 69px tall and 68px wide, against a 70px x-height and a 90px cap height — so
 * the artwork sets it at x-height, filling the lowercase "o" slot exactly and
 * no more. (An earlier comment here claimed the artwork drew it above cap
 * height. It does not; that was never measured.)
 *
 * This renders it deliberately larger than the artwork does — a full 0.72em,
 * which is cap height for the UI sans. Anchoring to the cap rather than to some
 * round number means the emblem's top lands level with the "P" that opens the
 * word and its bottom on the shared baseline, so the mark is bracketed by the
 * word instead of floating inside it. At x-height it was legible but read as a
 * slightly odd letter; at cap height it reads as the logo.
 *
 * Since the box is square and BrandMark fills it (the crop is the emblem's
 * bounding box plus 5px of padding per side, squared off), 0.72em is both the
 * height and the width.
 *
 * No transform: a flex item with no text baseline-aligns on its bottom margin
 * edge, which is exactly where the emblem belongs. `marginInline` is 0.09em,
 * the same emblem-to-letter gap the artwork uses — 12px against its 70px
 * x-height, scaled to the ~0.52em x-height of text at this size.
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
        <span
          className="relative inline-block shrink-0"
          style={{
            width: "0.72em",
            height: "0.72em",
            marginInline: "0.09em",
          }}
        >
          <BrandMark fill sizes="24px" className="object-contain" alt="" />
        </span>
        nnex
      </span>
    </span>
  );
}
