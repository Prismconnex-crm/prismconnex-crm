'use client';

import { useState } from 'react';
import { Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCountryFlagImageUrl, getCountryIsoCode } from '@/lib/find-shows/country-flags';

/**
 * A country's flag, drawn as an image rather than an emoji.
 *
 * Emoji flags are not an option here: Windows ships no country glyphs in Segoe
 * UI Emoji, so Chrome and Edge render 🇺🇸 as the bare letters "US". The image
 * is keyed by ISO 3166-1 alpha-2 code and falls back to the globe icon both
 * when the country has no code (an unparsed "Unknown" location, Kosovo) and
 * when the image fails to load, so an offline or blocked CDN degrades to the
 * previous look instead of an empty slot.
 */
export function CountryFlag({
  country,
  className,
}: {
  country: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const isoCode = getCountryIsoCode(country);
  const flagUrl = getCountryFlagImageUrl(country);

  // The slot keeps its size whichever branch renders, so rows stay aligned.
  return (
    <span
      className={cn(
        'flex size-[22px] shrink-0 items-center justify-center overflow-hidden',
        className
      )}
    >
      {flagUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- a 22px flag
        // through the Next image optimizer costs more than it saves, and the
        // onError fallback needs the native element's error event.
        <img
          src={flagUrl}
          alt={`${country} flag`}
          width={22}
          height={16}
          // Not lazy: the panel only mounts once it is open, so every flag in
          // it is already on screen, and deferring them inside the portal left
          // the row empty for the moment the menu is actually being read.
          loading="eager"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-auto w-[22px] rounded-[2px] object-contain shadow-[0_0_0_1px_rgba(15,23,42,0.08)]"
          data-country-iso={isoCode}
        />
      ) : (
        <Globe2
          className="size-[18px] text-slate-500"
          aria-label={`${country} (no flag available)`}
          data-country-iso={isoCode ?? 'none'}
        />
      )}
    </span>
  );
}
