"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    BarChart3,
    TrendingUp,
    Users,
    DollarSign,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    ChevronDown,
    Wand2,
    Sparkles
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from "recharts";
import { cn } from "@/lib/utils";

const pipelineData = [
    { month: "Jan", leads: 42, deals: 18, revenue: 52000 },
    { month: "Feb", leads: 58, deals: 24, revenue: 68000 },
    { month: "Mar", leads: 35, deals: 15, revenue: 41000 },
    { month: "Apr", leads: 72, deals: 32, revenue: 91000 },
    { month: "May", leads: 65, deals: 28, revenue: 78000 },
    { month: "Jun", leads: 88, deals: 41, revenue: 112000 },
];

const seqData = [
    { name: "Open", value: 64 },
    { name: "Click", value: 28 },
    { name: "Reply", value: 12 },
    { name: "Convert", value: 5 },
];

const metricsKpis = [
    { label: "Pipeline Value", value: "$442K", delta: "+18.3%", icon: DollarSign, trend: "up" },
    { label: "Active Leads", value: "312", delta: "+12.8%", icon: Users, trend: "up" },
    { label: "Events This Qtr", value: "8", delta: "-1", icon: Calendar, trend: "down" },
    { label: "Avg Deal Size", value: "$24.5K", delta: "+6.1%", icon: TrendingUp, trend: "up" },
];

export function AnalyticsSection() {
    const [hoveredBar, setHoveredBar] = useState<number | null>(null);

    return (
        <div className="space-y-4 max-w-[1200px] mx-auto pb-14">
            {/* Header & Controls */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3 border-b dark:border-white/[0.06] border-slate-200"
            >
                <div className="space-y-1">
                    <h1 className="text-base font-bold dark:text-white text-slate-900 tracking-tight">Analytics</h1>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Real-time KPIs, pipeline metrics, and sequence performance
                    </p>
                </div>
                
                <div className="flex gap-2">
                    <button className="h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm flex items-center gap-1.5">
                        <Calendar className="size-3" /> Last 30 Days <ChevronDown className="size-3 ml-1" />
                    </button>
                    <button className="h-7 px-3 rounded-md border dark:border-indigo-500/30 border-indigo-200 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-[10px] font-bold dark:text-indigo-300 text-indigo-700 transition-colors shadow-sm flex items-center gap-1.5">
                        <BarChart3 className="size-3" /> Export Report
                    </button>
                </div>
            </motion.div>

            {/* KPI Strip */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metricsKpis.map((kpi, i) => {
                    const Icon = kpi.icon;
                    return (
                        <motion.div
                            key={kpi.label}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="relative overflow-hidden rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white p-3 shadow-sm group hover:border-indigo-500/30 dark:hover:border-indigo-500/30 transition-colors cursor-default"
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 blur-[20px] rounded-full pointer-events-none group-hover:bg-indigo-600/10 transition-colors" />
                            <div className="flex items-center justify-between mb-2 relative z-10">
                                <div className="size-6 rounded-md dark:bg-[#111B2E] bg-slate-50 border dark:border-white/[0.06] border-slate-100 flex items-center justify-center">
                                    <Icon className="size-3 text-indigo-500 dark:text-indigo-400" />
                                </div>
                                <span className={cn(
                                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                                    kpi.trend === "up" 
                                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                                        : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                                )}>
                                    {kpi.trend === "up" ? <ArrowUpRight className="size-2.5" /> : <ArrowDownRight className="size-2.5" />}
                                    {kpi.delta}
                                </span>
                            </div>
                            <div className="relative z-10">
                                <p className="text-[18px] font-bold dark:text-white text-slate-900 leading-tight">{kpi.value}</p>
                                <p className="text-[10px] font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wide">{kpi.label}</p>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Main Charts & Insights */}
            <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
                
                <div className="space-y-4">
                    {/* Pipeline chart */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white shadow-sm flex flex-col"
                    >
                        <div className="p-4 border-b dark:border-white/[0.06] border-slate-100">
                            <h2 className="text-[13px] font-bold dark:text-white text-slate-900">Pipeline Trend</h2>
                            <p className="text-[10px] font-medium dark:text-slate-400 text-slate-500 mt-0.5">Leads vs deals sourced over time</p>
                        </div>
                        <div className="p-4 pt-6 h-[260px] pb-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={pipelineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="fillLeads" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                                            <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="fillDeals" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                                            <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis 
                                        dataKey="month" 
                                        tick={{ fontSize: 9.5, fill: "#9ca3af", fontWeight: 600 }} 
                                        axisLine={false} 
                                        tickLine={false} 
                                        dy={10}
                                    />
                                    <YAxis 
                                        tick={{ fontSize: 9.5, fill: "#9ca3af", fontWeight: 600 }} 
                                        axisLine={false} 
                                        tickLine={false} 
                                        dx={-10}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "rgba(11, 18, 32, 0.9)",
                                            borderColor: "rgba(255,255,255,0.06)",
                                            borderRadius: "8px",
                                            fontSize: "10.5px",
                                            fontWeight: 600,
                                            color: "#fff",
                                            boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
                                        }}
                                        itemStyle={{ fontSize: "10px", fontWeight: 600 }}
                                    />
                                    <Area type="monotone" dataKey="leads" stroke="#818cf8" fill="url(#fillLeads)" strokeWidth={2.5} />
                                    <Area type="monotone" dataKey="deals" stroke="#34d399" fill="url(#fillDeals)" strokeWidth={2.5} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Sequence funnel */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white shadow-sm flex flex-col"
                    >
                        <div className="p-4 border-b dark:border-white/[0.06] border-slate-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-[13px] font-bold dark:text-white text-slate-900">Sequence Funnel</h2>
                                <p className="text-[10px] font-medium dark:text-slate-400 text-slate-500 mt-0.5">Aggregate email engagement rates (%)</p>
                            </div>
                        </div>
                        <div className="p-4 pt-5 h-[240px] pb-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={seqData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                    <XAxis type="number" tick={{ fontSize: 9.5, fill: "#9ca3af", fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9.5, fill: "#9ca3af", fontWeight: 600 }} axisLine={false} tickLine={false} width={50} />
                                    <Tooltip
                                        cursor={{ fill: "rgba(16, 185, 129, 0.05)" }}
                                        contentStyle={{
                                            backgroundColor: "rgba(11, 18, 32, 0.9)",
                                            borderColor: "rgba(255,255,255,0.06)",
                                            borderRadius: "8px",
                                            fontSize: "10px",
                                            fontWeight: 600,
                                            color: "#fff"
                                        }}
                                    />
                                    <Bar 
                                        dataKey="value" 
                                        radius={[0, 4, 4, 0]} 
                                        barSize={20}
                                        onMouseEnter={(_, index) => setHoveredBar(index)}
                                        onMouseLeave={() => setHoveredBar(null)}
                                    >
                                        {seqData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={hoveredBar === index ? "#6366f1" : "url(#barGradient)"} 
                                                className="transition-all duration-300"
                                            />
                                        ))}
                                    </Bar>
                                    <defs>
                                        <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#4f46e5" />
                                            <stop offset="100%" stopColor="#818cf8" />
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>
                </div>

                {/* Right Column: AI Insights & Quick Stats */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-col gap-4"
                >
                    {/* Copilot Insights Card */}
                    <div className="rounded-xl border border-indigo-500/30 dark:bg-[#0B1220] bg-indigo-50/50 p-4 shadow-sm relative overflow-hidden flex-1">
                        <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-indigo-500/10 blur-[40px] rounded-full pointer-events-none" />
                        
                        <div className="flex items-center gap-2 mb-4 relative z-10">
                            <div className="size-6 rounded-md bg-indigo-600 flex items-center justify-center shadow-md">
                                <Sparkles className="size-3 text-white" />
                            </div>
                            <h3 className="text-[12px] font-bold dark:text-white text-slate-900">AI Insights</h3>
                        </div>

                        <div className="space-y-3 relative z-10">
                            {/* Insight 1 */}
                            <div className="p-3 rounded-lg dark:bg-[#070B14] bg-white border dark:border-white/[0.06] border-indigo-100 shadow-sm">
                                <h4 className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mb-1">
                                    <TrendingUp className="size-3" /> Velocity Increase
                                </h4>
                                <p className="text-[9.5px] leading-relaxed dark:text-slate-300 text-slate-600 font-medium">
                                    Sales cycles are <strong className="dark:text-white text-slate-900">14% shorter</strong> this month. Consider aggressively scaling out the <span className="underline decoration-indigo-500/30 underline-offset-2">Enterprise Q3</span> sequence.
                                </p>
                            </div>
                            {/* Insight 2 */}
                            <div className="p-3 rounded-lg dark:bg-[#070B14] bg-white border dark:border-white/[0.06] border-indigo-100 shadow-sm">
                                <h4 className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-1">
                                    <Wand2 className="size-3" /> Funnel Bottleneck
                                </h4>
                                <p className="text-[9.5px] leading-relaxed dark:text-slate-300 text-slate-600 font-medium">
                                    Reply rates dropped for <span className="underline decoration-emerald-500/30 underline-offset-2">Berlin Tech</span>. Recommend enabling multi-channel followups (SMS).
                                </p>
                            </div>
                        </div>

                        <button className="w-full mt-4 h-7 rounded-md dark:bg-white/[0.05] bg-indigo-100 hover:bg-indigo-200 dark:hover:bg-white/[0.1] text-[9.5px] font-bold dark:text-white text-indigo-900 transition-colors border border-transparent dark:border-white/[0.06]">
                            View All Insights
                        </button>
                    </div>

                    {/* Quick Metric */}
                    <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white p-4 shadow-sm relative overflow-hidden">
                        <h3 className="text-[10.5px] font-bold dark:text-slate-400 text-slate-500 uppercase tracking-wide mb-3">Database Health</h3>
                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold mb-1">
                                    <span className="dark:text-white text-slate-800">Deliverability</span>
                                    <span className="text-emerald-500">99.8%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-[#111B2E] rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-[99.8%]" />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold mb-1">
                                    <span className="dark:text-white text-slate-800">Bounce Rate</span>
                                    <span className="text-amber-500">1.2%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-[#111B2E] rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 w-[1.2%]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}

