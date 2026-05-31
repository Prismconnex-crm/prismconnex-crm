"use client";

import { motion } from "framer-motion";
import {
    Target,
    Mail,
    DollarSign,
    MoreHorizontal,
    TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const Sparkline = ({ color = "emerald", path = "M0,25 C20,20 30,28 50,15 C70,2 80,18 100,5" }) => {
    const isEmerald = color === "emerald";
    const stroke = isEmerald ? "rgb(16, 185, 129)" : "rgb(99, 102, 241)"; // emerald-500 or indigo-500
    const gradientId = `spark-${color}-${Math.random().toString(36).substr(2, 5)}`;

    return (
        <div className="absolute bottom-0 left-0 right-0 h-10 overflow-hidden rounded-b-[12px]">
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={`${path} L100,30 L0,30 Z`} fill={`url(#${gradientId})`} />
                <path d={path} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
            </svg>
        </div>
    );
};

export function DashboardSection() {
    return (
        <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto pb-10">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-start sm:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-[32px] font-black tracking-tight text-slate-900 dark:text-white leading-none mb-1.5">
                        Dashboard
                    </h1>
                    <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                        Your event-to-revenue overview
                    </p>
                </div>
                <div className="hidden sm:block">
                    <button className="inline-flex flex-shrink-0 items-center justify-center rounded-full bg-white dark:bg-[#111B2E] border border-slate-200 dark:border-[#22304A] h-9 px-4 text-[13px] font-bold text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-[#16233A] transition-colors">
                        Last 30 days
                    </button>
                </div>
            </motion.div>

            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Card 1 */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="relative flex flex-col rounded-[12px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] p-5 shadow-sm overflow-hidden group hover:border-indigo-500/30 dark:hover:border-indigo-400/30 transition-colors h-[130px]"
                >
                    <div className="flex items-center justify-between mb-3 z-10">
                        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">New Leads</span>
                        <Target className="size-[14px] text-slate-400 dark:text-[#9CA3AF]" />
                    </div>
                    <div className="text-[32px] font-black text-slate-900 dark:text-white leading-none mb-2 z-10">
                        248
                    </div>
                    <div className="flex items-center gap-1.5 z-10">
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">+12%</span>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">vs last month</span>
                    </div>
                    <Sparkline color="emerald" path="M0,25 C20,25 30,22 50,26 C70,30 80,10 100,12" />
                </motion.div>

                {/* Card 2 */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15 }}
                    className="relative flex flex-col rounded-[12px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] p-5 shadow-sm overflow-hidden group hover:border-indigo-500/30 dark:hover:border-indigo-400/30 transition-colors h-[130px]"
                >
                    <div className="flex items-center justify-between mb-3 z-10">
                        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">Replies</span>
                        <Mail className="size-[14px] text-slate-400 dark:text-[#9CA3AF]" />
                    </div>
                    <div className="text-[32px] font-black text-slate-900 dark:text-white leading-none mb-2 z-10">
                        64
                    </div>
                    <div className="flex items-center gap-1.5 z-10">
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">+6%</span>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">vs last month</span>
                    </div>
                    <Sparkline color="emerald" path="M0,28 C20,20 40,24 60,15 C80,6 90,12 100,5" />
                </motion.div>

                {/* Card 3 */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="relative flex flex-col rounded-[12px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] p-5 shadow-sm overflow-hidden group hover:border-indigo-500/30 dark:hover:border-indigo-400/30 transition-colors h-[130px]"
                >
                    <div className="flex items-center justify-between mb-3 z-10">
                        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">Meetings Booked</span>
                    </div>
                    <div className="text-[32px] font-black text-slate-900 dark:text-white leading-none mb-2 z-10">
                        18
                    </div>
                    <div className="flex items-center gap-1.5 z-10">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">This month</span>
                    </div>
                    <Sparkline color="emerald" path="M0,25 C30,25 40,15 60,18 C80,21 90,5 100,8" />
                </motion.div>

                {/* Card 4 */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.25 }}
                    className="relative flex flex-col rounded-[12px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] p-5 shadow-sm overflow-hidden group hover:border-indigo-500/30 dark:hover:border-indigo-400/30 transition-colors h-[130px]"
                >
                    <div className="flex items-center justify-between mb-3 z-10">
                        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">Forecast Profit</span>
                        <DollarSign className="size-[14px] text-slate-400 dark:text-[#9CA3AF]" />
                    </div>
                    <div className="text-[32px] font-black text-slate-900 dark:text-white leading-none mb-2 z-10">
                        $38,500
                    </div>
                    <div className="flex items-center gap-1.5 z-10">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Active pipeline</span>
                    </div>
                    <Sparkline color="emerald" path="M0,26 C20,26 30,16 50,16 C70,16 80,20 100,4" />
                </motion.div>
            </div>

            {/* Middle Row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Upcoming Events Table (Spans 6 cols on LG) */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="lg:col-span-6 flex flex-col rounded-[12px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] shadow-sm overflow-hidden min-h-[300px]"
                >
                    <div className="px-5 pt-5 pb-3">
                        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Upcoming Events</h2>
                    </div>
                    <div className="px-5 pb-4 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr>
                                    <th className="pb-3 text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF] whitespace-nowrap">Event</th>
                                    <th className="pb-3 text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF] whitespace-nowrap hidden sm:table-cell">City</th>
                                    <th className="pb-3 text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF] whitespace-nowrap">Dates</th>
                                    <th className="pb-3 text-[11px] font-semibold text-slate-500 dark:text-[#9CA3AF] whitespace-nowrap">Industry</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-[#22304A] text-[12px]">
                                {[
                                    { e: "Berlin Tech Expo 2026", c: "Berlin", d: "12-15 May", i: "Technology" },
                                    { e: "Paris Med Summit 2026", c: "Paris", d: "02-04 Jun", i: "Pharma" },
                                    { e: "London Manufacturing Week", c: "London", d: "18-20 Jul", i: "Manufacturing" },
                                    { e: "Munich Automation Fair", c: "Munich", d: "10-12 Sep", i: "Automation" },
                                ].map((row, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50/50 dark:hover:bg-[#16233A]/50 transition-colors">
                                        <td className="py-3.5 pr-4 text-[13px] text-slate-900 dark:text-white font-bold">{row.e}</td>
                                        <td className="py-3.5 pr-4 text-[13px] text-slate-600 dark:text-[#E5E7EB] font-medium hidden sm:table-cell">{row.c}</td>
                                        <td className="py-3.5 pr-4 text-[13px] text-slate-600 dark:text-[#E5E7EB] font-medium whitespace-nowrap">{row.d}</td>
                                        <td className="py-3.5 text-[13px] text-slate-600 dark:text-[#E5E7EB] font-medium">{row.i}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-auto px-5 py-4 border-t border-slate-200 dark:border-[#22304A] bg-slate-50/50 dark:bg-[#0B1220]/50">
                        <p className="text-[9px] text-slate-500 dark:text-[#9CA3AF] uppercase tracking-widest font-bold">
                            Data source • fetched date • confidence score
                        </p>
                    </div>
                </motion.div>

                {/* AI Next Best Actions (Spans 3 cols on LG) */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.35 }}
                    className="lg:col-span-3 flex flex-col rounded-[12px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] shadow-sm p-5 min-h-[300px]"
                >
                    <h2 className="text-[15px] font-bold text-slate-900 dark:text-white mb-5">AI Next Best Actions</h2>
                    <ul className="space-y-4">
                        {[
                            "Add 10 exhibitors to Berlin Outreach list",
                            "Reply to 3 inbound leads",
                            "Review proposal for NovaAI Systems",
                            "Schedule 2 follow-up calls",
                        ].map((item, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                                <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-indigo-500 dark:bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
                                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300 leading-snug">{item}</span>
                            </li>
                        ))}
                    </ul>
                </motion.div>

                {/* Sequence Performance (Spans 3 cols on LG) */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                    className="lg:col-span-3 flex flex-col rounded-[12px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] shadow-sm p-5 relative overflow-hidden group min-h-[300px]"
                >
                    <h2 className="text-[15px] font-bold text-slate-900 dark:text-white mb-5 relative z-10">Sequence Performance</h2>
                    <div className="space-y-3 relative z-10">
                        <div className="flex items-center justify-between">
                            <span className="text-[13px] font-medium text-slate-500 dark:text-[#9CA3AF]">Sent:</span>
                            <span className="text-[13px] font-bold text-slate-900 dark:text-white">1,250</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[13px] font-medium text-slate-500 dark:text-[#9CA3AF]">Replies:</span>
                            <span className="text-[13px] font-bold text-slate-900 dark:text-white">64</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[13px] font-medium text-slate-500 dark:text-[#9CA3AF]">Bounce:</span>
                            <span className="text-[13px] font-bold text-slate-900 dark:text-white">1.2%</span>
                        </div>
                    </div>
                    {/* Dark blue/indigo sparkline matching the reference image */}
                    <div className="absolute inset-x-0 bottom-0 h-28 overflow-hidden rounded-b-[12px] opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full transform translate-y-1">
                            <defs>
                                <linearGradient id="seq-gradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgb(99, 102, 241)" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <path d="M0,35 C10,32 20,33 30,30 C40,27 45,35 55,25 C65,15 70,20 80,10 C85,5 90,15 100,2 L100,40 L0,40 Z" fill="url(#seq-gradient)" />
                            <path d="M0,35 C10,32 20,33 30,30 C40,27 45,35 55,25 C65,15 70,20 80,10 C85,5 90,15 100,2" fill="none" stroke="rgb(99, 102, 241)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </motion.div>
            </div>

            {/* Bottom Row: Deal Pipeline */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.45 }}
                className="flex flex-col rounded-[12px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] p-5 shadow-sm mt-1"
            >
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Deal Pipeline</h2>
                    <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                        <MoreHorizontal className="size-4" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Stage 1: Prospecting */}
                    <div className="flex flex-col gap-3">
                        <h3 className="text-[12px] font-bold tracking-wider text-slate-500 dark:text-[#9CA3AF] uppercase px-1 border-b-2 border-indigo-500/50 pb-2 inline-block self-start">
                            Prospecting
                        </h3>
                        <div className="flex flex-col gap-1.5 rounded-[8px] border border-slate-200 dark:border-[#22304A] bg-slate-50/50 dark:bg-[#0B1220] p-3 hover:border-indigo-500/30 transition-colors cursor-pointer group shadow-sm">
                            <span className="text-[13px] font-bold text-slate-900 dark:text-white leading-tight mt-1">Booth Sponsorship Package</span>
                            <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">$35,000</span>
                            <div className="mt-1">
                                <span className="inline-flex rounded-[4px] bg-white dark:bg-[#16233A] border border-slate-200 dark:border-[#22304A] px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-[#E5E7EB] truncate">
                                    Berlin Tech Expo
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stage 2: Proposal */}
                    <div className="flex flex-col gap-3">
                        <h3 className="text-[12px] font-bold tracking-wider text-slate-500 dark:text-[#9CA3AF] uppercase px-1 border-b-2 border-blue-500/50 pb-2 inline-block self-start">
                            Proposal
                        </h3>
                        <div className="flex flex-col gap-1.5 rounded-[8px] border border-slate-200 dark:border-[#22304A] bg-slate-50/50 dark:bg-[#0B1220] p-3 hover:border-blue-500/30 transition-colors cursor-pointer group shadow-sm">
                            <span className="text-[13px] font-bold text-slate-900 dark:text-white leading-tight mt-1">Enterprise Partnership</span>
                            <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">$60,000</span>
                            <div className="mt-1">
                                <span className="inline-flex rounded-[4px] bg-white dark:bg-[#16233A] border border-slate-200 dark:border-[#22304A] px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-[#E5E7EB] truncate">
                                    Munich Automation Fair
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stage 3: Negotiation */}
                    <div className="flex flex-col gap-3">
                        <h3 className="text-[12px] font-bold tracking-wider text-slate-500 dark:text-[#9CA3AF] uppercase px-1 border-b-2 border-amber-500/50 pb-2 inline-block self-start">
                            Negotiation
                        </h3>
                        <div className="flex flex-col gap-1.5 rounded-[8px] border border-slate-200 dark:border-[#22304A] bg-slate-50/50 dark:bg-[#0B1220] p-3 hover:border-amber-500/30 transition-colors cursor-pointer group shadow-sm">
                            <span className="text-[13px] font-bold text-slate-900 dark:text-white leading-tight mt-1">Vendor Services Retainer</span>
                            <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">$20,000</span>
                            <div className="mt-1">
                                <span className="inline-flex rounded-[4px] bg-white dark:bg-[#16233A] border border-slate-200 dark:border-[#22304A] px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-[#E5E7EB] truncate">
                                    Paris Med Summit
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stage 4: Won */}
                    <div className="flex flex-col gap-3">
                        <h3 className="text-[12px] font-bold tracking-wider text-slate-500 dark:text-[#9CA3AF] uppercase px-1 border-b-2 border-emerald-500/50 pb-2 inline-block self-start">
                            Won
                        </h3>
                        <div className="flex flex-col gap-1.5 rounded-[8px] border border-slate-200 dark:border-[#22304A] bg-slate-50/50 dark:bg-[#0B1220] p-3 hover:border-emerald-500/30 transition-colors cursor-pointer group shadow-sm">
                            <span className="text-[13px] font-bold text-slate-900 dark:text-white leading-tight mt-1">Global Exhibitor Pass</span>
                            <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">$15,000</span>
                            <div className="mt-1">
                                <span className="inline-flex rounded-[4px] bg-white dark:bg-[#16233A] border border-slate-200 dark:border-[#22304A] px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-[#E5E7EB] truncate">
                                    London Mfg Week
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
