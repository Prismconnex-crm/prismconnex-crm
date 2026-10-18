"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
    Briefcase,
    Building2,
    ExternalLink,
    Globe2,
    Linkedin,
    Mail,
    MapPin,
    Phone,
    Users,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BettExhibitorGrid } from "@/components/crm/bett-exhibitor-grid";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { OFFICIAL_DIALOG_CLASS, OfficialPageView } from "@/components/find-shows/official-page-view";
import { closedWebsiteViewer, openWebsiteViewer, type WebsiteViewerState } from "@/lib/exhibitors/website-viewer";
import { exhibitorTabLayout } from "@/lib/exhibitors/tab-layout";
import type { FindShowEvent } from "@/types/find-shows";
import type { Exhibitor } from "@/types/exhibitors";

/**
 * The Exhibitors tab: every event renders BETT's paginated card grid
 * (components/crm/bett-exhibitor-grid.tsx) over its own EventExhibitor rows.
 * BETT's cards open its Companies-page profile; every other event's open the
 * details drawer below.
 */
/** Expected exhibitor counts per event, from the show's published figures. */
export const EXPECTED_EXHIBITORS: Record<string, number> = {
    'BETT SHOW': 316,
};

/** website -> this exhibitor's directory page -> the event's directory root. */
function exhibitorLink(ex: Exhibitor) {
    return ex.website || ex.profileUrl || ex.directoryUrl || undefined;
}

/**
 * Exhibitors tab. Reads the event's imported exhibitors from /api/exhibitors (see lib/exhibitors/crm-sync.ts
 * for how public lists reach it) and renders them as BETT's searchable, sortable, paginated card grid.
 */
export function ExhibitorsPanel({ event }: { event: FindShowEvent }) {
    const layout = exhibitorTabLayout(event);
    if (layout.grid === 'bett') {
        return <BettExhibitorGrid eventSlug={event.slug} expected={EXPECTED_EXHIBITORS[event.name] ?? null} />;
    }
    return <EventExhibitorGrid event={event} inAppViewer={layout.inAppViewer} />;
}

/**
 * BETT's card grid for any other event: a card opens this tab's details drawer (BETT's Companies-page profile
 * is BETT's own page). With the in-app viewer (AAPEX), "View detail" / "Open show directory" opens the page
 * inside Prismconnex; otherwise it opens in a new tab as on BETT. The grid stays mounted underneath both, so
 * closing either returns to the same search, sort, page and scroll position.
 */
function EventExhibitorGrid({ event, inAppViewer }: { event: FindShowEvent; inAppViewer: boolean }) {
    const [detail, setDetail] = useState<Exhibitor | null>(null);
    const [viewer, setViewer] = useState<WebsiteViewerState>(closedWebsiteViewer);
    const openViewer = inAppViewer ? (ex: Exhibitor) => setViewer(openWebsiteViewer(ex)) : undefined;
    return (
        <>
            <BettExhibitorGrid
                eventSlug={event.slug}
                expected={EXPECTED_EXHIBITORS[event.name] ?? null}
                onSelect={setDetail}
                onOpenWebsite={openViewer}
            />
            <ExhibitorDetailPanel
                exhibitor={detail}
                onClose={() => setDetail(null)}
                onOpenWebsite={
                    openViewer
                        ? (ex) => {
                              setDetail(null);
                              openViewer(ex);
                          }
                        : undefined
                }
            />
            {inAppViewer ? (
                <WebsiteViewerDialog eventSlug={event.slug} viewer={viewer} onClose={() => setViewer(closedWebsiteViewer)} />
            ) : null}
        </>
    );
}

/** The exhibitor's page in a sandboxed frame inside Prismconnex, with the external link when it cannot be shown. */
function WebsiteViewerDialog({ eventSlug, viewer, onClose }: { eventSlug: string; viewer: WebsiteViewerState; onClose: () => void }) {
    return (
        <Dialog open={viewer !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
            <DialogContent className={OFFICIAL_DIALOG_CLASS}>
                {viewer ? (
                    <OfficialPageView
                        key={viewer.exhibitorId}
                        slug={eventSlug}
                        target={{ kind: "profile", id: viewer.exhibitorId }}
                        title={viewer.name}
                        checkUrl={`/api/exhibitors/frame?id=${encodeURIComponent(viewer.exhibitorId)}`}
                        openExternally
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

/**
 * Details drawer for one exhibitor. Shows every enriched column the sheet
 * carries; anything the source left blank is rendered as "Not published" rather
 * than guessed at.
 */
function ExhibitorDetailPanel({
    exhibitor,
    onClose,
    onOpenWebsite,
}: {
    exhibitor: Exhibitor | null;
    onClose: () => void;
    /** Set where the event keeps exhibitor pages inside Prismconnex (AAPEX): the main button opens the viewer. */
    onOpenWebsite?: (exhibitor: Exhibitor) => void;
}) {
    // Portalled to <body>: the events tree animates through framer-motion, and a
    // transformed ancestor makes `position: fixed` resolve to that ancestor
    // instead of the viewport — which slid the drawer under the top bar.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // Esc closes, and the page behind must not scroll under the overlay.
    useEffect(() => {
        if (!exhibitor) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [exhibitor, onClose]);

    const groups: { title: string; rows: { label: string; value: string | null | undefined; href?: string | null; icon: typeof Globe2 }[] }[] = exhibitor
        ? [
              {
                  title: 'Company',
                  rows: [
                      { label: 'Exhibitor name', value: exhibitor.name, icon: Building2 },
                      { label: 'Stand number', value: exhibitor.stand, icon: MapPin },
                      { label: 'Official website', value: exhibitor.website?.replace(/^https?:\/\/(www\.)?/, ''), href: exhibitor.website, icon: Globe2 },
                      { label: 'Country', value: exhibitor.country, icon: Globe2 },
                      { label: 'Contact number', value: exhibitor.phone, href: exhibitor.phone ? `tel:${exhibitor.phone.replace(/\s+/g, '')}` : null, icon: Phone },
                      { label: 'Company LinkedIn', value: exhibitor.companyLinkedInUrl?.replace(/^https?:\/\/(www\.)?linkedin\.com\//, 'linkedin.com/'), href: exhibitor.companyLinkedInUrl, icon: Linkedin },
                  ],
              },
              {
                  title: 'Contact',
                  rows: [
                      { label: 'Contact person', value: [exhibitor.firstName, exhibitor.lastName].filter(Boolean).join(' ') || null, icon: Users },
                      { label: 'Job title', value: exhibitor.designation, icon: Briefcase },
                      { label: 'Contact email', value: exhibitor.email, href: exhibitor.email ? `mailto:${exhibitor.email}` : null, icon: Mail },
                      { label: 'Person LinkedIn', value: exhibitor.personLinkedInUrl?.replace(/^https?:\/\/([a-z]{2}\.)?(www\.)?linkedin\.com\//, 'linkedin.com/'), href: exhibitor.personLinkedInUrl, icon: Linkedin },
                      { label: 'Show directory listing', value: exhibitor.profileUrl ? 'Open on the show site' : null, href: exhibitor.profileUrl, icon: ExternalLink },
                  ],
              },
          ]
        : [];

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {exhibitor ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-[100] flex justify-end bg-slate-900/50 backdrop-blur-md dark:bg-[#020617]/70"
                    onClick={onClose}
                >
                    <motion.aside
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 360, damping: 38 }}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={`${exhibitor.name} details`}
                        className="relative flex h-full w-full max-w-[468px] flex-col overflow-hidden border-l border-slate-200 bg-white shadow-[0_0_80px_-12px_rgba(79,70,229,0.35)] dark:border-indigo-500/20 dark:bg-[#0B1220]"
                    >
                        {/* Ambient glow — pure decoration, kept behind the content */}
                        <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-indigo-500/20 blur-3xl dark:bg-indigo-500/25" aria-hidden="true" />
                        <div className="pointer-events-none absolute -left-20 top-40 size-56 rounded-full bg-fuchsia-500/10 blur-3xl dark:bg-fuchsia-500/15" aria-hidden="true" />

                        {/* Identity header — logo, name and stand stay pinned while the record scrolls */}
                        <header className="relative z-10 shrink-0 border-b border-slate-200/80 bg-gradient-to-br from-indigo-50/80 via-white to-white px-6 pb-5 pt-6 dark:border-indigo-500/15 dark:from-indigo-500/10 dark:via-[#0B1220] dark:to-[#0B1220]">
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close exhibitor details"
                                className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
                            >
                                <X className="size-4" />
                            </button>

                            <div className="flex items-start gap-4 pr-10">
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.06, type: 'spring', stiffness: 300, damping: 24 }}
                                    className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-lg ring-1 ring-indigo-500/10 dark:border-[#22304A] dark:bg-white"
                                >
                                    <ExhibitorLogoMark name={exhibitor.name} logoUrl={exhibitor.logoUrl} />
                                </motion.div>

                                <div className="min-w-0 pt-0.5">
                                    <h3 className="text-[19px] font-black leading-tight text-slate-900 dark:text-white">
                                        {exhibitor.name}
                                    </h3>
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        {exhibitor.stand ? (
                                            <span className="rounded-full border border-amber-300/60 bg-amber-50 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300">
                                                Stand {exhibitor.stand}
                                            </span>
                                        ) : null}
                                        {exhibitor.country ? (
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-300">
                                                {exhibitor.country}
                                            </span>
                                        ) : null}
                                        <span className={cn(
                                            'rounded-full border px-2.5 py-0.5 text-[11px] font-bold',
                                            exhibitor.website
                                                ? 'border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300'
                                                : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-400'
                                        )}>
                                            {exhibitor.website ? 'Official site' : 'Directory only'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {onOpenWebsite ? (
                                <button
                                    type="button"
                                    onClick={() => onOpenWebsite(exhibitor)}
                                    className={`w-full ${DETAIL_CTA_CLASS}`}
                                >
                                    <ExternalLink className="size-4 transition-transform group-hover/cta:translate-x-0.5 motion-reduce:transition-none" />
                                    {exhibitor.website ? 'Visit website' : 'Open show directory'}
                                </button>
                            ) : (
                                <a
                                    href={exhibitorLink(exhibitor)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={DETAIL_CTA_CLASS}
                                >
                                    <ExternalLink className="size-4 transition-transform group-hover/cta:translate-x-0.5 motion-reduce:transition-none" />
                                    {exhibitor.website ? 'Visit website' : 'Open show directory'}
                                </a>
                            )}
                        </header>

                        {/* Record — only this scrolls, so the header never leaves the viewport */}
                        <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-8 pt-4">
                            {/* The directory's own description, when it published one. */}
                            {exhibitor.description ? (
                                <section className="mb-5">
                                    <h4 className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                                        About
                                        <span className="h-px flex-1 bg-gradient-to-r from-indigo-500/30 to-transparent" />
                                    </h4>
                                    <p className="text-[12.5px] font-medium leading-relaxed text-slate-600 dark:text-slate-300">{exhibitor.description}</p>
                                </section>
                            ) : null}
                            {groups.map((group, groupIndex) => (
                                <section key={group.title} className={groupIndex ? 'mt-5' : ''}>
                                    <h4 className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                                        {group.title}
                                        <span className="h-px flex-1 bg-gradient-to-r from-indigo-500/30 to-transparent" />
                                    </h4>
                                    <dl className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                                        {group.rows.map((row, rowIndex) => (
                                            <motion.div
                                                key={row.label}
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.08 + (groupIndex * group.rows.length + rowIndex) * 0.02, duration: 0.22 }}
                                                className="grid grid-cols-[136px_1fr] items-start gap-3 py-[7px]"
                                            >
                                                <dt className="flex items-start gap-1.5 pt-px text-[10px] font-bold uppercase leading-[1.35] tracking-[0.04em] text-slate-500 dark:text-slate-400">
                                                    <row.icon className="mt-px size-3 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                                                    <span>{row.label}</span>
                                                </dt>
                                                <dd className="min-w-0 text-[12.5px] font-bold leading-snug text-slate-900 dark:text-white">
                                                    {row.value ? (
                                                        row.href ? (
                                                            <a
                                                                href={row.href}
                                                                target={row.href.startsWith('http') ? '_blank' : undefined}
                                                                rel="noopener noreferrer"
                                                                className="break-words text-indigo-600 decoration-indigo-400/40 underline-offset-2 hover:underline dark:text-indigo-300"
                                                            >
                                                                {row.value}
                                                            </a>
                                                        ) : (
                                                            <span className="break-words">{row.value}</span>
                                                        )
                                                    ) : (
                                                        <span className="text-[11.5px] font-medium italic text-slate-400 dark:text-slate-500">Not published</span>
                                                    )}
                                                </dd>
                                            </motion.div>
                                        ))}
                                    </dl>
                                </section>
                            ))}

                            <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-[10.5px] font-medium leading-relaxed text-slate-500 dark:border-[#22304A] dark:bg-[#111B2E]/60 dark:text-slate-400">
                                Sourced from the show&apos;s official exhibitor directory. Blank fields are not
                                published by the source — nothing here is inferred.
                            </p>
                        </div>
                    </motion.aside>
                </motion.div>
            ) : null}
        </AnimatePresence>,
        document.body
    );
}

/** Logo image sized for the drawer header, with initials as the fallback. */
function ExhibitorLogoMark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
    const [failed, setFailed] = useState(false);
    if (logoUrl && !failed) {
        return (
            <img
                src={logoUrl}
                alt={`${name} logo`}
                className="size-full object-contain"
                onError={() => setFailed(true)}
            />
        );
    }
    return <span className="text-[22px] font-black text-indigo-500">{name.substring(0, 2).toUpperCase()}</span>;
}

const DETAIL_CTA_CLASS =
    'group/cta mt-4 flex h-11 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-[13px] font-black text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.015] active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:scale-100';
