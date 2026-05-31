import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronDown,
    Zap,
    Play,
    Pause,
    Clock,
    CheckCircle2,
    XCircle,
    PlusCircle,
    Settings2,
    Search,
    RefreshCw,
    ShieldCheck,
    FileText,
    History,
    Sparkles,
    Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

const workflows = [
    { id: 1, name: "Lead Intake → Assign Owner", desc: "New lead → assign owner → create task → optional sequence", status: "Active" },
    { id: 2, name: "Reply Received → Stop Sequence", desc: "Auto-stop sequence → create follow-up task", status: "Active" },
    { id: 3, name: "Deal → Proposal Checklist", desc: "When stage = Proposal → tasks + reminders", status: "Active" },
    { id: 4, name: "Deal Won → Profit & ROI Update", desc: "Compute profit → update dashboard → notify team", status: "Active" },
    { id: 5, name: "Import Completed → Deduplicate", desc: "Detect duplicates → merge suggestions", status: "Paused" },
];

export function AutomationSection() {
    return (
        <div className="space-y-4 max-w-[1200px] mx-auto pb-14">
            
            {/* Top Navigation & Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col gap-4 pb-3 border-b dark:border-white/[0.06] border-slate-200"
            >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-0.5">
                        <h1 className="text-base font-bold dark:text-white text-slate-900 tracking-tight">Automation</h1>
                        <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Playbooks that run your CRM — safely, with approvals</p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto pt-2 sm:pt-0">
                        <button className="h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm">
                            Templates
                        </button>
                        <button className="h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm">
                            Dry Run
                        </button>
                        <button className="h-7 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-colors">
                            New Workflow
                        </button>
                    </div>
                </div>

                {/* Global Metadata Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-slate-50 px-3 py-2.5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px]">
                        <div className="flex items-center gap-2">
                            <span className="dark:text-slate-400 text-slate-500 font-bold">Workspace:</span>
                            <span className="dark:text-white text-slate-900 font-bold dark:bg-[#111B2E] bg-white px-2 py-0.5 rounded border dark:border-white/[0.06] border-slate-200 shadow-sm">Prism Connex Workspace</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="dark:text-slate-400 text-slate-500 font-bold">Approvals:</span>
                            <span className="dark:text-white text-slate-900 font-bold dark:bg-[#111B2E] bg-white px-2 py-0.5 rounded border dark:border-white/[0.06] border-slate-200 shadow-sm">Enabled</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="dark:text-slate-400 text-slate-500 font-bold">Retry policy:</span>
                            <span className="dark:text-white text-slate-900 font-bold dark:bg-[#111B2E] bg-white px-2 py-0.5 rounded border dark:border-white/[0.06] border-slate-200 shadow-sm">Smart retries</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="dark:text-slate-400 text-slate-500 font-bold">Last run:</span>
                            <span className="dark:text-white text-slate-900 font-bold dark:bg-[#111B2E] bg-white px-2 py-0.5 rounded border dark:border-white/[0.06] border-slate-200 shadow-sm">Today 14:22</span>
                        </div>
                    </div>
                    <div className="px-2.5 py-0.5 rounded-full dark:bg-emerald-500/10 bg-emerald-50 border dark:border-transparent border-emerald-200 text-emerald-600 dark:text-emerald-400 text-[9.5px] font-bold shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                        Engine Active
                    </div>
                </div>
            </motion.div>

            {/* Main 3-Column Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_280px] gap-4 items-start h-[calc(100vh-190px)] min-h-[500px]">
                
                {/* COLUMN 1: WORKFLOWS */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="flex flex-col rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white h-full overflow-hidden shadow-sm"
                >
                    <div className="p-3 border-b dark:border-white/[0.06] border-slate-200 bg-slate-50/50 dark:bg-[#070B14]">
                        <h2 className="text-[11px] font-bold dark:text-white text-slate-900 tracking-wide uppercase mb-3">Workflows</h2>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-slate-400 dark:text-[#6B7280]" />
                            <input 
                                type="text" 
                                placeholder="Search workflows..." 
                                className="w-full h-8 dark:bg-[#111B2E] bg-white border dark:border-white/[0.06] border-slate-200 rounded-md pl-8 pr-3 text-[10px] font-medium dark:text-white text-slate-900 placeholder:text-slate-400 dark:placeholder:text-[#6B7280] shadow-inner focus:outline-none focus:border-indigo-500/50 transition-colors"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                        {workflows.map((wf) => (
                            <div 
                                key={wf.id}
                                className={cn(
                                    "p-2.5 rounded-md border cursor-pointer transition-all duration-300 relative group overflow-hidden",
                                    wf.id === 1 
                                        ? "dark:bg-indigo-500/5 bg-indigo-50 border-indigo-200 dark:border-indigo-500/40 shadow-sm" 
                                        : "dark:bg-transparent bg-white border-transparent dark:border-transparent hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                )}
                            >
                                {wf.id === 1 && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 dark:from-indigo-500/10 to-transparent pointer-events-none"></div>}
                                
                                <div className="flex justify-between items-start mb-1 relative z-10">
                                    <h3 className={cn("text-[10px] font-bold leading-tight", wf.id === 1 ? "text-indigo-900 dark:text-indigo-100" : "text-slate-800 dark:text-white")}>{wf.name}</h3>
                                    <span className={cn(
                                        "text-[8.5px] font-bold uppercase tracking-widest px-1 py-0.5 rounded shrink-0",
                                        wf.status === "Active" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-transparent" : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-transparent"
                                    )}>
                                        {wf.status}
                                    </span>
                                </div>
                                <p className={cn("text-[9px] font-medium max-w-[95%] leading-relaxed relative z-10 line-clamp-2", wf.id === 1 ? "text-indigo-700/80 dark:text-[#818CF8]" : "text-slate-500 dark:text-slate-400")}>
                                    {wf.desc}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="p-2 border-t dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-slate-50">
                        <button className="w-full text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
                            View all workflows
                        </button>
                    </div>
                </motion.div>

                {/* COLUMN 2: VISUAL CANVAS */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="flex flex-col rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white h-full overflow-hidden relative shadow-sm"
                >
                    {/* Background Dot Grid */}
                    <div className="absolute inset-0 pattern-dots dark:pattern-[#22304A] pattern-slate-200 pattern-bg-transparent pattern-size-4 dark:pattern-opacity-40 pointer-events-none"></div>

                    {/* Canvas Header */}
                    <div className="relative z-10 flex items-center justify-between p-3 border-b dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220]/80 bg-white/80 backdrop-blur-md">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[13px] font-bold dark:text-white text-slate-900">Lead Intake → Assign Owner</h2>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-transparent text-[9.5px] font-bold uppercase tracking-wider">Active</span>
                        </div>
                    </div>

                    {/* Nodes Area (Simulated Flowchart) */}
                    <div className="relative z-10 flex-1 overflow-auto flex flex-col items-center py-6">
                        
                        {/* 1. Trigger Node */}
                        <div className="w-[180px] rounded-lg border border-indigo-200 dark:border-indigo-500/30 dark:bg-[#0B1220] bg-white p-2.5 text-center shadow-sm relative group">
                            <p className="text-[10px] font-bold dark:text-white text-slate-900 border-b border-indigo-100 dark:border-indigo-500/20 pb-1.5 mb-1.5">Trigger</p>
                            <p className="text-[9.5px] font-medium text-indigo-600 dark:text-[#9CA3AF]">Lead Created</p>
                        </div>

                        {/* Line segment with animated data dot */}
                        <div className="w-px h-8 dark:bg-indigo-500/30 bg-indigo-200 relative">
                            <motion.div 
                                className="absolute w-1.5 h-1.5 rounded-full bg-indigo-500 left-1/2 -ml-[3px]"
                                animate={{ top: [0, 32] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            />
                        </div>

                        {/* 2. Check Node */}
                        <div className="w-[180px] rounded-lg border dark:border-white/[0.08] border-slate-300 dark:bg-[#111B2E] bg-slate-50 p-2.5 text-center relative shadow-sm">
                            <p className="text-[10px] font-bold dark:text-white text-slate-800 border-b dark:border-white/[0.06] border-slate-200 pb-1.5 mb-1.5">Check: Source & Confidence</p>
                            <p className="text-[9.5px] font-medium text-slate-500 dark:text-[#6B7280]">Confidence ≥ 70%</p>
                        </div>

                        {/* Line segment with animated data dot */}
                        <div className="w-px h-8 dark:bg-indigo-500/30 bg-indigo-200 relative">
                             <motion.div 
                                className="absolute w-1.5 h-1.5 rounded-full bg-indigo-500 left-1/2 -ml-[3px]"
                                animate={{ top: [0, 32] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: 0.5 }}
                            />
                        </div>

                        {/* 3. Action Node (Active Selection) */}
                        <div className="w-[200px] rounded-lg border-2 border-indigo-500 dark:bg-[#0B1220] bg-white p-3 text-center shadow-[0_0_20px_rgba(99,102,241,0.15)] relative z-10">
                            <div className="absolute -inset-1 bg-indigo-500/10 rounded-xl blur-md -z-10"></div>
                            <p className="text-[11px] font-bold dark:text-white text-slate-900 mb-1">Action: Assign Owner</p>
                            <p className="text-[9.5px] font-medium text-indigo-600 dark:text-indigo-300">Round-robin: Admin, Sales</p>
                        </div>

                         {/* Hovering AI Copilot Optimization Widget */}
                         <motion.div 
                            initial={{ y: 0 }}
                            animate={{ y: [-4, 4, -4] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute right-[50%] mr-[-160px] top-[140px] w-[140px] rounded-md border border-purple-500/30 dark:bg-[#16233A] bg-purple-50 p-2 shadow-lg z-20"
                        >
                            <div className="flex items-center gap-1.5 mb-1 text-purple-600 dark:text-purple-400">
                                <Sparkles className="size-3" />
                                <span className="text-[9.5px] font-bold uppercase tracking-wide">AI Tip</span>
                            </div>
                            <p className="text-[9px] font-medium dark:text-slate-300 text-purple-900/80 leading-tight">Remove inactive reps from round-robin array to fix queue stalls.</p>
                            <button className="mt-2 text-[9px] font-bold text-white bg-purple-500 px-2 py-0.5 rounded shadow-sm w-full">Apply Fix</button>
                        </motion.div>

                        {/* Line segment */}
                        <div className="w-px h-8 dark:bg-white/[0.08] bg-slate-300 relative">
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full border dark:border-white/[0.08] border-slate-300 dark:bg-[#0B1220] bg-white"></div>
                        </div>

                        {/* 4. Action Node */}
                        <div className="w-[180px] rounded-lg border dark:border-white/[0.08] border-slate-300 dark:bg-[#111B2E] bg-slate-50 p-2.5 text-center relative shadow-sm">
                            <p className="text-[10px] font-bold dark:text-white text-slate-800 border-b dark:border-white/[0.06] border-slate-200 pb-1.5 mb-1.5">Action: Create Task</p>
                            <p className="text-[9.5px] font-medium text-slate-500 dark:text-[#6B7280]">Task: Send intro email</p>
                        </div>

                         {/* Line segment */}
                         <div className="w-px h-8 dark:bg-white/[0.08] bg-slate-300 relative"></div>

                        {/* 5. Decision Diamond Area */}
                        <div className="relative w-full max-w-[300px] flex justify-center">
                            {/* Horizontal Line out right */}
                            <div className="absolute right-[50%] top-1/2 w-[80px] h-px dark:bg-white/[0.08] bg-slate-300 translate-x-full"></div>
                            <div className="absolute left-[50%] top-1/2 translate-x-[65px] -translate-y-[12px] text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">Yes</div>
                            
                            {/* Vertical Line out bottom */}
                            <div className="absolute bottom-[-24px] left-1/2 w-px h-[24px] dark:bg-white/[0.08] bg-slate-300"></div>
                            <div className="absolute bottom-[-12px] left-[50%] translate-x-[6px] text-[9.5px] font-bold text-slate-500 dark:text-[#6B7280]">No</div>

                            <div className="w-[100px] h-[60px] flex items-center justify-center relative shadow-sm">
                                {/* CSS Diamond */}
                                <div className="absolute w-[60px] h-[60px] dark:bg-[#0B1220] bg-white border dark:border-white/[0.08] border-slate-300 rotate-45 rounded-md"></div>
                                <p className="text-[9.5px] font-bold dark:text-white text-slate-800 relative z-10 text-center leading-tight">Decision:<br/>Start Seq?</p>
                            </div>

                             {/* Branch Right - Action Node */}
                            <div className="absolute right-[10px] top-1/2 -translate-y-1/2 w-[110px] rounded-lg border border-emerald-200 dark:border-emerald-500/30 dark:bg-[#16233A] bg-emerald-50 p-2 text-center shadow-sm">
                                <p className="text-[9.5px] font-bold dark:text-white text-slate-800 mb-0.5">Add to Seq</p>
                                <p className="text-[9px] font-medium text-emerald-700 dark:text-[#9CA3AF] leading-tight flex items-center justify-center gap-1"><Check className="size-2.5" /> Berlin Outb...</p>
                            </div>
                        </div>
                        
                        {/* 6. End Node */}
                         <div className="mt-6 text-[9.5px] font-bold dark:text-[#6B7280] text-slate-500 uppercase tracking-widest dark:bg-[#111B2E] bg-slate-50 border dark:border-white/[0.06] border-slate-200 px-3 py-1 rounded-full shadow-sm">
                            End
                        </div>

                    </div>

                    {/* Canvas Footer Actions */}
                    <div className="relative z-10 p-3 border-t dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220]/90 bg-white/90 backdrop-blur flex items-center justify-center gap-2 w-full shrink-0">
                        <button className="h-7 px-4 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm">
                            Test Run
                        </button>
                        <button className="h-7 px-4 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm">
                            Save
                        </button>
                        <button className="h-7 px-6 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-colors">
                            Publish
                        </button>
                    </div>
                </motion.div>

                {/* COLUMN 3: CONFIGURATION */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="flex flex-col gap-4 h-full"
                >
                    {/* Node Settings */}
                    <div className="rounded-xl border border-indigo-500/30 dark:bg-[#0B1220] bg-white p-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-[30px] rounded-full pointer-events-none"></div>
                        <h3 className="text-[11px] font-bold dark:text-white text-slate-900 tracking-wide uppercase mb-3 relative z-10 flex items-center justify-between">
                            Node Settings 
                            <span className="text-[9px] font-mono font-bold dark:text-indigo-400 text-indigo-700 dark:bg-indigo-500/10 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/20">Action_2</span>
                        </h3>
                        
                        <div className="space-y-3 relative z-10">
                            <div>
                                <label className="text-[10px] font-bold dark:text-slate-400 text-slate-500 mb-1 block">Owner mode</label>
                                <div className="h-7 px-2.5 w-full rounded-md border dark:border-white/[0.08] border-slate-300 dark:bg-[#111B2E] bg-white hover:border-slate-400 flex items-center justify-between cursor-pointer text-[10px] font-medium dark:text-white text-slate-900 transition-colors shadow-sm">
                                    Round-robin <ChevronDown className="size-3 dark:text-[#6B7280] text-slate-400" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold dark:text-slate-400 text-slate-500 mb-1 block">Team</label>
                                <div className="h-7 px-2.5 w-full rounded-md border dark:border-white/[0.08] border-slate-300 dark:bg-[#111B2E] bg-white hover:border-slate-400 flex items-center justify-between cursor-pointer text-[10px] font-medium dark:text-white text-slate-900 transition-colors shadow-sm">
                                    Sales <ChevronDown className="size-3 dark:text-[#6B7280] text-slate-400" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold dark:text-slate-400 text-slate-500 mb-1 block">Fallback owner</label>
                                <div className="h-7 px-2.5 w-full rounded-md border dark:border-white/[0.08] border-slate-300 dark:bg-[#111B2E] bg-white hover:border-slate-400 flex items-center justify-between cursor-pointer text-[10px] font-medium dark:text-white text-slate-900 transition-colors shadow-sm">
                                    Admin <ChevronDown className="size-3 dark:text-[#6B7280] text-slate-400" />
                                </div>
                            </div>
                            
                            <div className="pt-2">
                                <div className="flex items-center justify-between p-2 rounded-md dark:bg-white/[0.02] bg-slate-50 border dark:border-white/[0.06] border-slate-200">
                                    <span className="text-[10.5px] font-bold dark:text-[#E5E7EB] text-slate-700">Skip if already assigned</span>
                                    <Switch checked={true} className="scale-75 origin-right" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Safety & Approvals */}
                    <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white p-4 shadow-sm">
                       <h3 className="text-[11px] font-bold dark:text-white text-slate-900 tracking-wide uppercase mb-3">Safety & Approvals</h3>
                        
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-2 rounded-md dark:bg-[#111B2E] bg-slate-50 border dark:border-white/[0.06] border-slate-200">
                                <span className="text-[10.5px] font-bold dark:text-[#E5E7EB] text-slate-700">Dry Run mode</span>
                                <div className="w-8 h-4 dark:bg-[#374151] bg-slate-300 rounded-full relative cursor-pointer"><div className="w-3 h-3 dark:bg-[#9CA3AF] bg-white rounded-full absolute left-[3px] top-[2px] shadow-sm"></div></div>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-md dark:bg-[#111B2E] bg-slate-50 border dark:border-white/[0.06] border-slate-200">
                                <span className="text-[10.5px] font-bold dark:text-[#E5E7EB] text-slate-700 max-w-[120px] leading-tight">Approval required for bulk actions</span>
                                <Switch checked={true} className="scale-75 origin-right" />
                            </div>
                            <div className="flex items-center justify-between p-2 rounded-md dark:bg-[#111B2E] bg-slate-50 border dark:border-white/[0.06] border-slate-200">
                                <span className="text-[10.5px] font-bold dark:text-[#E5E7EB] text-slate-700">Limit actions per hour</span>
                                <Switch checked={true} className="scale-75 origin-right" />
                            </div>
                            
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold dark:text-slate-400 text-slate-500 mb-1 block">Max emails/h</label>
                                    <input type="text" value="10" readOnly className="w-full h-7 dark:bg-[#111B2E] bg-slate-50 border dark:border-white/[0.06] border-slate-200 rounded-md px-2 font-mono text-[10px] font-medium dark:text-white text-slate-900 text-center shadow-inner focus:outline-none" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold dark:text-slate-400 text-slate-500 mb-1 block">Max updates/h</label>
                                    <input type="text" value="200" readOnly className="w-full h-7 dark:bg-[#111B2E] bg-slate-50 border dark:border-white/[0.06] border-slate-200 rounded-md px-2 font-mono text-[10px] font-medium dark:text-white text-slate-900 text-center shadow-inner focus:outline-none" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Run History */}
                    <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white p-4 shadow-sm flex-1 flex flex-col min-h-[160px]">
                        <h3 className="text-[11px] font-bold dark:text-white text-slate-900 tracking-wide uppercase mb-3 flex items-center gap-1.5"><History className="size-3.5"/> Run History</h3>
                        
                        <div className="flex text-[9.5px] font-bold dark:text-[#6B7280] text-slate-500 uppercase tracking-widest mb-1.5 px-1 pb-1.5 border-b dark:border-white/[0.06] border-slate-100">
                            <div className="w-[45px]">Time</div>
                            <div className="w-[55px]">Result</div>
                            <div className="flex-1">Notes</div>
                        </div>

                        <div className="flex-1 space-y-1 overflow-y-auto pr-1">
                            <div className="flex items-center text-[9.5px] font-medium py-1.5 border-b dark:border-white/[0.06] border-slate-100">
                                <div className="w-[45px] dark:text-[#9CA3AF] text-slate-500 flex items-center gap-1"><Clock className="size-2.5" />14:22</div>
                                <div className="w-[55px]"><span className="px-1 py-[2px] rounded text-[8.5px] font-bold uppercase dark:bg-emerald-500/10 bg-emerald-50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-transparent">Success</span></div>
                                <div className="flex-1 dark:text-white text-slate-800 truncate">Lead assigned + task created</div>
                            </div>
                            <div className="flex items-center text-[9.5px] font-medium py-1.5 border-b dark:border-white/[0.06] border-slate-100">
                                <div className="w-[45px] dark:text-[#9CA3AF] text-slate-500 flex items-center gap-1"><Clock className="size-2.5" />13:40</div>
                                <div className="w-[55px]"><span className="px-1 py-[2px] rounded text-[8.5px] font-bold uppercase dark:bg-emerald-500/10 bg-emerald-50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-transparent">Success</span></div>
                                <div className="flex-1 dark:text-white text-slate-800 truncate">Sequence started</div>
                            </div>
                            <div className="flex items-center text-[9.5px] font-medium py-1.5 border-b dark:border-white/[0.06] border-slate-100">
                                <div className="w-[45px] dark:text-[#9CA3AF] text-slate-500 flex items-center gap-1"><Clock className="size-2.5" />12:18</div>
                                <div className="w-[55px]"><span className="px-1 py-[2px] rounded text-[8.5px] font-bold uppercase dark:bg-amber-500/10 bg-amber-50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-transparent">Retry</span></div>
                                <div className="flex-1 dark:text-white text-slate-800 truncate">Temporary provider error</div>
                            </div>
                        </div>
                        
                        <div className="pt-2 mt-auto">
                           <button className="w-full h-7 rounded-md dark:bg-white/[0.05] bg-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.1] text-[10px] font-bold dark:text-white text-slate-700 transition-colors shadow-sm">
                               Open Full Logs
                           </button>
                        </div>
                    </div>

                </motion.div>
            </div>
        </div>
    );
}

