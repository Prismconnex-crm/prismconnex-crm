"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  LogIn,
  Settings,
  Eye,
  Video,
  Mail,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Edit,
  Trash2,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Zap,
  CreditCard,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AuditLogRoadmapDialog } from "./audit-log-roadmap-dialog";

/* ─── mock data ─── */
const activityEntries = [
  { time: "Today, 10:15 AM", actor: "Alex Chen (Exhibitor)", action: 'created new Lead "Global Tech Solutions" in Leads Module.', type: "Create", badge: "bg-emerald-500/15 text-emerald-400", icon: Plus },
  { time: "Today, 09:55 AM", actor: "Maria Rodriguez (Organizer)", action: 'updated Event "Future Health Summit 2024" details in Events Module.', type: "Update", badge: "bg-amber-500/15 text-amber-400", icon: Edit },
  { time: "Today, 09:30 AM", actor: "System (AI Copilot)", action: 'deleted inactive contact "John Doe" from People Module.', type: "Delete", badge: "bg-red-500/15 text-red-400", icon: Trash2 },
  { time: "Today, 08:00 AM", actor: "Sarah Lee (Attendee)", action: "logged in from San Francisco, USA.", type: "Login", badge: "bg-indigo-500/15 text-indigo-400", icon: LogIn },
  { time: "Yesterday, 04:45 PM", actor: "Admin user", action: 'changed "Deliverability" settings to High Priority.', type: "Settings", badge: "bg-slate-500/15 text-slate-400", icon: Settings },
  { time: "Yesterday, 02:00 PM", actor: "James Kim (Service Provider)", action: 'joined Zoom meeting for "Client Onboarding" via Integrations Module.', type: "Meeting", badge: "bg-purple-500/15 text-purple-400", icon: Video },
  { time: "Yesterday, 01:15 PM", actor: "Emily Davis (Organizer)", action: 'started email sequence "Post-Event Follow-up" in Sequence Studio.', type: "Sequence", badge: "bg-cyan-500/15 text-cyan-400", icon: Mail },
  { time: "Yesterday, 11:30 AM", actor: "Michael Brown (Attendee)", action: "updated billing information; subscription active.", type: "Billing", badge: "bg-pink-500/15 text-pink-400", icon: CreditCard },
  { time: "Yesterday, 10:00 AM", actor: "Admin user", action: "granted 'Analytics' module access to user 'Tech Team Lead'.", type: "Permission", badge: "bg-teal-500/15 text-teal-400", icon: Shield },
];

const workflowSteps = [
  { label: "Login", time: "08:00 AM" },
  { label: 'Viewed Event "Tech Expo"', time: "08:15 AM" },
  { label: 'Joined Zoom Meeting "Session 1"', time: "09:00 AM" },
  { label: 'Started Sequence "Lead Nurture"', time: "10:30 AM" },
  { label: 'Updated Settings "Notifications"', time: "11:45 AM" },
  { label: "Unsubscribed", time: "01:00 PM" },
];

const riskAlerts = [
  { title: "Suspicious Activity", desc: 'Yesterday, 03:50 AM - User "Chris Johnson" (Organizer) - 20 failed login attempts within 5 minutes.', border: "border-amber-500/40" },
  { title: "Unpaid Dues", desc: 'Yesterday, 12:00 PM - User "David Smith" (Exhibitor) - Billing status: Due for 3 months, access limited.', border: "border-red-500/40" },
  { title: "Limited Access", desc: 'Yesterday, 11:00 AM - User "Anna White" (Service Provider) - Permission changed to \'Limited Access\' by Admin.', border: "border-amber-500/40" },
];

const userStatusList = [
  { initials: "AC", name: "Alex Chen", status: "Active", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  { initials: "MR", name: "Maria Rodriguez", status: "Suspended", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  { initials: "DU", name: "Deryan user", status: "Limited Access", color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20" },
  { initials: "ER", name: "Evelyn Reed", status: "Limited Access", color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20" },
];

const modulePerms = [
  { module: "Events", access: "Events" },
  { module: "Companies", access: "Companies" },
  { module: "People", access: "People" },
  { module: "Leads", access: "Leads" },
  { module: "Unsubscribed", access: "Any" },
];

export function AuditLogSection() {
  const [roadmapOpen, setRoadmapOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 h-full overflow-hidden">
      {/* ── HEADER ── */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between shrink-0">
        <div>
          <h1 className="text-sm font-bold leading-tight dark:text-white text-slate-900">Audit Log</h1>
          <p className="text-[9px] text-slate-500 dark:text-slate-400">Complete operational accountability across every user, workspace, and workflow.</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {[{ label: "ENTRIES", val: "09" }, { label: "RISK FLAGS", val: "03" }, { label: "CONTROLS", val: "12" }].map((s) => (
            <div key={s.label} className="text-center px-2 py-0.5 rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white">
              <div className="text-[7px] font-bold uppercase tracking-widest text-slate-500">{s.label}</div>
              <div className="text-[11px] font-extrabold dark:text-white text-slate-900">{s.val}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── 3-COLUMN BODY ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 flex-1 min-h-0 overflow-hidden">

        {/* COL 1 — Activity Stream */}
        <div className="md:col-span-4 rounded-lg border dark:border-white/[0.06] border-slate-200 dark:bg-[#0E1321]/60 bg-white overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-1.5 py-1.5 space-y-1 custom-scrollbar">
            {activityEntries.map((e, i) => {
              const Icon = e.icon;
              return (
                <button key={i} onClick={() => setRoadmapOpen(true)} className="w-full text-left rounded-md border dark:border-white/[0.05] border-slate-100 dark:bg-white/[0.02] bg-slate-50/60 p-1.5 hover:dark:bg-white/[0.04] hover:bg-slate-100 transition-all cursor-pointer">
                  <div className="flex items-start gap-1.5">
                    <div className="mt-0.5 shrink-0">
                      <div className={cn("size-4 rounded-full flex items-center justify-center", e.badge)}>
                        <Icon className="size-2.5" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[7px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-500">{e.time}</span>
                        <span className={cn("text-[7px] font-bold px-1 py-px rounded-full", e.badge)}>{e.type}</span>
                      </div>
                      <p className="text-[8px] dark:text-slate-200 text-slate-700 leading-snug">
                        <span className="font-semibold dark:text-white text-slate-800">{e.actor}</span>{" "}
                        {e.action}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* COL 2 — Workflow Trace + Risk */}
        <div className="md:col-span-4 flex flex-col gap-2 min-h-0 overflow-hidden">
          {/* Workflow Trace */}
          <div className="rounded-lg border dark:border-white/[0.06] border-slate-200 dark:bg-[#0E1321]/60 bg-white p-2 shrink-0">
            <div className="flex flex-wrap items-center gap-1">
              {workflowSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className="rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.03] bg-slate-50 px-1.5 py-1 text-center min-w-0">
                    <p className="text-[7.5px] font-semibold dark:text-white text-slate-800 truncate leading-tight">{s.label}</p>
                    <p className="text-[6.5px] text-slate-500">{s.time}</p>
                  </div>
                  {i < workflowSteps.length - 1 && (
                    <div className="shrink-0">
                      {(i === 1 || i === 3) ? (
                        <ArrowDown className="size-2.5 text-slate-500" />
                      ) : i === 2 ? (
                        <ArrowLeft className="size-2.5 text-slate-500" />
                      ) : (
                        <ArrowRight className="size-2.5 text-slate-500" />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Risk / Attention Needed */}
          <div className="rounded-lg border border-red-500/20 dark:bg-[#0E1321]/60 bg-white flex-1 overflow-y-auto p-2 custom-scrollbar min-h-0">
            <div className="flex items-center gap-1 mb-1.5">
              <Zap className="size-3 text-red-400" />
              <span className="text-[9px] font-bold dark:text-white text-slate-900">Risk/Attention Needed</span>
              <AlertTriangle className="size-3 text-amber-400 ml-auto" />
            </div>
            <div className="space-y-1.5">
              {riskAlerts.map((r, i) => (
                <div key={i} className={cn("rounded-md border p-1.5 dark:bg-white/[0.02] bg-slate-50/60", r.border)}>
                  <p className="text-[8px] font-bold dark:text-white text-slate-900 mb-0.5">{r.title}</p>
                  <p className="text-[7px] dark:text-slate-400 text-slate-500 leading-snug">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COL 3 — Admin Control Panel */}
        <div className="md:col-span-4 rounded-lg border dark:border-white/[0.06] border-slate-200 dark:bg-[#0E1321]/60 bg-white overflow-y-auto flex flex-col min-h-0 custom-scrollbar">
          <div className="px-2 pt-2 pb-1 text-center shrink-0">
            <div className="w-6 h-0.5 mx-auto rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 mb-0.5" />
            <h2 className="text-[9px] font-bold dark:text-white text-slate-900">Admin Control Panel</h2>
          </div>
          <div className="px-2 pb-2 space-y-1.5 flex-1 min-h-0">
            {/* User Status Toggles */}
            <div>
              <h3 className="text-[7px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 px-0.5">User Status Toggles</h3>
              <div className="space-y-0.5">
                {userStatusList.map((u, i) => (
                  <div key={i} className="flex items-center justify-between px-1.5 py-1 rounded-md dark:bg-white/[0.02] bg-slate-50/60 border dark:border-white/[0.04] border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <div className="size-4 rounded-full bg-indigo-500/15 flex items-center justify-center text-[6px] font-bold text-indigo-400">{u.initials}</div>
                      <span className="text-[8px] font-medium dark:text-white text-slate-800">{u.name}</span>
                    </div>
                    <span className={cn("text-[6.5px] font-bold px-1 py-px rounded-full border", u.color)}>{u.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Billing Status */}
            <div>
              <h3 className="text-[7px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 px-0.5">Billing Status</h3>
              <div className="grid grid-cols-3 gap-0.5">
                {[
                  { icon: CheckCircle2, label: "Paid", color: "text-emerald-400" },
                  { icon: AlertTriangle, label: "Due", color: "text-amber-400" },
                  { icon: Clock, label: "Unsubscribed", color: "text-slate-400" },
                ].map((b) => (
                  <div key={b.label} className="flex flex-col items-center gap-px py-1 rounded-md dark:bg-white/[0.02] bg-slate-50/60 border dark:border-white/[0.04] border-slate-100">
                    <b.icon className={cn("size-3", b.color)} />
                    <span className="text-[7px] font-medium dark:text-slate-300 text-slate-600">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Permission Controls */}
            <div>
              <h3 className="text-[7px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 px-0.5">Permission Controls</h3>
              <div className="rounded-md dark:bg-white/[0.02] bg-slate-50/60 border dark:border-white/[0.04] border-slate-100 p-1.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] font-medium dark:text-white text-slate-800">Assign user module access</span>
                  <div className="w-6 h-3.5 rounded-full bg-indigo-500 flex items-center justify-end px-0.5">
                    <div className="size-2.5 rounded-full bg-white shadow-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1">
                  <span className="text-[7px] font-semibold text-slate-500 dark:text-slate-400">Module</span>
                  <span className="text-[7px] font-semibold text-slate-500 dark:text-slate-400">Access</span>
                  {modulePerms.map((m, i) => (
                    <div key={i} className="contents">
                      <div className="flex items-center gap-0.5">
                        <Search className="size-2 text-slate-500" />
                        <span className="text-[7.5px] dark:text-slate-300 text-slate-600">{m.module}</span>
                      </div>
                      <div className="flex items-center justify-between rounded border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.03] bg-white px-1 py-px">
                        <span className="text-[7px] dark:text-slate-300 text-slate-600">{m.access}</span>
                        <ChevronDown className="size-2 text-slate-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Emergency Disable Service */}
            <div>
              <h3 className="text-[7px] font-bold uppercase tracking-wider text-slate-500 mb-0.5 px-0.5">Emergency Disable Service</h3>
              <div className="rounded-md dark:bg-white/[0.02] bg-slate-50/60 border dark:border-white/[0.04] border-slate-100 p-1.5">
                <p className="text-[7px] dark:text-slate-400 text-slate-500 mb-1">Click your emergency disable service.</p>
                <button className="w-full flex items-center justify-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-1 text-[7.5px] font-bold uppercase tracking-wider transition-all">
                  <AlertTriangle className="size-2.5" />
                  EMERGENCY DISABLE SERVICE
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Roadmap Dialog */}
      <AuditLogRoadmapDialog open={roadmapOpen} onOpenChange={setRoadmapOpen} />
    </div>
  );
}
