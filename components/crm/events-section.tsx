import { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { findShowEvents, findShowsCategories, findShowsRegions, countryStatsByRegion } from "@/lib/find-shows/catalog";
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
import { EventMap } from "./event-map";

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

function CategoryFilterPopover({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const categories = [
    { label: 'All Categories', value: 'All Categories' },
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
          <CommandInput placeholder="Search category..." className="h-9 text-[12px]" />
          <CommandList>
            <CommandEmpty className="py-2 text-center text-[12px] text-slate-500">No category found.</CommandEmpty>
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
        category: 'All Categories' as FindShowsCategory
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
                    </div>

                    { (filters.region !== 'All Regions' || filters.country !== '' || filters.category !== 'All Categories' || showOnlyLiked) && (
                        <button 
                            onClick={() => {
                                setFilters({ region: 'All Regions', country: '', category: 'All Categories' });
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
                                <th className="px-4 py-4 font-black uppercase tracking-[0.1em] text-[10px] hidden md:table-cell w-32">Category</th>
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