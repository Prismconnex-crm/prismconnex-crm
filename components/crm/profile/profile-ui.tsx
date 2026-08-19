"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared building blocks for the Profile page.
 *
 * These exist so the nine cards look and behave identically without nine
 * copies of the same markup, and so the accessibility details — label/input
 * association, aria-live on status, aria-invalid on errors — are written once
 * and correct everywhere rather than remembered nine times.
 *
 * The visual language matches the existing CRM sections (translucent card,
 * hairline border, small type) rather than introducing a second one.
 */

export const CARD_CLASSES =
    "rounded-xl border border-slate-200 bg-white/70 backdrop-blur-xl dark:border-white/[0.06] dark:bg-white/[0.02]";

export function SectionCard({
    title,
    description,
    icon: Icon,
    actions,
    children,
    id,
}: {
    title: string;
    description?: string;
    icon?: LucideIcon;
    actions?: ReactNode;
    children: ReactNode;
    id?: string;
}) {
    const headingId = useId();

    return (
        // `section` + aria-labelledby rather than a plain div: the page is a
        // long list of cards, and this is what lets a screen-reader user jump
        // between them by landmark instead of reading through.
        <section
            id={id}
            aria-labelledby={headingId}
            className={cn(CARD_CLASSES, "scroll-mt-24 p-4 sm:p-5")}
        >
            <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                    {Icon ? (
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand dark:bg-brand-hover/10 dark:text-brand-hover">
                            <Icon className="size-4" aria-hidden="true" />
                        </span>
                    ) : null}
                    <div>
                        <h2
                            id={headingId}
                            className="text-[14px] font-bold tracking-tight text-slate-900 dark:text-white"
                        >
                            {title}
                        </h2>
                        {description ? (
                            <p className="mt-0.5 text-[12px] text-slate-600 dark:text-slate-400">
                                {description}
                            </p>
                        ) : null}
                    </div>
                </div>
                {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
            </header>
            {children}
        </section>
    );
}

export type StatusKind = "success" | "error" | null;
export type Status = { kind: StatusKind; message: string };

export const NO_STATUS: Status = { kind: null, message: "" };

/**
 * Inline success/error line for a card.
 *
 * `role="status"` + aria-live="polite" so the outcome of a save is announced
 * rather than only shown — a form that reports success purely in colour is
 * silent to anyone using a screen reader. Errors use role="alert", which
 * interrupts, because they need acting on.
 */
export function StatusMessage({ status }: { status: Status }) {
    return (
        <AnimatePresence mode="wait">
            {status.kind ? (
                <motion.p
                    key={status.message}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    role={status.kind === "error" ? "alert" : "status"}
                    aria-live={status.kind === "error" ? "assertive" : "polite"}
                    className={cn(
                        "flex items-start gap-1.5 text-[12px] font-medium",
                        status.kind === "success"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                    )}
                >
                    {status.kind === "success" ? (
                        <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                        <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>{status.message}</span>
                </motion.p>
            ) : null}
        </AnimatePresence>
    );
}

/** Clears a status after a delay, so a success line does not linger forever. */
export function useAutoClearedStatus(timeoutMs = 6000) {
    const [status, setStatus] = useState<Status>(NO_STATUS);
    const timer = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        // Errors persist: they usually require the user to change something,
        // and clearing the explanation while they are still reading it is how
        // a form becomes impossible to debug.
        if (status.kind !== "success") return;

        timer.current = setTimeout(() => setStatus(NO_STATUS), timeoutMs);
        return () => clearTimeout(timer.current);
    }, [status, timeoutMs]);

    return [status, setStatus] as const;
}

const CONTROL_CLASSES =
    "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 transition-colors placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:border-[#22304A] dark:bg-[#0F1729] dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-white/[0.02] dark:disabled:text-slate-500";

export function Field({
    label,
    name,
    value,
    onChange,
    type = "text",
    placeholder,
    disabled,
    error,
    hint,
    required,
    autoComplete,
    inputMode,
    maxLength,
}: {
    label: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
    hint?: string;
    required?: boolean;
    autoComplete?: string;
    inputMode?: "text" | "numeric" | "tel" | "email";
    maxLength?: number;
}) {
    const id = useId();
    const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
        .filter(Boolean)
        .join(" ");

    return (
        <div>
            <label
                htmlFor={id}
                className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300"
            >
                {label}
                {required ? (
                    <span className="ml-0.5 text-red-500" aria-hidden="true">
                        *
                    </span>
                ) : null}
            </label>
            <input
                id={id}
                name={name}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                required={required}
                autoComplete={autoComplete}
                inputMode={inputMode}
                maxLength={maxLength}
                // aria-invalid is what tells assistive tech the field is the
                // problem; the red ring alone conveys it only to sighted users.
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy || undefined}
                className={cn(
                    CONTROL_CLASSES,
                    error &&
                        "border-red-400 focus:border-red-500 focus:ring-red-500/25 dark:border-red-500/60"
                )}
            />
            {hint && !error ? (
                <p id={`${id}-hint`} className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {hint}
                </p>
            ) : null}
            {error ? (
                <p
                    id={`${id}-error`}
                    className="mt-1 text-[11px] font-medium text-red-600 dark:text-red-400"
                >
                    {error}
                </p>
            ) : null}
        </div>
    );
}

export function SelectField({
    label,
    value,
    onChange,
    options,
    disabled,
    hint,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: readonly { value: string; label: string }[];
    disabled?: boolean;
    hint?: string;
}) {
    const id = useId();

    return (
        <div>
            <label
                htmlFor={id}
                className="mb-1 block text-[12px] font-medium text-slate-700 dark:text-slate-300"
            >
                {label}
            </label>
            <select
                id={id}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                className={cn(CONTROL_CLASSES, "pr-8")}
            >
                {/*
                    A value that is not in the option list (a timezone the
                    browser knows but this list does not, say) would otherwise
                    render as the first option and silently rewrite itself on
                    the next save. Adding it keeps the shown value truthful.
                */}
                {options.some((option) => option.value === value) ? null : (
                    <option value={value}>{value}</option>
                )}
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {hint ? (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
            ) : null}
        </div>
    );
}

/** Label + value, for information the user cannot edit here. */
export function ReadOnlyField({
    label,
    value,
    mono,
}: {
    label: string;
    value: ReactNode;
    mono?: boolean;
}) {
    return (
        <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
            </dt>
            <dd
                className={cn(
                    "mt-0.5 text-[13px] text-slate-900 dark:text-slate-100",
                    mono && "font-mono text-[12px]"
                )}
            >
                {value}
            </dd>
        </div>
    );
}

/** Muted placeholder for a value that has never been set. */
export function NotSet() {
    return <span className="text-slate-400 dark:text-slate-500">Not set</span>;
}

export function PrimaryButton({
    children,
    onClick,
    type = "button",
    disabled,
    loading,
    className,
}: {
    children: ReactNode;
    onClick?: () => void;
    type?: "button" | "submit";
    disabled?: boolean;
    loading?: boolean;
    className?: string;
}) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || loading}
            // aria-busy so the pending state is exposed, not just animated.
            aria-busy={loading || undefined}
            className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-[12px] font-semibold text-white transition-colors hover:bg-brand-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-[#0B1220]",
                className
            )}
        >
            {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            {children}
        </button>
    );
}

export function SecondaryButton({
    children,
    onClick,
    disabled,
    type = "button",
    tone = "neutral",
    className,
}: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit";
    tone?: "neutral" | "danger";
    className?: string;
}) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-[#0B1220]",
                tone === "danger"
                    ? "border-red-300 text-red-600 hover:bg-red-50 focus-visible:ring-red-500/40 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                    : "border-slate-300 text-slate-700 hover:bg-slate-100 focus-visible:ring-brand/40 dark:border-[#22304A] dark:text-slate-300 dark:hover:bg-white/[0.04]",
                className
            )}
        >
            {children}
        </button>
    );
}

/** Grey block used while the real content loads. */
export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            aria-hidden="true"
            className={cn(
                "animate-pulse rounded-md bg-slate-200/70 dark:bg-white/[0.06]",
                className
            )}
        />
    );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
    return (
        <div className={cn(CARD_CLASSES, "space-y-3 p-4 sm:p-5")}>
            <Skeleton className="h-4 w-40" />
            <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: rows * 2 }).map((_, index) => (
                    <Skeleton key={index} className="h-9 w-full" />
                ))}
            </div>
        </div>
    );
}

export function EmptyState({
    icon: Icon,
    title,
    description,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
}) {
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center dark:border-white/[0.08]">
            <Icon className="size-5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <p className="mt-2 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                {title}
            </p>
            <p className="mt-0.5 max-w-sm text-[12px] text-slate-500 dark:text-slate-400">
                {description}
            </p>
        </div>
    );
}

/**
 * Formats a timestamp for display, or a dash when absent.
 *
 * Fixed `en-GB` + explicit options rather than the visitor's locale: the value
 * has to be stable between the server-rendered shell and the client hydration,
 * and a locale-dependent format is the classic source of a hydration mismatch
 * warning on a page like this.
 */
export function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return "—";

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

export function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—";

    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        // The stored value is a calendar date at UTC midnight; formatting it in
        // a western timezone without this would show the previous day.
        timeZone: "UTC",
    }).format(date);
}
