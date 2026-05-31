import { useState } from "react";
import { motion } from "framer-motion";
import {
    Settings,
    Mail,
    Calendar,
    Database,
    BarChart3,
    Cable,
    Server,
    FileBox,
    X,
    Check,
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    Moon,
    Sun,
    Monitor
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

export function IntegrationsSection() {
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
                        <h1 className="text-base font-bold dark:text-white text-slate-900 tracking-tight">Integrations</h1>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">Connect calendar, meetings, notifications, and webhooks</p>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto pt-2 sm:pt-0">
                        <button className="h-7 px-3 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white hover:bg-slate-50 dark:hover:bg-white/[0.04] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-colors shadow-sm">
                            View Logs
                        </button>
                        <button className="h-7 px-4 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.3)] transition-colors">
                            Add Integration
                        </button>
                    </div>
                </div>

                <div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                         <button className="h-6 px-3 rounded-full bg-indigo-600 text-white text-[10px] font-bold shadow-[0_0_10px_rgba(79,70,229,0.3)]">All</button>
                         <button className="h-6 px-3 rounded-full border dark:border-[#22304A] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] dark:text-[#9CA3AF] text-slate-600 hover:text-slate-900 dark:hover:text-white text-[10px] font-bold transition-colors">Calendar</button>
                         <button className="h-6 px-3 rounded-full border dark:border-[#22304A] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] dark:text-[#9CA3AF] text-slate-600 hover:text-slate-900 dark:hover:text-white text-[10px] font-bold transition-colors">Meetings</button>
                         <button className="h-6 px-3 rounded-full border dark:border-[#22304A] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] dark:text-[#9CA3AF] text-slate-600 hover:text-slate-900 dark:hover:text-white text-[10px] font-bold transition-colors">Notifications</button>
                         <button className="h-6 px-3 rounded-full border dark:border-[#22304A] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] dark:text-[#9CA3AF] text-slate-600 hover:text-slate-900 dark:hover:text-white text-[10px] font-bold transition-colors">Webhooks</button>
                    </div>
                </div>
            </motion.div>

            {/* Main Split-Pane Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start">
                
                {/* LEFT PANE: GRID & SUMMARY */}
                <div className="space-y-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-3"
                    >
                        {/* Integration Tile 1: Calendar Sync */}
                        <div className="rounded-xl border dark:border-indigo-500/30 border-indigo-200 dark:bg-[#16233A]/40 bg-indigo-50 hover:bg-indigo-100 dark:hover:bg-[#16233A] p-3 transition-colors cursor-pointer relative shadow-sm text-left flex flex-col items-start gap-3">
                            <div className="space-y-0.5">
                                <h3 className="text-[13px] font-bold dark:text-white text-slate-900">Calendar Sync</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Sync events and meetings</p>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-transparent px-2 py-0.5 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
                                Connected
                            </span>
                            <button className="w-full mt-1.5 h-7 rounded-md border dark:border-[#374151] border-slate-300 hover:border-slate-400 dark:hover:border-[#4B5563] dark:bg-[#0B1220] bg-white text-[10px] font-bold dark:text-white text-slate-700 transition-all shadow-sm">
                                Configure
                            </button>
                        </div>

                         {/* Integration Tile 2: Video Meetings */}
                         <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] p-3 transition-colors flex flex-col items-start gap-3 shadow-sm">
                            <div className="space-y-0.5">
                                <h3 className="text-[13px] font-bold dark:text-white text-slate-900">Video Meetings</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Create meeting links</p>
                            </div>
                            <span className="inline-flex items-center rounded-full dark:bg-slate-800 bg-slate-100 px-2 py-0.5 text-[9.5px] font-medium dark:text-slate-400 text-slate-500">
                                Not connected
                            </span>
                            <button className="w-full mt-1.5 h-7 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-all">
                                Connect
                            </button>
                        </div>

                        {/* Integration Tile 3: Team Notifications */}
                        <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] p-3 transition-colors flex flex-col items-start gap-3 shadow-sm">
                            <div className="space-y-0.5">
                                <h3 className="text-[13px] font-bold dark:text-white text-slate-900">Team Notifications</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Send deal updates</p>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-transparent px-2 py-0.5 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
                                Connected
                            </span>
                            <button className="w-full mt-1.5 h-7 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-all">
                                Configure
                            </button>
                        </div>

                        {/* Integration Tile 4: Webhooks */}
                        <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] p-3 transition-colors flex flex-col items-start gap-3 shadow-sm">
                            <div className="space-y-0.5">
                                <h3 className="text-[13px] font-bold dark:text-white text-slate-900">Webhooks</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Automate external actions</p>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-transparent px-2 py-0.5 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
                                Connected
                            </span>
                            <button className="w-full mt-1.5 h-7 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-all">
                                Manage
                            </button>
                        </div>

                        {/* Integration Tile 5: CRM Forms */}
                        <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] p-3 transition-colors flex flex-col items-start gap-3 shadow-sm">
                            <div className="space-y-0.5">
                                <h3 className="text-[13px] font-bold dark:text-white text-slate-900">CRM Forms</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Capture website leads</p>
                            </div>
                            <span className="inline-flex items-center rounded-full dark:bg-slate-800 bg-slate-100 px-2 py-0.5 text-[9.5px] font-medium dark:text-slate-400 text-slate-500">
                                Not connected
                            </span>
                            <button className="w-full mt-1.5 h-7 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-all">
                                Connect
                            </button>
                        </div>

                        {/* Integration Tile 6: File Storage */}
                        <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#0B1220] bg-white hover:bg-slate-50 dark:hover:bg-[#111B2E] p-3 transition-colors flex flex-col items-start gap-3 shadow-sm">
                            <div className="space-y-0.5">
                                <h3 className="text-[13px] font-bold dark:text-white text-slate-900">File Storage</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Store exports and attachments</p>
                            </div>
                            <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-transparent px-2 py-0.5 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
                                Connected
                            </span>
                            <button className="w-full mt-1.5 h-7 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-slate-50 hover:bg-slate-100 dark:hover:bg-white/[0.04] text-[10px] font-bold dark:text-slate-300 text-slate-700 transition-all">
                                Configure
                            </button>
                        </div>
                    </motion.div>

                    {/* Summary Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }} 
                        className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-slate-50 p-4 max-w-[400px]"
                    >
                         <h3 className="text-[11px] font-bold dark:text-white text-slate-900 mb-3 tracking-wide uppercase">Connected Integrations</h3>
                         <div className="space-y-2">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="dark:text-white text-slate-800 font-bold">Calendar Sync <span className="dark:text-slate-400 text-slate-500 font-medium">— Last sync</span></span>
                                <span className="dark:text-slate-300 text-slate-600">Today 10:12</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="dark:text-white text-slate-800 font-bold">Team Notifications <span className="dark:text-slate-400 text-slate-500 font-medium">— Last event</span></span>
                                <span className="dark:text-slate-300 text-slate-600">Deal moved to Proposal</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="dark:text-white text-slate-800 font-bold">Webhooks <span className="dark:text-slate-400 text-slate-500 font-medium">— Requests today</span></span>
                                <span className="dark:text-slate-300 text-slate-600">24</span>
                            </div>
                         </div>
                    </motion.div>
                </div>

                {/* RIGHT PANE: ACTIVE INSPECTOR */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-[#070B14] bg-white h-full shadow-sm flex flex-col pt-2 sm:pt-0"
                >
                    {/* Inspector Header */}
                    <div className="p-4 border-b dark:border-white/[0.06] border-slate-200 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <h2 className="text-[14px] font-bold dark:text-white text-slate-900">Calendar Sync</h2>
                            <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 dark:border-transparent dark:bg-emerald-500/20 px-2 py-0.5 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
                                Connected
                            </span>
                         </div>
                         <button className="dark:text-slate-400 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
                            <X className="size-4" />
                         </button>
                    </div>

                    <div className="p-4 overflow-y-auto space-y-6">
                        
                        {/* 1) CONNECTION block */}
                        <div>
                            <div className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 tracking-wide uppercase mb-3">Connection</div>
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between items-center text-[10.5px]">
                                    <span className="dark:text-slate-400 text-slate-600 font-medium">Provider</span>
                                    <span className="dark:text-white text-slate-900 text-right max-w-[150px] truncate font-bold">Calendar Provider (placeholder)</span>
                                </div>
                                <div className="flex justify-between items-center text-[10.5px]">
                                    <span className="dark:text-slate-400 text-slate-600 font-medium">Account</span>
                                    <span className="dark:text-white text-slate-900 text-right max-w-[150px] truncate font-bold">admin@prismconnex...</span>
                                </div>
                                <div className="flex justify-between items-center text-[10.5px]">
                                    <span className="dark:text-slate-400 text-slate-600 font-medium">Last sync</span>
                                    <span className="dark:text-white text-slate-900 text-right font-bold">Today 10:12</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button className="flex-1 h-7 rounded-md dark:bg-[#16233A] bg-slate-100 hover:bg-slate-200 dark:hover:bg-[#1F2937] text-[10px] font-bold dark:text-white text-slate-700 transition-colors">
                                    Reconnect
                                </button>
                                <button className="flex-1 h-7 rounded-md border border-red-500/20 bg-red-50 hover:bg-red-100 dark:bg-red-500/5 dark:hover:bg-red-500/10 text-[10px] font-bold text-red-600 dark:text-red-500 transition-colors">
                                    Disconnect
                                </button>
                            </div>
                        </div>

                        {/* 2) SYNC SETTINGS block */}
                        <div>
                             <div className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 tracking-wide uppercase mb-3">Sync Settings</div>
                             <div className="space-y-3">
                                <div className="flex justify-between items-center text-[10.5px]">
                                    <span className="dark:text-slate-400 text-slate-600 font-medium">Sync frequency</span>
                                    <span className="dark:text-white text-slate-900 font-bold">Every 15 minutes</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10.5px] font-medium dark:text-white text-slate-900">Sync events</span>
                                    <Switch checked={true} className="scale-75 origin-right" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-[10.5px] font-medium dark:text-white text-slate-900">Sync meeting links</span>
                                    <Switch checked={true} className="scale-75 origin-right" />
                                </div>
                                <div className="flex justify-between items-center text-[10.5px] pt-1">
                                    <span className="dark:text-slate-400 text-slate-600 font-medium">Default timezone</span>
                                    <span className="dark:text-white text-slate-900 font-bold">Europe/Berlin</span>
                                </div>
                             </div>
                        </div>

                        {/* 3) PERMISSIONS block */}
                        <div>
                            <div className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 tracking-wide uppercase mb-3">Permissions (Scopes)</div>
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="flex items-center gap-1.5 dark:text-slate-300 text-slate-700 font-medium">
                                        <Check className="size-3 text-indigo-500 dark:text-indigo-400" /> Read calendar events
                                    </span>
                                    <span className="dark:text-slate-400 text-slate-500">Allowed</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="flex items-center gap-1.5 dark:text-slate-300 text-slate-700 font-medium">
                                        <Check className="size-3 text-indigo-500 dark:text-indigo-400" /> Create events
                                    </span>
                                    <span className="dark:text-slate-400 text-slate-500">Allowed</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="flex items-center gap-1.5 dark:text-slate-300 text-slate-700 font-medium">
                                        <Check className="size-3 text-indigo-500 dark:text-indigo-400" /> Update events
                                    </span>
                                    <span className="dark:text-slate-400 text-slate-500">Allowed</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="flex items-center gap-1.5 dark:text-slate-400 text-slate-500 font-medium">
                                        <div className="w-3 flex justify-center"><div className="w-1.5 h-[1px] dark:bg-slate-400 bg-slate-500"></div></div> Delete events
                                    </span>
                                    <span className="flex items-center gap-1.5"><Switch disabled checked={false} className="scale-75 origin-right" /></span>
                                </div>
                            </div>
                        </div>

                        {/* 4) ACTIVITY LOG block */}
                        <div>
                             <div className="text-[9.5px] font-bold dark:text-slate-400 text-slate-500 tracking-wide uppercase mb-3">Activity Log</div>
                             <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 overflow-hidden">
                                 <div className="dark:bg-[#111B2E] bg-slate-50 px-3 py-2 text-[10px] font-bold dark:text-white text-slate-700 mb-0">Recent Activity</div>
                                 <div className="p-3 dark:bg-[#0B1220] bg-white space-y-2">
                                     <div className="flex items-center justify-between text-[9.5px]">
                                        <span className="dark:text-slate-400 text-slate-500 w-10 text-left font-bold">Time</span>
                                        <span className="dark:text-slate-400 text-slate-500 flex-1 text-left pl-2 font-bold">Action</span>
                                        <span className="dark:text-slate-400 text-slate-500 w-16 text-right font-bold">Result</span>
                                     </div>
                                     <div className="flex items-center justify-between text-[9.5px] border-t dark:border-white/[0.06] border-slate-100 pt-2">
                                        <span className="dark:text-white text-slate-800 w-10 text-left font-medium">10:12</span>
                                        <span className="dark:text-white text-slate-800 flex-1 text-left pl-2">Sync completed</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 w-16 text-right font-bold">Success</span>
                                     </div>
                                     <div className="flex items-center justify-between text-[9.5px] border-t dark:border-white/[0.06] border-slate-100 pt-2">
                                        <span className="dark:text-white text-slate-800 w-10 text-left font-medium">09:57</span>
                                        <span className="dark:text-white text-slate-800 flex-1 text-left pl-2">Sync completed</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 w-16 text-right font-bold">Success</span>
                                     </div>
                                     <div className="flex items-center justify-between text-[9.5px] border-t dark:border-white/[0.06] border-slate-100 pt-2">
                                        <span className="dark:text-white text-slate-800 w-10 text-left font-medium">09:42</span>
                                        <span className="dark:text-white text-slate-800 flex-1 text-left pl-2">Token refreshed</span>
                                        <span className="text-emerald-600 dark:text-emerald-400 w-16 text-right font-bold">Success</span>
                                     </div>
                                 </div>
                             </div>
                        </div>

                    </div>
                    
                    {/* Notice Block */}
                    <div className="mt-auto p-4 border-t dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-slate-50">
                        <div className="flex items-start gap-2">
                             <h4 className="text-[10px] font-bold dark:text-white text-slate-900 whitespace-nowrap">Data Notice</h4>
                             <p className="text-[10px] dark:text-slate-400 text-slate-600 leading-tight mt-[1px]">Integrations share only the data needed for the selected features.</p>
                        </div>
                    </div>
                </motion.div>
                
            </div>
        </div>
    );
}
