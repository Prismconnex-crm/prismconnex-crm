"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, Building2, Globe2, Mail, MapPin, Phone, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Exhibitor } from "@/types/exhibitors";

/** Where an exhibitor with no published site sends you instead. */
const DIRECTORY_FALLBACK = "https://uk.bettshow.com/solution-providers";

/**
 * LinkedIn's glyph in its own brand blue. Inline rather than from lucide: the
 * icon set ships a generic outline "linkedin" mark, and a recognisable brand
 * button needs the filled logo in #0A66C2.
 */
function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05a3.75 3.75 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

/** Square icon action. Renders as a dead, dimmed button when there is no link. */
function IconAction({
  href,
  label,
  tone,
  children,
}: {
  href: string | null | undefined;
  label: string;
  tone: "linkedin" | "neutral";
  children: React.ReactNode;
}) {
  const shared =
    "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-all";

  if (!href) {
    return (
      <span
        aria-disabled="true"
        title={`${label} — not available`}
        className={cn(
          shared,
          "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-600"
        )}
      >
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        shared,
        "hover:scale-105 active:scale-95",
        tone === "linkedin"
          ? "border-[#0A66C2]/25 bg-[#0A66C2]/10 text-[#0A66C2] hover:border-[#0A66C2]/50 hover:bg-[#0A66C2]/15 dark:border-[#0A66C2]/35 dark:bg-[#0A66C2]/15 dark:text-[#4DA3F5]"
          : "border-indigo-200 bg-indigo-50 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
      )}
    >
      {children}
    </a>
  );
}

/** One label/value line. Missing values read "Not available" rather than vanish. */
function DetailRow({
  icon: Icon,
  iconClass,
  label,
  value,
  href,
  action,
}: {
  icon: typeof Mail;
  iconClass?: string;
  label: string;
  value: string | null | undefined;
  href?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className={cn("size-4 shrink-0", iconClass ?? "text-slate-400 dark:text-slate-500")} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
        {value ? (
          href ? (
            <a
              href={href}
              onClick={(event) => event.stopPropagation()}
              className="block truncate text-[13px] font-bold text-indigo-600 hover:underline dark:text-indigo-300"
            >
              {value}
            </a>
          ) : (
            <p className="truncate text-[13px] font-bold text-slate-900 dark:text-white">{value}</p>
          )
        ) : (
          <p className="text-[12.5px] font-medium italic text-slate-400 dark:text-slate-500">Not available</p>
        )}
      </div>
      {action}
    </div>
  );
}

/**
 * Contact card for one exhibitor, centred over the grid.
 *
 * Deliberately does not repeat the name, stand or website URL as text — the
 * card behind it already carries those. What it adds is the enriched contact
 * detail, with the LinkedIn URLs presented as the company and person they
 * belong to rather than as raw links.
 */
export function ExhibitorContactModal({
  exhibitor,
  onClose,
}: {
  exhibitor: Exhibitor | null;
  onClose: () => void;
}) {
  // Portalled to <body>: the grid sits inside framer-motion panels, and a
  // transformed ancestor would make `position: fixed` resolve to that box
  // instead of the viewport, pinning the modal off-centre.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!exhibitor) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [exhibitor, onClose]);

  if (!mounted) return null;

  const person = exhibitor
    ? [exhibitor.firstName, exhibitor.lastName].filter(Boolean).join(" ").trim() || null
    : null;

  return createPortal(
    <AnimatePresence>
      {exhibitor ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-md dark:bg-[#020617]/70"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`${exhibitor.name} contact details`}
            className="relative w-full max-w-[420px] overflow-hidden rounded-2xl border border-indigo-200/70 bg-white/90 p-5 shadow-[0_30px_80px_-30px_rgba(79,70,229,0.65)] backdrop-blur-2xl dark:border-indigo-500/25 dark:bg-[#0B1220]/90"
          >
            {/* Neon top edge */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/80 to-transparent" />

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 dark:border-[#22304A]">
                  {exhibitor.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={exhibitor.logoUrl} alt="" className="size-full object-contain" />
                  ) : (
                    <span className="text-[13px] font-black uppercase text-indigo-500/50">
                      {exhibitor.name.substring(0, 2)}
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                  Exhibitor contact
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <IconAction
                  href={exhibitor.website || exhibitor.profileUrl || DIRECTORY_FALLBACK}
                  label={exhibitor.website ? "Open official website" : "Open show directory"}
                  tone="neutral"
                >
                  <Globe2 className="size-4" />
                </IconAction>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.06]">
              <DetailRow
                icon={Building2}
                iconClass="text-indigo-500"
                label="Company"
                value={exhibitor.name}
                action={
                  <IconAction
                    href={exhibitor.companyLinkedInUrl}
                    label={`${exhibitor.name} on LinkedIn`}
                    tone="linkedin"
                  >
                    <LinkedInMark className="size-4" />
                  </IconAction>
                }
              />
              <DetailRow
                icon={User}
                iconClass="text-indigo-500"
                label="Contact person"
                value={person}
                action={
                  <IconAction
                    href={exhibitor.personLinkedInUrl}
                    label={person ? `${person} on LinkedIn` : "Person LinkedIn"}
                    tone="linkedin"
                  >
                    <LinkedInMark className="size-4" />
                  </IconAction>
                }
              />
              <DetailRow icon={Briefcase} label="Job title" value={exhibitor.designation} />
              <DetailRow
                icon={Mail}
                iconClass="text-sky-500"
                label="Contact email"
                value={exhibitor.email}
                href={exhibitor.email ? `mailto:${exhibitor.email}` : null}
              />
              <DetailRow
                icon={Phone}
                iconClass="text-emerald-500"
                label="Contact number"
                value={exhibitor.phone}
                href={exhibitor.phone ? `tel:${exhibitor.phone.replace(/\s+/g, "")}` : null}
              />
              <DetailRow icon={MapPin} label="Country" value={exhibitor.country} />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
