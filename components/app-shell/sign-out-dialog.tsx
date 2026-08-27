"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
    AlertCircle,
    Globe,
    Laptop,
    Loader2,
    LogOut,
    X,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Sign out" confirmation — a centred modal offering the two scopes Supabase
 * Auth actually supports, instead of signing out the moment the menu item is
 * clicked.
 *
 * ── The two choices ──
 * Both post to the SAME existing endpoint, /api/auth/sign-out, which now takes
 * a `scope` and passes it through to GoTrue's POST /logout?scope= (the wire
 * form of `supabase.auth.signOut({ scope })`):
 *
 *   this device  → scope "local"  — revokes only the refresh token behind this
 *                                   browser. A phone or second laptop stays
 *                                   signed in.
 *   all devices  → scope "global" — revokes every refresh token the user holds.
 *
 * Either way the route also expires this browser's auth cookies, so both paths
 * end with this device signed out; the difference is what happens elsewhere.
 * Nothing here touches the profile row or the account — this is session
 * revocation only.
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

export function SignOutDialog({
    open,
    onOpenChange,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /**
     * Performs the sign-out. Resolves on success (the caller redirects);
     * rejects with a displayable message on failure, which is rendered inline
     * so the user can retry rather than being dropped somewhere unexplained.
     */
    onConfirm: (scope: SignOutScope) => Promise<void>;
}) {
    // Which button is spinning, or null. One value rather than a boolean, so
    // only the button that was pressed shows a spinner while BOTH are disabled.
    const [pending, setPending] = useState<SignOutScope | null>(null);
    const [error, setError] = useState<string | null>(null);

    const busy = pending !== null;

    // A reopened dialog must not show the previous attempt's failure. Cleared
    // on open rather than on close so the message stays visible for as long as
    // the closing animation lasts.
    useEffect(() => {
        if (open) {
            setPending(null);
            setError(null);
        }
    }, [open]);

    const handle = async (scope: SignOutScope) => {
        if (busy) return;
        setPending(scope);
        setError(null);

        try {
            await onConfirm(scope);
            // Deliberately no setPending(null) on success: the caller is
            // navigating away, and clearing the spinner first would flash the
            // idle buttons back for a frame.
        } catch (cause) {
            setError(
                cause instanceof Error && cause.message
                    ? cause.message
                    : "We could not sign you out. Please check your connection and try again."
            );
            setPending(null);
        }
    };

    return (
        <DialogPrimitive.Root
            open={open}
            // Guarded rather than passed straight through: Radix routes Escape,
            // the overlay and the close button all through here, so one check
            // covers every way the dialog could vanish mid-request.
            onOpenChange={(next) => {
                if (busy && !next) return;
                onOpenChange(next);
            }}
        >
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px]" />

                <DialogPrimitive.Content
                    aria-busy={busy || undefined}
                    onPointerDownOutside={(event) => {
                        if (busy) event.preventDefault();
                    }}
                    onEscapeKeyDown={(event) => {
                        if (busy) event.preventDefault();
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
                                <LogOut className="size-4" />
                            </span>
                            <div className="min-w-0">
                                <DialogPrimitive.Title className="text-[14px] font-semibold text-slate-900 dark:text-white">
                                    Sign out
                                </DialogPrimitive.Title>
                                <DialogPrimitive.Description className="mt-0.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                                    Choose whether to sign out of this device only, or to end
                                    every active session on all your devices.
                                </DialogPrimitive.Description>
                            </div>
                        </div>

                        <DialogPrimitive.Close
                            aria-label="Close"
                            disabled={busy}
                            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                        >
                            <X className="size-4" aria-hidden="true" />
                        </DialogPrimitive.Close>
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                        <ScopeOption
                            icon={Laptop}
                            label="Sign out from this device"
                            hint="Other devices stay signed in."
                            loading={pending === "local"}
                            disabled={busy}
                            onClick={() => handle("local")}
                        />
                        <ScopeOption
                            icon={Globe}
                            label="Sign out from all devices"
                            hint="Ends every active session everywhere."
                            loading={pending === "global"}
                            disabled={busy}
                            onClick={() => handle("global")}
                        />
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

                    <div className="mt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            disabled={busy}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                        >
                            Cancel
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

/** One sign-out choice: icon, label, and what it does to other devices. */
function ScopeOption({
    icon: Icon,
    label,
    hint,
    loading,
    disabled,
    onClick,
}: {
    icon: LucideIcon;
    label: string;
    hint: string;
    loading: boolean;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            // aria-busy so the pending state is exposed, not just animated.
            aria-busy={loading || undefined}
            className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent dark:border-[#22304A] dark:hover:bg-red-500/10"
        >
            <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400"
            >
                {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : (
                    <Icon className="size-4" />
                )}
            </span>
            <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-slate-900 dark:text-white">
                    {label}
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    {loading ? "Signing out…" : hint}
                </span>
            </span>
        </button>
    );
}
