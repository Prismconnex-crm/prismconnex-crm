import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Calendar,
    ChevronDown,
    Search,
    MapPin,
    ArrowLeft,
    ImageIcon,
    ExternalLink,
    Building2,
    Check,
    X,
    Filter,
    Download,
    Mail,
    Plus,
    MoreVertical,
    FileText,
    TrendingUp,
    Heart,
    Target,
    Save,
    Ticket,
    Activity,
    Globe2,
    Sparkles,
    CheckCircle2,
    Hotel,
    Plane,
    TrainFront,
    Church,
    ArrowRight,
    Users,
    Share2,
    Loader2,
    Phone,
    Linkedin,
    Briefcase,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { findShowEvents, findShowsCategories, findShowsRegions, countryStatsByRegion, findShowMonthOptions } from "@/lib/find-shows/catalog";
import type { FindShowEvent, FindShowsRegion, FindShowsCategory } from "@/types/find-shows";
import type { WorkspacePreferences } from "@/types";
import type { Exhibitor } from "@/types/exhibitors";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { EventMap, googleMapsUrl } from "./event-map";

const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

interface EventsSectionProps {
    eventId?: string;
    preferences?: WorkspacePreferences;
    mode?: 'all' | 'target';
}

/** Expected exhibitor counts per event, from the show's published figures. */
const EXPECTED_EXHIBITORS: Record<string, number> = {
    'BETT SHOW': 316,
};

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
function ExhibitorsPanel({ event }: { event: FindShowEvent }) {
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

/**
 * Event logo beside the title. Falls back to the event initials when the source
 * has no logo, or when the logo URL 404s.
 */
function EventLogo({ event }: { event: FindShowEvent }) {
    const [failed, setFailed] = useState(false);
    const logo = event.seedAsset.logoUrl;

    return (
        <div className="mt-1 size-20 shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-white p-2 shadow-2xl dark:border-[#111B2E] dark:bg-[#0B1220]">
            {logo && !failed ? (
                <img
                    src={logo}
                    alt={`${event.name} logo`}
                    className="size-full object-contain"
                    onError={() => setFailed(true)}
                />
            ) : (
                <div className="flex size-full items-center justify-center text-xl font-black text-indigo-500">
                    {event.name.substring(0, 2).toUpperCase()}
                </div>
            )}
        </div>
    );
}

/**
 * Overview hero. Prefers the venue photograph (a real, full-resolution image);
 * falls back to a clean gradient rather than upscaling the small event logo,
 * which would look blurry.
 */
function EventHero({ event }: { event: FindShowEvent }) {
    const [failed, setFailed] = useState(false);
    const photo = event.seedAsset.bannerUrl ?? null;
    const showPhoto = photo && !failed;

    return (
        <div className="relative h-[300px] w-full overflow-hidden bg-slate-100 dark:bg-[#0B1220]">
            {showPhoto ? (
                <img
                    src={photo}
                    alt={`${event.venue || event.city} venue`}
                    loading="lazy"
                    className="size-full object-cover"
                    onError={() => setFailed(true)}
                />
            ) : (
                <div className="size-full bg-gradient-to-br from-indigo-500/25 via-violet-500/10 to-cyan-500/20 flex flex-col items-center justify-center gap-3">
                    {event.seedAsset.logoUrl ? (
                        // Logos are small; render at natural size inside a card
                        // instead of stretching them across the hero.
                        <div className="rounded-2xl bg-white dark:bg-[#0B1220] p-4 shadow-lg">
                            <img src={event.seedAsset.logoUrl} alt={event.name} className="max-h-16 max-w-[220px] object-contain" />
                        </div>
                    ) : (
                        <ImageIcon className="size-16 text-indigo-500/30" />
                    )}
                    <p className="text-[12px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        {event.city}{event.country ? `, ${event.country}` : ''}
                    </p>
                </div>
            )}
            {showPhoto ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white dark:from-[#111B2E] to-transparent" />
            ) : null}
        </div>
    );
}

export function EventsSection({ eventId, preferences, mode = 'all' }: EventsSectionProps) {
    // Look up active event in the full catalog
    const activeEvent = useMemo(() => 
        eventId ? findShowEvents.find((e) => e.slug === eventId) : null,
        [eventId]
    );

    if (activeEvent) {
        return <EventDetailView event={activeEvent} />;
    }

    return <EventListView mode={mode} />;
}

// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// EVENT DETAIL VIEW (NEW)
// ----------------------------------------------------------------------

function EventDetailView({ event }: { event: FindShowEvent }) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('Overview');

    return (
        <div className="relative isolate min-h-screen space-y-6 max-w-[1600px] mx-auto pb-12">
            {/* Ambient background glows */}
            <div className="absolute top-0 -left-20 size-[500px] bg-indigo-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
            <div className="absolute top-40 -right-20 size-[400px] bg-cyan-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

            {/* Header & Breadcrumbs */}
            <div className="flex flex-col gap-4">
                <nav className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    <button 
                        onClick={() => router.push('/app/events')}
                        className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                        Events
                    </button>
                    <ChevronDown className="size-3 -rotate-90 opacity-40" />
                    <span className="text-slate-900 dark:text-slate-200">Event Intelligence</span>
                </nav>
                
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-start gap-5">
                        <EventLogo event={event} />
                        <div className="space-y-1">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-[32px] font-black tracking-tight text-slate-900 dark:text-white leading-tight">{event.name}</h1>
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-[10px] font-black text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 uppercase tracking-wider">
                                    Verified Insight
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-[14px] font-bold text-slate-500 dark:text-slate-400">
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="size-4 text-indigo-500" />
                                    {event.city}, {event.country}
                                </div>
                                <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="size-4 text-indigo-500" />
                                    {event.displayDate}
                                </div>
                                <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                <span className="text-indigo-600 dark:text-indigo-400">{event.primaryCategory}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                         <button className="flex items-center gap-2 h-10 px-5 rounded-full border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#0B1220] text-[13px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#16233A] transition-all shadow-sm">
                            <Save className="size-4" />
                            Track Event
                        </button>
                        <a
                            href={event.website || event.seedAsset.eventseyeUrl || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={event.website ? `Go to ${event.name} official website` : 'Official site not published - opens the source listing'}
                            className="flex items-center justify-center gap-2 h-10 px-8 rounded-full bg-indigo-600 dark:bg-indigo-500 text-[13px] font-black text-white shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            <Ticket className="size-4" />
                            Buy Official Tickets
                        </a>
                    </div>
                </div>
            </div>

            {/* Quick Stats Toolbar */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-[#22304A] bg-white/50 dark:bg-[#111B2E]/50 backdrop-blur-md flex flex-wrap items-center gap-x-8 gap-y-4">
                <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                        <Globe2 className="size-5 text-indigo-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Region</p>
                        <p className="text-[13px] font-black text-slate-900 dark:text-white leading-none">{event.region}</p>
                    </div>
                </div>

                <div className="w-px h-8 bg-slate-200 dark:bg-[#22304A] hidden md:block" />

                <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                        <Activity className="size-5 text-indigo-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Frequency</p>
                        <p className="text-[13px] font-black text-slate-900 dark:text-white leading-none">{event.frequency}</p>
                    </div>
                </div>

                <div className="w-px h-8 bg-slate-200 dark:bg-[#22304A] hidden md:block" />

                <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                        <Users className="size-5 text-indigo-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Organizer</p>
                        <p className="text-[13px] font-black text-slate-900 dark:text-white leading-none truncate max-w-[200px]">{event.organizer}</p>
                    </div>
                </div>

                <div className="flex-1" />
            </div>

            {/* Main Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#22304A]">
                {['Overview', 'Location & Venue', 'Exhibitors', 'Notes'].map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "px-6 py-4 text-[14px] font-black transition-all relative",
                                isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-slate-200"
                            )}
                        >
                            {tab}
                            {isActive && (
                                <motion.div 
                                    layoutId="event-tab-marker"
                                    className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 z-10"
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Content Display — Tab Switched */}
            {activeTab === 'Exhibitors' ? (
                <ExhibitorsPanel event={event} />
            ) : (
                /* ---- DEFAULT: OVERVIEW + SIDEBAR ---- */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-8 space-y-6">
                        <div className="rounded-3xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] overflow-hidden shadow-xl">
                            <EventHero event={event} />
                            <div className="p-8 space-y-8">
                                <div>
                                    <h3 className="text-[20px] font-black text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                        <FileText className="size-5 text-indigo-500" />
                                        Executive Overview
                                    </h3>
                                    <div className="space-y-4 text-[15px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                        {/* Editorial blurb from the source listing, when present. */}
                                        {event.description ? <p>{event.description}.</p> : null}
                                        <p>
                                            {event.name} takes place {event.displayDate} in {event.city}
                                            {event.country ? `, ${event.country}` : ''}
                                            {event.venue && event.venue !== 'Venue to be announced' ? ` at ${event.venue}` : ''}.
                                            It is a {event.primaryCategory.toLowerCase()} event serving the {event.region} region
                                            {event.duration ? `, running over ${event.duration}` : ''}.
                                        </p>
                                        <p>
                                            The show runs {event.frequency === 'unknown' ? 'on a recurring basis' : `${event.frequency}`}
                                            {event.organizer ? `, organised by ${event.organizer}` : ''}. Use the location panel to plan
                                            travel, and track the event to keep its exhibitors and dates in your workspace.
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-5 rounded-2xl border border-slate-100 dark:border-[#22304A] bg-slate-50/50 dark:bg-[#0B1220]/50">
                                        <h4 className="text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">Venue Details</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3"><Hotel className="size-4 text-indigo-500 mt-0.5" /><span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{event.venue}</span></div>
                                            <div className="flex items-start gap-3"><MapPin className="size-4 text-indigo-500 mt-0.5" /><span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{event.city}, {event.country}</span></div>
                                        </div>
                                    </div>
                                    <div className="p-5 rounded-2xl border border-slate-100 dark:border-[#22304A] bg-slate-50/50 dark:bg-[#0B1220]/50">
                                        <h4 className="text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4">Logistics</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3"><Globe2 className="size-4 text-indigo-500 mt-0.5" />{event.website ? (<a href={event.website} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-indigo-500 hover:underline truncate">{event.website.replace(/^https?:\/\/(www\.)?/, '')}</a>) : (<span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Official website not published</span>)}</div>
                                            <div className="flex items-start gap-3"><Mail className="size-4 text-indigo-500 mt-0.5" />{event.email ? (<a href={`mailto:${event.email}`} title={`Contact email for ${event.name}`} className="text-[13px] font-bold text-indigo-500 hover:underline truncate">{event.email}</a>) : (<span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Contact email not published</span>)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-4 space-y-6">
                        <div className="rounded-3xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] p-6 shadow-xl space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[15px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Global Location</h3>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500"><Sparkles className="size-3" /><span className="text-[9px] font-black uppercase">Live Geo</span></div>
                            </div>
                            <EventMap locationName={`${event.venue}, ${event.city}, ${event.country}`} cityKey={event.seedCity} className="h-[240px] shadow-2xl" />
                            <div className="space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#22304A]"><span className="text-[12px] font-bold text-slate-500">Venue Distance</span><span className="text-[12px] font-black text-slate-900 dark:text-white">Calculating...</span></div>
                                <a
                                    href={googleMapsUrl(`${event.venue}, ${event.city}, ${event.country}`)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`Open ${event.venue !== '?' ? event.venue : event.city} in Google Maps`}
                                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#0B1220] text-[12px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#111B2E] transition-colors flex items-center justify-center gap-2"
                                ><ExternalLink className="size-4" />Open in Google Maps</a>
                            </div>
                        </div>
                        <div className="rounded-3xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-gradient-to-br dark:from-indigo-500/[0.05] dark:to-transparent p-6 shadow-xl space-y-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4"><Sparkles className="size-6 text-indigo-500 opacity-20" /></div>
                            <h3 className="text-[15px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Next Actions</h3>
                            <div className="space-y-3">
                                {[{ icon: Users, label: "Import Exhibitors to CRM" },{ icon: Activity, label: "Generate Trend Analysis" },{ icon: Share2, label: "Create Team Collaboration" }].map((item, i) => (
                                    <button key={i} className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-[#0B1220]/60 border border-slate-200 dark:border-white/5 flex items-center gap-3 hover:translate-x-1 transition-all group">
                                        <item.icon className="size-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                                        <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200 text-left">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                            <button className="w-full h-12 rounded-2xl bg-indigo-600 dark:bg-indigo-500 text-white font-black text-[13px] shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 mt-4 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                <TrendingUp className="size-4" /> Analyze Trade Show ROI
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


// ----------------------------------------------------------------------
// EXHIBITOR DETAIL VIEW
// ----------------------------------------------------------------------

function ExhibitorDetailView({ exhibitor, event, onBack }: { exhibitor: Exhibitor; event: FindShowEvent; onBack: () => void }) {
    const [exTab, setExTab] = useState('About');

    return (
        <div className="relative isolate min-h-screen space-y-6 max-w-[1600px] mx-auto pb-12">
            <div className="absolute top-0 -left-20 size-[500px] bg-purple-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                <button onClick={() => { onBack(); }} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Events</button>
                <ChevronDown className="size-3 -rotate-90 opacity-40" />
                <button onClick={onBack} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate max-w-[200px]">{event.name}</button>
                <ChevronDown className="size-3 -rotate-90 opacity-40" />
                <span className="text-slate-900 dark:text-slate-200 truncate max-w-[200px]">{exhibitor.name}</span>
            </nav>

            {/* Hero */}
            <div className="rounded-3xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] overflow-hidden shadow-xl">
                <div className="h-[200px] w-full bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-cyan-500/10 dark:from-indigo-500/10 dark:via-purple-500/5 dark:to-cyan-500/5 relative flex items-center justify-center">
                    {exhibitor.logoUrl ? (
                        <img src={exhibitor.logoUrl} alt="" className="max-h-24 max-w-[200px] object-contain" />
                    ) : (
                        <span className="text-[64px] font-black text-indigo-500/20 uppercase">{exhibitor.name.substring(0, 3)}</span>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#111B2E] to-transparent via-transparent" />
                </div>

                <div className="p-8 -mt-6 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="space-y-2">
                            <h1 className="text-[28px] font-black text-slate-900 dark:text-white">{exhibitor.name}</h1>
                            <p className="text-[13px] font-bold text-slate-500 dark:text-slate-400">Exhibiting at {event.name}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            {exhibitor.stand && (
                                <span className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-[13px] font-black text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 uppercase tracking-wider">
                                    <MapPin className="size-4" /> Stand {exhibitor.stand}
                                </span>
                            )}
                            {exhibitor.website && (
                                <a href={exhibitor.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 h-10 px-6 rounded-full bg-indigo-600 text-[13px] font-bold text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all">
                                    <Globe2 className="size-4" /> Visit Website
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Exhibitor Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#22304A]">
                {['About', 'Location'].map((tab) => {
                    const isActive = exTab === tab;
                    return (
                        <button key={tab} onClick={() => setExTab(tab)} className={cn("px-6 py-4 text-[14px] font-black transition-all relative", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200")}>
                            {tab}
                            {isActive && <motion.div layoutId="ex-tab-marker" className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 z-10" />}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {exTab === 'About' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 space-y-6">
                        <div className="rounded-2xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] p-8 shadow-sm">
                            <h3 className="text-[18px] font-black text-slate-900 dark:text-white mb-4">About {exhibitor.name}</h3>
                            <p className="text-[14px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                {exhibitor.description || `${exhibitor.name} is exhibiting at ${event.name} (${event.displayDate}) in ${event.city}, ${event.country}. Visit their stand${exhibitor.stand ? ` (${exhibitor.stand})` : ''} to learn more about their products and services.`}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] p-8 shadow-sm">
                            <h3 className="text-[18px] font-black text-slate-900 dark:text-white mb-4">Event Context</h3>
                            <div className="grid grid-cols-2 gap-4 text-[13px]">
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-100 dark:border-[#22304A]">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Event</p>
                                    <p className="font-bold text-slate-900 dark:text-white">{event.name}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-100 dark:border-[#22304A]">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dates</p>
                                    <p className="font-bold text-slate-900 dark:text-white">{event.displayDate}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-100 dark:border-[#22304A]">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Venue</p>
                                    <p className="font-bold text-slate-900 dark:text-white">{event.venue}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B1220] border border-slate-100 dark:border-[#22304A]">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Industry</p>
                                    <p className="font-bold text-slate-900 dark:text-white">{event.primaryCategory}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-4">
                        <div className="rounded-2xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] p-6 shadow-sm space-y-4">
                            <h3 className="text-[14px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Quick Info</h3>
                            {exhibitor.stand && <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-[#22304A]"><span className="text-[12px] font-bold text-slate-500">Stand</span><span className="text-[12px] font-black text-amber-600 dark:text-amber-400">{exhibitor.stand}</span></div>}
                            {exhibitor.country && <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-[#22304A]"><span className="text-[12px] font-bold text-slate-500">Country</span><span className="text-[12px] font-black text-slate-900 dark:text-white">{exhibitor.country}</span></div>}
                            {exhibitor.website && (
                                <a href={exhibitor.website} target="_blank" rel="noopener noreferrer" className="w-full h-10 rounded-xl bg-indigo-600 text-white text-[12px] font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-all mt-2">
                                    <ExternalLink className="size-3.5" /> Official Website
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] p-8 shadow-sm space-y-6">
                    <h3 className="text-[18px] font-black text-slate-900 dark:text-white">Location &amp; Venue</h3>
                    <div className="space-y-3 text-[14px] font-medium text-slate-600 dark:text-slate-300">
                        <p><span className="font-bold text-slate-900 dark:text-white">Venue:</span> {event.venue}</p>
                        <p><span className="font-bold text-slate-900 dark:text-white">City:</span> {event.city}, {event.country}</p>
                        {exhibitor.stand && <p><span className="font-bold text-slate-900 dark:text-white">Stand / Booth:</span> {exhibitor.stand}</p>}
                    </div>
                    <EventMap locationName={`${event.venue}, ${event.city}, ${event.country}`} cityKey={event.seedCity} className="h-[300px] shadow-2xl rounded-xl" />
                </div>
            )}

            {/* Back Button */}
            <button onClick={onBack} className="flex items-center gap-2 text-[13px] font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                <ArrowLeft className="size-4" /> Back to Exhibitor List
            </button>
        </div>
    );
}

// ----------------------------------------------------------------------
// EVENT LIST VIEW (EXISTING)
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// TICKET BOOKING & TRAVEL VIEW (NEW)
// ----------------------------------------------------------------------

function TicketBookingView({ event, onBack }: { event: typeof findShowEvents[0], onBack: () => void }) {
    const [activeTab, setActiveTab] = useState('Overview');

    return (
        <div className="relative isolate min-h-screen space-y-6 max-w-[1600px] mx-auto pb-12 px-4">
            {/* Ambient Background Glows */}
            <div className="absolute -top-24 -left-20 size-[600px] bg-indigo-500/10 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none" />
            <div className="absolute top-1/2 -right-20 size-[500px] bg-cyan-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
            
            {/* Header */}
            <div className="flex flex-col gap-4 mb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-[40px] font-bold tracking-tight text-white leading-tight mb-2">{event.name}</h1>
                        <p className="text-[18px] text-slate-400">
                            {event.city}, {event.country} • 12–15 May 2026
                        </p>
                    </div>
                </div>
            </div>

            {/* Component Tabs */}
            <div className="flex items-center gap-2 border-b border-white/5 mt-4">
                {['Overview', 'Sessions', 'Speakers', 'Attendees', 'Settings'].map((tab) => {
                    const isActive = tab === activeTab;
                    return (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "px-6 py-4 text-[16px] font-bold transition-all relative",
                                isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
                            )}
                        >
                            {tab}
                            {isActive && (
                                <motion.div 
                                    layoutId="booking-tab-line"
                                    className="absolute bottom-[-1px] left-0 right-0 h-1 bg-cyan-400 z-10 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                                />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start pt-6">
                
                {/* TICKETS CARD (Left) */}
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="xl:col-span-4 rounded-[24px] border border-white/10 bg-[#111B2E]/60 backdrop-blur-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group"
                >
                    {/* Animated Glow Accent */}
                    <div className="absolute -top-10 -right-10 size-40 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all duration-1000" />
                    
                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <h3 className="text-[20px] font-bold text-slate-300">Event Detail — Tickets</h3>
                    </div>

                    <div className="space-y-10">
                        {/* Price Display */}
                        <div className="relative">
                            <div className="flex items-baseline gap-1">
                                <span className="text-[48px] font-black text-white leading-none">€149</span>
                                <span className="text-slate-400 text-[18px] font-medium">starting</span>
                            </div>
                            
                            {/* Partner Offer Badge */}
                            <div className="absolute top-2 right-0 flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 backdrop-blur-md">
                                <div className="size-5 rounded-md bg-cyan-400/20 flex items-center justify-center">
                                    <Users className="size-3 text-cyan-400" />
                                </div>
                                <span className="text-cyan-400 text-[13px] font-bold">Partner offer</span>
                            </div>
                        </div>

                        {/* Promo Input */}
                        <div className="space-y-3">
                            <label className="text-[14px] font-bold text-slate-400 ml-1">Promo available</label>
                            <div className="relative h-[56px] w-full rounded-xl border border-white/10 bg-[#0B1220]/60 flex items-center px-4">
                                <span className="text-cyan-400 font-mono text-[16px] font-bold tracking-wider">PRISM10</span>
                                <div className="absolute right-4 size-8 rounded-lg bg-white/5 flex items-center justify-center text-cyan-400/60">
                                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                </div>
                            </div>
                            <p className="text-[12px] text-slate-500 ml-1 italic">Promo codes shown only if configured.</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-4 pt-4">
                            <a
                                href={event.website || event.seedAsset.eventseyeUrl || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full h-14 rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-600 text-white font-black text-[18px] shadow-[0_0_30px_rgba(79,70,229,0.5)] flex items-center justify-center gap-3 group transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Ticket className="size-5" />
                                Buy Official Tickets
                                <ArrowRight className="size-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                            </a>
                            <button className="w-full h-14 rounded-full border border-white/10 bg-white/5 text-slate-200 font-bold text-[16px] flex items-center justify-center gap-2 hover:bg-white/10 transition-all">
                                <FileText className="size-5 opacity-60" />
                                Copy Promo Code
                            </button>
                        </div>

                        <p className="text-center text-[12px] text-slate-500 font-medium">Checkout happens on provider site.</p>
                    </div>
                </motion.div>

                {/* TRAVEL MODE PANEL (Right) */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="xl:col-span-8 rounded-[32px] border border-white/10 bg-[#111B2E]/40 backdrop-blur-[40px] p-10 shadow-2xl relative min-h-[600px] flex flex-col items-center justify-center overflow-hidden"
                >
                    {/* Panel "Triangle" Pointer */}
                    <div className="absolute left-[-12px] top-[140px] size-[24px] bg-[#111B2E] border-l border-t border-white/10 rotate-[-45deg] z-10 hidden xl:block" />

                    <div className="text-center mb-12 relative z-20">
                        <h2 className="text-[44px] font-black text-white mb-4 tracking-tight drop-shadow-sm">Attendee Travel Mode</h2>
                        <p className="text-slate-400 text-[16px] max-w-[600px] mx-auto leading-relaxed">
                            Attendees can buy tickets, view promo availability, and plan their visit with nearby essentials — all in one place.
                        </p>
                    </div>

                    {/* Nearby Essentials Interior Card */}
                    <div className="w-full max-w-[860px] rounded-[24px] border border-white/5 bg-[#0B1220]/60 p-6 relative z-20 backdrop-blur-md">
                        <div className="flex items-center gap-2 mb-6 ml-2">
                            <h4 className="text-[18px] font-bold text-white">Nearby Essentials — Map + List</h4>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                            {/* Custom Map Mockup */}
                            <div className="relative aspect-[4/3] rounded-[20px] bg-slate-900 border border-white/5 overflow-hidden group shadow-2xl">
                                <div className="absolute inset-0 bg-[#0B1220] opacity-50" />
                                {/* Grid Pattern */}
                                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                                
                                {/* Connection Lines SVG */}
                                <svg className="absolute inset-0 size-full opacity-20" viewBox="0 0 400 300">
                                    <path d="M100 80 L200 150 L300 100" stroke="white" strokeWidth="1" fill="none" />
                                    <path d="M200 150 L120 220" stroke="white" strokeWidth="1" fill="none" />
                                    <path d="M200 150 L280 250" stroke="white" strokeWidth="1" fill="none" />
                                </svg>

                                {/* Nodes */}
                                <div className="absolute top-[80px] left-[100px] size-4 rounded-full bg-cyan-400/40 animate-pulse flex items-center justify-center">
                                    <div className="size-2 rounded-full bg-cyan-400" />
                                </div>
                                <div className="absolute bottom-[80px] left-[120px] size-4 rounded-full bg-purple-400/40 animate-pulse flex items-center justify-center transition-delay-300">
                                    <div className="size-2 rounded-full bg-purple-400" />
                                </div>
                                <div className="absolute top-[100px] right-[100px] size-4 rounded-full bg-cyan-400/40 animate-pulse flex items-center justify-center transition-delay-700">
                                    <div className="size-2 rounded-full bg-cyan-400" />
                                </div>

                                {/* Center Event Tag */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
                                    <div className="px-4 py-2 rounded-lg bg-indigo-600/90 text-[12px] font-bold text-white border border-indigo-400/30 shadow-2xl whitespace-nowrap">
                                        Berlin Tech Expo 2026
                                    </div>
                                    <div className="size-10 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20 animate-bounce">
                                        <MapPin className="size-6 text-indigo-400" />
                                    </div>
                                </div>
                            </div>

                            {/* List of Essentials */}
                            <div className="space-y-4">
                                {[
                                    { icon: <div className="size-10 rounded-xl bg-purple-600/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-600/30 transition-all"><Hotel className="size-5" /></div>, label: "Hotels", desc: "Hotel Berlin Plaza — 0.8 km", price: "91" },
                                    { icon: <div className="size-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-600/30 transition-all"><Plane className="size-5" /></div>, label: "Airport", desc: "Berlin Airport (BER) — 18 km", code: "km" },
                                    { icon: <div className="size-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600/30 transition-all"><TrainFront className="size-5" /></div>, label: "Railway", desc: "Berlin Central Station — 1.2 km" },
                                    { icon: <div className="size-10 rounded-xl bg-pink-600/20 flex items-center justify-center text-pink-400 group-hover:bg-pink-600/30 transition-all"><Church className="size-5" /></div>, label: "Worship places", desc: "City Church / Mosque / Temple — 2.0 km" },
                                ].map((ess, i) => (
                                    <motion.div 
                                        key={ess.label} 
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.4 + i * 0.1 }}
                                        className="flex items-center gap-4 group cursor-pointer p-2 rounded-xl hover:bg-white/[0.03] transition-all"
                                    >
                                        {ess.icon}
                                        <div className="flex-1 flex flex-col">
                                            <span className="text-white text-[15px] font-bold leading-tight group-hover:text-cyan-400 transition-colors">{ess.label}</span>
                                            <span className="text-slate-400 text-[13px] font-medium opacity-80">{ess.desc}</span>
                                        </div>
                                        {ess.price && <div className="text-slate-500 font-mono text-[16px] group-hover:text-indigo-400 transition-colors"><Hotel className="size-4" /></div>}
                                        {ess.code && <div className="size-6 rounded-full border border-white/10 flex items-center justify-center text-[10px] text-slate-500 font-bold group-hover:border-cyan-400/50 transition-colors">{ess.code}</div>}
                                    </motion.div>
                                ))}
                                <p className="text-[12px] text-slate-500 pt-2 ml-1">Availability and results may vary by provider.</p>
                            </div>
                        </div>
                    </div>

                    {/* Features Checklist */}
                    <div className="absolute bottom-10 right-10 flex flex-col gap-2 relative z-20">
                         {[
                            "Buy Ticket entry points (partner offers)",
                            "Promo codes shown only if configured",
                            "Nearby hotels, airport, railway, worship places",
                            "Localized language/time formatting"
                         ].map((f, i) => (
                             <div key={i} className="flex items-center gap-3 text-slate-300">
                                 <CheckCircle2 className="size-4 text-cyan-400" />
                                 <span className="text-[14px] font-bold">{f}</span>
                             </div>
                         ))}
                    </div>
                </motion.div>
            </div>
            
            {/* Back Button Floating */}
            <motion.button 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
                onClick={onBack}
                className="fixed bottom-10 left-10 h-14 w-14 rounded-full bg-white/5 border border-white/10 text-slate-400 flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.4)] z-[100] backdrop-blur-xl"
            >
                <ChevronDown className="size-8 rotate-90" />
            </motion.button>
        </div>
    );
}

// ----------------------------------------------------------------------
// New Local Components for Advanced Filtering (Replica of Find-Shows)
// ----------------------------------------------------------------------

function RegionMegaMenuPopover({
  region,
  filters,
  onFiltersChange,
}: {
  region: FindShowsRegion;
  filters: any;
  onFiltersChange: (nextFilters: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = filters.region === region;

  let label: string = region;
  if (isActive && filters.country) {
    label = `${region}: ${filters.country}`;
  }

  return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'group inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12px] font-bold transition-all duration-200',
              isActive
                ? 'border-indigo-500/60 bg-indigo-50/50 text-indigo-600 shadow-sm dark:border-indigo-400/40 dark:bg-indigo-400/10 dark:text-indigo-300'
                : 'border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:text-slate-900 dark:hover:text-white'
            )}
          >
            <span className="truncate">{label}</span>
            <ChevronDown className="size-3 shrink-0 opacity-60 group-data-[state=open]:rotate-180" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="z-[100] w-[90vw] max-w-[800px] rounded-[16px] border border-slate-200 dark:border-[#22304A] bg-white/95 dark:bg-[#0B1220]/95 p-5 shadow-2xl backdrop-blur-xl outline-none"
        >
        {region === 'All Regions' ? (
           <div className="space-y-4">
             <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
               <h3 className="text-[16px] font-black text-slate-900 dark:text-white">Global Regions</h3>
               <button
                 onClick={() => {
                   onFiltersChange({ ...filters, region: 'All Regions', country: '' });
                   setOpen(false);
                 }}
                 className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors uppercase tracking-wider"
               >
                 Reset
               </button>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {findShowsRegions.filter(r => r !== 'All Regions').map(subRegion => (
                     <button
                       key={subRegion}
                       onClick={() => {
                         onFiltersChange({ ...filters, region: subRegion, country: '' });
                         setOpen(false);
                       }}
                       className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 p-4 transition-all hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:bg-white dark:hover:bg-white/10"
                     >
                       <Globe2 className="size-5 text-indigo-500" />
                       <span className="text-[12px] font-bold text-slate-900 dark:text-white">{subRegion}</span>
                     </button>
                ))}
             </div>
           </div>
        ) : (
           <div className="space-y-4">
             <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
               <h3 className="text-[16px] font-black text-slate-900 dark:text-white">{region} Countries</h3>
               <button
                 onClick={() => {
                   onFiltersChange({ ...filters, region, country: '' });
                   setOpen(false);
                 }}
                 className="px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold rounded-full transition-all hover:bg-indigo-600 hover:text-white"
               >
                 View All {region}
               </button>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
               {countryStatsByRegion[region]?.map(stat => (
                 <button
                   key={stat.country}
                   onClick={() => {
                     onFiltersChange({ ...filters, region, country: stat.country });
                     setOpen(false);
                   }}
                   className={cn(
                     "flex items-center gap-2 rounded-lg border border-transparent p-2 text-left transition-all hover:bg-slate-100 dark:hover:bg-white/5",
                     isActive && filters.country === stat.country && "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 font-bold"
                   )}
                 >
                   <span className="text-[16px]">{stat.flag}</span>
                   <span className="truncate text-[12px] text-slate-900 dark:text-white">{stat.country}</span>
                 </button>
               ))}
             </div>
           </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Month-Year dropdown (August 2026 → July 2027), sourced from the catalogue. */
function MonthYearFilterPopover({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const options = [
    { label: 'All Dates', value: 'All Dates', count: undefined as number | undefined },
    ...findShowMonthOptions,
  ];
  const selected = options.find(o => o.value === value) ?? options[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12px] font-bold transition-all",
          value !== 'All Dates'
            ? "border-indigo-500/60 bg-indigo-50/50 text-indigo-600 shadow-sm dark:border-indigo-400/40 dark:bg-indigo-400/10 dark:text-indigo-300"
            : "border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:text-slate-900 dark:hover:text-white"
        )}>
          <Calendar className="size-3 shrink-0 opacity-70" />
          <span className="truncate">{selected.label}</span>
          <ChevronDown className="size-3 shrink-0 opacity-60 transition-transform" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-0 rounded-xl overflow-hidden border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#0B1220]">
        <Command>
          <CommandInput placeholder="Search month..." className="h-9 text-[12px]" />
          <CommandList>
            <CommandEmpty className="py-2 text-center text-[12px] text-slate-500">No month found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="px-3 py-2 text-[12px] font-bold cursor-pointer"
                >
                  <span className="flex-1">{option.label}</span>
                  {typeof option.count === 'number' ? (
                    <span className="mr-2 text-[11px] font-semibold text-slate-400">{option.count.toLocaleString()}</span>
                  ) : null}
                  {value === option.value && <Check className="size-3.5 text-indigo-600" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function CategoryFilterPopover({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const categories = [
    // `value` stays the FindShowsCategory sentinel the filter logic compares
    // against; only the label the user reads changed to "Industries".
    { label: 'All Industries', value: 'All Categories' },
    { label: 'Technology', value: 'Technology' },
    { label: 'Manufacturing', value: 'Manufacturing' },
    { label: 'Healthcare', value: 'Healthcare' },
    { label: 'Energy', value: 'Energy' },
    { label: 'Retail', value: 'Retail' },
    { label: 'Finance', value: 'Finance' },
  ];

  const selected = categories.find(c => c.value === value) || categories[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12px] font-bold transition-all",
          value !== 'All Categories' 
            ? "border-indigo-500/60 bg-indigo-50/50 text-indigo-600 shadow-sm dark:border-indigo-400/40 dark:bg-indigo-400/10 dark:text-indigo-300"
            : "border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:text-slate-900 dark:hover:text-white"
        )}>
          <span className="truncate">{selected.label}</span>
          <ChevronDown className="size-3 shrink-0 opacity-60 data-[state=open]:rotate-180 transition-transform" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[240px] p-0 rounded-xl overflow-hidden border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#0B1220]">
        <Command>
          <CommandInput placeholder="Search industry..." className="h-9 text-[12px]" />
          <CommandList>
            <CommandEmpty className="py-2 text-center text-[12px] text-slate-500">No industry found.</CommandEmpty>
            <CommandGroup>
              {categories.map((cat) => (
                <CommandItem
                  key={cat.value}
                  value={cat.value}
                  onSelect={() => {
                    onChange(cat.value);
                    setOpen(false);
                  }}
                  className="px-3 py-2 text-[12px] font-bold cursor-pointer"
                >
                  <span className="flex-1">{cat.label}</span>
                  {value === cat.value && <Check className="size-3.5 text-indigo-600" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ----------------------------------------------------------------------
function EventListView({ mode = 'all' }: { mode?: 'all' | 'target' }) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [filters, setFilters] = useState({
        region: 'All Regions' as FindShowsRegion,
        country: '',
        category: 'All Categories' as FindShowsCategory,
        monthYear: 'All Dates',
    });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Liked & Target State (Local persistence)
    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    const [targetIds, setTargetIds] = useState<Set<string>>(new Set());
    const [showOnlyLiked, setShowOnlyLiked] = useState(false);

    useEffect(() => {
        const savedLiked = localStorage.getItem('pc_liked_events');
        const savedTarget = localStorage.getItem('pc_target_events');
        if (savedLiked) setLikedIds(new Set(JSON.parse(savedLiked)));
        if (savedTarget) setTargetIds(new Set(JSON.parse(savedTarget)));
    }, []);

    const toggleLike = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setLikedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            localStorage.setItem('pc_liked_events', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const toggleTarget = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setTargetIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            localStorage.setItem('pc_target_events', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    // Advanced Filter Logic
    const filteredEvents = useMemo(() => {
        let results = findShowEvents;

        // Mode Filter (Target Events)
        if (mode === 'target') {
            results = results.filter(e => targetIds.has(e.slug));
        }

        // Liked Filter
        if (showOnlyLiked) {
            results = results.filter(e => likedIds.has(e.slug));
        }

        // Search Query (Name, City, Venue)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            results = results.filter(e => e.searchText.includes(query));
        }

        // Region Filter
        if (filters.region !== 'All Regions') {
            results = results.filter(e => e.region === filters.region);
        }

        // Country Filter
        if (filters.country) {
            results = results.filter(e => e.country === filters.country);
        }

        // Category Filter
        if (filters.category !== 'All Categories') {
            results = results.filter(e => e.categories.includes(filters.category as any));
        }

        // Month-Year Filter (e.g. "August 2026")
        if (filters.monthYear !== 'All Dates') {
            results = results.filter(e => e.monthYear === filters.monthYear);
        }

        return results;
    }, [searchQuery, filters, mode, targetIds, likedIds, showOnlyLiked]);

    // Pagination Calculation
    const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
    const paginatedEvents = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredEvents.slice(start, start + itemsPerPage);
    }, [filteredEvents, currentPage]);

    const [selectedId, setSelectedId] = useState<string | null>(null);

    const activeEvent = useMemo(() => {
        return findShowEvents.find((e) => e.slug === selectedId) || paginatedEvents[0];
    }, [selectedId, paginatedEvents]);

    // Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filters]);

    return (
        <div className="space-y-5 w-full pb-8">
            {/* Header Section */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2"
            >
                <div>
                    <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                        <Calendar className="size-6 text-indigo-500" />
                        {mode === 'target' ? 'Target Events' : 'Events Explorer'}
                    </h1>
                    <p className="text-[13px] text-slate-600 dark:text-slate-400">
                        {mode === 'target' ? 'Focused tracking for high-priority shows' : '9,771+ premium trade show intelligence nodes'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="h-9 px-4 rounded-[8px] bg-indigo-600 dark:bg-indigo-500 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors">
                        Add New Event
                    </button>
                </div>
            </motion.div>

            {/* Filter Bar */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="flex flex-col gap-5 rounded-[12px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] p-4 shadow-sm"
            >
                {/* Search Row */}
                <div className="relative w-full">
                    <Search className="absolute left-3.5 top-1/2 size-[15px] -translate-y-1/2 text-slate-400 dark:text-[#9CA3AF] opacity-70" />
                    <input
                        type="text"
                        placeholder="Search events by name, city, or venue..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-11 rounded-[10px] border border-slate-200 dark:border-[#22304A] bg-slate-50/50 dark:bg-[#0B1220]/50 pl-10 pr-4 text-[13px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#9CA3AF] focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 focus:bg-white dark:focus:bg-[#0B1220] transition-all font-semibold outline-none shadow-inner"
                    />
                </div>
                
                {/* Filters Row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* ❤️ Events Filter */}
                        <button 
                            onClick={() => setShowOnlyLiked(!showOnlyLiked)}
                            className={cn(
                                "inline-flex items-center gap-2 h-9 px-4 rounded-full border transition-all font-bold text-[12px]",
                                showOnlyLiked 
                                    ? "bg-red-500 text-white border-transparent shadow-lg shadow-red-500/20" 
                                    : "bg-white dark:bg-[#111B2E] border-slate-200 dark:border-[#22304A] text-slate-600 dark:text-slate-400 hover:border-red-300 dark:hover:border-red-500/50"
                            )}
                        >
                            <Heart className={cn("size-3.5 transition-transform", showOnlyLiked ? "fill-white scale-110" : "text-red-500")} />
                            Events
                        </button>

                        <div className="w-px h-4 bg-slate-200 dark:bg-[#22304A] mx-1" />

                        {findShowsRegions.map((region) => (
                            <RegionMegaMenuPopover
                                key={region}
                                region={region}
                                filters={filters}
                                onFiltersChange={(next) => setFilters(next)}
                            />
                        ))}
                        
                        <CategoryFilterPopover
                            value={filters.category}
                            onChange={(cat) => setFilters({ ...filters, category: cat as any })}
                        />

                        <MonthYearFilterPopover
                            value={filters.monthYear}
                            onChange={(monthYear) => setFilters({ ...filters, monthYear })}
                        />
                    </div>

                    { (filters.region !== 'All Regions' || filters.country !== '' || filters.category !== 'All Categories' || filters.monthYear !== 'All Dates' || showOnlyLiked) && (
                        <button
                            onClick={() => {
                                setFilters({ region: 'All Regions', country: '', category: 'All Categories', monthYear: 'All Dates' });
                                setShowOnlyLiked(false);
                            }}
                            className="flex items-center gap-2 h-9 px-4 rounded-full border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 text-red-600 dark:text-red-400 text-[12px] font-bold hover:bg-red-100 dark:hover:bg-red-500/10 transition-all shadow-sm"
                        >
                            <X className="size-3.5" />
                            Clear filters
                        </button>
                    )}
                </div>
            </motion.div>

            {/* Results Table - Full Width */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="flex flex-col rounded-[12px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] overflow-hidden shadow-sm"
            >
                {/* Table Header Row */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-[#22304A] bg-slate-50/10">
                    <div className="flex items-center gap-2.5">
                       <h2 className="text-[14px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                           {mode === 'target' ? 'Targeted Events' : 'Event Catalog'}
                       </h2>
                       <span className="rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-black text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                           {filteredEvents.length.toLocaleString()} events
                       </span>
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[500px]">
                    <table className="w-full text-left text-[12px]">
                        <thead className="bg-slate-50 dark:bg-[#0B1220] sticky top-0 z-10">
                            <tr className="border-b border-slate-200 dark:border-[#22304A] text-slate-500 dark:text-[#9CA3AF]">
                                <th className="px-4 py-4 font-black uppercase tracking-[0.1em] text-[10px] w-8 text-center bg-slate-50/50 dark:bg-[#0B1220]/50">❤️</th>
                                <th className="px-4 py-4 font-black uppercase tracking-[0.1em] text-[10px] w-16 text-center">Logo</th>
                                <th className="px-4 py-4 font-black uppercase tracking-[0.1em] text-[10px]">Event Details</th>
                                <th className="px-4 py-4 font-black uppercase tracking-[0.1em] text-[10px]">Location</th>
                                <th className="px-4 py-4 font-black uppercase tracking-[0.1em] text-[10px] w-32">Dates</th>
                                <th className="px-4 py-4 font-black uppercase tracking-[0.1em] text-[10px] hidden md:table-cell w-32">Industry</th>
                                <th className="px-4 py-4 font-black uppercase tracking-[0.1em] text-[10px] text-right">Action</th>
                            </tr>
                        </thead>
                        <motion.tbody className="divide-y divide-slate-100 dark:divide-[#22304A]">
                            {paginatedEvents.map((event) => {
                                const isLiked = likedIds.has(event.slug);
                                const isTargeted = targetIds.has(event.slug);
                                return (
                                    <motion.tr
                                        key={event.slug}
                                        className={cn(
                                            "group cursor-pointer transition-all duration-200 hover:bg-slate-50 dark:hover:bg-[#16233A]/40",
                                            isTargeted && "bg-indigo-50/20 dark:bg-indigo-500/5 shadow-inner"
                                        )}
                                        onClick={() => router.push(`/app/events/${event.slug}`)}
                                    >
                                        <td className="px-4 py-4 text-center">
                                            <button 
                                                onClick={(e) => toggleLike(e, event.slug)}
                                                className="group/heart relative p-1 transition-transform active:scale-75"
                                            >
                                                <Heart 
                                                    className={cn(
                                                        "size-5 transition-all duration-300",
                                                        isLiked 
                                                            ? "fill-red-500 text-red-500 scale-110 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" 
                                                            : "text-slate-300 dark:text-[#22304A] group-hover/heart:text-red-400"
                                                    )} 
                                                />
                                            </button>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <div className="size-11 rounded-xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#0B1220] p-1.5 shadow-glow-sm overflow-hidden flex items-center justify-center mx-auto transition-transform group-hover:scale-105">
                                                {event.seedAsset.logoUrl ? (
                                                    <img src={event.seedAsset.logoUrl} alt="" className="size-full object-contain" />
                                                ) : (
                                                    <span className="text-[14px] font-black text-indigo-500/40 uppercase">
                                                        {event.name.substring(0, 2)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-[14px] font-black text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {event.name}
                                                </span>
                                                <span className="text-[11px] font-bold text-slate-500 dark:text-[#9CA3AF] line-clamp-1 uppercase tracking-tight">
                                                    {event.organizer}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-[12px] text-slate-600 dark:text-[#E5E7EB] font-bold">
                                                <MapPin className="size-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                                {event.city}, {event.country}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-[12px] text-slate-600 dark:text-[#E5E7EB] font-black">
                                                <Calendar className="size-3.5 text-indigo-500/60" />
                                                {event.displayDate}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 hidden md:table-cell">
                                            <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#0B1220] text-[10px] font-black text-slate-600 dark:text-[#9CA3AF] border border-slate-200 dark:border-[#22304A] uppercase tracking-wider">
                                                {event.primaryCategory}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <button 
                                                onClick={(e) => toggleTarget(e, event.slug)}
                                                className={cn(
                                                    "h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] transition-all relative overflow-hidden",
                                                    isTargeted 
                                                        ? "bg-slate-100 dark:bg-[#0B1220] text-indigo-600 dark:text-indigo-400 border border-indigo-200/50" 
                                                        : "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95"
                                                )}
                                            >
                                                {isTargeted ? (
                                                    <span className="flex items-center gap-1.5 focus:outline-none">
                                                        <Check className="size-3" /> Targeted
                                                    </span>
                                                ) : (
                                                    "Add To target events"
                                                )}
                                            </button>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </motion.tbody>
                    </table>
                </div>

                {/* Table Footer */}
                <div className="px-4 py-4 border-t border-slate-200 dark:border-[#22304A] bg-slate-50/50 dark:bg-[#0B1220]/50 flex items-center justify-between text-[11px] font-black text-slate-500 dark:text-[#9CA3AF] uppercase tracking-widest">
                    <span>Showing {paginatedEvents.length} of {filteredEvents.length.toLocaleString()} events</span>
                    <div className="flex items-center gap-3">
                         <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="h-9 px-4 rounded-xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] text-slate-600 dark:text-[#E5E7EB] hover:bg-slate-50 dark:hover:bg-[#16233A] disabled:opacity-50 transition-all font-black shadow-sm"
                         >
                            Prev
                         </button>
                         <div className="flex items-center gap-2 text-[14px]">
                            <span className="text-indigo-600 dark:text-indigo-400 font-black">{currentPage}</span>
                            <span className="opacity-20">/</span>
                            <span>{totalPages}</span>
                         </div>
                         <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="h-9 px-4 rounded-xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] text-slate-600 dark:text-[#E5E7EB] hover:bg-slate-50 dark:hover:bg-[#16233A] disabled:opacity-50 transition-all font-black shadow-sm"
                         >
                            Next
                         </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// ----------------------------------------------------------------------
export default EventsSection;