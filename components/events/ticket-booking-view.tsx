"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    Church,
    FileText,
    Hotel,
    MapPin,
    Plane,
    Ticket,
    TrainFront,
    Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { findShowEvents } from '@/lib/find-shows/catalog';

/**
 * NOT CURRENTLY RENDERED. This view has had no caller since the initial commit;
 * it was moved here intact rather than deleted so the work is preserved and
 * easy to find if the ticket-booking flow is picked back up.
 */
export function TicketBookingView({ event, onBack }: { event: typeof findShowEvents[0], onBack: () => void }) {
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
