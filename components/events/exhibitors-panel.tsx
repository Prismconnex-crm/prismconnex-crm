"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
    Briefcase,
    Building2,
    ExternalLink,
    Globe2,
    Linkedin,
    Loader2,
    Mail,
    MapPin,
    Phone,
    Search,
    Users,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BettExhibitorGrid } from "@/components/crm/bett-exhibitor-grid";
import type { FindShowEvent } from "@/types/find-shows";
import type { Exhibitor } from "@/types/exhibitors";

/**
 * The Exhibitors tab, lifted out of the old events-section file unchanged: BETT
 * renders the paginated card grid, every other show keeps the vertical list and
 * its details drawer.
 */
/** Expected exhibitor counts per event, from the show's published figures. */
export const EXPECTED_EXHIBITORS: Record<string, number> = {
    'BETT SHOW': 316,
};

/**
 * Events whose Exhibitors tab uses the paginated card grid instead of the
 * shared vertical list. BETT only for now — every other show keeps the list.
 */
const GRID_EXHIBITOR_EVENTS = new Set(['BETT SHOW']);

/** website -> this exhibitor's directory page -> the event's directory root. */
function exhibitorLink(ex: Exhibitor) {
    return ex.website || ex.profileUrl || ex.directoryUrl || undefined;
}

function ExhibitorLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
    const [failed, setFailed] = useState(false);
    return (
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#22304A] dark:bg-[#0B1220]">
            {logoUrl && !failed ? (
                <img
                    src={logoUrl}
                    alt={`${name} logo`}
                    loading="lazy"
                    className="size-full object-contain p-1"
                    onError={() => setFailed(true)}
                />
            ) : (
                <span className="text-[13px] font-black text-indigo-500">
                    {name.substring(0, 2).toUpperCase()}
                </span>
            )}
        </div>
    );
}

/**
 * Exhibitors tab. Reads imported exhibitors from /api/exhibitors and renders a
 * searchable, sortable list. Clicking a row opens the exhibitor's own website,
 * falling back to the source directory page when no official site was published.
 */
export function ExhibitorsPanel({ event }: { event: FindShowEvent }) {
    // BETT gets the card grid; the hooks below only run for the list events.
    if (GRID_EXHIBITOR_EVENTS.has(event.name)) {
        return <BettExhibitorGrid eventSlug={event.slug} expected={EXPECTED_EXHIBITORS[event.name] ?? null} />;
    }
    return <ExhibitorsListPanel event={event} />;
}

/** The original list rendering, kept for every non-grid event. */
function ExhibitorsListPanel({ event }: { event: FindShowEvent }) {
    const [exhibitors, setExhibitors] = useState<Exhibitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'stand'>('name');
    const [detail, setDetail] = useState<Exhibitor | null>(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        fetch(`/api/exhibitors?eventSlug=${encodeURIComponent(event.slug)}`)
            .then((res) => res.json())
            .then((data) => {
                if (!active) return;
                if (data.error) throw new Error(data.error);
                setExhibitors(data.exhibitors ?? []);
            })
            .catch((err) => {
                if (!active) return;
                setError(err instanceof Error ? err.message : 'Failed to load exhibitors');
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [event.slug]);

    const expected = EXPECTED_EXHIBITORS[event.name] ?? null;
    const withSite = useMemo(() => exhibitors.filter((x) => x.website).length, [exhibitors]);

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        const rows = q
            ? exhibitors.filter((x) =>
                  [x.name, x.stand, x.country].filter(Boolean).join(' ').toLowerCase().includes(q)
              )
            : exhibitors;
        return [...rows].sort((a, b) =>
            sortBy === 'stand'
                ? (a.stand ?? 'zzz').localeCompare(b.stand ?? 'zzz', undefined, { numeric: true })
                : a.name.localeCompare(b.name)
        );
    }, [exhibitors, query, sortBy]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Users className="size-5 text-indigo-500" />
                    <h2 className="text-[16px] font-black text-slate-900 dark:text-white">Exhibitors</h2>
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-black text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                        Imported: {exhibitors.length.toLocaleString()}
                    </span>
                    {expected !== null ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-slate-400">
                            Expected: {expected.toLocaleString()}
                        </span>
                    ) : null}
                    {withSite > 0 ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                            Official sites: {withSite.toLocaleString()}
                        </span>
                    ) : null}
                </div>

                {exhibitors.length > 0 ? (
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search exhibitors..."
                                className="h-9 w-[220px] rounded-full border border-slate-200 bg-white pl-9 pr-3 text-[12px] font-medium text-slate-900 outline-none focus:border-indigo-500 dark:border-[#22304A] dark:bg-[#0B1220] dark:text-white"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setSortBy(sortBy === 'name' ? 'stand' : 'name')}
                            className="h-9 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-bold text-slate-600 transition-colors hover:border-indigo-300 dark:border-[#22304A] dark:bg-[#111B2E] dark:text-slate-400"
                        >
                            Sort: {sortBy === 'name' ? 'Name' : 'Stand'}
                        </button>
                    </div>
                ) : null}
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-[13px] font-bold text-slate-500 dark:border-[#22304A] dark:bg-[#111B2E]">
                    <Loader2 className="size-4 animate-spin" />
                    Loading exhibitors...
                </div>
            ) : error ? (
                <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center dark:border-[#22304A] dark:bg-[#111B2E]">
                    <p className="text-[15px] font-black text-slate-900 dark:text-white">Could not load exhibitors</p>
                    <p className="mt-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">{error}</p>
                </div>
            ) : exhibitors.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-slate-200 bg-white py-16 shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
                    <div className="flex size-16 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-500/10">
                        <Users className="size-8 text-indigo-500" />
                    </div>
                    <div className="max-w-lg space-y-2 text-center">
                        <p className="text-[17px] font-black text-slate-900 dark:text-white">No Exhibitors Imported Yet</p>
                        <p className="text-[13px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                            Run the exhibitor import for this event, or visit the official site to browse the directory.
                        </p>
                    </div>
                    {event.website ? (
                        <a
                            href={event.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-11 items-center gap-2.5 rounded-full bg-indigo-600 px-8 text-[13px] font-black text-white shadow-xl shadow-indigo-500/20 transition-all hover:scale-[1.03] dark:bg-indigo-500"
                        >
                            <ExternalLink className="size-4" />
                            Visit Official Website
                        </a>
                    ) : null}
                </div>
            ) : (
                <>
                    <div className="max-h-[620px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E]">
                        <ul className="divide-y divide-slate-100 dark:divide-[#22304A]">
                            {visible.map((ex) => (
                                <li
                                    key={ex.id}
                                    className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-[#16233A]"
                                >
                                    {/* Row body opens the enriched details panel; the website link
                                        is a separate anchor so one click still reaches the site. */}
                                    <button
                                        type="button"
                                        onClick={() => setDetail(ex)}
                                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                                    >
                                        <ExhibitorLogo name={ex.name} logoUrl={ex.logoUrl} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[14px] font-black text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                                                {ex.name}
                                            </p>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                                {ex.stand ? (
                                                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-[#0B1220]">
                                                        Stand {ex.stand}
                                                    </span>
                                                ) : null}
                                                {ex.country ? <span>{ex.country}</span> : null}
                                                {ex.website ? (
                                                    <span className="truncate text-indigo-500/80 dark:text-indigo-300/80">
                                                        {ex.website.replace(/^https?:\/\/(www\.)?/, '')}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 dark:text-slate-500">No official site published</span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                    <a
                                        href={exhibitorLink(ex)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={ex.website ? `Open ${ex.name} official website` : 'No official site published - opens the show directory'}
                                        className="flex shrink-0 items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-[12px] font-bold text-indigo-500 transition-all hover:border-indigo-200 hover:bg-indigo-50 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10 md:opacity-0 md:group-hover:opacity-100"
                                    >
                                        Visit website
                                        <ExternalLink className="size-3.5" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Showing {visible.length.toLocaleString()} of {exhibitors.length.toLocaleString()} imported exhibitors
                        {withSite > 0 ? `, ${withSite.toLocaleString()} with an official website` : ''}.
                        Click a row for the full record; blank fields are simply not published by the source.
                    </p>
                </>
            )}

            <ExhibitorDetailPanel exhibitor={detail} onClose={() => setDetail(null)} />
        </div>
    );
}

/**
 * Details drawer for one exhibitor. Shows every enriched column the sheet
 * carries; anything the source left blank is rendered as "Not published" rather
 * than guessed at.
 */
function ExhibitorDetailPanel({ exhibitor, onClose }: { exhibitor: Exhibitor | null; onClose: () => void }) {
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

                            <a
                                href={exhibitorLink(exhibitor)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group/cta mt-4 flex h-11 items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-[13px] font-black text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.015] active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:scale-100"
                            >
                                <ExternalLink className="size-4 transition-transform group-hover/cta:translate-x-0.5 motion-reduce:transition-none" />
                                {exhibitor.website ? 'Visit website' : 'Open show directory'}
                            </a>
                        </header>

                        {/* Record — only this scrolls, so the header never leaves the viewport */}
                        <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-8 pt-4">
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
                                Sourced from the show directory and the BETT 2027 detail sheet. Blank fields are
                                not published by either source — nothing here is inferred.
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
