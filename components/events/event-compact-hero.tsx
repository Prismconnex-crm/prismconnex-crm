"use client";

import { useState } from "react";
import { Image as ImageIcon, MapPin } from "lucide-react";
import type { FindShowEvent } from "@/types/find-shows";

/**
 * Compact event header, shared by the Overview and Location & Venue tabs so
 * both read identically for every event in the catalog.
 *
 * Replaces a 300px gradient panel that was mostly empty space: the logo is
 * small, so stretching a block behind it filled the viewport without adding
 * information. This is a single glass strip — logo, name, place — and the
 * banner photo, when the source published one, becomes a low-opacity wash
 * behind it rather than a full-bleed image.
 */
export function EventCompactHero({ event }: { event: FindShowEvent }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);

  const photo = event.seedAsset.bannerUrl && !photoFailed ? event.seedAsset.bannerUrl : null;
  const logo = event.seedAsset.logoUrl && !logoFailed ? event.seedAsset.logoUrl : null;
  const place = [event.city, event.country === "Unknown" ? "" : event.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="relative overflow-hidden border-b border-slate-200 bg-white/70 backdrop-blur-xl dark:border-[#22304A] dark:bg-[#111B2E]/70">
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="pointer-events-none absolute inset-0 size-full object-cover opacity-20 dark:opacity-15"
            ref={(node) => {
              // Several source banners 404; a load that already failed before
              // React attached onError would otherwise leave a broken image.
              if (node && node.complete && node.naturalWidth === 0) setPhotoFailed(true);
            }}
            onError={() => setPhotoFailed(true)}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/80 via-white/40 to-transparent dark:from-[#111B2E]/90 dark:via-[#111B2E]/50" />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/[0.07] via-transparent to-cyan-500/[0.07]" />
      )}

      <div className="relative flex items-center gap-4 px-6 py-5">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#0B1220]">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={`${event.name} logo`}
              loading="lazy"
              className="max-h-12 max-w-[85%] object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <ImageIcon className="size-6 text-indigo-500/40" />
          )}
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-[16px] font-bold tracking-tight text-slate-900 dark:text-white">
            {event.name}
          </h2>
          {place ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-medium text-slate-600 dark:text-slate-300">
              <MapPin className="size-3.5 text-indigo-500" />
              {place}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
