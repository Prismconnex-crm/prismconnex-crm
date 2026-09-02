"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertCircle, Globe, Loader2, LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sign-out confirmation — a centred modal shown before the session is actually
 * revoked, instead of signing out the moment the menu item is clicked.
 *
 * ── Who asks, and who does not ──
 * The scope is decided by whoever mounts the dialog, not chosen inside it:
 *
 *   "global" → Settings › Security › "Sign out from all devices", the only
 *              caller today. Revokes every refresh token the user holds, which
 *              is worth a confirmation: it reaches devices that are not here.
 *   "local"  → revokes only the refresh token behind this browser. The topbar's
 *              "Sign Out" does this WITHOUT a dialog — signing out of the
 *              device you are already holding needs no second thought — so the
 *              scope is kept as the default for any future caller that does
 *              want to ask.
 *
 * Both scopes post to the SAME endpoint, /api/auth/sign-out, which passes `scope`
 * through to GoTrue's POST /logout?scope= (the wire form of
 * `supabase.auth.signOut({ scope })`) and then expires this browser's auth
 * cookies either way — so both paths end with this device signed out; the
 * difference is what happens elsewhere. Nothing here touches the profile row
 * or the account: this is session revocation only.
 *
 * ── Why Radix primitives rather than components/ui/dialog ──
 * The shared DialogContent ships a close button styled `hover:text-white`,
 * which is invisible against this modal's white light-mode surface — the same
 * reason avatar-source-dialog reaches for the primitives. Everything that
 * matters still comes from Radix and is correct for free: Escape to close, the
 * focus trap, `aria-modal`, and the scroll lock on the page behind.
 *
 * ── Accidental sign-out ──
 * Clicking the overlay closes the modal without signing out — the same
 * behaviour the project's other dialogs already have — and while a request is
 * in flight the overlay, Escape and Cancel are all inert, so a stray click
 * cannot abandon a half-finished logout.
 */

export type SignOutScope = "local" | "global";

/** Wording and iconography per scope; the mechanics below are identical. */
const COPY: Record<
    SignOutScope,
    { title: string; description: string; confirm: string; icon: typeof LogOut }
> = {
    local: {
        title: "Sign out",
        description:
            "You will be signed out of Prismconnex on this device. Your other devices stay signed in.",
        confirm: "Sign out",
        icon: LogOut,
    },
    global: {
        title: "Sign out from all devices",
        description:
            "This ends every active session on all your devices, including this one. You will need to sign in again everywhere.",
        confirm: "Sign out everywhere",
        icon: Globe,
    },
};

export function SignOutDialog({
    open,
    onOpenChange,
    onConfirm,
    scope = "local",
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /**
     * Performs the sign-out. Resolves on success (the caller redirects);
     * rejects with a displayable message on failure, which is rendered inline
     * so the user can retry rather than being dropped somewhere unexplained.
     */
    onConfirm: (scope: SignOutScope) => Promise<void>;
    /** How far the sign-out reaches. Defaults to this device only. */
    scope?: SignOutScope;
}) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const copy = COPY[scope];
    const Icon = copy.icon;

    // A reopened dialog must not show the previous attempt's failure. Cleared
    // on open rather than on close so the message stays visible for as long as
    // the closing animation lasts.
    useEffect(() => {
        if (open) {
            setPending(false);
            setError(null);
        }
    }, [open]);

    const handleConfirm = async () => {
        if (pending) return;
        setPending(true);
        setError(null);

        try {
            await onConfirm(scope);
            // Deliberately no setPending(false) on success: the caller is
            // navigating away, and clearing the spinner first would flash the
            // idle button back for a frame.
        } catch (cause) {
            setError(
                cause instanceof Error && cause.message
                    ? cause.message
                    : "We could not sign you out. Please check your connection and try again."
            );
            setPending(false);
        }
    };

    return (
        <DialogPrimitive.Root
            open={open}
            // Guarded rather than passed straight through: Radix routes Escape,
            // the overlay and the close button all through here, so one check
            // covers every way the dialog could vanish mid-request.
            onOpenChange={(next) => {
                if (pending && !next) return;
                onOpenChange(next);
            }}
        >
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px]" />

                <DialogPrimitive.Content
                    aria-busy={pending || undefined}
                    onPointerDownOutside={(event) => {
                        if (pending) event.preventDefault();
                    }}
                    onEscapeKeyDown={(event) => {
                        if (pending) event.preventDefault();
                    }}
                    className={cn(
                        // Centred against the viewport, not the page.
                        "fixed left-1/2 top-1/2 z-[100] -translate-x-1/2 -translate-y-1/2",
                        // Never wider than the phone it is on, never taller than
                        // the screen — hence the vw cap and the scroll fallback.
                        "w-[calc(100vw-2rem)] max-w-[24rem] max-h-[calc(100vh-2rem)] overflow-y-auto",
                        "rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-black/10",
                        "dark:border-[#22304A] dark:bg-[#16233A] dark:shadow-black/40",
                        "focus:outline-none",
                        // Defined in tailwind.config — this project has no
                        // tailwindcss-animate, so `animate-in` would be a no-op.
                        "animate-scale-in"
                    )}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                            <span
                                aria-hidden="true"
                                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400"
                            >
                                <Icon className="size-4" />
                            </span>
                            <div className="min-w-0">
                                <DialogPrimitive.Title className="text-[14px] font-semibold text-slate-900 dark:text-white">
                                    {copy.title}
                                </DialogPrimitive.Title>
                                <DialogPrimitive.Description className="mt-0.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                                    {copy.description}
                                </DialogPrimitive.Description>
                            </div>
                        </div>

                        <DialogPrimitive.Close
                            aria-label="Close"
                            disabled={pending}
                            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                        >
                            <X className="size-4" aria-hidden="true" />
                        </DialogPrimitive.Close>
                    </div>

                    {error ? (
                        <p
                            role="alert"
                            aria-live="assertive"
                            className="mt-3 flex items-start gap-1.5 text-[12px] font-medium text-red-600 dark:text-red-400"
                        >
                            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                            <span>{error}</span>
                        </p>
                    ) : null}

                    <div className="mt-4 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            disabled={pending}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={pending}
                            // aria-busy so the pending state is exposed, not just animated.
                            aria-busy={pending || undefined}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-[12px] font-semibold text-white transition-colors hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {pending ? (
                                <>
                                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                    Signing out…
                                </>
                            ) : (
                                copy.confirm
                            )}
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
