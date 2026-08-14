"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Two artwork files, each with its background baked in, so the correct one has
// to be chosen per theme rather than recoloured with CSS:
//   dark  -> white mark on deep navy
//   light -> blue mark on white
const LOGO_DARK = "/prismconnex-logo-dark.jpeg";
const LOGO_LIGHT = "/prismconnex-logo-light.jpeg";

// Both files are square lockups: emblem on top, "Prismconnex Global Solutions"
// beneath. At sidebar size the wordmark is illegible, so `mark` zooms into the
// emblem and lets the adjacent text carry the name.
//
// Geometry (measured on the artwork, 1600x1496): the emblem spans ~66% of the
// height centred at ~39% — i.e. ABOVE the image's midpoint — and ~60% of the
// width. So the image is scaled until the emblem fills the frame, then nudged
// DOWN to bring it to centre; shifting up would pull the wordmark into view.
const MARK_ZOOM = "scale-[1.7] translate-y-[17.5%]";

type BrandLogoProps = {
  /** `mark` crops to the emblem; `full` shows the entire lockup. */
  variant?: "mark" | "full";
  /** Tailwind size classes for the frame, e.g. "size-9". */
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ variant = "mark", className, priority = false }: BrandLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // resolvedTheme is undefined until mounted; rendering before then would flash
  // the wrong artwork (and mismatch the server HTML).
  useEffect(() => setMounted(true), []);

  const src = mounted && resolvedTheme === "light" ? LOGO_LIGHT : LOGO_DARK;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-white/10",
        // Frame background matches each artwork so the JPEG's baked-in
        // background never reads as a visible box.
        "bg-white dark:bg-[#0E1321]",
        className
      )}
    >
      <Image
        key={src}
        src={src}
        alt="Prismconnex Global Solutions"
        fill
        sizes="96px"
        priority={priority}
        className={cn(
          "object-contain",
          variant === "mark" ? MARK_ZOOM : "p-0.5"
        )}
      />
    </div>
  );
}
