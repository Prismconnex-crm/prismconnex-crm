import Link from 'next/link';
import type { ReactNode } from 'react';

import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';

/**
 * Two-column shell for the auth landing page.
 *
 * Replaces the single centred card that `AuthCard` used to provide. The form
 * column carries the Login / Sign Up tabs and whichever form is active; the
 * brand column shows nothing but the logo.
 *
 * Column order is driven by `order-*` rather than DOM order so the brand panel
 * sits *above* the form on mobile but on the *right* from `lg` up. That needs a
 * flex/grid formatting context at every breakpoint, hence `flex flex-col` on
 * small screens rather than plain block flow.
 *
 * ── Theming ──
 * Every surface here is a light-mode class with the original dark hex kept as a
 * `dark:` variant, matching the convention used across the app. next-themes
 * toggles `.dark` on <html>, so a theme change is a pure CSS repaint: no
 * re-render, no refresh, and no flash on first paint (its blocking script sets
 * the class before the document renders).
 *
 *   light -> page #FFFFFF, brand panel transparent (inherits the page)
 *   dark  -> page #0A0E1A, brand panel transparent (inherits the page)
 *
 * The two columns are deliberately indistinguishable as surfaces. The panel used
 * to carry a `lg:border-l` hairline (a `border-b` where it stacks on mobile) and
 * a lighter `#F8FAFC` background in light mode; together those read as a seam
 * splitting one page into two. Both are gone, so the only thing marking the
 * columns apart is their content. The single `bg-white dark:bg-[#0A0E1A]` on the
 * wrapper above is now the sole background for the whole screen.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-white transition-colors duration-200 dark:bg-[#0A0E1A] lg:grid lg:grid-cols-2">
      {/*
        The auth routes sit outside both the marketing navbar and the app
        topbar, so without this there is no way to change theme from a signed-out
        page. It is the same shared control the app topbar mounts — its own
        `bg-surface`/`border-border` tokens already track the theme.
      */}
      <div className="absolute right-4 top-4 z-30 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative order-2 flex flex-1 items-center justify-center overflow-hidden px-4 py-10 sm:px-8 lg:order-1 lg:min-h-screen lg:py-12">
        {/* Ambient blurs: dialled back in light mode, where a /10 indigo wash
            over white reads as a grey smudge rather than a glow. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[6%] top-[8%] h-72 w-72 rounded-full bg-indigo-500/[0.06] blur-[120px] dark:bg-indigo-600/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[8%] right-[4%] h-80 w-80 rounded-full bg-purple-500/[0.06] blur-[140px] dark:bg-purple-600/10"
        />

        <div className="relative z-10 w-full max-w-md">{children}</div>
      </div>

      <AuthBrandPanel />
    </div>
  );
}

/**
 * Right-hand panel: the Prismconnex Global Solutions logo, centred on both
 * axes, and nothing else.
 *
 * This used to render the wordmark as text because the only asset available,
 * `public/prismconnex-logo.jpeg`, is a white-background JPEG that would show as
 * a white block against `#0A0E1A`. It now renders the real logo from
 * `public/images/prismconnex-logo.png`, generated from that JPEG as a
 * brand-blue lockup with a true alpha channel:
 *
 *   - alpha is derived from each source pixel's darkest channel, so the white
 *     background drops out completely and anti-aliased edges stay smooth;
 *   - RGB is forced to a single flat colour across the whole canvas, so
 *     downscaling interpolates alpha only and cannot produce edge fringing;
 *   - the source's 77% white padding is cropped away, so the mark fills its box;
 *   - it is stored as a palette PNG (1 byte/pixel) rather than 32-bit RGBA,
 *     which is lossless here and cuts the file from 120 KB to 72 KB.
 *
 * That palette swap is automated by `scripts/generate-logo-variants.mjs`, which
 * emits one variant per theme from the `--brand` / `--brand-hover` tokens in
 * app/globals.css — the same blues the Login / Sign Up tabs and the primary
 * buttons use. A PNG cannot read a CSS variable, so the script holds the only
 * other copy of those hexes; they are kept in sync by hand.
 *
 * The panel has no background of its own, so the mark sits on the page colour:
 *
 *   light -> #005C9D on #FFFFFF — 6.96:1
 *   dark  -> #0086E6 on #0A0E1A — 5.09:1
 *
 * Dark mode needs the lighter variant: #005C9D lands at 2.77:1 there, which is
 * legible in principle but reads as a smudge. `BrandLogo` swaps them with a
 * `dark:` class, not `useTheme()`, so there is no hydration flash.
 *
 * Dropping the panel's own background is what makes the two columns read as one
 * page; it also lifts light-mode contrast slightly, since white is the brighter
 * surface. The focus ring's `ring-offset` follows the same colour — it has to
 * match whatever is actually behind the logo, or the ring gets a halo.
 */
function AuthBrandPanel() {
  return (
    <div className="relative order-1 flex items-center justify-center overflow-hidden px-6 py-10 lg:order-2 lg:min-h-screen lg:py-0">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.06] blur-[150px] dark:bg-indigo-600/10 lg:h-[560px] lg:w-[560px]"
      />

      <Link
        href="/"
        aria-label="Prismconnex Global Solutions"
        className="relative z-10 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-4 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0A0E1A]"
      >
        {/*
          `width`/`height` are the asset's intrinsic pixels — they only give
          Next the aspect ratio to reserve space with (no layout shift). The
          rendered size comes from the `w-*` classes, with `h-auto` keeping the
          ratio at every breakpoint. `sizes` tells the optimizer which widths to
          emit so phones never download the desktop variant, and `priority`
          opts this out of lazy-loading because it is the panel's LCP element.
        */}
        <BrandLogo
          width={800}
          height={705}
          priority
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 280px, 200px"
          className="h-auto w-[200px] sm:w-[280px] lg:w-[360px]"
        />
      </Link>
    </div>
  );
}
