import { useState, useMemo, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Calendar,
    ChevronDown,
    MapPin,
    ArrowLeft,
    ImageIcon,
    ExternalLink,
    FileText,
    TrendingUp,
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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { findShowEvents } from '@/lib/find-shows/catalog';
import type { FindShowEvent } from '@/types/find-shows';
import type { WorkspacePreferences } from '@/types';
import type { Exhibitor } from '@/types/exhibitors';
import { cn } from '@/lib/utils';
import { EventsFilterSidebar } from '@/components/events/events-filter-sidebar';
import { EventsAiSearch } from '@/components/events/events-ai-search';
import { EventsResultsTable } from '@/components/events/events-results-table';
import { buildEventFilterChips, removeEventFilterChip } from '@/lib/events/chips';
import {
    computeEventFacets,
    filterEventList,
    parseEventQueryState,
    serializeEventQueryState,
    type EventQueryState,
} from '@/lib/events/filters';
import { emptyEventFilters, type EventAnswerRow, type EventFilters } from '@/types/events';
import { EventMap } from './event-map';

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
                        <div className="size-20 rounded-2xl border-2 border-white dark:border-[#111B2E] bg-white dark:bg-[#0B1220] p-2 shadow-2xl overflow-hidden shrink-0 mt-1">
                            {event.seedAsset.logoUrl ? (
                                <img src={event.seedAsset.logoUrl} alt="" className="size-full object-contain" />
                            ) : (
                                <div className="size-full flex items-center justify-center text-xl font-black text-indigo-500">
                                    {event.name.substring(0, 2)}
                                </div>
                            )}
                        </div>
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
                            href={event.website}
                            target="_blank"
                            rel="noopener noreferrer"
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

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <div className="size-2 rounded-full bg-emerald-500" />
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Synchronized via Eventseye intelligence</span>
                </div>
            </div>

            {/* Main Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#22304A]">
                {['Overview', 'Intelligence', 'Location & Venue', 'Exhibitors', 'Notes'].map((tab) => {
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
                /* ---- EXHIBITORS TAB — Direct Official Link ---- */
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <Users className="size-5 text-indigo-500" />
                        <h2 className="text-[16px] font-black text-slate-900 dark:text-white">Exhibitors</h2>
                    </div>
                    <div className="flex flex-col items-center justify-center py-16 gap-6 rounded-2xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] shadow-sm">
                        <div className="size-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                            <Users className="size-8 text-indigo-500" />
                        </div>
                        <div className="text-center space-y-2 max-w-lg">
                            <p className="text-[17px] font-black text-slate-900 dark:text-white">Exhibitor Data Not Yet Available</p>
                            <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">The exhibitor list for this event could not be automatically imported. Visit the official website to view exhibitors.</p>
                        </div>
                        <a
                            href={event.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 h-11 px-8 rounded-full bg-indigo-600 dark:bg-indigo-500 text-[13px] font-black text-white shadow-xl shadow-indigo-500/20 hover:scale-[1.03] active:scale-[0.97] transition-all"
                        >
                            <ExternalLink className="size-4" />
                            Visit Official Website
                        </a>
                    </div>
                </div>
            ) : (
                /* ---- DEFAULT: OVERVIEW + SIDEBAR ---- */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-8 space-y-6">
                        <div className="rounded-3xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] overflow-hidden shadow-xl">
                            <div className="h-[300px] w-full bg-slate-100 dark:bg-[#0B1220] relative">
                                {event.seedAsset.bannerUrl ? (
                                    <img src={event.seedAsset.bannerUrl} alt="" className="size-full object-cover opacity-90" />
                                ) : (
                                    <div className="size-full bg-gradient-to-br from-indigo-500/20 to-purple-500/10 flex items-center justify-center">
                                        <ImageIcon className="size-20 text-indigo-500/10" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#111B2E] to-transparent via-transparent" />
                            </div>
                            <div className="p-8 space-y-8">
                                <div>
                                    <h3 className="text-[20px] font-black text-slate-900 dark:text-white mb-4 flex items-center gap-3">
                                        <FileText className="size-5 text-indigo-500" />
                                        Executive Overview
                                    </h3>
                                    <div className="space-y-4 text-[15px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                        <p>{event.name} is a premier global event scheduled for {event.displayDate} in {event.city}. As a core gathering for the {event.primaryCategory} industry, it brings together key decision-makers and innovators from across the {event.region} region.</p>
                                        <p>The event is professionally managed by {event.organizer} and occurs on a {event.frequency} basis, ensuring consistent opportunities for growth, networking, and technology exchange.</p>
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
                                            <div className="flex items-start gap-3"><Globe2 className="size-4 text-indigo-500 mt-0.5" /><a href={event.website} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-indigo-500 hover:underline truncate">{event.website?.replace(/^https?:\/\/(www\.)?/, '')}</a></div>
                                            <div className="flex items-start gap-3"><CheckCircle2 className="size-4 text-emerald-500 mt-0.5" /><span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">Official Registration Active</span></div>
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
                            <EventMap locationName={`${event.venue}, ${event.city}, ${event.country}`} className="h-[240px] shadow-2xl" />
                            <div className="space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#22304A]"><span className="text-[12px] font-bold text-slate-500">Venue Distance</span><span className="text-[12px] font-black text-slate-900 dark:text-white">Calculating...</span></div>
                                <button className="w-full h-10 rounded-xl border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#0B1220] text-[12px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"><ExternalLink className="size-4" />Open in Google Maps</button>
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
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</p>
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
                    <EventMap locationName={`${event.venue}, ${event.city}, ${event.country}`} className="h-[300px] shadow-2xl rounded-xl" />
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
                                href={event.website}
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
// EVENT LIST VIEW — two-column Companies-style layout
// ----------------------------------------------------------------------

const PAGE_SIZE = 25;
/** How many rows the answering model is allowed to see. */
const ANSWER_ROW_LIMIT = 40;

function readSlugSet(key: string): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set();
    } catch {
        return new Set();
    }
}

function EventListView({ mode = 'all' }: { mode?: 'all' | 'target' }) {
    // Filter state is read from — and written back to — the URL, so a search is
    // shareable and the AI panel and the left rail read the same source.
    const [queryState, setQueryState] = useState<EventQueryState>(() => ({
        filters: emptyEventFilters(),
        search: '',
    }));
    // The URL is read after mount rather than in the initializer above: parsing
    // it during render would have the server produce an unfiltered list and the
    // client a filtered one, which is a hydration mismatch.
    const [isHydrated, setIsHydrated] = useState(false);
    const [page, setPage] = useState(1);

    const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
    const [targetIds, setTargetIds] = useState<Set<string>>(new Set());

    // The question behind the current result set, and the grounded answer to it.
    const [question, setQuestion] = useState<string | null>(null);
    const [answer, setAnswer] = useState<string | null>(null);
    const [isAnswering, setIsAnswering] = useState(false);

    useEffect(() => {
        setQueryState(parseEventQueryState(window.location.search));
        setLikedIds(readSlugSet('pc_liked_events'));
        setTargetIds(readSlugSet('pc_target_events'));
        setIsHydrated(true);
    }, []);

    // history.replaceState rather than router.replace: this only needs to keep
    // the address bar shareable, and avoids re-running the RSC payload on every
    // checkbox click. Skipped until the URL has been read, so the first paint
    // cannot blank out an incoming shared link.
    useEffect(() => {
        if (!isHydrated) return;
        const query = serializeEventQueryState(queryState);
        window.history.replaceState(null, '', `${window.location.pathname}${query}`);
    }, [queryState, isHydrated]);

    const toggleLike = (slug: string) => {
        setLikedIds((prev) => {
            const next = new Set(prev);
            if (next.has(slug)) next.delete(slug);
            else next.add(slug);
            localStorage.setItem('pc_liked_events', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const toggleTarget = (slug: string) => {
        setTargetIds((prev) => {
            const next = new Set(prev);
            if (next.has(slug)) next.delete(slug);
            else next.add(slug);
            localStorage.setItem('pc_target_events', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    // The Target Events route filters the catalog down before anything else, so
    // facet counts and the assistant's answer both reflect that subset.
    const baseEvents = useMemo(
        () => (mode === 'target' ? findShowEvents.filter((e) => targetIds.has(e.slug)) : findShowEvents),
        [mode, targetIds]
    );

    const filteredEvents = useMemo(
        () => filterEventList(baseEvents, queryState.filters, queryState.search, likedIds),
        [baseEvents, queryState, likedIds]
    );

    const facets = useMemo(
        () => computeEventFacets(baseEvents, queryState.filters, queryState.search, likedIds),
        [baseEvents, queryState, likedIds]
    );

    const pageCount = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount);
    const pagedEvents = useMemo(
        () => filteredEvents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
        [filteredEvents, safePage]
    );

    // Answer the user's question from the rows that actually matched. Runs after
    // filtering, and re-runs if the filters are then adjusted by hand.
    useEffect(() => {
        if (!question) return;

        const controller = new AbortController();
        setIsAnswering(true);

        const rows: EventAnswerRow[] = filteredEvents.slice(0, ANSWER_ROW_LIMIT).map((event) => ({
            name: event.name,
            organizer: event.organizer === '?' ? '' : event.organizer,
            city: event.city,
            country: event.country,
            dates: event.displayDate,
            category: event.primaryCategory,
        }));

        fetch('/api/ai/event-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, totalMatched: filteredEvents.length, rows }),
            signal: controller.signal,
        })
            .then((response) => (response.ok ? response.json() : { answer: null }))
            .then((data: { answer?: string | null }) => {
                setAnswer(typeof data.answer === 'string' ? data.answer : null);
                setIsAnswering(false);
            })
            .catch((error) => {
                if ((error as Error).name === 'AbortError') return;
                // The table is already on screen; a missing summary is not worth
                // an error state.
                setAnswer(null);
                setIsAnswering(false);
            });

        return () => controller.abort();
    }, [question, filteredEvents]);

    const applyQueryState = useCallback((next: EventQueryState, asked: string | null) => {
        setQueryState(next);
        setPage(1);
        if (asked !== null) {
            setQuestion(asked);
            setAnswer(null);
        }
    }, []);

    const updateFilters = (filters: EventFilters) => {
        setQueryState((prev) => ({ ...prev, filters }));
        setPage(1);
    };

    const updateSearch = (search: string) => {
        setQueryState((prev) => ({ ...prev, search }));
        setPage(1);
    };

    const clearAll = () => {
        setQueryState({ filters: emptyEventFilters(), search: '' });
        setPage(1);
        setQuestion(null);
        setAnswer(null);
    };

    // Emptying the compact box drops the question, but leaves filters the user
    // set by hand in the rail — those still have results worth showing.
    const clearQuery = () => {
        setQueryState((prev) => ({ ...prev, search: '' }));
        setPage(1);
        setQuestion(null);
        setAnswer(null);
    };

    const removeChip = (chipId: string) => {
        setQueryState((prev) => removeEventFilterChip(prev.filters, prev.search, chipId));
        setPage(1);
    };

    const chips = buildEventFilterChips(queryState.filters, queryState.search);

    // The hero and the results share one slot. Anything narrowing the catalog —
    // a typed question or a single filter — means the rows are what the user
    // came for, so the pitch collapses to a one-line bar. Target Events is a
    // curated list rather than a search, so it skips the hero entirely.
    const isSearchActive = mode === 'target' || chips.length > 0 || question !== null;

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-5 pb-8">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-start justify-between gap-4 py-2 sm:flex-row sm:items-center"
            >
                <div>
                    <h1 className="mb-1 flex items-center gap-2 text-[24px] font-bold tracking-tight text-slate-900 dark:text-white">
                        <Calendar className="size-6 text-indigo-500" />
                        {mode === 'target' ? 'Target Events' : 'Events Explorer'}
                    </h1>
                    <p className="text-[13px] text-slate-600 dark:text-slate-400">
                        {mode === 'target'
                            ? 'Focused tracking for high-priority shows'
                            : `${findShowEvents.length.toLocaleString()} trade shows — filter them, or just ask`}
                    </p>
                </div>
                <button className="h-9 rounded-[8px] bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400">
                    Add New Event
                </button>
            </motion.div>

            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[340px_1fr]">
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.05 }}
                    className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]"
                >
                    <EventsFilterSidebar
                        filters={queryState.filters}
                        search={queryState.search}
                        facets={facets}
                        resultCount={filteredEvents.length}
                        onFiltersChange={updateFilters}
                        onSearchChange={updateSearch}
                        onClear={clearAll}
                    />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                    className="min-w-0"
                >
                    <AnimatePresence mode="wait" initial={false}>
                        {isSearchActive ? (
                            <motion.div
                                key="events-results"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                // The panel owns its scroll: the bar and chips
                                // stay pinned while the rows run under them,
                                // and the page keeps its single scrollbar.
                                className="flex flex-col overflow-y-auto rounded-[16px] border border-slate-200 bg-white shadow-sm dark:border-[#22304A] dark:bg-[#111B2E] xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]"
                            >
                                <EventsAiSearch
                                    variant="compact"
                                    filters={queryState.filters}
                                    search={queryState.search}
                                    question={question}
                                    onApply={applyQueryState}
                                    onRemoveChip={removeChip}
                                    onClearAll={clearAll}
                                    onClearQuery={clearQuery}
                                    answer={answer}
                                    isAnswering={isAnswering}
                                />

                                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-[#22304A]">
                                    <span className="text-[13px] font-bold text-slate-900 dark:text-white">
                                        {filteredEvents.length.toLocaleString()}{' '}
                                        <span className="font-semibold text-slate-500 dark:text-[#9CA3AF]">
                                            {filteredEvents.length === 1 ? 'event' : 'events'}
                                        </span>
                                    </span>
                                    {/* The empty state carries its own reset, so this
                                        only appears when there are rows to clear. */}
                                    {chips.length > 0 && filteredEvents.length > 0 ? (
                                        <button
                                            type="button"
                                            onClick={clearAll}
                                            className="text-[12px] font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-[#9CA3AF] dark:hover:text-indigo-400"
                                        >
                                            Clear all
                                        </button>
                                    ) : null}
                                </div>

                                <EventsResultsTable
                                    events={pagedEvents}
                                    totalMatched={filteredEvents.length}
                                    page={safePage}
                                    pageSize={PAGE_SIZE}
                                    onPageChange={(next) => setPage(Math.min(Math.max(1, next), pageCount))}
                                    likedIds={likedIds}
                                    targetIds={targetIds}
                                    onToggleLike={toggleLike}
                                    onToggleTarget={toggleTarget}
                                    chips={chips}
                                    onRemoveChip={removeChip}
                                    onClearAll={clearAll}
                                />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="events-hero"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <EventsAiSearch
                                    filters={queryState.filters}
                                    search={queryState.search}
                                    question={question}
                                    onApply={applyQueryState}
                                    onRemoveChip={removeChip}
                                    onClearAll={clearAll}
                                    onClearQuery={clearQuery}
                                    answer={answer}
                                    isAnswering={isAnswering}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
export default EventsSection;