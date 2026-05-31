"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    ChevronDown,
    TrendingUp,
    Target,
    Calendar,
    ChevronUp,
    MoreHorizontal,
    Mail,
    Phone,
    ListTodo,
    Sparkles,
    CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data
const dealsList = [
    { id: "1", name: "Lead List Purchase", value: 25000, prob: 60, tag: "Berlin Tech Expo", stage: "Prospecting" },
    { id: "2", name: "Booth Services Package", value: 15000, prob: 45, tag: "Munich Automation Fair", stage: "Prospecting" },
    { id: "3", name: "Booth Sponsorship Package", value: 35000, prob: 55, tag: "Berlin Tech Expo", stage: "Proposal" },
    { id: "4", name: "Enterprise Partnership", value: 60000, prob: 70, tag: "Munich Automation Fair", stage: "Negotiation" },
    { id: "5", name: "Vendor Services Retainer", value: 20000, prob: 100, tag: "Paris Med Summit", stage: "Won" },
];

const pipelineStages = ["Prospecting", "Proposal", "Negotiation", "Won"] as const;

export function DealsSection() {
    const [selectedDealId, setSelectedDealId] = useState<string>("3"); // Default to Proposal one as per image
    const [hoveredDealId, setHoveredDealId] = useState<string | null>(null);
    const activeDeal = dealsList.find(d => d.id === selectedDealId) || dealsList[2];

    return (
        <div className="space-y-4 max-w-[1400px] mx-auto pb-14">
            {/* Header Area */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b dark:border-white/[0.06] border-slate-200"
            >
                <div className="space-y-0.5">
                    <h1 className="text-base font-bold tracking-tight dark:text-white text-slate-900">
                        Deals
                    </h1>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Track stages, forecast revenue, and calculate profit per event
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm">
                        Export
                    </button>
                    <button className="h-7 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-colors">
                        New Deal
                    </button>
                </div>
            </motion.div>

            {/* KPI Metrics Row */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white shadow-sm flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x dark:divide-white/[0.06] divide-slate-100 overflow-hidden"
            >
                <div className="flex-1 p-3 flex flex-col gap-0.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-default">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Open Deals</p>
                    <p className="text-[20px] font-bold dark:text-white text-slate-900 leading-tight">12</p>
                </div>
                <div className="flex-1 p-3 flex flex-col gap-0.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-default">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Pipeline Value</p>
                    <p className="text-[20px] font-bold dark:text-white text-slate-900 leading-tight">$180,000</p>
                </div>
                <div className="flex-1 p-3 flex flex-col gap-0.5 relative overflow-hidden hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-default">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 blur-[20px] rounded-full"></div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 relative z-10">Forecast Profit</p>
                    <p className="text-[20px] font-bold dark:text-white text-slate-900 leading-tight relative z-10">$58,500</p>
                </div>
                <div className="flex-1 p-3 flex flex-col gap-0.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors cursor-default">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Win Rate</p>
                    <div className="flex items-center gap-2">
                        <p className="text-[20px] font-bold dark:text-white text-slate-900 leading-tight">22%</p>
                        <span className="flex items-center text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-200 dark:border-transparent"><TrendingUp className="size-2.5 mr-0.5"/> 4%</span>
                    </div>
                </div>
            </motion.div>

            {/* Main Split Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] 2xl:grid-cols-[1fr_340px] gap-4 items-start pb-8">
                
                {/* LEFT PANEL: Deal Pipeline Kanban */}
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="flex flex-col gap-4"
                >
                    <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white p-4 shadow-sm relative overflow-hidden">
                        {/* Background Grid Pattern */}
                        <div className="absolute inset-0 pattern-dots dark:pattern-[#22304A] pattern-slate-200 pattern-bg-transparent pattern-size-4 dark:pattern-opacity-40 pointer-events-none"></div>

                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h2 className="text-[13px] font-bold dark:text-white text-slate-900 tracking-tight">Deal Pipeline</h2>
                        </div>
                        
                        <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 relative z-10">
                            {pipelineStages.map((stage) => {
                                const stageDeals = dealsList.filter(d => d.stage === stage);
                                return (
                                    <div key={stage} className="min-w-[200px] flex-1 flex flex-col gap-2">
                                        {/* Stage Header */}
                                        <div className="h-8 rounded-md dark:bg-[#111B2E]/90 bg-slate-50/90 backdrop-blur-sm border dark:border-white/[0.06] border-slate-200 flex items-center justify-between px-3 shadow-sm">
                                            <p className="text-[10px] font-bold dark:text-slate-300 text-slate-700 uppercase tracking-wide">{stage}</p>
                                            <span className="text-[9px] font-bold dark:text-slate-500 text-slate-400">{stageDeals.length}</span>
                                        </div>

                                        {/* Stage Deals */}
                                        <div className="flex flex-col gap-2 min-h-[400px]">
                                            {stageDeals.map((deal) => {
                                                const isActive = selectedDealId === deal.id;
                                                return (
                                                    <div 
                                                        key={deal.id}
                                                        onClick={() => setSelectedDealId(deal.id)}
                                                        onMouseEnter={() => setHoveredDealId(deal.id)}
                                                        onMouseLeave={() => setHoveredDealId(null)}
                                                        className={cn(
                                                            "rounded-lg p-3 flex flex-col border transition-all cursor-pointer relative overflow-hidden",
                                                            isActive 
                                                                ? "dark:bg-[#111B2E] bg-white border-indigo-500/50 shadow-md ring-1 ring-indigo-500/20" 
                                                                : "dark:bg-[#0B1220] bg-white dark:border-white/[0.06] border-slate-200 hover:border-indigo-300 dark:hover:border-slate-500 shadow-sm"
                                                        )}
                                                    >
                                                        <p className="text-[10.5px] font-bold dark:text-white text-slate-800 leading-tight mb-2 pr-2">{deal.name}</p>
                                                        
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[14px] font-bold dark:text-white text-slate-900 leading-none">${deal.value.toLocaleString()}</span>
                                                            <span className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500">{deal.prob}% prob</span>
                                                        </div>
                                                        
                                                        {/* Progress bar */}
                                                        <div className="h-1 w-full dark:bg-[#16233A] bg-slate-100 rounded-full overflow-hidden mb-2">
                                                            <div 
                                                                className={cn(
                                                                    "h-full rounded-full",
                                                                    deal.stage === "Won" ? "bg-emerald-500" :
                                                                    deal.id === '3' ? "bg-indigo-500" :
                                                                    "bg-indigo-400"
                                                                )} 
                                                                style={{ width: `${deal.prob}%` }} 
                                                            />
                                                        </div>

                                                        <div className="flex items-center justify-between mt-1">
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm dark:bg-[#16233A] bg-slate-100 text-[8.5px] font-bold dark:text-[#9CA3AF] text-slate-500 border dark:border-white/[0.06] border-slate-200">
                                                                {deal.tag.replace('Fair', '').replace('Expo', '').trim()}
                                                            </span>
                                                            
                                                            {/* Quick Actions overlay on hover */}
                                                            <AnimatePresence>
                                                                {hoveredDealId === deal.id && !isActive && (
                                                                    <motion.div 
                                                                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                                                                        className="flex items-center gap-1"
                                                                    >
                                                                        <div className="size-5 rounded dark:bg-[#16233A] bg-slate-100 flex items-center justify-center dark:text-slate-300 text-slate-600 hover:text-indigo-500 transition-colors"><Mail className="size-2.5" /></div>
                                                                        <div className="size-5 rounded dark:bg-[#16233A] bg-slate-100 flex items-center justify-center dark:text-slate-300 text-slate-600 hover:text-indigo-500 transition-colors"><ListTodo className="size-2.5" /></div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Transparency Mini Bar */}
                    <div className="rounded-lg border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white px-3 py-2 flex flex-col gap-1 shadow-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold dark:text-white text-slate-800 uppercase tracking-widest">Transparency Audit</span>
                        </div>
                        <div className="flex items-center flex-wrap gap-1.5 text-[9.5px] font-medium dark:text-slate-400 text-slate-500">
                            <span>Source: CRM</span>
                            <span className="size-1 rounded-full dark:bg-slate-600 bg-slate-300" />
                            <span>Fetched: 2026-02-01</span>
                            <span className="size-1 rounded-full dark:bg-slate-600 bg-slate-300" />
                            <span>Confidence: <span className="text-emerald-500 font-bold">85%</span></span>
                            <span className="ml-1 px-1.5 py-0.5 rounded-sm dark:bg-[#16233A] bg-slate-100 text-[8.5px] font-bold border dark:border-white/[0.06] border-slate-200 shadow-sm">Munich Auto.</span>
                        </div>
                    </div>

                </motion.div>

                {/* RIGHT PANEL: Deal Detail Panel */}
                <motion.div
                    key={activeDeal.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex flex-col gap-4"
                >
                    {/* Deal Header Overview */}
                    <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white p-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-[20px] rounded-full pointer-events-none"></div>
                        
                        <div className="flex items-center justify-between mb-2">
                             <span className="inline-flex items-center justify-center rounded uppercase tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 shadow-sm">
                                 {activeDeal.stage}
                             </span>
                        </div>
                        
                        <h2 className="text-[16px] font-bold dark:text-white text-slate-900 leading-tight mb-3">
                            {activeDeal.name}
                        </h2>
                        
                        <div className="flex items-center gap-2 mb-4">
                            <button className="flex-1 h-7 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] hover:shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all flex items-center justify-center gap-1.5">
                                <CheckCircle2 className="size-3" /> Won
                            </button>
                            <button className="h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm">
                                Proposal
                            </button>
                            <button className="h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm">
                                Task
                            </button>
                        </div>

                        {/* Info Grid */}
                        <div className="flex flex-col gap-2 text-[10.5px]">
                             <div className="flex items-center justify-between border-b dark:border-white/[0.06] border-slate-100 pb-1.5">
                                 <span className="dark:text-slate-400 text-slate-500 font-bold uppercase tracking-wide">Company</span>
                                 <span className="dark:text-white text-slate-800 font-bold">NovaAI Systems</span>
                             </div>
                             <div className="flex items-center justify-between border-b dark:border-white/[0.06] border-slate-100 pb-1.5 pt-0.5">
                                 <span className="dark:text-slate-400 text-slate-500 font-bold uppercase tracking-wide">Event</span>
                                 <span className="dark:text-slate-300 text-slate-700 dark:bg-[#111B2E] bg-slate-50 border dark:border-white/[0.06] border-slate-200 px-1.5 py-0.5 rounded font-bold">{activeDeal.tag}</span>
                             </div>
                             <div className="flex items-center justify-between border-b dark:border-white/[0.06] border-slate-100 pb-1.5 pt-0.5">
                                 <span className="dark:text-slate-400 text-slate-500 font-bold uppercase tracking-wide">Value</span>
                                 <span className="dark:text-emerald-400 text-emerald-600 font-bold text-[11.5px]">${activeDeal.value.toLocaleString()}</span>
                             </div>
                             <div className="flex items-center justify-between border-b dark:border-white/[0.06] border-slate-100 pb-1.5 pt-0.5">
                                 <span className="dark:text-slate-400 text-slate-500 font-bold uppercase tracking-wide">Probability</span>
                                 <span className="dark:text-white text-slate-800 font-bold">{activeDeal.prob}%</span>
                             </div>
                             <div className="flex items-center justify-between pt-0.5">
                                 <span className="dark:text-slate-400 text-slate-500 font-bold uppercase tracking-wide">Close date</span>
                                 <span className="dark:text-white text-slate-800 font-bold">Mar 10, 2026</span>
                             </div>
                        </div>
                    </div>

                    {/* Deal Economics Card */}
                    <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white overflow-hidden flex flex-col shadow-sm">
                        <div className="p-3 flex items-center justify-between border-b dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-slate-50">
                            <h3 className="text-[11px] font-bold dark:text-white text-slate-900 uppercase tracking-widest">Economics</h3>
                            <ChevronUp className="size-3 dark:text-slate-400 text-slate-500" />
                        </div>
                        <div className="p-3 flex flex-col gap-2 border-b dark:border-white/[0.06] border-slate-200">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 w-24">Revenue</span>
                                <input type="text" readOnly value={`$${activeDeal.value.toLocaleString()}`} className="h-7 flex-1 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#111B2E] bg-slate-50 px-2 py-1 text-[10px] font-bold dark:text-white text-slate-900 focus:outline-none shadow-inner" />
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 w-24">Booth cost</span>
                                <input type="text" readOnly value="$8,000" className="h-7 flex-1 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#111B2E] bg-slate-50 px-2 py-1 text-[10px] font-bold dark:text-white text-slate-900 focus:outline-none shadow-inner" />
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 w-24">Travel</span>
                                <input type="text" readOnly value="$2,500" className="h-7 flex-1 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#111B2E] bg-slate-50 px-2 py-1 text-[10px] font-bold dark:text-white text-slate-900 focus:outline-none shadow-inner" />
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 w-24">Accommodation</span>
                                <input type="text" readOnly value="$1,800" className="h-7 flex-1 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#111B2E] bg-slate-50 px-2 py-1 text-[10px] font-bold dark:text-white text-slate-900 focus:outline-none shadow-inner" />
                            </div>
                             <div className="flex items-center justify-between gap-3">
                                <span className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 w-24">Vendor srvs.</span>
                                <input type="text" readOnly value="$3,000" className="h-7 flex-1 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#111B2E] bg-slate-50 px-2 py-1 text-[10px] font-bold dark:text-white text-slate-900 focus:outline-none shadow-inner" />
                            </div>
                        </div>
                        <div className="p-3 dark:bg-[#070B14]/50 bg-slate-50">
                            <div className="flex justify-between items-end mb-1">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-widest">Net Profit</span>
                                    <span className="text-[14px] font-bold dark:text-emerald-400 text-emerald-600 leading-none">$19,700</span>
                                </div>
                                <div className="flex flex-col gap-0.5 text-right">
                                    <span className="text-[9px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-widest">Margin</span>
                                    <span className="text-[14px] font-bold dark:text-white text-slate-800 leading-none">56%</span>
                                </div>
                                <div className="flex flex-col gap-0.5 text-right">
                                    <span className="text-[9px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-widest">ROI</span>
                                    <span className="text-[14px] font-bold dark:text-white text-slate-800 leading-none">1.3x</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Copilot AI Recommendation (The New Feature) */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="rounded-xl border border-purple-200 dark:border-purple-500/30 dark:bg-[#0B1220] bg-purple-50 p-3 shadow-md relative overflow-hidden group"
                    >
                        <div className="absolute top-[-20px] left-[-20px] w-20 h-20 bg-purple-500/10 blur-[20px] rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-colors duration-500"></div>
                        <h3 className="text-[10px] font-bold dark:text-white text-slate-900 mb-2.5 flex items-center gap-1.5 uppercase tracking-wide">
                            <Sparkles className="size-3 text-purple-500" /> Action Insights
                        </h3>
                        <ul className="space-y-1.5 text-[10.5px]">
                            <li className="flex items-start">
                                <span className="mr-1.5 text-purple-500 mt-[3px] text-[7px]">●</span> 
                                <span className="dark:text-slate-300 text-slate-700 leading-snug font-medium">Reduce travel estimate by 10% to secure target 60% margin framework.</span>
                            </li>
                            <li className="flex items-start">
                                <span className="mr-1.5 text-purple-500 mt-[3px] text-[7px]">●</span> 
                                <span className="dark:text-slate-300 text-slate-700 leading-snug font-medium">Likely to close: Queue up contract drafting sequence.</span>
                            </li>
                        </ul>
                        <button className="h-7 mt-3 w-full rounded-md bg-purple-600 hover:bg-purple-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(168,85,247,0.3)] hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center gap-1">
                            Ask Copilot to Apply
                        </button>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
