"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ChevronRight,
    Check,
    Plus,
    Settings,
    CreditCard,
    FileText,
    User,
    HelpCircle,
    Zap,
    LogOut,
    ExternalLink,
    Sparkles,
    Shield,
    Globe,
    Building2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface WorkspaceSwitcherProps {
    isOpen: boolean;
    onClose: () => void;
}

export function WorkspaceSwitcher({ isOpen, onClose }: WorkspaceSwitcherProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Fixed Backdrop for catching clicks outside */}
                    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:bg-transparent" onClick={onClose} />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10, x: 0 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className={cn(
                            "fixed z-[60] rounded-3xl p-[1px] overflow-hidden shadow-2xl",
                            // Mobile: centered overlay with proper margins
                            "inset-x-4 bottom-4 top-auto",
                            // Desktop: positioned beside sidebar
                            "md:inset-x-auto md:bottom-6 md:left-[296px] md:w-[320px]"
                        )}
                        style={{ maxHeight: "calc(100vh - 32px)" }}
                    >
                        {/* Animated Border Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-border-rotate" />
                        <style jsx>{`
                            @keyframes rotate {
                                from { transform: rotate(0deg); }
                                to { transform: rotate(360deg); }
                            }
                            .animate-border-rotate {
                                width: 200%;
                                height: 200%;
                                top: -50%;
                                left: -50%;
                                animation: rotate 4s linear infinite;
                            }
                        `}</style>

                        {/* Main Content Area */}
                        <div className="relative h-full w-full bg-[#0B1220]/95 backdrop-blur-2xl rounded-[23px] overflow-y-auto flex flex-col no-scrollbar" style={{ maxHeight: "calc(100vh - 36px)" }}>
                            
                            {/* Section 1: Top Profile & Usage Metrics */}
                            <div className="p-5 space-y-5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-glow-sm">
                                            <Building2 className="size-5 text-indigo-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[14px] font-bold text-white tracking-tight">Prism Connex Workspace</span>
                                            <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-400/80">Professional Plan</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-1">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                                            <span>Usage Metrics</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[11px] font-medium">
                                                    <span className="text-[#9CA3AF]">Seats Used: 3 / 4</span>
                                                    <span className="text-white">75%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: "75%" }} className="h-full bg-indigo-500 shadow-glow-sm" />
                                                </div>
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex justify-between text-[11px] font-medium">
                                                        <span className="text-[#9CA3AF]">Contacts: 8.2k / 10k</span>
                                                        <span className="text-white">82%</span>
                                                    </div>
                                                    <div className="h-1 w-full bg-white/[0.04] rounded-full overflow-hidden">
                                                        <motion.div initial={{ width: 0 }} animate={{ width: "82%" }} className="h-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]" />
                                                    </div>
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex justify-between text-[11px] font-medium">
                                                        <span className="text-[#9CA3AF]">Sequences</span>
                                                        <span className="text-white">12 Active</span>
                                                    </div>
                                                    <div className="h-1 w-full bg-white/[0.04] rounded-full overflow-hidden">
                                                        <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} className="h-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="h-px w-full bg-white/[0.06]" />

                            {/* Section 2: Switch Workspace */}
                            <div className="p-2 space-y-0.5">
                                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">Switch Workspace</div>
                                <button className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-white group">
                                    <div className="flex items-center gap-3">
                                        <Building2 className="size-4 text-indigo-400" />
                                        <span className="text-[13px] font-medium">Prism Connex Workspace</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Check className="size-3.5 text-indigo-400" />
                                        <Globe className="size-3.5 text-[#6B7280]" />
                                    </div>
                                </button>
                                <button className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/[0.04] text-[#9CA3AF] hover:text-white transition-all group">
                                    <div className="flex items-center gap-3">
                                        <Building2 className="size-4 opacity-50 group-hover:opacity-100" />
                                        <span className="text-[13px] font-medium">EU Division</span>
                                        <div className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                                    </div>
                                    <Globe className="size-4 opacity-0 group-hover:opacity-50" />
                                </button>
                                <button className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/[0.04] text-[#9CA3AF] hover:text-white transition-all group">
                                    <div className="flex items-center gap-3">
                                        <Building2 className="size-4 opacity-50 group-hover:opacity-100" />
                                        <span className="text-[13px] font-medium">APAC Expansion Project</span>
                                    </div>
                                </button>
                            </div>

                            {/* Divider */}
                            <div className="h-px w-full bg-white/[0.06]" />

                            {/* Section 3 & 4: Actions & Account */}
                            <div className="p-2 grid grid-cols-2 gap-0.5">
                                <div className="space-y-0.5">
                                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">Workspace</div>
                                    <MenuItem icon={Plus} label="New Workspace" />
                                    <MenuItem icon={Settings} label="Settings" />
                                    <MenuItem icon={CreditCard} label="Billing" />
                                    <MenuItem icon={FileText} label="Audit Log" />
                                </div>
                                <div className="space-y-0.5 border-l border-white/[0.06]">
                                    <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">Account</div>
                                    <MenuItem icon={User} label="My Profile" />
                                    <MenuItem icon={HelpCircle} label="Documentation" />
                                    <MenuItem icon={Zap} label="What's New" />
                                    <MenuItem icon={LogOut} label="Log Out" color="text-red-400" />
                                </div>
                            </div>

                            {/* Section 5: AI Workspace Insight */}
                            <div className="p-3 pt-1">
                                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/20 space-y-3 relative overflow-hidden group/ai">
                                    <div className="absolute top-0 right-0 p-2 opacity-20 group-hover/ai:opacity-40 transition-opacity">
                                        <Sparkles className="size-8 text-indigo-400 rotate-12" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-5 w-5 rounded-md bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                                            <Sparkles className="size-3 text-indigo-400" />
                                        </div>
                                        <span className="text-[12px] font-bold text-white tracking-tight">AI Workspace Insight</span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-[#D1D5DB] pr-4">
                                        Your contact usage is approaching the limit. Consider upgrading for unlimited contacts and advanced analytics.
                                    </p>
                                    <button className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-all shadow-glow-sm">
                                        View Plans
                                    </button>
                                </div>
                            </div>

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function MenuItem({ icon: Icon, label, color = "text-[#9CA3AF]" }: { icon: any, label: string, color?: string }) {
    return (
        <button className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-white/[0.04] text-[12px] font-medium transition-all group">
            <Icon className={cn("size-3.5", color === "text-[#9CA3AF]" ? "opacity-50 group-hover:opacity-100" : color)} />
            <span className={cn(color === "text-[#9CA3AF]" ? "text-[#9CA3AF] group-hover:text-white" : color)}>{label}</span>
        </button>
    );
}
