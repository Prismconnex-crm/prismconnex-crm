"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The signed-in user's photo, with initials as the fallback.
 *
 * Three states, because "show the uploaded image" has three real outcomes:
 *   no url          -> initials, immediately (the common case — most users
 *                      have never uploaded a photo)
 *   url, loading    -> a pulsing disc, NOT a half-drawn image or the browser's
 *                      broken-image glyph
 *   url, failed     -> initials again. A stored avatar_url can outlive its
 *                      object (bucket emptied, file deleted outside the app),
 *                      and a broken icon in the header looks like the app is
 *                      broken rather than the image.
 *
 * `unoptimized` for the same reason as the Profile page: the Supabase Storage
 * host is not in next.config's images.remotePatterns, and the file is already
 * served from a CDN at the size it is displayed.
 */
export function UserAvatar({
    src,
    initials,
    size,
    className,
}: {
    src: string | null;
    initials: string;
    /** Rendered diameter in px. Kept numeric — next/image needs real numbers. */
    size: number;
    className?: string;
}) {
    const [failed, setFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // A new url is a new attempt: without this, one broken image would latch
    // `failed` on and suppress every later upload for the rest of the session.
    useEffect(() => {
        setFailed(false);
        setLoaded(false);
    }, [src]);

    const showImage = Boolean(src) && !failed;

    return (
        <span
            style={{ width: size, height: size }}
            className={cn(
                "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
                "bg-slate-200 ring-1 ring-white/15 dark:bg-[#1A2138]",
                className
            )}
        >
            {showImage ? (
                <Image
                    src={src as string}
                    alt=""
                    width={size}
                    height={size}
                    unoptimized
                    onLoad={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                    className={cn(
                        "size-full object-cover transition-opacity duration-200",
                        loaded ? "opacity-100" : "opacity-0"
                    )}
                />
            ) : null}

            {/*
                Initials sit UNDER the image rather than replacing it, so the
                swap to a loaded photo never flashes an empty circle — and they
                are already in place if the image errors.
            */}
            {!showImage || !loaded ? (
                <span
                    aria-hidden="true"
                    className={cn(
                        "absolute inset-0 flex items-center justify-center font-bold",
                        // A pulsing disc while a real image is on its way;
                        // plain initials when there is nothing to wait for.
                        showImage
                            ? "animate-pulse bg-slate-300 text-transparent dark:bg-[#22304A]"
                            : "text-slate-700 dark:text-slate-200"
                    )}
                    style={{ fontSize: Math.max(10, Math.round(size * 0.36)) }}
                >
                    {initials}
                </span>
            ) : null}
        </span>
    );
}
