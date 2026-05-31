"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Shield,
  Search,
  Calendar,
  CreditCard,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Crown,
  Pause,
  Play,
  ArrowRight,
  Settings,
  Mail,
  Video,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* roadmap modal data exactly mapping to the image */
const roadmapCards = [
  { time: "09:00 AM, Oct 25", title: "Login", desc: "User logged in securely via SSO" },
  { time: "09:05 AM, Oct 25", title: "Viewed Event", desc: "Viewed 'Berlin Tech Expo 2026' details" },
  { time: "09:15 AM, Oct 25", title: "Clicked Action", desc: "Clicked 'Buy Ticket' for Early Bird pass" },
  { time: "09:20 AM, Oct 25", title: "Checked Service", desc: "Checked 'Hotels Nearby' via map integration" },
  { time: "09:10 AM, Oct 25", title: "Checked Service", desc: "Checked 'Hotels' via map integration" },
  { time: "10:00 AM, Oct 25", title: "Joined Meeting", desc: "Joined Zoom Meeting: 'Exhibitor Prep Call'" },
  { time: "11:30 AM, Oct 25", title: "Started Sequence", desc: "Started 'Post-Event Follow-up' email sequence" },
  { time: "01:45 PM, Oct 25", title: "Updated Settings", desc: "Updated Localization preferences to 'German'" },
  { time: "02:00 PM, Oct 25", title: "Billing Due", desc: "Automated 'Billing Due' reminder triggered", colorClass: "border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]" },
];

const roadmapTabs = ["All", "Security", "Meetings", "Events", "Sequences", "Billing", "Settings"];

const tabIcons: Record<string, typeof Search> = {
  All: Search, Security: Shield, Meetings: Video, Events: Calendar, Sequences: Mail, Billing: CreditCard, Settings: Settings,
};

type AuditLogRoadmapDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AuditLogRoadmapDialog({ open, onOpenChange }: AuditLogRoadmapDialogProps) {
  const [activeTab, setActiveTab] = useState("All");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="p-0 border-0 bg-transparent shadow-none max-w-[720px] outline-none"
        style={{ 
          position: "fixed",
          left: "auto",
          right: "1.5rem",
          top: "50%",
          transform: "translateY(-50%)",
          width: "calc(100% - 3rem)",
          maxHeight: "calc(100vh - 2rem)",
          display: "flex",
          flexDirection: "column" as const,
        }}
      >
        <DialogTitle className="sr-only">User Activity Roadmap</DialogTitle>
        
        <div className="flex-1 rounded-[20px] border border-white/[0.1] bg-gradient-to-b from-[#18213A] to-[#0D1425] shadow-2xl flex flex-col overflow-hidden relative w-full h-full max-h-full">
          
          {/* Animated Tech Background */}
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none mix-blend-screen bg-circuit-pattern" />

          {/* Header */}
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0 relative z-10">
            <h2 className="text-[12px] font-bold text-white tracking-wide">User Activity Roadmap - Prism Connex CRM Audit Log</h2>
            <button onClick={() => onOpenChange(false)} className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
              <X className="size-3.5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col p-4 relative z-10 overflow-hidden min-h-0">
            {/* Profile Strip */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] shrink-0 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="relative size-10 rounded-full border border-indigo-500/30 flex items-center justify-center bg-indigo-500/10 text-xl font-bold text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                  A
                  <Crown className="absolute -top-1.5 -right-1 text-amber-400 size-4 drop-shadow-md" />
                </div>
                <div>
                  <span className="text-[14px] font-bold text-white block leading-tight">Alex Chen</span>
                  <span className="text-[10px] text-slate-400 tracking-wide">Persona</span>
                </div>
                <div className="ml-4 flex items-center gap-1.5 border border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-amber-600/10 px-3 py-1 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                  <Crown className="size-3 text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400">Organizer</span>
                </div>
                <span className="text-[9px] text-slate-400 ml-1">Persona Badge</span>
              </div>
              
              <div className="flex flex-col items-end gap-1.5">
                <div className="text-[9px] font-medium text-slate-300 border border-white/10 bg-white/[0.03] px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Globe className="size-3 text-slate-400" /> Workspace: Global Events Hub
                </div>
                <div className="flex gap-2">
                  <div className="text-[9px] font-bold text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <div className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" /> Active
                  </div>
                  <div className="text-[9px] font-bold text-amber-400 border border-amber-500/30 bg-amber-500/10 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <AlertTriangle className="size-2.5" /> Billing: Due
                  </div>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1.5 mt-3 shrink-0">
              {roadmapTabs.map((t) => {
                const TabIcon = tabIcons[t] || Search;
                const isActive = t === activeTab;
                return (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-all shadow-sm",
                      isActive
                        ? "bg-indigo-600 text-white shadow-glow-sm"
                        : "bg-white/[0.02] text-slate-400 border border-white/[0.08] hover:bg-white/[0.05] hover:text-white"
                    )}
                  >
                    <TabIcon className="size-3" /> {t}
                  </button>
                );
              })}
            </div>

            {/* Main Content Layout */}
            <div className="flex gap-4 mt-4 flex-1 min-h-0">
              {/* Left: Activity Cards Grid */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col justify-center">
                
                {/* Row 1 */}
                <div className="flex items-center gap-2 relative z-10 w-full">
                  <RoadmapCard data={roadmapCards[0]} />
                  <ArrowRight className="size-4 text-cyan-400 shrink-0" />
                  <RoadmapCard data={roadmapCards[1]} />
                  <ArrowRight className="size-4 text-indigo-400 shrink-0" />
                  <RoadmapCard data={roadmapCards[2]} />
                </div>

                {/* Return Path 1 */}
                <div className="h-5 w-full relative z-0">
                    <svg className="absolute inset-0 w-[100%] h-full overflow-visible pointer-events-none" preserveAspectRatio="none">
                      {/* Starts from box 3 bottom, curves left to box 4 top */}
                      <path d="M 83.3% 0 C 83.3% 100%, 16.6% 0%, 16.6% 100%" fill="none" stroke="rgba(45,212,191,0.5)" strokeWidth="1.5" strokeDasharray="3 3" />
                      <circle cx="16.6%" cy="100%" r="2" fill="rgba(45,212,191,0.8)" transform="translate(0, 2)" />
                    </svg>
                </div>

                {/* Row 2 */}
                <div className="flex items-center gap-2 relative z-10 w-full">
                  <RoadmapCard data={roadmapCards[3]} />
                  <ArrowRight className="size-4 text-cyan-400 shrink-0" />
                  <RoadmapCard data={roadmapCards[4]} />
                  <ArrowRight className="size-4 text-indigo-400 shrink-0" />
                  <RoadmapCard data={roadmapCards[5]} />
                </div>

                {/* Return Path 2 */}
                <div className="h-5 w-full relative z-0">
                    <svg className="absolute inset-0 w-[100%] h-full overflow-visible pointer-events-none" preserveAspectRatio="none">
                      <path d="M 83.3% 0 C 83.3% 100%, 16.6% 0%, 16.6% 100%" fill="none" stroke="rgba(99,102,241,0.5)" strokeWidth="1.5" strokeDasharray="3 3" />
                      <circle cx="16.6%" cy="100%" r="2" fill="rgba(99,102,241,0.8)" transform="translate(0, 2)" />
                    </svg>
                </div>

                {/* Row 3 */}
                <div className="flex items-center gap-2 relative z-10 w-full mb-2">
                  <RoadmapCard data={roadmapCards[6]} />
                  <ArrowRight className="size-4 text-indigo-400 shrink-0" />
                  <RoadmapCard data={roadmapCards[7]} />
                  <ArrowRight className="size-4 text-rose-500 shrink-0" />
                  <RoadmapCard data={roadmapCards[8]} />
                </div>

              </div>

              {/* Right: AI Summary + Admin Controls */}
              <div className="w-[240px] shrink-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar pb-2">
                {/* AI Summary */}
                <div className="rounded-[14px] bg-gradient-to-b from-[#1E293B]/80 to-[#0F172A]/80 border border-white/[0.08] shadow-[0_0_20px_rgba(99,102,241,0.05)] p-3 relative overflow-hidden backdrop-blur-md">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[30px] rounded-full pointer-events-none" />
                  <div className="flex items-center gap-1.5 mb-2 relative z-10">
                    <Sparkles className="size-3 text-cyan-400" />
                    <span className="text-[12px] font-bold text-white tracking-wide">AI Summary</span>
                  </div>
                  <div className="space-y-2 relative z-10">
                    <div>
                      <p className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Most Used Module:</p>
                      <p className="text-[9.5px] text-slate-200 mt-0.5">Events & Sequences</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Recent Critical Event:</p>
                      <p className="text-[9.5px] text-slate-200 mt-0.5">Billing Due Triggered</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Suggested Admin Action:</p>
                      <p className="text-[9.5px] text-slate-200 mt-0.5 leading-snug">Review Billing Status, Monitor Sequence Activity</p>
                    </div>
                  </div>
                </div>

                {/* Admin Controls */}
                <div className="rounded-[14px] bg-[#1E293B]/40 border border-white/[0.06] p-3 backdrop-blur-md">
                  <span className="text-[10px] font-bold text-white mb-2.5 block">Admin Controls</span>
                  <div className="space-y-2 mb-3">
                    <ToggleRow label="Toggle Service" on={true} />
                    <ToggleRow label="Restrict Sequence Studio" on={false} />
                    <ToggleRow label="Restrict Ticket Access" on={false} />
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <ControlButton 
                      label="Reset Session" 
                      icon={RotateCcw} 
                      className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20" 
                    />
                    <ControlButton 
                      label="Mark Billing Reminder Sent" 
                      icon={CheckCircle2} 
                      iconClass="text-blue-400"
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/[0.06]" 
                    />
                    <ControlButton 
                      label="Suspend Account" 
                      icon={Pause} 
                      className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20" 
                    />
                    <ControlButton 
                      label="Restore Access" 
                      icon={Play} 
                      className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" 
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* Helper Components */
function RoadmapCard({ data }: { data: any }) {
  return (
    <div className={cn(
      "w-[30%] shrink-0 flex flex-col bg-slate-800/40 backdrop-blur-md rounded-[12px] p-3 border border-white/[0.08] shadow-sm relative overflow-hidden group transition-all",
      data.colorClass
    )}>
       <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
       
       <div className="relative z-10">
         <p className="text-[8.5px] font-medium text-slate-300/80 mb-1 tracking-wide">{data.time}</p>
         <h4 className="text-[12px] font-bold text-white leading-tight mb-1">{data.title}</h4>
         <p className="text-[9.5px] text-slate-400 leading-snug tracking-wide line-clamp-2">{data.desc}</p>
       </div>
    </div>
  );
}

function ToggleRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9.5px] text-slate-200 font-medium">{label}</span>
      <div className={cn(
        "w-[30px] h-[16px] rounded-full flex items-center px-0.5 transition-all text-[5px] font-bold select-none cursor-pointer relative shrink-0",
        on ? "bg-cyan-500 justify-end text-slate-900" : "bg-slate-600 justify-start text-white/50"
      )}>
        {on ? "ON" : "OFF"}
        <div className="size-3 rounded-full bg-white shadow-sm absolute z-10 mx-[-1px]" />
      </div>
    </div>
  );
}

function ControlButton({ label, icon: Icon, className, iconClass }: any) {
  return (
    <button className={cn(
      "w-full flex items-center justify-between py-[7px] px-3 rounded-[8px] text-[9.5px] font-semibold transition-all shadow-sm",
      className
    )}>
      <span>{label}</span>
      <Icon className={cn("size-3.5", iconClass)} />
    </button>
  );
}
