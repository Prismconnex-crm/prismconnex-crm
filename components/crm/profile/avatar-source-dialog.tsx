"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Camera, Image as ImageIcon, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Profile picture" source chooser — a centered modal, deliberately NOT a
 * bottom sheet.
 *
 * Why this exists at all: without it, the camera button opened the hidden file
 * input directly and the *browser* took over, which on mobile means the native
 * chooser sliding up from the bottom of the screen. That sheet is OS chrome —
 * it cannot be repositioned or restyled from CSS. The only way to get a centred
 * dialog is to put our own in front of it, which is what this is: it asks the
 * question first, then opens exactly one input, so the OS has nothing left to
 * ask about (the camera goes straight to the camera).
 *
 * Built on the Radix Dialog primitives rather than components/ui/dialog because
 * that shared DialogContent ships its own close button styled `hover:text-white`
 * — invisible against this modal's white light-mode surface. Everything that
 * actually matters still comes from Radix for free and correct: Escape to close,
 * click-outside to close, the focus trap, `aria-modal`, and the scroll lock.
 *
 * This component picks a source and nothing else. The upload itself — the
 * FormData POST to /api/profile/avatar and the Supabase Storage write behind it
 * — is untouched in profile-header.tsx.
 */
export function AvatarSourceDialog({
    open,
    onOpenChange,
    onSelect,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called with the chosen source; the caller opens the matching input. */
    onSelect: (source: "camera" | "gallery") => void;
}) {
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                {/* Semi-transparent overlay; clicking it closes (Radix). */}
                <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px]" />

                <DialogPrimitive.Content
                    className={cn(
                        // Centred both ways against the viewport, not the page:
                        // fixed + 50/50 + the -50% translate back on both axes.
                        "fixed left-1/2 top-1/2 z-[100] -translate-x-1/2 -translate-y-1/2",
                        // Never wider than the phone it is on, never taller than
                        // the screen — hence the vw cap and the scroll fallback.
                        "w-[calc(100vw-2rem)] max-w-[22rem] max-h-[calc(100vh-2rem)] overflow-y-auto",
                        "rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-black/10",
                        "dark:border-[#22304A] dark:bg-[#16233A] dark:shadow-black/40",
                        "focus:outline-none",
                        // Defined in tailwind.config — this project has no
                        // tailwindcss-animate, so `animate-in` would be a no-op.
                        "animate-scale-in"
                    )}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <DialogPrimitive.Title className="text-[14px] font-semibold text-slate-900 dark:text-white">
                                Profile picture
                            </DialogPrimitive.Title>
                            <DialogPrimitive.Description className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                Choose where to get your photo from.
                            </DialogPrimitive.Description>
                        </div>

                        <DialogPrimitive.Close
                            aria-label="Close"
                            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                        >
                            <X className="size-4" aria-hidden="true" />
                        </DialogPrimitive.Close>
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                        <SourceOption
                            icon={Camera}
                            label="Camera"
                            hint="Take a new photo"
                            onClick={() => onSelect("camera")}
                        />
                        <SourceOption
                            icon={ImageIcon}
                            label="Gallery"
                            hint="Choose an existing image"
                            onClick={() => onSelect("gallery")}
                        />
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

function SourceOption({
    icon: Icon,
    label,
    hint,
    onClick,
}: {
    icon: LucideIcon;
    label: string;
    hint: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:border-[#22304A] dark:hover:bg-white/[0.04]"
        >
            <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand dark:bg-brand-hover/10 dark:text-brand-hover"
            >
                <Icon className="size-4" />
            </span>
            <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-slate-900 dark:text-white">
                    {label}
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">{hint}</span>
            </span>
        </button>
    );
}
