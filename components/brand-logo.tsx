import Image, { type ImageProps } from "next/image";

import { cn } from "@/lib/utils";

export const LOGO_BLUE_SRC = "/images/logo-blue.png";
export const LOGO_BLUE_DARK_SRC = "/images/logo-blue-dark.png";

/** Intrinsic pixels of the source artwork — used only to reserve aspect ratio. */
const INTRINSIC_WIDTH = 800;
const INTRINSIC_HEIGHT = 705;

const DEFAULT_ALT = "Prismconnex Global Solutions";

type BrandLogoProps = Omit<ImageProps, "src" | "alt" | "width" | "height"> & {
  alt?: string;
  width?: number;
  height?: number;
};

/**
 * The Prismconnex logo, in brand blue — #005C9D in light mode, one step up to
 * #0086E6 in dark. Those are the `--brand` and `--brand-hover` tokens from
 * app/globals.css, baked into two PNGs by scripts/generate-logo-variants.mjs. A
 * PNG cannot read a CSS variable, so the script holds the only other copy of
 * both hexes; keep them in sync.
 *
 * Dark mode gets its own variant because #005C9D is only 2.77:1 on the #0A0E1A
 * auth background and 2.47:1 on the #111B2E sidebar. #0086E6 restores that to
 * 5.09:1 / 4.55:1 — the same brand -> brand-hover substitution dark mode already
 * makes for link text and focus borders.
 *
 * Both variants are rendered and toggled by Tailwind's `dark:` classes rather
 * than picked in JS via `useTheme()`. That is deliberate: the theme is resolved
 * from a class on <html>, so a JS swap would either render the wrong logo on the
 * server and flash on hydration, or force this into a client component. CSS has
 * the answer before first paint. Only one variant is ever visible, and only the
 * visible one is decoded.
 *
 * A much older revision swapped in a *white* logo under `.dark`; that was
 * removed on purpose and is not what this is — the mark stays brand blue in both
 * themes. Don't reintroduce the white one.
 */
export function BrandLogo({
  className,
  alt = DEFAULT_ALT,
  fill,
  width,
  height,
  ...rest
}: BrandLogoProps) {
  // `fill` and explicit dimensions are mutually exclusive in next/image.
  const dimensions = fill
    ? {}
    : { width: width ?? INTRINSIC_WIDTH, height: height ?? INTRINSIC_HEIGHT };

  // `alt` is passed explicitly rather than through the spread: jsx-a11y/alt-text
  // cannot see props arriving via a spread and would warn on the <Image>s below.
  const shared = { fill, ...dimensions, ...rest };

  return (
    <>
      <Image
        {...shared}
        alt={alt}
        src={LOGO_BLUE_SRC}
        className={cn(className, "dark:hidden")}
      />
      {/*
        `aria-hidden` plus an empty alt on the dark twin: both nodes are in the
        DOM at all times, and without this a screen reader would announce the
        logo twice regardless of which one is painted.
      */}
      <Image
        {...shared}
        alt=""
        aria-hidden="true"
        src={LOGO_BLUE_DARK_SRC}
        className={cn(className, "hidden dark:block")}
      />
    </>
  );
}
