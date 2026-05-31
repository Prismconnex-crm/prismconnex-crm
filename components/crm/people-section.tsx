"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Filter,
    Download,
    ChevronDown,
    BadgeCheck,
    Mail,
    Phone,
    Globe,
    FileText,
    MoreHorizontal,
    UploadCloud,
    CheckSquare,
    Activity,
    Star
} from "lucide-react";
import { cn } from "@/lib/utils";

// Detailed mock data matching the screenshot + some extra fields for "new features"
const contactsList = [
    { id: "1", name: "Sarah Miller", title: "Marketing Manager", company: "NovaAI Systems", email: "sarah@novaai.example", verify: "Verified", location: "Germany", source: "User import", conf: 91, avatar: "S", lastActive: "2h ago", score: 98 },
    { id: "2", name: "David Lee", title: "Sales Director", company: "CloudForge Ltd", email: "david@cloudforge.example", verify: "Verified", location: "UK", source: "Licensed", conf: 88, avatar: "D", lastActive: "1d ago", score: 85 },
    { id: "3", name: "Amina Khan", title: "Partnerships Lead", company: "Medidata Europe", email: "amina@medidata.example", verify: "Needs verify", location: "France", source: "User import", conf: 79, avatar: "A", lastActive: "3d ago", score: 72 },
    { id: "4", name: "Jonas Richter", title: "Product Lead", company: "NovaAI Systems", email: "jonas@novaai.example", verify: "Verified", location: "Germany", source: "Licensed", conf: 86, avatar: "J", lastActive: "Just now", score: 91 },
    { id: "5", name: "Mia Thompson", title: "Operations Manager", company: "ElectroMech Works", email: "mia@electromech.example", verify: "Needs verify", location: "USA", source: "User import", conf: 74, avatar: "M", lastActive: "1w ago", score: 65 },
    { id: "6", name: "Luca Romano", title: "Procurement", company: "GreenHydro Labs", email: "luca@greenhydro.example", verify: "Verified", location: "Germany", source: "Licensed", conf: 83, avatar: "L", lastActive: "5h ago", score: 88 },
    { id: "7", name: "Elena Silva", title: "HR Manager", company: "SecureNet Dynamics", email: "elena@securenet.example", verify: "Verified", location: "UK", source: "Licensed", conf: 85, avatar: "E", lastActive: "2d ago", score: 81 },
];

export function PeopleSection() {
    const [selectedContactId, setSelectedContactId] = useState<string>(contactsList[0].id);
    const activeContact = contactsList.find(c => c.id === selectedContactId) || contactsList[0];

    return (
        <div className="space-y-5 max-w-[1600px] mx-auto pb-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2"
            >
                <div>
                    <h1 className="text-[24px] font-bold tracking-tight text-slate-900 dark:text-white mb-1 flex items-baseline gap-3">
                        People <span className="text-[12px] font-medium text-slate-500 dark:text-[#9CA3AF] tracking-normal">2,418 contacts</span>
                    </h1>
                    <p className="text-[13px] text-slate-600 dark:text-slate-400">
                        Contacts with verification, source transparency, and bulk actions
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="h-9 px-4 rounded-[8px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111B2E] text-[13px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors shadow-sm">
                        Import CSV/XLSX
                    </button>
                    <button className="flex items-center gap-2 h-9 pl-4 pr-3 rounded-[8px] border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111B2E] text-[13px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors shadow-sm">
                        <span>Export</span>
                        <ChevronDown className="size-4 text-slate-400 dark:text-[#9CA3AF]" />
                    </button>
                </div>
            </motion.div>

            {/* Transparency Bar */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="rounded-[12px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] p-5 shadow-sm flex flex-col md:flex-row items-center gap-6"
            >
                <div className="flex-1 flex flex-col justify-center md:border-r border-slate-200 dark:border-[#22304A] md:pr-6 w-full">
                    <p className="text-[12px] font-medium text-slate-500 dark:text-[#9CA3AF] mb-1">Data source</p>
                    <div className="flex items-center gap-2">
                        <UploadCloud className="size-4 text-indigo-500" />
                        <p className="text-[14px] font-semibold text-slate-900 dark:text-white truncate">
                            User import / Licensed dataset
                        </p>
                    </div>
                </div>
                <div className="flex flex-col justify-center md:border-r border-slate-200 dark:border-[#22304A] md:pr-6 w-full md:w-auto">
                    <p className="text-[12px] font-medium text-slate-500 dark:text-[#9CA3AF] mb-1">Last Fetched</p>
                    <p className="text-[14px] font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Activity className="size-3.5 text-emerald-500" />
                        2026-02-01
                    </p>
                </div>
                <div className="flex-1 flex flex-col justify-center w-full">
                    <p className="text-[12px] font-medium text-slate-500 dark:text-[#9CA3AF] mb-1.5 flex items-center justify-between">
                        <span>Avg. Confidence <span className="text-slate-900 dark:text-white ml-2 font-semibold font-mono">84% <span className="text-emerald-500 dark:text-emerald-400 font-medium">(Good)</span></span></span>
                        <span className="text-[11px] text-slate-400 dark:text-[#9CA3AF] hidden lg:block">Combines recency + source reliability.</span>
                    </p>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-[#16233A] rounded-full overflow-hidden flex">
                        <div className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full" style={{ width: '84%' }} />
                    </div>
                </div>
            </motion.div>

            {/* Main Split Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] 2xl:grid-cols-[1fr_380px] gap-5 items-start">
                
                {/* LEFT PANEL: Contacts List */}
                <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="flex flex-col gap-4 overflow-hidden"
                >
                    {/* Filter Bar */}
                    <div className="rounded-[12px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] p-3 flex flex-col gap-3 shadow-sm">
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
                              {/* Search */}
                              <div className="lg:col-span-1 border-r border-slate-100 dark:border-[#22304A] pr-2">
                                  <p className="text-[11px] font-medium text-slate-500 dark:text-[#9CA3AF] mb-1.5 uppercase tracking-wider">Search</p>
                                  <div className="relative">
                                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 dark:text-[#9CA3AF]" />
                                      <input
                                          type="text"
                                          placeholder="Name, email, company..."
                                          className="w-full h-8 rounded-[6px] border border-slate-200 dark:border-[#22304A] bg-slate-50 dark:bg-[#0B1220] pl-8 pr-2 text-[12px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#6B7280] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                                      />
                                  </div>
                              </div>
                              {/* Country */}
                              <div className="lg:col-span-1 border-r border-slate-100 dark:border-[#22304A] px-2">
                                  <p className="text-[11px] font-medium text-slate-500 dark:text-[#9CA3AF] mb-1.5 uppercase tracking-wider">Country</p>
                                  <button className="w-full flex items-center justify-between h-8 px-2.5 rounded-[6px] border border-slate-200 dark:border-[#22304A] bg-slate-50 dark:bg-[#0B1220] hover:bg-slate-100 dark:hover:bg-[#16233A] text-[12px] text-slate-700 dark:text-[#E5E7EB] transition-colors">
                                      <span>All countries</span>
                                      <ChevronDown className="size-3.5 text-slate-400 dark:text-[#6B7280]" />
                                  </button>
                              </div>
                              {/* Source */}
                              <div className="lg:col-span-1 border-r border-slate-100 dark:border-[#22304A] px-2">
                                  <p className="text-[11px] font-medium text-slate-500 dark:text-[#9CA3AF] mb-1.5 uppercase tracking-wider">Source</p>
                                  <button className="w-full flex items-center justify-between h-8 px-2.5 rounded-[6px] border border-slate-200 dark:border-[#22304A] bg-slate-50 dark:bg-[#0B1220] hover:bg-slate-100 dark:hover:bg-[#16233A] text-[12px] text-slate-700 dark:text-[#E5E7EB] transition-colors">
                                      <span>All sources</span>
                                      <ChevronDown className="size-3.5 text-slate-400 dark:text-[#6B7280]" />
                                  </button>
                              </div>
                              {/* Verification */}
                              <div className="lg:col-span-1 border-r border-slate-100 dark:border-[#22304A] px-2">
                                  <p className="text-[11px] font-medium text-slate-500 dark:text-[#9CA3AF] mb-1.5 uppercase tracking-wider">Verification</p>
                                  <button className="w-full flex items-center justify-between h-8 px-2.5 rounded-[6px] border border-slate-200 dark:border-[#22304A] bg-slate-50 dark:bg-[#0B1220] hover:bg-slate-100 dark:hover:bg-[#16233A] text-[12px] text-slate-700 dark:text-[#E5E7EB] transition-colors">
                                      <span className="truncate">All • Verified</span>
                                      <ChevronDown className="size-3.5 text-slate-400 dark:text-[#6B7280]" />
                                  </button>
                              </div>
                              {/* Confidence */}
                              <div className="lg:col-span-1 pl-2">
                                  <p className="text-[11px] font-medium text-slate-500 dark:text-[#9CA3AF] mb-1.5 uppercase tracking-wider">Confidence</p>
                                  <button className="w-full flex items-center justify-between h-8 px-2.5 rounded-[6px] border border-slate-200 dark:border-[#22304A] bg-slate-50 dark:bg-[#0B1220] hover:bg-slate-100 dark:hover:bg-[#16233A] text-[12px] text-slate-700 dark:text-[#E5E7EB] transition-colors">
                                      <span>&ge; 70%</span>
                                      <ChevronDown className="size-3.5 text-slate-400 dark:text-[#6B7280]" />
                                  </button>
                              </div>
                         </div>
                         
                         {/* Bulk Action Bar */}
                         <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 dark:border-[#22304A]">
                             <div className="flex flex-wrap items-center gap-2">
                                 <label className="flex items-center gap-2 cursor-pointer pr-3 border-r border-slate-200 dark:border-[#22304A]">
                                     <div className="size-3.5 rounded-[4px] border border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center">
                                         <CheckSquare className="size-2.5 text-indigo-600 dark:text-[#E5E7EB]" />
                                     </div>
                                     <span className="text-[12px] font-medium text-slate-700 dark:text-[#E5E7EB]">Select all</span>
                                 </label>
                                 <button className="h-7 px-2.5 rounded-[6px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#16233A] text-[12px] font-medium text-slate-700 dark:text-[#E5E7EB] hover:bg-slate-50 dark:hover:bg-[#22304A] shadow-sm transition-colors">
                                     Verify emails
                                 </button>
                                 <button className="h-7 px-2.5 rounded-[6px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#16233A] text-[12px] font-medium text-slate-700 dark:text-[#E5E7EB] hover:bg-slate-50 dark:hover:bg-[#22304A] shadow-sm transition-colors">
                                     Add to Sequence
                                 </button>
                                 <button className="h-7 px-2.5 rounded-[6px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#16233A] text-[12px] font-medium text-slate-700 dark:text-[#E5E7EB] hover:bg-slate-50 dark:hover:bg-[#22304A] shadow-sm transition-colors">
                                     Merge
                                 </button>
                             </div>
                             <div className="bg-slate-100 dark:bg-[#16233A] rounded-full px-2.5 py-0.5 flex items-center justify-center border border-slate-200 dark:border-[#22304A]">
                                 <span className="text-[11px] font-semibold text-slate-700 dark:text-white">3 selected</span>
                             </div>
                         </div>
                    </div>

                    {/* Data Table Area */}
                    <div className="rounded-[12px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] shadow-sm flex flex-col overflow-hidden h-fit">
                        {/* Table Header / Quick Filters */}
                        <div className="p-3 border-b border-slate-200 dark:border-[#22304A] flex flex-wrap items-center gap-3 justify-between bg-slate-50/50 dark:bg-[#0B1220]/50">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-[14px] font-bold text-slate-900 dark:text-white mr-2">Results</h3>
                                <button className="h-[24px] px-3 border border-slate-900 dark:border-white rounded-full bg-slate-900 dark:bg-white text-[11px] font-semibold text-white dark:text-[#0B1220] shadow-sm transition-colors">
                                    All
                                </button>
                                <button className="h-[24px] px-3 rounded-full border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] text-[11px] font-medium text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-white hover:border-indigo-500/40 transition-colors">
                                    High Confidence
                                </button>
                                <button className="h-[24px] px-3 rounded-full border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] text-[11px] font-medium text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-white hover:border-indigo-500/40 transition-colors">
                                    Needs Verification
                                </button>
                            </div>
                        </div>

                        {/* Contacts Data Table */}
                        <div className="overflow-x-auto custom-scrollbar">
                             <table className="w-full text-left text-[13px] whitespace-nowrap min-w-[900px]">
                                 <thead className="bg-slate-50 dark:bg-[#0B1220] border-b border-slate-200 dark:border-[#22304A]">
                                     <tr className="text-slate-500 dark:text-[#9CA3AF] text-[12px]">
                                         <th className="px-4 py-2.5 font-medium">Name</th>
                                         <th className="px-3 py-2.5 font-medium">Platform Score</th>
                                         <th className="px-3 py-2.5 font-medium">Company</th>
                                         <th className="px-3 py-2.5 font-medium">Work Email</th>
                                         <th className="px-3 py-2.5 font-medium">Status</th>
                                         <th className="px-3 py-2.5 font-medium">Confidence</th>
                                         <th className="px-3 py-2.5 font-medium">Last Active</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100 dark:divide-[#22304A]">
                                     {contactsList.map((contact, idx) => {
                                         const isActive = selectedContactId === contact.id;
                                         return (
                                             <tr 
                                                key={contact.id} 
                                                onClick={() => setSelectedContactId(contact.id)}
                                                className={cn(
                                                    "transition-all h-[48px] cursor-pointer group",
                                                    isActive 
                                                      ? "bg-indigo-50/50 dark:bg-[#16233A]/80 border-l-2 border-l-indigo-500" 
                                                      : "hover:bg-slate-50 dark:hover:bg-[#16233A]/40 border-l-2 border-l-transparent"
                                                )}
                                             >
                                                 <td className="px-4">
                                                     <div className="flex items-center gap-3">
                                                         <div className={cn(
                                                             "size-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-sm",
                                                             isActive ? "bg-indigo-500" : "bg-slate-300 dark:bg-[#22304A]"
                                                         )}>
                                                             {contact.avatar}
                                                         </div>
                                                         <div className="flex flex-col">
                                                            <span className={cn("font-semibold text-[13px]", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-900 dark:text-[#E5E7EB]")}>{contact.name}</span>
                                                            <span className="text-[11px] text-slate-500 dark:text-[#9CA3AF] truncate max-w-[120px]">{contact.title}</span>
                                                         </div>
                                                     </div>
                                                 </td>
                                                 <td className="px-3">
                                                     <div className="flex items-center gap-1.5">
                                                         <Star className={cn("size-3.5", contact.score >= 90 ? "text-amber-400 fill-amber-400" : "text-slate-300 dark:text-slate-600")} />
                                                         <span className="font-medium text-slate-700 dark:text-[#E5E7EB]">{contact.score}</span>
                                                     </div>
                                                 </td>
                                                 <td className="px-3 font-medium text-slate-700 dark:text-[#9CA3AF]">{contact.company}</td>
                                                 <td className="px-3 font-medium text-slate-900 dark:text-[#E5E7EB]">{contact.email}</td>
                                                 <td className="px-3">
                                                    <span className={cn(
                                                        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium border",
                                                        contact.verify === 'Verified' 
                                                            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20" 
                                                            : "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/20"
                                                    )}>
                                                        {contact.verify}
                                                        {contact.verify === 'Needs verify' && <span className="ml-1 text-[10px]">⚠️</span>}
                                                    </span>
                                                 </td>
                                                 <td className="px-3">
                                                     <div className="flex items-center gap-2 w-[70px]">
                                                         <span className="text-[12px] font-mono font-medium text-slate-700 dark:text-white">{contact.conf}%</span>
                                                         <div className="h-1.5 w-full bg-slate-100 dark:bg-[#0B1220] rounded-full overflow-hidden">
                                                             <div className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full" style={{ width: `${contact.conf}%` }} />
                                                         </div>
                                                     </div>
                                                 </td>
                                                 <td className="px-3 text-[12px] font-medium text-slate-500 dark:text-slate-400">
                                                     {contact.lastActive}
                                                 </td>
                                             </tr>
                                         )
                                     })}
                                 </tbody>
                             </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="p-3 border-t border-slate-200 dark:border-[#22304A] bg-slate-50/50 dark:bg-[#0B1220]/50 flex items-center justify-end gap-5 mt-auto">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[12px] font-medium text-slate-500 dark:text-[#9CA3AF]">Rows:</span>
                                <button className="flex items-center gap-1 text-[12px] font-semibold text-slate-700 dark:text-white focus:outline-none">
                                    25 <ChevronDown className="size-3 text-slate-400 dark:text-[#9CA3AF]" />
                                </button>
                            </div>
                            <span className="text-[12px] font-medium text-slate-600 dark:text-[#E5E7EB]">Page 1 of 97</span>
                            <div className="flex items-center bg-white dark:bg-[#111B2E] rounded-md border border-slate-200 dark:border-[#22304A] shadow-sm overflow-hidden">
                                 <button className="h-[24px] px-2.5 text-[12px] font-medium text-slate-400 dark:text-[#6B7280] bg-slate-50 dark:bg-[#0B1220] cursor-not-allowed">Prev</button>
                                 <div className="w-px h-[24px] bg-slate-200 dark:bg-[#22304A]"></div>
                                 <button className="h-[24px] px-2.5 text-[12px] font-medium text-slate-700 dark:text-[#E5E7EB] hover:bg-slate-50 dark:hover:bg-[#16233A] transition-colors">Next</button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* RIGHT PANEL: Contact Detail */}
                <motion.div
                    key={activeContact.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex flex-col gap-5"
                >
                    <div className="rounded-[12px] border border-slate-200 dark:border-[#22304A] bg-white dark:bg-[#111B2E] overflow-hidden shadow-sm flex flex-col">
                        
                        {/* Profile Header */}
                        <div className="p-5 border-b border-slate-200 dark:border-[#22304A]">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                     <div className="size-[56px] rounded-full bg-slate-100 dark:bg-[#16233A] border-2 border-white dark:border-[#22304A] shadow-sm flex items-center justify-center shrink-0">
                                         <span className="text-[22px] font-bold text-slate-700 dark:text-slate-300">{activeContact.avatar}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-[20px] font-bold text-slate-900 dark:text-white leading-tight flex items-baseline gap-2 mb-0.5">
                                            {activeContact.name}
                                        </h2>
                                        <span className="text-[11px] font-bold tracking-wide text-slate-600 dark:text-[#9CA3AF] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#0B1220] border border-slate-200 dark:border-[#22304A] inline-block mt-1 uppercase">
                                            {activeContact.company}
                                        </span>
                                    </div>
                                </div>
                                <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#22304A] rounded-md transition-colors">
                                    <MoreHorizontal className="size-4" />
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button className="h-8 w-full rounded-[6px] bg-indigo-600 dark:bg-indigo-500 text-[12px] font-semibold text-white shadow-sm hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors">
                                    Add to CRM
                                </button>
                                <button className="h-8 w-full rounded-[6px] border border-slate-300 dark:border-[#22304A] bg-white dark:bg-[#0B1220] text-[12px] font-semibold text-slate-700 dark:text-[#E5E7EB] hover:bg-slate-50 dark:hover:bg-[#16233A] shadow-sm transition-colors">
                                    Add to Sequence
                                </button>
                            </div>
                        </div>

                        {/* Info Section */}
                        <div className="p-5 flex flex-col gap-4 border-b border-slate-200 dark:border-[#22304A]">
                             {/* 2-Col Grid */}
                             <div className="grid grid-cols-2 gap-3">
                                 <div>
                                     <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-1">Work email</p>
                                     <p className="text-[13px] font-semibold text-slate-900 dark:text-[#E5E7EB] truncate mb-1" title={activeContact.email}>{activeContact.email}</p>
                                     <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                                         Verified <BadgeCheck className="size-2.5" />
                                     </span>
                                 </div>
                                 <div className="pl-3 border-l border-slate-100 dark:border-[#22304A]">
                                     <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-1">Country</p>
                                     <p className="text-[13px] font-semibold text-slate-900 dark:text-[#E5E7EB] mb-1 flex items-center gap-1.5">
                                        <Globe className="size-3.5 text-indigo-500" />
                                        {activeContact.location}
                                     </p>
                                 </div>
                                 <div>
                                     <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-1">Phone</p>
                                     <p className="text-[13px] font-semibold text-slate-900 dark:text-[#E5E7EB] flex items-center gap-1.5">
                                        <Phone className="size-3.5 text-slate-400" />
                                        —
                                     </p>
                                 </div>
                                 <div className="pl-3 border-l border-slate-100 dark:border-[#22304A]">
                                     <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-1">Title</p>
                                     <p className="text-[13px] font-semibold text-slate-900 dark:text-[#E5E7EB] leading-tight">{activeContact.title}</p>
                                 </div>
                             </div>

                             {/* Single fields */}
                             <div>
                                 <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-1">LinkedIn URL</p>
                                 <div className="h-8 px-2.5 w-full rounded-[6px] border border-slate-200 dark:border-[#22304A] bg-slate-50 dark:bg-[#0B1220] flex items-center">
                                     <span className="text-[12px] font-medium text-slate-400 dark:text-[#6B7280]">Provided by user</span>
                                 </div>
                             </div>

                             {/* Small Data Source block inside card */}
                             <div className="rounded-[6px] bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#22304A] p-2.5 grid grid-cols-2 gap-y-1.5 text-[12px]">
                                 <div className="text-slate-500 dark:text-[#9CA3AF] font-medium">Source</div>
                                 <div className="text-slate-900 dark:text-[#E5E7EB] font-semibold">{activeContact.source}</div>
                                 <div className="text-slate-500 dark:text-[#9CA3AF] font-medium">Fetched</div>
                                 <div className="text-slate-900 dark:text-[#E5E7EB] font-semibold">2026-02-01</div>
                                 <div className="text-slate-500 dark:text-[#9CA3AF] font-medium">Confidence</div>
                                 <div className="text-emerald-600 dark:text-emerald-400 font-bold">{activeContact.conf}% (High)</div>
                             </div>
                        </div>

                        {/* Tabs Navigation (Internal to profile) */}
                        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-[#22304A] px-3 pt-1">
                            {['Overview', 'Activity', 'Notes'].map((tab) => {
                                const isActive = tab === 'Overview';
                                return (
                                    <button 
                                        key={tab}
                                        className={cn(
                                            "px-3 py-1.5 text-[12px] font-semibold transition-all relative border-b-2",
                                            isActive ? "text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-500" : "text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#E5E7EB] border-transparent"
                                        )}
                                    >
                                        {tab}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Profile Bottom Content (Overview Active) */}
                        <div className="p-5 flex flex-col gap-4">
                            
                            <div>
                                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-1.5">Contact Tags</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                     <span className="text-[11px] font-bold text-slate-700 dark:text-[#E5E7EB] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#16233A] border border-slate-200 dark:border-[#22304A]">Event lead</span>
                                     <span className="text-[11px] font-bold text-slate-700 dark:text-[#E5E7EB] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#16233A] border border-slate-200 dark:border-[#22304A]">High priority</span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-1">Last Contact</p>
                                    <p className="text-[13px] font-semibold text-slate-900 dark:text-white">—</p>
                                </div>
                                <div className="pl-3 border-l border-slate-100 dark:border-[#22304A]">
                                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-[#9CA3AF] mb-1">Lead Score</p>
                                    <div className="flex items-center gap-1">
                                        <Star className="size-3.5 text-amber-500 fill-amber-500" />
                                        <p className="text-[13px] font-bold text-slate-900 dark:text-white">{activeContact.score}</p>   
                                    </div>
                                </div>
                            </div>

                            {/* Deep AI Sidebar */}
                            <div className="mt-1 rounded-[8px] bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-[#22304A] p-3.5 flex flex-col gap-3 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full" />
                                <div className="flex items-center justify-between relative z-10">
                                    <h4 className="text-[12px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                        <BadgeCheck className="size-3.5" />
                                        AI Copilot Summary
                                    </h4>
                                </div>
                                <ul className="space-y-2 text-[12px] font-medium relative z-10">
                                    <li className="flex items-start">
                                        <span className="mr-2 text-indigo-500 mt-1 text-[8px]">●</span> 
                                        <span className="text-slate-700 dark:text-[#E5E7EB] leading-relaxed">High fit for events in {activeContact.location}</span>
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 text-indigo-500 mt-1 text-[8px]">●</span> 
                                        <span className="text-slate-700 dark:text-[#E5E7EB] leading-relaxed">Suggested outreach: Event invite + partnership request.</span>
                                    </li>
                                </ul>
                                <button className="h-8 w-full rounded-[6px] border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-[#16233A] text-[12px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-[#22304A] transition-colors mt-1 relative z-10 shadow-sm">
                                    Generate Outreach Draft
                                </button>
                            </div>

                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
