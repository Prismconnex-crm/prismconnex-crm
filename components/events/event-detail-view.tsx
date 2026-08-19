"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Activity,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ExternalLink,
    FileText,
    Globe2,
    Hotel,
    ImageIcon,
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
import { EventMap } from '@/components/crm/event-map';
import type { FindShowEvent } from '@/types/find-shows';
import type { Exhibitor } from '@/types/exhibitors';

export function EventDetailView({ event }: { event: FindShowEvent }) {
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
