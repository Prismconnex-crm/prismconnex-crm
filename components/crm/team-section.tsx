"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    Users,
    Shield,
    Check,
    X,
    ChevronDown,
    MoreVertical,
    Search,
    UserPlus,
    AlertCircle,
    Clock,
    LayoutGrid,
    Globe,
    Palette,
    Send,
    Lock,
    Database,
    FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const sidebarItems = [
    { id: "workspace", label: "Workspace", icon: LayoutGrid },
    { id: "localization", label: "Localization", icon: Globe },
    { id: "theme", label: "Theme", icon: Palette },
    { id: "email", label: "Email Sending", icon: Send },
    { id: "privacy", label: "Privacy & Compliance", icon: Lock },
    { id: "team", label: "Team & Roles", icon: Users },
    { id: "data", label: "Data Retention", icon: Database },
    { id: "audit", label: "Audit Log", icon: FileText },
];

const teamMembers = [
    { id: 1, name: "Admin (You)", email: "admin@prismconnex.com", role: "Admin", status: "Online", lastActive: "Now", avatar: "A" },
    { id: 2, name: "Sarah Miller", email: "sarah@prismconnex.com", role: "Sales Rep", status: "Online", lastActive: "5 mins ago", avatar: "S" },
    { id: 3, name: "David Lee", email: "david@prismconnex.com", role: "Support", status: "Away", lastActive: "2 hours ago", avatar: "D" },
    { id: 4, name: "Amina Khan", email: "amina@prismconnex.com", role: "Viewer", status: "Offline", lastActive: "Yesterday", avatar: "A" },
];

const permissions = [
    { name: "View all data", admin: true, sales: true, support: true, viewer: true },
    { name: "Export data", admin: true, sales: true, support: false, viewer: false },
    { name: "Launch sequences", admin: true, sales: true, support: false, viewer: false },
    { name: "Manage billing", admin: true, sales: false, support: false, viewer: false },
    { name: "Manage team members", admin: true, sales: false, support: false, viewer: false },
    { name: "Configure integrations", admin: true, sales: false, support: false, viewer: false },
    { name: "Delete records", admin: true, sales: false, support: false, viewer: false },
];

export function TeamSection() {
    const [activeTab, setActiveTab] = useState("team");

    return (
        <div className="flex flex-col h-full space-y-3 max-w-[1200px] mx-auto pb-14 relative overflow-hidden">
            {/* A) Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 shrink-0 border-b dark:border-white/[0.06] border-slate-200 pb-2">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-500/80">A)</span>
                        <h1 className="text-base font-bold dark:text-white text-slate-900 tracking-tight">Team & Roles</h1>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">Manage workspace members, roles, and permissions for your 4-person team</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button className="h-7 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md shadow-[0_0_10px_rgba(79,70,229,0.3)] font-bold text-[10px]">
                        Invite Member
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 items-start flex-1 min-h-0 overflow-hidden">
                {/* B) Secondary Sidebar */}
                <div className="relative group shrink-0">
                    <span className="absolute -top-5 left-0 text-[9px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-500/80">B)</span>
                    <nav className="flex flex-col space-y-0.5 p-1.5 dark:bg-white/[0.02] bg-white/70 backdrop-blur-xl border dark:border-white/[0.06] border-slate-200 rounded-xl">
                        {sidebarItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-200 text-left text-[10px] font-medium group/item",
                                        isActive 
                                            ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20" 
                                            : "dark:text-slate-400 text-slate-600 hover:dark:text-white hover:text-slate-900 dark:hover:bg-white/5 hover:bg-slate-100 border border-transparent"
                                    )}
                                >
                                    <Icon className={cn("size-3.5", isActive ? "text-indigo-600 dark:text-indigo-400" : "dark:text-slate-500 text-slate-400 group-hover/item:dark:text-white group-hover/item:text-slate-800")} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Main Content Area */}
                <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 pb-20 h-full">
                    {/* 1) Team Members Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative"
                    >
                        <span className="absolute -top-5 left-0 text-[9px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-500/80">1)</span>
                        <div className="dark:bg-[#0B1220] bg-white border dark:border-white/[0.06] border-slate-200 rounded-xl overflow-hidden shadow-sm dark:shadow-2xl">
                            <div className="px-3 py-2.5 border-b dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-slate-50/50 flex items-center justify-between">
                                <h2 className="text-[13px] font-bold dark:text-white text-slate-900">Team Members (4/4)</h2>
                                <div className="flex items-center gap-2">
                                    <div className="relative hidden sm:block">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-slate-400 dark:text-[#6B7280]" />
                                        <Input 
                                            placeholder="Search members..." 
                                            className="h-7 w-40 pl-7 dark:bg-[#070B14] bg-white dark:border-white/[0.06] border-slate-200 text-[10px] rounded-md"
                                        />
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-900 dark:text-[#6B7280] dark:hover:text-white">
                                        <MoreVertical className="size-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b dark:border-white/[0.06] border-slate-200 dark:text-slate-400 text-slate-500 text-[9px] uppercase tracking-wider font-bold">
                                            <th className="px-3 py-2">Member</th>
                                            <th className="px-3 py-2">Role</th>
                                            <th className="px-3 py-2">Status</th>
                                            <th className="px-3 py-2">Last Active</th>
                                            <th className="px-3 py-2 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-white/[0.04] divide-slate-100">
                                        {teamMembers.map((member) => (
                                            <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors duration-200 text-[11px]">
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center gap-2.5">
                                                        <Avatar className="h-7 w-7 border dark:border-white/[0.06] border-slate-200">
                                                            <AvatarFallback className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[10px]">
                                                                {member.avatar}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold dark:text-white text-slate-900 tracking-tight leading-tight">{member.name}</span>
                                                            <span className="text-[10px] dark:text-slate-400 text-slate-500 tracking-tight">{member.email}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="relative group/select inline-block">
                                                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md dark:bg-white/[0.03] bg-slate-100 border dark:border-white/[0.06] border-slate-200 text-[10px] dark:text-slate-300 text-slate-700 cursor-pointer hover:border-slate-300 dark:hover:border-white/[0.1]">
                                                            {member.role}
                                                            <ChevronDown className="size-2.5 dark:text-slate-500 text-slate-400" />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className={cn(
                                                        "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border",
                                                        member.status === "Online" ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20" :
                                                        member.status === "Away" ? "text-amber-600 dark:text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20" :
                                                        "dark:text-slate-400 text-slate-600 bg-slate-100 border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.06]"
                                                    )}>
                                                        {member.status}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 dark:text-slate-300 text-slate-600 text-[10px] font-medium tracking-tight">
                                                    {member.lastActive}
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    <button className="text-indigo-600 dark:text-indigo-400 font-bold text-[10px] hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider underline-offset-4 hover:underline">Edit</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>

                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-3">
                        {/* 2) Roles & Permissions Matrix */}
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="dark:bg-[#0B1220] bg-white border dark:border-white/[0.06] border-slate-200 rounded-xl overflow-hidden shadow-sm dark:shadow-2xl flex flex-col h-full"
                        >
                            <div className="px-3 py-2.5 border-b dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-slate-50/50">
                                <h3 className="text-[12px] font-bold dark:text-white text-slate-900 tracking-tight">Roles & Permissions</h3>
                            </div>
                            <div className="overflow-x-auto flex-1 custom-scrollbar">
                                <table className="w-full text-left border-collapse min-w-[400px]">
                                    <thead>
                                        <tr className="border-b dark:border-white/[0.06] border-slate-200 dark:text-slate-400 text-slate-500 text-[9px] uppercase font-bold tracking-widest leading-none">
                                            <th className="px-3 py-2">Permission</th>
                                            <th className="px-2 py-2 text-center">Admin</th>
                                            <th className="px-2 py-2 text-center">Sales</th>
                                            <th className="px-2 py-2 text-center">Support</th>
                                            <th className="px-2 py-2 text-center">Viewer</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-white/[0.04] divide-slate-100">
                                        {permissions.map((perm, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors duration-150">
                                                <td className="px-3 py-2 text-[10px] dark:text-slate-300 text-slate-700 font-medium">{perm.name}</td>
                                                <td className="px-2 py-2 text-center">
                                                    {perm.admin ? <Check className="size-3 text-emerald-600 dark:text-emerald-400 mx-auto" /> : <X className="size-3 text-red-500/80 mx-auto" />}
                                                </td>
                                                <td className="px-2 py-2 text-center">
                                                    {perm.sales ? <Check className="size-3 text-emerald-600 dark:text-emerald-400 mx-auto" /> : <X className="size-3 text-red-500/80 mx-auto" />}
                                                </td>
                                                <td className="px-2 py-2 text-center">
                                                    {perm.support ? <Check className="size-3 text-emerald-600 dark:text-emerald-400 mx-auto" /> : <X className="size-3 text-red-500/80 mx-auto" />}
                                                </td>
                                                <td className="px-2 py-2 text-center">
                                                    {perm.viewer ? <Check className="size-3 text-emerald-600 dark:text-emerald-400 mx-auto" /> : <X className="size-3 text-red-500/80 mx-auto" />}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>

                        {/* 3) AI Security Insights */}
                        <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-slate-50 border border-slate-200 dark:bg-[#070B14] dark:border-indigo-500/20 rounded-xl p-4 flex flex-col h-full shadow-inner dark:shadow-[0_0_30px_rgba(79,70,229,0.05)] dark:bg-gradient-to-b dark:from-[#070B14] dark:to-[#0B1220]"
                        >
                            <h3 className="text-[12px] font-bold dark:text-white text-slate-900 tracking-tight mb-3">AI Security Insights</h3>
                            
                            <div className="space-y-3 flex-1">
                                <div className="flex gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mt-1 shrink-0 dark:shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
                                    <p className="text-[10px] dark:text-slate-300 text-slate-700 font-medium leading-relaxed">2 members can export data</p>
                                </div>
                                <div className="flex gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 mt-1 shrink-0 dark:shadow-[0_0_10px_rgba(129,140,248,0.5)]"></div>
                                    <p className="text-[10px] dark:text-slate-300 text-slate-700 font-medium leading-relaxed">1 member has full admin access</p>
                                </div>
                                <div className="flex gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400 mt-1 shrink-0 dark:shadow-[0_0_10px_rgba(251,191,36,0.5)]"></div>
                                    <p className="text-[10px] dark:text-slate-300 text-slate-700 font-medium leading-relaxed">
                                        <span className="font-bold dark:text-amber-400 text-amber-600">Recommendation:</span> Review 'Sales Rep' permissions for data deletion
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t dark:border-white/[0.06] border-slate-200">
                                <Button className="w-full h-7 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-600/10 dark:hover:bg-indigo-600/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded-md font-bold text-[10px] tracking-tight transition-all">
                                    View Audit Log
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
}
