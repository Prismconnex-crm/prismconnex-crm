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

        `fixed` rather than `absolute`: the brand panel below is sticky, so an
        absolutely-positioned toggle would ride up over it as the form scrolls
        and then leave the page entirely. Fixed keeps it in the same corner and
        reachable, and its z-30 stays above the panel's z-20.
      */}
      <div className="fixed right-4 top-4 z-30 sm:right-6 sm:top-6">
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
 * Right-hand panel: the scrolling brand tagline (`BrandTagline`, below) stacked
 * directly above the Prismconnex Global Solutions logo, the pair centred on
 * both axes.
 *
 * The panel is a centred column rather than a single centred child, so the
 * tagline rides with the logo at every breakpoint — including mobile, where the
 * whole panel reorders above the form. Nothing about the mark itself changed:
 * same asset, same size ramp, same link target; the column just shifts it down
 * by half the tagline's height so the group stays optically centred.
 *
 * ── Sticky brand ──
 * The panel is `position: sticky; top: 0` at every breakpoint, so the mark stays
 * on screen for the whole of a form that is taller than the viewport — the
 * sign-up form is, at every size we support.
 *
 * From `lg` up that is nearly free, because the panel is already a full-height
 * centred column. It only needs `self-start`: a grid item is stretched to fill
 * its area by default, and a box that fills its containing block has nowhere to
 * stick to. Nothing about the desktop composition changes.
 *
 * Below `lg` the panel stacks *above* the form, so sticking it turns it into a
 * header — and at its hero size that header is 347px, most of a phone. It
 * compacts instead: `pb-10` drops to `pb-4`, the logo from `w-[200px]` to
 * `w-[96px]` (`sm:w-[120px]`), and the tagline's gap from `mb-7` to `mb-2`,
 * taking the bar to about 196px.
 *
 * The top padding only tightens, from `pt-20` to `pt-16` (`sm:pt-[72px]`),
 * because it is still doing its original job: clearing the ThemeToggle that
 * floats at the panel's top edge. That control is a three-way segmented switch
 * about 229px wide, not an icon button, so on a 375px screen there is no
 * sideways room to sit beside it — the content has to start below it. Those two
 * numbers track the toggle's own `top-4`/`sm:top-6` offset plus its 38px height,
 * so if the toggle changes size they have to move with it.
 *
 * A sticky panel needs an opaque surface or the form scrolls visibly through it,
 * so below `lg` it takes the page colour flat — 95% plus a backdrop blur left the
 * form ghosting through it — with a hairline bottom edge. From `lg` up it still
 * has no background of its own: the two columns have to read as one page (see
 * below), and there is no seam to cover when the panel never overlaps anything.
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
    <div className="sticky top-0 z-20 order-1 flex flex-col items-center justify-center overflow-hidden px-6 pb-4 pt-16 max-lg:border-b max-lg:border-slate-200/80 max-lg:bg-white max-lg:dark:border-[#22304A] max-lg:dark:bg-[#0A0E1A] sm:pt-[72px] lg:order-2 lg:h-screen lg:self-start lg:py-0">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.06] blur-[150px] dark:bg-indigo-600/10 lg:h-[560px] lg:w-[560px]"
      />

      <BrandTagline />

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
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 120px, 96px"
          className="h-auto w-[96px] sm:w-[120px] lg:w-[360px]"
        />
      </Link>
    </div>
  );
}


/** The tagline, as it appears once in the marquee track. */
const TAGLINE_LEAD = 'One Platform.';
const TAGLINE_REST = ' Every Connection. Turn Every Connection Into an Opportunity';

/**
 * Four copies of the phrase are laid end to end and the track is translated
 * by half its width. Four copies against two copies' worth of travel is what makes
 * the loop seamless: the final frame is pixel-identical to the first, so there
 * is no snap when the animation restarts. Four (rather than two) also
 * guarantees the strip is wider than the panel at every breakpoint, so the
 * viewport is never left with a gap mid-cycle.
 */
const TAGLINE_COPIES = 4;

/**
 * The scrolling brand line that sits directly above the logo.
 *
 * Everything visual lives in `.pcx-tagline*` in app/globals.css — the edge
 * fade, the centre brightening, the breathing float, the glow, and the
 * `prefers-reduced-motion` fallback that collapses this to a single static,
 * centred, wrapping line. Only transform and opacity are animated, so the whole
 * thing stays on the compositor and costs no layout.
 *
 * The clipping viewport is width-capped and `overflow-hidden`, so the
 * `w-max` track can never widen the panel or introduce a horizontal scrollbar.
 *
 * Screen readers get the sentence exactly once: the first copy is real content,
 * the remaining three are `aria-hidden` decoration.
 */
function BrandTagline() {
  return (
    <div className="pcx-tagline relative z-10 mb-2 w-full max-w-[300px] sm:max-w-[460px] lg:mb-10 lg:max-w-[600px]">
      <div className="pcx-tagline__float">
        <div className="pcx-tagline__track font-sans text-[14px] leading-relaxed tracking-[0.01em] sm:text-[16px] lg:text-[18px]">
          {Array.from({ length: TAGLINE_COPIES }, (_, index) => (
            <span
              key={index}
              className="pcx-tagline__item"
              aria-hidden={index === 0 ? undefined : true}
            >
              <span className="pcx-tagline__lead">{TAGLINE_LEAD}</span>
              <span className="pcx-tagline__rest">{TAGLINE_REST}</span>
              <span className="pcx-tagline__dot" aria-hidden="true">
                {'  •  '}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
