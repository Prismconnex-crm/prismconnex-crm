"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, ExternalLink, Globe2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EventMap } from '@/components/crm/event-map';
import type { FindShowEvent } from '@/types/find-shows';
import type { Exhibitor } from '@/types/exhibitors';

/**
 * NOT CURRENTLY RENDERED. This view has had no caller since the initial commit;
 * it was moved here intact rather than deleted so the work is preserved and
 * easy to find if the exhibitor-detail flow is picked back up.
 */
export function ExhibitorDetailView({ exhibitor, event, onBack }: { exhibitor: Exhibitor; event: FindShowEvent; onBack: () => void }) {
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
