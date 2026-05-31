import { useState } from "react";
import { motion } from "framer-motion";
import {
    Activity,
    Shield,
    CheckCircle2,
    AlertTriangle,
    ChevronDown,
    Check
} from "lucide-react";

export function DeliverabilitySection() {
    return (
        <div className="space-y-4 max-w-[1200px] mx-auto pb-14">
            
            {/* Top Navigation & Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col gap-4 border-b dark:border-white/[0.06] border-slate-200 pb-3"
            >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-0.5">
                        <h1 className="text-base font-bold dark:text-white text-slate-900 tracking-tight">Deliverability</h1>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">Monitor sending health, authentication, bounces, and compliance</p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto relative pt-2 sm:pt-0">

                        <button className="h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-white/[0.04] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm">
                            Suppression List
                        </button>
                        <button className="h-7 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-colors">
                            Run Health Check
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* HEALTH KPI STRIP */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
            >
                <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x dark:divide-white/[0.06] divide-slate-200 overflow-hidden shadow-sm dark:shadow-2xl">
                    
                    {/* KPI 1 */}
                    <div className="flex-1 p-3 flex items-center justify-between">
                        <div>
                            <p className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 mb-0.5">Domain Health</p>
                            <p className="text-[18px] font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">Good</p>
                        </div>
                        <div className="w-16 h-7 opacity-80">
                            {/* Sparkline for Domain Health: relatively stable/high */}
                            <svg viewBox="0 0 100 40" className="w-full h-full text-emerald-500 fill-emerald-500/10" preserveAspectRatio="none">
                                <path d="M0,35 L10,33 L20,34 L30,30 L40,32 L50,25 L60,28 L70,20 L80,15 L90,12 L100,10 L100,40 L0,40 Z" />
                                <path d="M0,35 L10,33 L20,34 L30,30 L40,32 L50,25 L60,28 L70,20 L80,15 L90,12 L100,10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>

                    {/* KPI 2 */}
                    <div className="flex-1 p-3 flex items-center justify-between">
                        <div>
                            <p className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 mb-0.5">Bounce Rate</p>
                            <p className="text-[18px] font-bold dark:text-white text-slate-900 tracking-tight">1.2%</p>
                        </div>
                        <div className="w-16 h-7 opacity-70">
                            {/* Sparkline for Bounce: small bump then low */}
                            <svg viewBox="0 0 100 40" className="w-full h-full text-indigo-500 fill-indigo-500/10" preserveAspectRatio="none">
                                <path d="M0,38 L15,37 L30,38 L45,35 L60,20 L75,32 L90,36 L100,37 L100,40 L0,40 Z" />
                                <path d="M0,38 L15,37 L30,38 L45,35 L60,20 L75,32 L90,36 L100,37" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>

                    {/* KPI 3 */}
                    <div className="flex-1 p-3 flex items-center justify-between">
                        <div>
                            <p className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 mb-0.5">Complaint Rate</p>
                            <p className="text-[18px] font-bold dark:text-white text-slate-900 tracking-tight">0.02%</p>
                        </div>
                        <div className="w-16 h-7 opacity-50">
                            {/* Sparkline for Complaint: practically flat */}
                            <svg viewBox="0 0 100 40" className="w-full h-full text-indigo-500 fill-indigo-500/5" preserveAspectRatio="none">
                                <path d="M0,39 L20,39 L40,38.5 L60,39 L80,38 L100,39 L100,40 L0,40 Z" />
                                <path d="M0,39 L20,39 L40,38.5 L60,39 L80,38 L100,39" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>

                    {/* KPI 4 */}
                    <div className="flex-1 p-3 flex items-center justify-between">
                        <div>
                            <p className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 mb-0.5">Unsubscribe Rate</p>
                            <p className="text-[18px] font-bold dark:text-white text-slate-900 tracking-tight">0.4%</p>
                        </div>
                        <div className="w-16 h-7 opacity-70">
                           {/* Sparkline for Unsubscribe: slow curve */}
                           <svg viewBox="0 0 100 40" className="w-full h-full text-indigo-500 fill-indigo-500/10" preserveAspectRatio="none">
                                <path d="M0,35 L15,36 L30,35 L45,30 L60,32 L75,35 L90,36 L100,37 L100,40 L0,40 Z" />
                                <path d="M0,35 L15,36 L30,35 L45,30 L60,32 L75,35 L90,36 L100,37" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>

                </div>
            </motion.div>

            {/* AUTHENTICATION STATUS */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
            >
                <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-slate-50 p-4">
                    <h3 className="text-[13px] font-bold dark:text-white text-slate-900 mb-4">Authentication Status</h3>
                    
                    <div className="flex flex-col md:flex-row gap-4 md:gap-12 mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] dark:text-slate-300 text-slate-700 font-bold w-10">SPF</span>
                            <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                Configured
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] dark:text-slate-300 text-slate-700 font-bold w-10">DKIM</span>
                            <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                Configured
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] dark:text-slate-300 text-slate-700 font-bold w-12">DMARC</span>
                            <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                Configured
                            </span>
                        </div>
                    </div>

                    <p className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium">
                        Authentication reduces spam risk and improves inbox placement.
                    </p>
                </div>
            </motion.div>

            {/* 2-COLUMN LAYOUT BELOW */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4"
            >
                <div>
                   <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white h-full overflow-hidden flex flex-col shadow-sm dark:shadow-2xl">
                        <div className="p-3 border-b dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-slate-50/50">
                            <h3 className="text-[13px] font-bold dark:text-white text-slate-900">Sending Identities</h3>
                        </div>
                        
                        <div className="overflow-x-auto flex-1 p-3">
                            <table className="w-full min-w-[400px] text-left border-collapse">
                                <thead>
                                    <tr className="border-b dark:border-white/[0.06] border-slate-200">
                                        <th className="pb-2 text-[9.5px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider">Sender</th>
                                        <th className="pb-2 text-[9.5px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider">Daily Limit</th>
                                        <th className="pb-2 text-[9.5px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="pb-2 text-[9.5px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider">Reputation</th>
                                        <th className="pb-2 text-[9.5px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="py-2.5 text-[10.5px] dark:text-white text-slate-900 font-medium tracking-tight">admin@prismconne...</td>
                                        <td className="py-2.5 text-[10.5px] dark:text-slate-300 text-slate-600">80/day</td>
                                        <td className="py-2.5 text-[10.5px] dark:text-white text-slate-900">Active</td>
                                        <td className="py-2.5">
                                             <span className="inline-flex items-center rounded-full bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border dark:border-emerald-500/20">Good</span>
                                        </td>
                                        <td className="py-2.5 text-right">
                                            <button className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider underline-offset-4 hover:underline">Configure</button>
                                        </td>
                                    </tr>
                                    <tr className="border-t dark:border-white/[0.04] border-slate-100">
                                        <td className="py-2.5 text-[10.5px] dark:text-white text-slate-900 font-medium tracking-tight">outreach@prismcon...</td>
                                        <td className="py-2.5 text-[10.5px] dark:text-slate-300 text-slate-600">60/day</td>
                                        <td className="py-2.5 text-[10.5px] dark:text-white text-slate-900">Active</td>
                                        <td className="py-2.5">
                                            <span className="inline-flex items-center rounded-full bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border dark:border-emerald-500/20">Good</span>
                                        </td>
                                        <td className="py-2.5 text-right">
                                            <button className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider underline-offset-4 hover:underline">Configure</button>
                                        </td>
                                    </tr>
                                    <tr className="border-t dark:border-white/[0.04] border-slate-100">
                                        <td className="py-2.5 text-[10.5px] dark:text-white text-slate-900 font-medium tracking-tight">events@prismconne...</td>
                                        <td className="py-2.5 text-[10.5px] dark:text-slate-300 text-slate-600">40/day</td>
                                        <td className="py-2.5 text-[10.5px] dark:text-white text-slate-900">Paused</td>
                                        <td className="py-2.5">
                                            <span className="inline-flex items-center rounded-full bg-amber-50 border-amber-200 dark:bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-500 border dark:border-amber-500/20">Review</span>
                                        </td>
                                        <td className="py-2.5 text-right">
                                            <button className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider underline-offset-4 hover:underline">Configure</button>
                                        </td>
                                    </tr>
                                    <tr className="border-t dark:border-white/[0.04] border-slate-100">
                                        <td className="py-2.5 text-[10.5px] dark:text-white text-slate-900 font-medium tracking-tight">sales@prismconnex...</td>
                                        <td className="py-2.5 text-[10.5px] dark:text-slate-300 text-slate-600">80/day</td>
                                        <td className="py-2.5 text-[10.5px] dark:text-white text-slate-900">Active</td>
                                        <td className="py-2.5">
                                            <span className="inline-flex items-center rounded-full bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border dark:border-emerald-500/20">Good</span>
                                        </td>
                                        <td className="py-2.5 text-right">
                                            <button className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider underline-offset-4 hover:underline">Configure</button>
                                        </td>
                                    </tr>
                                    <tr className="border-t dark:border-white/[0.04] border-slate-100">
                                        <td className="py-2.5 text-[10.5px] dark:text-white text-slate-900 font-medium tracking-tight">support@prismcon...</td>
                                        <td className="py-2.5 text-[10.5px] dark:text-slate-300 text-slate-600">30/day</td>
                                        <td className="py-2.5 text-[10.5px] dark:text-white text-slate-900">Active</td>
                                        <td className="py-2.5">
                                            <span className="inline-flex items-center rounded-full bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border dark:border-emerald-500/20">Good</span>
                                        </td>
                                        <td className="py-2.5 text-right">
                                            <button className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider underline-offset-4 hover:underline">Configure</button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 xl:mt-0">
                    
                     {/* Compliance Card */}
                    <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-slate-50 flex flex-col relative top-0 xl:top-0">
                        <div className="p-3 border-b dark:border-white/[0.06] border-slate-200">
                            <h3 className="text-[13px] font-bold dark:text-white text-slate-900">Compliance</h3>
                        </div>
                        <div className="p-3 flex-1 space-y-2">
                            <div className="flex items-center justify-between text-[10.5px]">
                                <span className="flex items-center gap-1.5 dark:text-slate-300 text-slate-700 font-medium"><CheckCircle2 className="size-3 text-emerald-500" /> Unsubscribe enabled</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold tracking-widest">—   On</span>
                            </div>
                            <div className="flex items-center justify-between text-[10.5px]">
                                <span className="flex items-center gap-1.5 dark:text-slate-300 text-slate-700 font-medium"><CheckCircle2 className="size-3 text-emerald-500" /> Stop on reply</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold tracking-widest">—   On</span>
                            </div>
                            <div className="flex items-center justify-between text-[10.5px]">
                                <span className="flex items-center gap-1.5 dark:text-slate-300 text-slate-700 font-medium"><CheckCircle2 className="size-3 text-emerald-500" /> Suppression list active</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold tracking-widest">—   On</span>
                            </div>
                        </div>
                        <div className="p-3 pt-0 mt-auto">
                            <button className="w-full h-7 rounded-md dark:bg-white/[0.02] bg-white border dark:border-white/[0.06] border-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] text-[10px] font-bold dark:text-white text-slate-700 transition-colors shadow-sm">
                                Manage Suppression
                            </button>
                        </div>
                    </div>

                    {/* Bounces & Complaints Card */}
                    <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-slate-50 flex flex-col relative top-0 xl:top-0">
                        <div className="p-3 border-b dark:border-white/[0.06] border-slate-200">
                            <h3 className="text-[13px] font-bold dark:text-white text-slate-900">Bounces & Complaints</h3>
                        </div>
                        <div className="p-3 flex-1 flex flex-col justify-center">
                             
                            {/* Graphic Chart representation */}
                            <div className="w-full h-16 relative mb-3">
                                <svg viewBox="0 0 200 60" className="w-full h-full overflow-visible">
                                    {/* Grid Lines */}
                                    <line x1="0" y1="30" x2="200" y2="30" className="stroke-slate-200 dark:stroke-[#16233A]" strokeWidth="1" />
                                    <line x1="0" y1="60" x2="200" y2="60" className="stroke-slate-200 dark:stroke-[#16233A]" strokeWidth="1" />
                                    
                                    {/* Line mapping */}
                                    <path d="M10,40 L60,35 L110,20 L160,45 L190,40" fill="none" className="stroke-indigo-500 dark:stroke-[#60A5FA]" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    
                                    {/* Dots */}
                                    <circle cx="10" cy="40" r="2.5" className="fill-indigo-500 dark:fill-[#60A5FA]" />
                                    <circle cx="60" cy="35" r="2.5" className="fill-indigo-500 dark:fill-[#60A5FA]" />
                                    <circle cx="110" cy="20" r="3" className="fill-indigo-500 dark:fill-[#93C5FD] drop-shadow-[0_0_8px_rgba(99,102,241,0.5)] dark:drop-shadow-[0_0_8px_rgba(147,197,253,0.8)]" />
                                    <circle cx="160" cy="45" r="2.5" className="fill-indigo-500 dark:fill-[#60A5FA]" />
                                    <circle cx="190" cy="40" r="2.5" className="fill-indigo-500 dark:fill-[#60A5FA]" />
                                    
                                    {/* X-Axis labels */}
                                    <text x="10" y="75" className="fill-slate-500 dark:fill-[#6B7280]" fontSize="8" fontWeight="bold" textAnchor="middle">Feb</text>
                                    <text x="60" y="75" className="fill-slate-500 dark:fill-[#6B7280]" fontSize="8" fontWeight="bold" textAnchor="middle">Mar</text>
                                    <text x="110" y="75" className="fill-slate-500 dark:fill-[#6B7280]" fontSize="8" fontWeight="bold" textAnchor="middle">Apr</text>
                                    <text x="160" y="75" className="fill-slate-500 dark:fill-[#6B7280]" fontSize="8" fontWeight="bold" textAnchor="middle">May</text>
                                </svg>
                            </div>

                             <div className="space-y-1.5 mt-auto">
                                <div className="flex justify-between items-center text-[10.5px]">
                                    <span className="dark:text-slate-300 text-slate-600 font-medium">Bounces</span>
                                    <span className="dark:text-white text-slate-900 font-bold">1.2%</span>
                                </div>
                                <div className="flex justify-between items-center text-[10.5px]">
                                    <span className="dark:text-slate-300 text-slate-600 font-medium">Complaints</span>
                                    <span className="dark:text-white text-slate-900 font-bold">0.02%</span>
                                </div>
                             </div>
                        </div>
                        <div className="p-3 pt-0">
                            <button className="w-full text-center text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider underline-offset-4 hover:underline">
                                View Details
                            </button>
                        </div>
                    </div>

                </div>
            </motion.div>

            {/* RECENT EVENTS LOG */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="pt-2"
            >
                <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white overflow-hidden shadow-sm dark:shadow-xl">
                    <div className="p-3 border-b dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-slate-50/50">
                        <h3 className="text-[13px] font-bold dark:text-white text-slate-900">Recent Deliverability Events</h3>
                    </div>
                    <div className="overflow-x-auto p-3 pt-1">
                        <table className="w-full min-w-[600px] text-left border-collapse">
                            <thead>
                                <tr className="border-b dark:border-white/[0.06] border-slate-200">
                                    <th className="pb-2 pt-1 text-[9.5px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider w-20">Time</th>
                                    <th className="pb-2 pt-1 text-[9.5px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider w-40">Type</th>
                                    <th className="pb-2 pt-1 text-[9.5px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider">Details</th>
                                    <th className="pb-2 pt-1 text-[9.5px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wider text-right">Result</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                                    <td className="py-2 text-[10.5px] dark:text-slate-300 text-slate-600 font-medium">14:22</td>
                                    <td className="py-2 text-[10.5px] dark:text-white text-slate-900 font-bold">Health check</td>
                                    <td className="py-2 text-[10.5px] dark:text-slate-300 text-slate-600">Authentication verified</td>
                                    <td className="py-2 text-[10.5px] dark:text-white text-slate-900 font-bold text-right">Success</td>
                                </tr>
                                <tr className="border-t dark:border-white/[0.04] border-slate-100 hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                                    <td className="py-2 text-[10.5px] dark:text-slate-300 text-slate-600 font-medium">13:40</td>
                                    <td className="py-2 text-[10.5px] dark:text-white text-slate-900 font-bold">Bounce</td>
                                    <td className="py-2 text-[10.5px] dark:text-slate-300 text-slate-600">Hard bounce detected</td>
                                    <td className="py-2 text-[10.5px] text-amber-600 dark:text-amber-400 font-bold text-right">Suppressed</td>
                                </tr>
                                <tr className="border-t dark:border-white/[0.04] border-slate-100 hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                                    <td className="py-2 text-[10.5px] dark:text-slate-300 text-slate-600 font-medium">12:18</td>
                                    <td className="py-2 text-[10.5px] dark:text-white text-slate-900 font-bold">Unsubscribe</td>
                                    <td className="py-2 text-[10.5px] dark:text-slate-300 text-slate-600">Recipient opted out</td>
                                    <td className="py-2 text-[10.5px] dark:text-white text-slate-900 font-bold text-right">Logged</td>
                                </tr>
                                <tr className="border-t dark:border-white/[0.04] border-slate-100 hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                                    <td className="py-2 text-[10.5px] dark:text-slate-300 text-slate-600 font-medium">11:05</td>
                                    <td className="py-2 text-[10.5px] dark:text-white text-slate-900 font-bold">Complaint</td>
                                    <td className="py-2 text-[10.5px] dark:text-slate-300 text-slate-600">Complaint received</td>
                                    <td className="py-2 text-[10.5px] text-red-600 dark:text-red-400 font-bold text-right">Sender paused</td>
                                </tr>
                                <tr className="border-t dark:border-white/[0.04] border-slate-100 hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                                    <td className="py-2 text-[10.5px] dark:text-slate-300 text-slate-600 font-medium">10:12</td>
                                    <td className="py-2 text-[10.5px] dark:text-white text-slate-900 font-bold">Health check</td>
                                    <td className="py-2 text-[10.5px] dark:text-slate-300 text-slate-600">Reputation stable</td>
                                    <td className="py-2 text-[10.5px] dark:text-white text-slate-900 font-bold text-right">Success</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </motion.div>
            
        </div>
    );
}
