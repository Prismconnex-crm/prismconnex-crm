"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    ChevronDown,
    TrendingUp,
    Percent,
    Target,
    Phone,
    Mail,
    Calendar,
    CheckSquare,
    X,
    CalendarDays,
    Sparkles,
    CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// Detailed mock data matching the screenshot
const leadsList = [
    { id: "1", name: "Sarah Miller", company: "NovaAI Systems", srcLabel: "Berlin Tech Expo", srcType: "event", status: "New", conf: 91, owner: "Admin", email: "sarah@novaai...com", next: "Tomorrow", avatar: "S" },
    { id: "2", name: "David Lee", company: "CloudForge Ltd", srcLabel: "Import", srcType: "import", status: "Contacted", conf: 88, owner: "Admin", email: "david@cloudforge...", next: "Feb 4", avatar: "D" },
    { id: "3", name: "Amina Khan", company: "Medidata Europe", srcLabel: "Import", srcType: "import", status: "Qualified", conf: 79, owner: "Admin", email: "amina@medidata...", next: "Feb 5", avatar: "A" },
    { id: "4", name: "Mia Thompson", company: "ElectroMech Works", srcLabel: "Munich Automation Fair", srcType: "event", status: "New", conf: 74, owner: "Admin", email: "mia@electromech...", next: "Feb 5", avatar: "M" },
    { id: "5", name: "Elena Silva", company: "SecureNet Dynamics", srcLabel: "Licensed", srcType: "licensed", status: "Contacted", conf: 85, owner: "Admin", email: "elena@securenet...", next: "Feb 6", avatar: "E" },
];

const pipelineStages = [
    { name: "New", leads: [leadsList[0]] },
    { name: "Contacted", leads: [leadsList[0]] }, // Reusing for visual density as per image
    { name: "Qualified", leads: [leadsList[2]] },
    { name: "Proposal", leads: [leadsList[2]] },
    { name: "Won", leads: [leadsList[3]] },
];

const getStatusColor = (status: string) => {
    switch (status) {
        case 'New': return "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20";
        case 'Contacted': return "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20";
        case 'Qualified': return "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20";
        default: return "bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/20";
    }
};

const getSourceColor = (type: string) => {
    switch (type) {
        case 'event': return "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300";
        case 'import': return "bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300";
        default: return "bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-300";
    }
};

export function LeadsSection() {
    const [selectedLeadId, setSelectedLeadId] = useState<string>(leadsList[0].id);
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
    const [isSimulatingAI, setIsSimulatingAI] = useState(false);
    
    const activeLead = leadsList.find(c => c.id === selectedLeadId) || leadsList[0];

    // Simulate AI loading effect when modal opens
    useEffect(() => {
        if (isConvertModalOpen) {
            setIsSimulatingAI(true);
            const timer = setTimeout(() => setIsSimulatingAI(false), 1200);
            return () => clearTimeout(timer);
        }
    }, [isConvertModalOpen]);

    return (
        <div className="space-y-4 max-w-[1400px] mx-auto pb-14">
            
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b dark:border-white/[0.06] border-slate-200"
            >
                <div>
                    <h1 className="text-base font-bold tracking-tight dark:text-white text-slate-900 mb-0.5">
                        Leads
                    </h1>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Track prospects from event intelligence to deal pipeline
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm">
                        Import CSV/XLSX
                    </button>
                    <button className="h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm">
                        Export
                    </button>
                    <button className="h-7 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-colors">
                        Add Lead
                    </button>
                </div>
            </motion.div>

            {/* Top KPI Cards row */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3"
            >
                <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white p-3 shadow-sm flex flex-col justify-between h-[80px] hover:border-slate-300 dark:hover:border-[#374151] transition-colors cursor-default">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[#9CA3AF]">Total Leads</span>
                        <div className="size-5 rounded-md dark:bg-white/5 bg-slate-100 flex items-center justify-center">
                            <TrendingUp className="size-3 text-slate-500 dark:text-[#9CA3AF]" />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-[20px] font-bold dark:text-white text-slate-900 leading-none">245</span>
                        <span className="text-[10px] font-medium text-slate-500 dark:text-[#9CA3AF]">32px</span>
                    </div>
                </div>
                
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/20 dark:bg-[#0B1220] bg-indigo-50/30 p-3 shadow-sm flex flex-col justify-between h-[80px] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 blur-[20px] rounded-full group-hover:bg-indigo-500/20 transition-colors"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-400">Qualified</span>
                        <div className="size-5 rounded-md bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                            <Percent className="size-3 text-indigo-600 dark:text-indigo-400" />
                        </div>
                    </div>
                    <div className="text-[20px] font-bold text-indigo-700 dark:text-indigo-400 leading-none relative z-10">
                        68
                    </div>
                </div>

                <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white p-3 shadow-sm flex flex-col justify-between h-[80px] hover:border-slate-300 dark:hover:border-[#374151] transition-colors cursor-default">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[#9CA3AF]">Meetings</span>
                        <div className="size-5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                            <TrendingUp className="size-3 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                    <div className="text-[20px] font-bold text-emerald-600 dark:text-emerald-400 leading-none">
                        18
                    </div>
                </div>

                <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white p-3 shadow-sm flex flex-col justify-between h-[80px] hover:border-slate-300 dark:hover:border-[#374151] transition-colors cursor-default">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[#9CA3AF]">Conversion</span>
                        <div className="size-5 rounded-md dark:bg-white/5 bg-slate-100 flex items-center justify-center">
                            <Percent className="size-3 text-slate-500 dark:text-[#9CA3AF]" />
                        </div>
                    </div>
                    <div className="text-[20px] font-bold dark:text-slate-200 text-slate-800 leading-none">
                        18.9%
                    </div>
                </div>
            </motion.div>

            {/* Transparency Bar */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-slate-50 py-3 px-4 shadow-sm flex flex-col lg:flex-row items-center gap-4 lg:gap-6"
            >
                <div className="flex flex-wrap items-center justify-center gap-2 lg:gap-4 lg:border-r dark:border-white/[0.06] border-slate-200 lg:pr-6 w-full lg:w-auto">
                    <Target className="size-3.5 text-slate-400 dark:text-[#9CA3AF]" />
                    <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#9CA3AF]">Source:</span>
                    <span className="text-[10.5px] font-bold dark:text-white text-slate-900 border dark:border-white/[0.06] border-slate-200 bg-white dark:bg-[#111B2E] px-1.5 py-0.5 rounded shadow-sm">Event list (placeholder)</span>
                </div>
                <div className="flex items-center justify-center gap-2 lg:gap-4 lg:border-r dark:border-white/[0.06] border-slate-200 lg:pr-6 w-full lg:w-auto">
                    <Calendar className="size-3.5 text-slate-400 dark:text-[#9CA3AF]" />
                    <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#9CA3AF]">Fetched:</span>
                    <span className="text-[10.5px] font-bold dark:text-white text-slate-900">2026-02-01</span>
                </div>
                <div className="flex-1 flex flex-col justify-center w-full max-w-[400px]">
                    <div className="flex items-center justify-between mb-1.5">
                         <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-[#9CA3AF]">Confidence: Filtered</span>
                         <span className="text-[10.5px] font-bold dark:text-white text-slate-800">80%</span>
                    </div>
                    <div className="h-1.5 w-full dark:bg-[#16233A] bg-slate-200 rounded-full overflow-hidden flex relative">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '80%' }}
                            transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                            className="h-full bg-indigo-500 rounded-full relative overflow-hidden" 
                        >
                            <motion.div 
                                className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                                animate={{ x: ['-100%', '200%'] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            />
                        </motion.div>
                    </div>
                </div>
            </motion.div>

            {/* Main Split Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] 2xl:grid-cols-[1fr_340px] gap-4 items-start">
                
                {/* LEFT PANEL: Overview & List */}
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex flex-col gap-5"
                >
                    {/* Mini Pipeline Kanban */}
                    <div>
                         <h2 className="text-[12px] font-bold dark:text-white text-slate-900 mb-2 uppercase tracking-wide">Lead Pipeline Overview</h2>
                         <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2">
                              {pipelineStages.map((stage) => (
                                  <div key={stage.name} className="min-w-[160px] flex-1 flex flex-col gap-1.5">
                                      <p className="text-[10px] font-bold dark:text-slate-400 text-slate-600 uppercase tracking-widest pl-1">{stage.name}</p>
                                      {stage.leads.map((lead, idx) => (
                                          <div key={idx} className="rounded-lg border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white p-2.5 shadow-sm hover:border-indigo-400 dark:hover:border-[#4F46E5]/50 transition-colors cursor-pointer group">
                                              <p className="text-[10.5px] font-bold dark:text-white text-slate-800 leading-tight mb-0.5">{lead.name}</p>
                                              <p className="text-[9.5px] font-medium text-slate-500 dark:text-[#9CA3AF] mb-1.5">{lead.company}</p>
                                              <span className={cn(
                                                  "inline-block px-1.5 py-0.5 rounded-[4px] text-[8.5px] font-bold mb-2 border dark:border-transparent",
                                                  getSourceColor(lead.srcType)
                                              )}>
                                                  {lead.srcLabel.replace('Fair', '').replace('Expo', '').trim()}
                                              </span>
                                              <p className="text-[8.5px] font-bold text-slate-400 dark:text-[#9CA3AF] uppercase tracking-wide">Next: <span className="dark:text-[#E5E7EB] text-slate-700 capitalize tracking-normal font-medium">{lead.next}</span></p>
                                          </div>
                                      ))}
                                  </div>
                              ))}
                         </div>
                    </div>

                    {/* Lead List Area */}
                    <div>
                         <div className="flex items-center gap-2 mb-2">
                             <h2 className="text-[12px] font-bold dark:text-white text-slate-900 uppercase tracking-wide">Master List</h2>
                             <span className="px-1.5 py-0.5 rounded-[4px] dark:bg-[#16233A] bg-slate-100 text-[9.5px] font-bold dark:text-[#9CA3AF] text-slate-500 border dark:border-white/[0.06] border-slate-200 shadow-sm leading-none">245</span>
                         </div>
                         
                         <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white shadow-sm flex flex-col overflow-hidden">
                             {/* List Filter Bar */}
                             <div className="p-3 border-b dark:border-white/[0.06] border-slate-200 flex flex-wrap items-center gap-3 dark:bg-[#070B14] bg-slate-50">
                                 <div className="relative flex-1 min-w-[200px]">
                                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 dark:text-[#9CA3AF]" />
                                      <input
                                          type="text"
                                          placeholder="Search lead name..."
                                          className="w-full h-8 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white pl-8 pr-3 text-[10.5px] font-medium dark:text-white text-slate-900 placeholder:text-slate-400 focus:border-indigo-500/50 focus:outline-none transition-all shadow-inner"
                                      />
                                 </div>
                                 <div className="flex gap-2">
                                     <button className="flex items-center justify-between w-[120px] h-8 px-2.5 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#16233A] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm">
                                         <span>All sources</span>
                                         <ChevronDown className="size-3 text-slate-400" />
                                     </button>
                                     <button className="flex items-center justify-between w-[120px] h-8 px-2.5 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#16233A] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm">
                                         <span>All statuses</span>
                                         <ChevronDown className="size-3 text-slate-400" />
                                     </button>
                                 </div>
                                 <button className="h-8 px-3 rounded-md border dark:border-transparent border-slate-200 bg-slate-100 dark:bg-[#16233A] text-[10px] font-bold dark:text-slate-300 text-slate-700 shadow-sm hover:bg-slate-200 dark:hover:bg-[#22304A] transition-colors ml-auto">
                                     + Sequence
                                 </button>
                             </div>

                             {/* Leads Table */}
                             <div className="overflow-x-auto custom-scrollbar">
                                  <table className="w-full text-left text-[10.5px] whitespace-nowrap min-w-[700px]">
                                      <thead className="dark:bg-[#070B14]/50 bg-slate-50/50 border-b dark:border-white/[0.06] border-slate-200 uppercase tracking-widest text-[9px] font-bold dark:text-slate-500 text-slate-400">
                                          <tr>
                                              <th className="w-8 px-3 py-2"><CheckSquare className="size-3.5 text-indigo-500 opacity-50" /></th>
                                              <th className="px-2 py-2">Lead</th>
                                              <th className="px-3 py-2">Company</th>
                                              <th className="px-3 py-2">Source</th>
                                              <th className="px-3 py-2">Status</th>
                                              <th className="px-3 py-2">Conf ↓</th>
                                              <th className="px-3 py-2 text-right pr-4">Action</th>
                                          </tr>
                                      </thead>
                                      <tbody className="divide-y dark:divide-white/[0.06] divide-slate-100">
                                          {leadsList.map((lead) => {
                                              const isActive = selectedLeadId === lead.id;
                                              return (
                                                  <tr 
                                                     key={lead.id} 
                                                     onClick={() => setSelectedLeadId(lead.id)}
                                                     className={cn(
                                                         "transition-colors h-[40px] cursor-pointer group relative",
                                                         isActive ? "dark:bg-[#111B2E] bg-slate-50 border-l-[3px] border-indigo-500" : "hover:bg-slate-50 dark:hover:bg-[#16233A]/40 border-l-[3px] border-transparent"
                                                     )}
                                                  >
                                                      <td className="px-3">
                                                          <div className="size-3.5 rounded-[3px] border border-indigo-400 bg-transparent opacity-30 group-hover:opacity-100 transition-opacity" />
                                                      </td>
                                                      <td className="px-2">
                                                          <div className="flex items-center gap-2">
                                                              {isActive ? (
                                                                  <span className="font-bold text-indigo-700 dark:text-indigo-400">{lead.name}</span>
                                                              ) : (
                                                                  <>
                                                                    <div className="flex size-5 items-center justify-center rounded-full dark:bg-[#16233A] bg-slate-200 text-[8.5px] font-bold dark:text-white text-slate-700 border dark:border-white/[0.06] border-slate-300">
                                                                        {lead.avatar}
                                                                    </div>
                                                                    <span className="font-bold dark:text-slate-200 text-slate-700">{lead.name}</span>
                                                                  </>
                                                              )}
                                                          </div>
                                                      </td>
                                                      <td className="px-3 font-medium dark:text-slate-300 text-slate-600 truncate max-w-[120px]">{lead.company}</td>
                                                      <td className="px-3 font-medium dark:text-slate-500 text-slate-500 truncate max-w-[120px]">{lead.srcLabel}</td>
                                                      <td className="px-3">
                                                         <span className={cn(
                                                             "inline-flex items-center justify-center rounded-[4px] px-1.5 py-[1px] text-[8.5px] font-bold tracking-wide uppercase border dark:border-transparent",
                                                             getStatusColor(lead.status)
                                                         )}>
                                                             {lead.status}
                                                         </span>
                                                      </td>
                                                      <td className="px-3">
                                                          <div className="flex items-center gap-2 w-[80px]">
                                                              <span className="text-[10px] font-bold dark:text-white text-slate-800">{lead.conf}%</span>
                                                              <div className="h-1 flex-1 dark:bg-[#0B1220] bg-slate-200 rounded-full overflow-hidden">
                                                                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${lead.conf}%` }} />
                                                              </div>
                                                          </div>
                                                      </td>
                                                      <td className="px-3 text-right pr-4">
                                                          <button className="h-6 px-2.5 rounded-md border dark:border-white/[0.06] border-slate-200 bg-white dark:bg-transparent text-[9.5px] font-bold dark:text-slate-300 text-slate-600 hover:bg-slate-100 dark:hover:bg-[#16233A] transition-colors shadow-sm focus:outline-none">
                                                              View
                                                          </button>
                                                      </td>
                                                  </tr>
                                              )
                                          })}
                                      </tbody>
                                  </table>
                             </div>
                         </div>
                    </div>
                </motion.div>

                {/* RIGHT PANEL: Lead Detail */}
                <motion.div
                    key={activeLead.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                    className="flex flex-col gap-4"
                >
                    <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white overflow-hidden shadow-sm flex flex-col pt-1 pb-4">
                        
                        {/* Profile Header */}
                        <div className="p-4 pb-3 border-b dark:border-white/[0.06] border-slate-200 relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-[20px] rounded-full pointer-events-none"></div>

                            <h2 className="text-[16px] font-bold dark:text-white text-slate-900 leading-tight mb-1 relative z-10">
                                {activeLead.name}
                            </h2>
                            <span className="text-[9.5px] font-bold text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-[4px] bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 inline-block mb-3 relative z-10">
                                {activeLead.company}
                            </span>
                            
                            <div className="flex flex-wrap items-center gap-1.5 relative z-10">
                                <button className="h-7 px-2.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[9.5px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-colors">
                                    + Sequence
                                </button>
                                <button className="h-7 size-7 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors shadow-sm">
                                    <CalendarDays className="size-3.5" />
                                </button>
                                <button 
                                    onClick={() => setIsConvertModalOpen(true)}
                                    className="h-7 px-2.5 rounded-md border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors shadow-sm"
                                >
                                    Convert to Deal
                                </button>
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="p-4 flex flex-col gap-2 text-[10.5px] border-b dark:border-white/[0.06] border-slate-200 bg-slate-50/50 dark:bg-transparent">
                             <div className="flex items-center gap-4">
                                 <div className="w-[60px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400 text-[9px]">Status</div>
                                 <span className={cn(
                                     "inline-flex items-center justify-center rounded-[4px] px-1.5 py-[1px] text-[8.5px] font-bold uppercase tracking-wide border dark:border-transparent",
                                     getStatusColor(activeLead.status)
                                 )}>
                                     {activeLead.status}
                                 </span>
                             </div>
                             <div className="flex items-center gap-4">
                                 <div className="w-[60px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400 text-[9px]">Source</div>
                                 <div className="dark:text-white text-slate-800 font-medium truncate">{activeLead.srcLabel}</div>
                             </div>
                             <div className="flex items-center gap-4">
                                 <div className="w-[60px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400 text-[9px]">Work Email</div>
                                 <div className="dark:text-white text-slate-800 font-medium truncate">{activeLead.email}</div>
                             </div>
                             <div className="flex items-center gap-4">
                                 <div className="w-[60px] font-bold uppercase tracking-widest dark:text-slate-500 text-slate-400 text-[9px]">Owner</div>
                                 <div className="dark:text-white text-slate-800 font-medium">{activeLead.owner}</div>
                             </div>

                             {/* Inner Tracking Card */}
                             <div className="mt-2 rounded-lg dark:bg-[#0B1220] bg-white border dark:border-white/[0.06] border-slate-200 p-3 flex flex-col gap-1.5 shadow-sm">
                                 <div className="flex items-center justify-between text-[9.5px] font-bold dark:text-slate-500 text-slate-400 uppercase tracking-widest mb-1">
                                    <span>Confidence Score</span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{activeLead.conf}%</span>
                                 </div>
                                 <div className="h-1 w-full dark:bg-[#16233A] bg-slate-100 rounded-full overflow-hidden flex mb-1">
                                     <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${activeLead.conf}%` }} />
                                 </div>
                                 <p className="text-[9px] dark:text-slate-400 text-slate-500 leading-tight font-medium">Fetched on 02-01-2026 from Event source.</p>
                             </div>
                        </div>

                        {/* Tabs row & Next Step */}
                        <div className="px-4 pt-1">
                            <div className="flex items-center gap-4 border-b dark:border-white/[0.06] border-slate-200 mb-3 relative">
                                {['Overview', 'ACTIVE', 'Activity'].map((tab) => {
                                    const isActive = tab === 'Overview' || tab === 'ACTIVE'; // active is visually mixed with Overview in screenshot
                                    const isRealActive = tab === 'Overview';
                                    if(tab === 'ACTIVE') return <span key={tab} className="text-[8.5px] font-bold text-indigo-700 dark:text-indigo-400 absolute ml-[60px] -mt-2">ACTIVE</span>;
                                    return (
                                        <button 
                                            key={tab}
                                            className={cn(
                                                "py-2 text-[10.5px] font-bold uppercase tracking-wide transition-all relative border-b-[2px]",
                                                isRealActive ? "dark:text-white text-slate-900 border-indigo-500" : "dark:text-slate-500 text-slate-400 hover:text-slate-600 dark:hover:text-[#E5E7EB] border-transparent"
                                            )}
                                        >
                                            {tab}
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="flex flex-col gap-0.5 mb-3">
                                <p className="text-[10px] uppercase tracking-widest font-bold dark:text-slate-500 text-slate-400">Next step</p>
                                <p className="text-[11.5px] font-bold dark:text-white text-slate-800">Send intro email <span className="text-[10px] font-medium text-slate-500 dark:text-[#9CA3AF] ml-1">Due: {activeLead.next}</span></p>
                            </div>

                            {/* Deep AI Sidebar Block */}
                            <div className="rounded-lg border border-purple-200 dark:border-purple-500/30 dark:bg-[#0B1220] bg-purple-50 p-3 flex flex-col gap-2 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-[-20px] left-[-20px] w-20 h-20 bg-purple-500/10 blur-[20px] rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-colors"></div>
                                <h4 className="text-[10px] font-bold dark:text-white text-slate-900 uppercase tracking-widest flex items-center gap-1.5"><Sparkles className="size-3 text-purple-500" /> AI Summary</h4>
                                <ul className="space-y-1.5 text-[10px] font-medium relative z-10">
                                    <li className="flex items-start">
                                        <span className="mr-1.5 text-purple-500 mt-[3px] text-[7px]">●</span> 
                                        <span className="dark:text-slate-300 text-slate-700 leading-tight">High fit for Germany tech events.</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-1.5 text-purple-500 mt-[3px] text-[7px]">●</span> 
                                        <span className="dark:text-slate-300 text-slate-700 leading-tight">Action: Add to &apos;Berlin Outreach&apos; seq.</span>
                                    </li>
                                </ul>
                                <button className="h-7 w-full rounded-md bg-purple-600 hover:bg-purple-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(168,85,247,0.3)] hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all mt-1">
                                    Ask Copilot
                                </button>
                            </div>
                        </div>

                    </div>
                </motion.div>
            </div>

            {/* Convert Lead to Deal Modal */}
            <Dialog open={isConvertModalOpen} onOpenChange={setIsConvertModalOpen}>
                <DialogContent className="sm:max-w-4xl p-0 dark:bg-[#070B14] bg-white border dark:border-white/[0.06] border-slate-200 dark:text-white text-slate-900 shadow-2xl overflow-hidden rounded-xl">
                    
                    {/* Header */}
                    <div className="flex items-start justify-between p-4 pb-3 border-b dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-slate-50">
                        <div>
                            <h2 className="text-[14px] font-bold tracking-tight dark:text-white text-slate-900 mb-0.5 flex items-center gap-2">
                                <CheckCircle2 className="size-4 text-emerald-500" /> Convert Lead to Deal
                            </h2>
                            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Establish a pipeline asset linked to event, company, and existing contacts.</p>
                        </div>
                        <button onClick={() => setIsConvertModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:text-[#9CA3AF] dark:hover:text-white transition-colors bg-white dark:bg-[#111B2E] border dark:border-white/[0.06] border-slate-200 rounded-md p-1 shadow-sm focus:outline-none">
                            <X className="size-3.5" />
                        </button>
                    </div>

                    <div className="p-4">
                        {/* 3-Column Grid */}
                        <div className="grid grid-cols-[1fr_280px_220px] gap-4 items-start relative pb-4 border-b dark:border-white/[0.06] border-slate-200">
                            
                            {/* Column 1: Deal Details */}
                            <div className="flex flex-col gap-3">
                                <h3 className="text-[11px] font-bold dark:text-white text-slate-900 uppercase tracking-widest pl-1">Data Mapping</h3>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-0.5">Company</label>
                                        <input type="text" readOnly value={activeLead.company} className="w-full h-8 px-2.5 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#111B2E] bg-slate-50 text-[10.5px] font-bold dark:text-slate-200 text-slate-800 focus:outline-none shadow-inner" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-0.5">Pipeline Stage</label>
                                        <div className="relative">
                                            <input type="text" readOnly value="Proposal" className="w-full h-8 px-2.5 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#111B2E] bg-slate-50 text-[10.5px] font-bold dark:text-slate-200 text-slate-800 focus:outline-none shadow-inner cursor-pointer" />
                                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-0.5">Primary Contact</label>
                                        <input type="text" readOnly value={activeLead.name} className="w-full h-8 px-2.5 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#111B2E] bg-slate-50 text-[10.5px] font-bold dark:text-slate-200 text-slate-800 focus:outline-none shadow-inner" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-0.5">Close Date</label>
                                        <div className="relative">
                                            <input type="text" readOnly value="2026-03-10" className="w-full h-8 px-2.5 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-[#111B2E] bg-slate-50 text-[10.5px] font-bold dark:text-slate-200 text-slate-800 focus:outline-none shadow-inner cursor-pointer" />
                                            <CalendarDays className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-0.5">Deal Name</label>
                                        <input type="text" readOnly value="Berlin Tech Expo - Sponsorship Package" className="w-full h-8 px-2.5 rounded-md border border-indigo-200 dark:border-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-500/10 text-[10.5px] font-bold text-indigo-900 dark:text-indigo-200 focus:outline-none shadow-sm ring-1 ring-indigo-500/20" />
                                    </div>
                                    <div className="space-y-0.5 flex flex-col justify-end pb-1.5">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><img src={`https://ui-avatars.com/api/?name=${activeLead.owner}&background=random&color=fff&size=24`} alt="Avatar" className="size-4 rounded-full"/> Owner: <span className="dark:text-white text-slate-800 inline-block">{activeLead.owner}</span></label>
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Deal Economics Preview */}
                            <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white overflow-hidden flex flex-col shadow-sm">
                                <div className="p-2.5 border-b dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-slate-50">
                                    <h3 className="text-[10px] font-bold dark:text-white text-slate-900 uppercase tracking-widest pl-1">Financial Forecaster</h3>
                                </div>
                                <div className="p-3 flex flex-col gap-2.5 border-b dark:border-white/[0.06] border-slate-200 relative">
                                    {/* Hovering data source bubble */}
                                    <div className="absolute top-1/2 right-full mr-2 -translate-y-1/2 w-[180px] rounded-lg dark:bg-[#16233A] bg-white border dark:border-[#374151] border-slate-200 p-2 shadow-xl z-20 flex flex-col gap-1 hidden lg:flex">
                                        <div className="absolute right-[-4px] top-1/2 -mt-1 size-2 rotate-45 border-t border-r dark:border-[#374151] border-slate-200 dark:bg-[#16233A] bg-white"></div>
                                        <p className="text-[9px] font-medium dark:text-slate-300 text-slate-600 leading-tight">Data source: Event placeholder record</p>
                                        <p className="text-[9px] font-medium dark:text-[#9CA3AF] text-slate-400">Confidence: <span className="font-bold dark:text-emerald-400 text-emerald-600">91% (High)</span></p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-0.5">Revenue</label>
                                            <div className="relative">
                                                <input type="text" readOnly value="$35,000" className="w-full h-7 pl-2 pr-12 rounded-[4px] border dark:border-white/[0.06] border-emerald-200/50 dark:bg-[#111B2E] bg-emerald-50/30 text-[10.5px] font-bold dark:text-emerald-400 text-emerald-700 focus:outline-none shadow-inner" />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold uppercase tracking-widest text-slate-400 pointer-events-none">Est</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-0.5">Travel Exp</label>
                                             <div className="relative">
                                                <input type="text" readOnly value="$2,800" className="w-full h-7 pl-2 pr-12 rounded-[4px] border dark:border-white/[0.06] border-rose-200/50 dark:bg-[#111B2E] bg-rose-50/30 text-[10.5px] font-bold dark:text-rose-400 text-rose-700 focus:outline-none shadow-inner" />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-bold uppercase tracking-widest text-slate-400 pointer-events-none">Est</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-0.5">Booth Cost</label>
                                            <input type="text" readOnly value="$8,000" className="w-full h-7 px-2 rounded-[4px] border dark:border-white/[0.06] border-slate-200 dark:bg-[#111B2E] bg-slate-50 text-[10.5px] font-bold dark:text-white text-slate-900 focus:outline-none shadow-inner" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 pl-0.5">Vendor Srv</label>
                                            <input type="text" readOnly value="$3,000" className="w-full h-7 px-2 rounded-[4px] border dark:border-white/[0.06] border-slate-200 dark:bg-[#111B2E] bg-slate-50 text-[10.5px] font-bold dark:text-white text-slate-900 focus:outline-none shadow-inner" />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-50/20 dark:bg-transparent">
                                    <div className="flex items-end justify-between mb-1">
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0.5">Net Profit</p>
                                            <p className="text-[16px] font-bold dark:text-emerald-400 text-emerald-600 leading-none">$19,700</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0.5">Margin</p>
                                            <p className="text-[14px] font-bold dark:text-white text-slate-800 leading-none">56%</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-0.5">ROI</p>
                                            <p className="text-[14px] font-bold dark:text-white text-slate-800 leading-none">1.3x</p>
                                        </div>
                                    </div>
                                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">Costs editable after creation.</p>
                                </div>
                            </div>

                            {/* Column 3: AI Recommendations */}
                            <div className="rounded-xl border border-purple-200 dark:border-purple-500/30 dark:bg-[#0B1220] bg-purple-50 p-3 flex flex-col gap-2 min-h-[220px] shadow-sm relative overflow-hidden group">
                                <div className="absolute top-[-20px] right-[-20px] w-20 h-20 bg-purple-500/10 blur-[20px] rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-colors"></div>
                                <h3 className="text-[10px] font-bold dark:text-white text-slate-900 uppercase tracking-widest pl-1 mb-1 flex items-center gap-1.5"><Sparkles className="size-3 text-purple-500"/> AI Recommendations</h3>
                                
                                <AnimatePresence mode="wait">
                                    {isSimulatingAI ? (
                                        <motion.div key="loading" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex-1 flex flex-col items-center justify-center gap-2">
                                            <div className="flex gap-1 justify-center">
                                              <motion.div animate={{y: [0, -3, 0]}} transition={{duration: 0.6, repeat: Infinity, delay: 0}} className="size-1.5 rounded-full bg-purple-400"></motion.div>
                                              <motion.div animate={{y: [0, -3, 0]}} transition={{duration: 0.6, repeat: Infinity, delay: 0.2}} className="size-1.5 rounded-full bg-purple-400"></motion.div>
                                              <motion.div animate={{y: [0, -3, 0]}} transition={{duration: 0.6, repeat: Infinity, delay: 0.4}} className="size-1.5 rounded-full bg-purple-400"></motion.div>
                                            </div>
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-purple-400 mt-1">Analyzing Lead...</span>
                                        </motion.div>
                                    ) : (
                                        <motion.div key="content" initial={{opacity:0}} animate={{opacity:1}} className="flex-1 flex flex-col justify-between pt-1">
                                            <ul className="space-y-2 text-[10.5px] font-medium">
                                                <li className="flex items-start">
                                                    <span className="mr-1.5 text-purple-500 mt-[4px] text-[6px]">●</span> 
                                                    <span className="dark:text-slate-300 text-slate-700 leading-snug">Prob: <span className="font-bold">55%</span> based on stage mapping.</span>
                                                </li>
                                                <li className="flex items-start">
                                                    <span className="mr-1.5 text-purple-500 mt-[4px] text-[6px]">●</span> 
                                                    <span className="dark:text-slate-300 text-slate-700 leading-snug">Next best action: Schedule final scope call.</span>
                                                </li>
                                                <li className="flex items-start">
                                                    <span className="mr-1.5 text-purple-500 mt-[4px] text-[6px]">●</span> 
                                                    <span className="dark:text-slate-300 text-slate-700 leading-snug">Attach to: 4-step Germany outreach tone.</span>
                                                </li>
                                            </ul>
                                            <button className="h-7 w-full rounded-md bg-purple-600 hover:bg-purple-500 text-[9.5px] font-bold text-white shadow-[0_0_10px_rgba(168,85,247,0.3)] transition-colors mt-2 uppercase tracking-wide">
                                                Apply With Copilot
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Bottom Section: Next Steps & Footer Actions */}
                        <div className="pt-3 flex items-end justify-between pl-1">
                            <div className="flex flex-col gap-2">
                                <h3 className="text-[10px] font-bold dark:text-white text-slate-900 uppercase tracking-widest mb-0.5">Workflow Triggers</h3>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className="size-3.5 rounded-[3px] bg-indigo-600 flex items-center justify-center flex-shrink-0">
                                        <CheckSquare className="size-2.5 text-white" />
                                    </div>
                                    <span className="text-[10.5px] font-bold dark:text-white text-slate-800">Create task: Send proposal</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className="size-3.5 rounded-[3px] border dark:border-white/[0.1] border-slate-300 group-hover:border-indigo-400 bg-white dark:bg-transparent transition-colors flex items-center justify-center flex-shrink-0" />
                                    <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">Queue in active sequence: Berlin Outreach</span>
                                </label>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setIsConvertModalOpen(false)}
                                    className="h-7 px-3 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors focus:outline-none"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => setIsConvertModalOpen(false)}
                                    className="h-7 px-4 rounded-md bg-indigo-600 text-[10.5px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] hover:bg-indigo-500 transition-colors focus:outline-none"
                                >
                                    Create Deal
                                </button>
                                <button className="h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm focus:outline-none flex items-center gap-1.5">
                                    Create & Start Sequence <Sparkles className="size-2.5"/>
                                </button>
                            </div>
                        </div>

                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
