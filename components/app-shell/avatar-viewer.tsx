"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Download, ImageOff, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";

/**
 * Full-size view of the signed-in user's profile photo.
 *
 * Built on the project's Radix Dialog rather than a hand-rolled overlay, which
 * is what supplies — for free and correctly — the Escape key, click-outside to
 * close, the focus trap, `aria-modal`, and the scroll lock on the page behind.
 * Re-implementing those by hand is where accessibility bugs come from.
 *
 * ── Where the image comes from ──
 * Nothing here fetches or stores anything. `src` is the same
 * `profiles.avatar_url` the topbar and the Profile page already render, written
 * by the existing upload in components/crm/profile/profile-header.tsx. The
 * `avatars` bucket is PUBLIC (see supabase/sql/003_avatars_storage.sql), so the
 * URL renders in an <img> and downloads with a plain fetch — no signed URL is
 * needed and no policy is bypassed. If that bucket is ever made private, this
 * component is the only place that would need a signed-URL call added.
 */
export function AvatarViewer({
    open,
    onOpenChange,
    src,
    initials,
    name,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    src: string | null;
    initials: string;
    name: string;
}) {
    const [failed, setFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [downloading, setDownloading] = useState(false);

    // Reset per image AND per open: reopening after a transient network failure
    // should retry rather than show the error state forever.
    useEffect(() => {
        setFailed(false);
        setLoaded(false);
    }, [src, open]);

    const showImage = Boolean(src) && !failed;

    /**
     * Downloads through a blob rather than `<a download href={src}>`, because
     * the `download` attribute is ignored for cross-origin URLs — the Supabase
     * CDN is a different origin, so the plain link would navigate to the image
     * instead of saving it. Falls back to opening in a tab if the fetch fails.
     */
    const handleDownload = async () => {
        if (!src || downloading) return;
        setDownloading(true);

        try {
            const response = await fetch(src);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = objectUrl;
            link.download = src.split("/").pop()?.split("?")[0] || "profile-image";
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error("Profile image download error:", error);
            window.open(src, "_blank", "noopener,noreferrer");
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                // animate-dialog-in, NOT animate-scale-in. DialogContent centres
                // itself with fixed + left/top-50% + a -50%/-50% translate, and a
                // CSS animation's `transform` replaces the element's own — so the
                // plain scale keyframes wiped that translate out and (being
                // `forwards`) left the panel's top-left corner sitting at the
                // centre of the viewport, i.e. hanging off the bottom. dialog-in
                // re-states the translate in both keyframes; centring now holds
                // during the animation and after it settles.
                // The `animate-in / zoom-in-95` utilities are NOT defined here —
                // this project has no tailwindcss-animate plugin.
                className={cn("max-w-[min(92vw,28rem)] p-5", "animate-dialog-in")}
            >
                <div className="flex flex-col items-center gap-4">
                    {/*
                        Square box, so the skeleton occupies the same area the
                        image will — the dialog does not jump size on load.
                        max-h in vh units keeps it inside the viewport on a
                        short screen or a phone in landscape.
                    */}
                    <div className="relative flex aspect-square w-full max-h-[60vh] items-center justify-center overflow-hidden rounded-2xl bg-slate-100 dark:bg-white/[0.04]">
                        {showImage ? (
                            <>
                                <Image
                                    src={src as string}
                                    alt={`${name}'s profile image`}
                                    fill
                                    unoptimized
                                    sizes="(max-width: 640px) 92vw, 28rem"
                                    onLoad={() => setLoaded(true)}
                                    onError={() => setFailed(true)}
                                    // contain, not cover: this is the viewer, so
                                    // the whole uploaded image should be visible
                                    // rather than cropped to a square.
                                    className={cn(
                                        "object-contain transition-opacity duration-200",
                                        loaded ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {!loaded ? (
                                    <div
                                        aria-hidden="true"
                                        className="absolute inset-0 flex animate-pulse items-center justify-center bg-slate-200/70 dark:bg-white/[0.06]"
                                    >
                                        <Loader2 className="size-6 animate-spin text-slate-400" />
                                    </div>
                                ) : null}
                            </>
                        ) : (
                            // No photo, or one that would not load. Both end at
                            // the initials the rest of the app already shows —
                            // never a broken-image glyph.
                            <div className="flex flex-col items-center gap-3 px-6 text-center">
                                <UserAvatar src={null} initials={initials} size={112} />
                                <p className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
                                    <ImageOff className="size-3.5 shrink-0" aria-hidden="true" />
                                    {failed
                                        ? "We could not load your profile image."
                                        : "No profile image uploaded yet."}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex w-full flex-col items-center gap-3">
                        <div className="text-center">
                            {/* Radix requires a DialogTitle for the accessible
                                name; here it doubles as the visible caption. */}
                            <DialogTitle className="text-[14px] font-semibold text-slate-900 dark:text-white">
                                Profile Image
                            </DialogTitle>
                            {/* Doubles as the dialog's accessible description,
                                which Radix warns about when missing — a screen
                                reader otherwise announces "Profile Image" with
                                no indication of whose. */}
                            <DialogDescription className="mt-0.5 break-words text-[12px] text-slate-500 dark:text-slate-400">
                                {name}
                            </DialogDescription>
                        </div>

                        {/* Only offered when there is something to download. */}
                        {showImage ? (
                            <button
                                type="button"
                                onClick={handleDownload}
                                disabled={downloading}
                                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                            >
                                {downloading ? (
                                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                ) : (
                                    <Download className="size-3.5" aria-hidden="true" />
                                )}
                                Download
                            </button>
                        ) : null}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
