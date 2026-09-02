"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Activity,
    Calendar,
    ChevronDown,
    ExternalLink,
    FileText,
    Globe2,
    Hotel,
    ImageIcon,
    Mail,
    MapPin,
    Save,
    Share2,
    Sparkles,
    Ticket,
    TrendingUp,
    Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { EventMap, googleMapsUrl } from '@/components/crm/event-map';
import { ExhibitorsPanel } from '@/components/events/exhibitors-panel';
import type { FindShowEvent } from '@/types/find-shows';

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
                <div className="flex size-full items-center justify-center text-[22px] font-black text-indigo-500">
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
                /* The ref catches a load that already failed before React
                   attached onError — several eventseye banners 404, and without
                   it the broken-image icon sat where the gradient fallback
                   should be. */
                <img
                    src={photo}
                    alt={`${event.venue || event.city} venue`}
                    loading="lazy"
                    className="size-full object-cover"
                    ref={(node) => {
                        if (node && node.complete && node.naturalWidth === 0) setFailed(true);
                    }}
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
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
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

const EVENT_TABS = ['Overview', 'Location & Venue', 'Exhibitors', 'Notes'] as const;

export function EventDetailView({ event }: { event: FindShowEvent }) {
    const router = useRouter();
    // Tab lives in the URL (?tab=) so a refresh lands back where the user was —
    // which is what makes the Exhibitors grid's own ?page/?pageSize meaningful.
    const [activeTab, setActiveTab] = useState<string>('Overview');

    // Read after mount, not during render: the server has no URL search string,
    // so seeding state from it directly would be a hydration mismatch.
    useEffect(() => {
        const fromUrl = new URLSearchParams(window.location.search).get('tab');
        if (fromUrl && EVENT_TABS.includes(fromUrl as (typeof EVENT_TABS)[number])) setActiveTab(fromUrl);
    }, []);

    // replaceState, not router.push: switching tabs must not re-navigate the app.
    const selectTab = (tab: string) => {
        setActiveTab(tab);
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (tab === 'Overview') params.delete('tab');
        else params.set('tab', tab);
        if (tab !== 'Exhibitors') {
            params.delete('page');
            params.delete('pageSize');
            params.delete('q');
            params.delete('sort');
        }
        const search = params.toString();
        window.history.replaceState(null, '', search ? `${window.location.pathname}?${search}` : window.location.pathname);
    };

    return (
        <div className="relative isolate min-h-screen space-y-6 max-w-[1600px] mx-auto pb-12">
            {/* Ambient background glows */}
            <div className="absolute top-0 -left-20 size-[500px] bg-indigo-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
            <div className="absolute top-40 -right-20 size-[400px] bg-cyan-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

            {/* Header & Breadcrumbs */}
            <div className="flex flex-col gap-4">
                <nav className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
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
                                <h1 className="text-[22px] font-black leading-tight tracking-tight text-slate-900 dark:text-white">{event.name}</h1>
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                                    Verified Insight
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
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
                            className="flex items-center justify-center gap-2 h-10 px-8 rounded-full bg-indigo-600 dark:bg-indigo-500 text-[13px] font-bold text-white shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
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
                        <p className="mb-1 leading-none text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Region</p>
                        <p className="text-[13px] font-bold leading-none text-slate-900 dark:text-white">{event.region}</p>
                    </div>
                </div>

                <div className="w-px h-8 bg-slate-200 dark:bg-[#22304A] hidden md:block" />

                <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                        <Activity className="size-5 text-indigo-500" />
                    </div>
                    <div>
                        <p className="mb-1 leading-none text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Frequency</p>
                        <p className="text-[13px] font-bold leading-none text-slate-900 dark:text-white">{event.frequency}</p>
                    </div>
                </div>

                <div className="w-px h-8 bg-slate-200 dark:bg-[#22304A] hidden md:block" />

                <div className="flex items-center gap-3">
                    <div className="size-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                        <Users className="size-5 text-indigo-500" />
                    </div>
                    <div>
                        <p className="mb-1 leading-none text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Organizer</p>
                        <p className="max-w-[200px] truncate text-[13px] font-bold leading-none text-slate-900 dark:text-white">{event.organizer}</p>
                    </div>
                </div>

                <div className="flex-1" />
            </div>

            {/* Main Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#22304A]">
                {EVENT_TABS.map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                        <button 
                            key={tab}
                            onClick={() => selectTab(tab)}
                            className={cn(
                                "px-6 py-4 text-[13px] font-bold transition-all relative",
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
                                    <h3 className="mb-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                                        <FileText className="size-5 text-indigo-500" />
                                        Executive Overview
                                    </h3>
                                    <div className="space-y-4 text-[13px] font-medium leading-relaxed text-slate-700 dark:text-slate-300">
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
                                        <h4 className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Venue Details</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3"><Hotel className="size-4 text-indigo-500 mt-0.5" /><span className="text-[13px] font-bold leading-snug text-slate-900 dark:text-white">{event.venue}</span></div>
                                            <div className="flex items-start gap-3"><MapPin className="size-4 text-indigo-500 mt-0.5" /><span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">{event.city}, {event.country}</span></div>
                                        </div>
                                    </div>
                                    <div className="p-5 rounded-2xl border border-slate-100 dark:border-[#22304A] bg-slate-50/50 dark:bg-[#0B1220]/50">
                                        <h4 className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Logistics</h4>
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3"><Globe2 className="size-4 text-indigo-500 mt-0.5" />{event.website ? (<a href={event.website} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-indigo-500 hover:underline truncate">{event.website.replace(/^https?:\/\/(www\.)?/, '')}</a>) : (<span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Official website not published</span>)}</div>
                                            <div className="flex items-start gap-3"><Mail className="size-4 text-indigo-500 mt-0.5" />{event.email ? (<a href={`mailto:${event.email}`} title={`Contact email for ${event.name}`} className="text-[13px] font-bold text-indigo-500 hover:underline truncate">{event.email}</a>) : (<span className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Contact email not published</span>)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-4 space-y-6">
                        <div className="rounded-3xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] p-6 shadow-xl space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Global Location</h3>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500"><Sparkles className="size-3" /><span className="text-[9px] font-bold uppercase tracking-[0.1em]">Live Geo</span></div>
                            </div>
                            <EventMap locationName={`${event.venue}, ${event.city}, ${event.country}`} cityKey={event.seedCity} className="h-[240px] shadow-2xl" />
                            <div className="space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#22304A]"><span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Venue Distance</span><span className="text-[13px] font-bold leading-snug text-slate-900 dark:text-white">Calculating...</span></div>
                                <a
                                    href={googleMapsUrl(`${event.venue}, ${event.city}, ${event.country}`)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`Open ${event.venue !== '?' ? event.venue : event.city} in Google Maps`}
                                    className="w-full h-10 rounded-xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#0B1220] text-[13px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#111B2E] transition-colors flex items-center justify-center gap-2"
                                ><ExternalLink className="size-4" />Open in Google Maps</a>
                            </div>
                        </div>
                        <div className="rounded-3xl border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-gradient-to-br dark:from-indigo-500/[0.05] dark:to-transparent p-6 shadow-xl space-y-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4"><Sparkles className="size-6 text-indigo-500 opacity-20" /></div>
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Next Actions</h3>
                            <div className="space-y-3">
                                {[{ icon: Users, label: "Import Exhibitors to CRM" },{ icon: Activity, label: "Generate Trend Analysis" },{ icon: Share2, label: "Create Team Collaboration" }].map((item, i) => (
                                    <button key={i} className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-[#0B1220]/60 border border-slate-200 dark:border-white/5 flex items-center gap-3 hover:translate-x-1 transition-all group">
                                        <item.icon className="size-4 text-indigo-500 group-hover:scale-110 transition-transform" />
                                        <span className="text-[13px] font-bold leading-snug text-slate-900 dark:text-white text-left">{item.label}</span>
                                    </button>
                                ))}
                            </div>
                            <button className="w-full h-12 rounded-2xl bg-indigo-600 dark:bg-indigo-500 text-white text-[13px] font-bold shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 mt-4 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                <TrendingUp className="size-4" /> Analyze Trade Show ROI
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
