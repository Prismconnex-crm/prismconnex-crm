"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Edit,
  Eye,
  FileText,
  LogIn,
  MailX,
  Plus,
  Power,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { AuditLogRoadmapDialog } from "@/components/crm/audit-log-roadmap-dialog";
import { cn } from "@/lib/utils";

/* ─── types ─── */
type AccentKey = "emerald" | "sky" | "rose" | "violet" | "amber" | "cyan" | "fuchsia" | "slate";

type ActivityEntry = { time: string; tag: string; title: string; description: string; accent: AccentKey; icon: LucideIcon };
type WorkflowStep = { time: string; title: string; accent: AccentKey; icon: LucideIcon };
type RiskItem = { title: string; time: string; detail: string; icon: LucideIcon; border: string };
type UserStatus = { name: string; status: "Active" | "Suspended" | "Limited Access" };
type PermissionRow = { module: string; access: string; icon: LucideIcon };

/* ─── accent styles (compact) ─── */
const accentStyles: Record<AccentKey, { card: string; badge: string }> = {
  emerald: { card: "border-emerald-400/30 dark:border-emerald-400/20", badge: "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300" },
  sky:     { card: "border-sky-400/30 dark:border-sky-400/20",         badge: "bg-sky-500/12 text-sky-700 dark:bg-sky-400/12 dark:text-sky-300" },
  rose:    { card: "border-rose-400/30 dark:border-rose-400/20",       badge: "bg-rose-500/12 text-rose-700 dark:bg-rose-400/12 dark:text-rose-300" },
  violet:  { card: "border-violet-400/30 dark:border-violet-400/20",   badge: "bg-violet-500/12 text-violet-700 dark:bg-violet-400/12 dark:text-violet-300" },
  amber:   { card: "border-amber-400/30 dark:border-amber-400/20",     badge: "bg-amber-500/12 text-amber-700 dark:bg-amber-400/12 dark:text-amber-300" },
  cyan:    { card: "border-cyan-400/30 dark:border-cyan-400/20",       badge: "bg-cyan-500/12 text-cyan-700 dark:bg-cyan-400/12 dark:text-cyan-300" },
  fuchsia: { card: "border-fuchsia-400/30 dark:border-fuchsia-400/20", badge: "bg-fuchsia-500/12 text-fuchsia-700 dark:bg-fuchsia-400/12 dark:text-fuchsia-300" },
  slate:   { card: "border-slate-300/50 dark:border-slate-600/20",     badge: "bg-slate-100 text-slate-700 dark:bg-slate-400/10 dark:text-slate-300" },
};

const statusStyles: Record<string, string> = {
  Active:           "bg-emerald-500/12 text-emerald-700 border-emerald-500/30 dark:bg-emerald-400/12 dark:text-emerald-300 dark:border-emerald-400/25",
  Suspended:        "bg-rose-500/12 text-rose-700 border-rose-500/30 dark:bg-rose-400/12 dark:text-rose-300 dark:border-rose-400/25",
  "Limited Access": "bg-amber-500/12 text-amber-700 border-amber-500/30 dark:bg-amber-400/12 dark:text-amber-300 dark:border-amber-400/25",
  Paid:             "bg-emerald-500/12 text-emerald-700 border-emerald-500/30 dark:bg-emerald-400/12 dark:text-emerald-300 dark:border-emerald-400/25",
  Due:              "bg-rose-500/12 text-rose-700 border-rose-500/30 dark:bg-rose-400/12 dark:text-rose-300 dark:border-rose-400/25",
  Unsubscribed:     "bg-slate-100 text-slate-600 border-slate-300/50 dark:bg-slate-400/10 dark:text-slate-300 dark:border-slate-500/25",
};

/* ─── data ─── */
const activityEntries: ActivityEntry[] = [
  { time: "Today, 10:15 AM", tag: "Create", title: "Alex Chen (Exhibitor) created new Lead", description: '"Global Tech Solutions" in Leads Module.', accent: "emerald", icon: Plus },
  { time: "Today, 09:55 AM", tag: "Update", title: "Maria Rodriguez (Organizer) updated Event", description: '"Future Health Summit 2024" details in Events Module.', accent: "sky", icon: Edit },
  { time: "Today, 09:30 AM", tag: "Delete", title: "System (AI Copilot) deleted inactive contact", description: '"John Doe" from People Module.', accent: "rose", icon: Trash2 },
  { time: "Today, 08:00 AM", tag: "Login", title: "Sarah Lee (Attendee) logged in", description: "From San Francisco, USA.", accent: "violet", icon: LogIn },
  { time: "Yesterday, 04:45 PM", tag: "Settings", title: "Admin changed Deliverability settings", description: "Priority moved to High Priority.", accent: "amber", icon: Settings },
  { time: "Yesterday, 02:00 PM", tag: "Meeting", title: "James Kim (Service Provider) joined Zoom meeting", description: '"Client Onboarding" via Integrations Module.', accent: "cyan", icon: Video },
  { time: "Yesterday, 01:15 PM", tag: "Sequence", title: 'Emily Davis (Organizer) started email sequence', description: '"Post-Event Follow-up" in Sequence Studio.', accent: "fuchsia", icon: FileText },
  { time: "Yesterday, 11:30 AM", tag: "Billing", title: "Michael Brown (Attendee) updated billing information", description: "Subscription active.", accent: "amber", icon: CreditCard },
  { time: "Yesterday, 10:00 AM", tag: "Permission", title: "Admin granted Analytics module access", description: '"Tech Team Lead".', accent: "cyan", icon: ShieldCheck },
];

const workflowSteps: WorkflowStep[] = [
  { time: "08:00 AM", title: "Login", accent: "sky", icon: LogIn },
  { time: "08:15 AM", title: 'Viewed Event "Tech Expo"', accent: "slate", icon: Eye },
  { time: "09:00 AM", title: 'Joined Zoom Meeting "Session 1"', accent: "violet", icon: Video },
  { time: "10:30 AM", title: 'Started Sequence "Lead Nurture"', accent: "amber", icon: FileText },
  { time: "11:45 AM", title: 'Updated Settings "Notifications"', accent: "cyan", icon: Settings },
  { time: "01:00 PM", title: "Unsubscribed", accent: "rose", icon: MailX },
];

const riskItems: RiskItem[] = [
  { title: "Suspicious Activity", time: "Yesterday, 03:50 AM", detail: 'User "Chris Johnson" (Organizer) - 20 failed login attempts within 5 minutes.', icon: ShieldAlert, border: "border-amber-500/40 dark:border-amber-400/30" },
  { title: "Unpaid Dues", time: "Yesterday, 12:00 PM", detail: 'User "David Smith" (Exhibitor) - Billing status: Due for 3 months, access limited.', icon: CreditCard, border: "border-red-500/40 dark:border-red-400/30" },
  { title: "Limited Access", time: "Yesterday, 11:00 AM", detail: "User \"Anna White\" (Service Provider) - Permission changed to 'Limited Access' by Admin.", icon: Ban, border: "border-amber-500/40 dark:border-amber-400/30" },
];

const userStatuses: UserStatus[] = [
  { name: "Alex Chen", status: "Active" },
  { name: "Maria Rodriguez", status: "Suspended" },
  { name: "Deryan User", status: "Limited Access" },
  { name: "Evelyn Reed", status: "Limited Access" },
];

const permissionRows: PermissionRow[] = [
  { module: "Events", access: "Events", icon: FileText },
  { module: "Companies", access: "Companies", icon: Users },
  { module: "People", access: "People", icon: ShieldCheck },
  { module: "Leads", access: "Leads", icon: Plus },
  { module: "Unsubscribed", access: "Any", icon: MailX },
];

function getInitials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function AuditLogSection() {
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 h-full overflow-hidden">
      {/* HEADER */}
      <div className="flex items-end justify-between shrink-0 pb-1.5 border-b dark:border-white/[0.06] border-slate-200/80">
        <div>
          <h1 className="text-base font-bold leading-tight dark:text-white text-slate-900">Audit Log</h1>
          <p className="text-[11px] text-slate-600 dark:text-slate-300">Complete operational accountability across every user, workspace, and workflow.</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {[{ l: "ENTRIES", v: "09" }, { l: "RISK FLAGS", v: "03" }, { l: "CONTROLS", v: "12" }].map((s) => (
            <div key={s.l} className="text-center px-2.5 py-1 rounded-lg border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white/80">
              <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{s.l}</div>
              <div className="text-[15px] font-extrabold dark:text-white text-slate-900">{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 3-COLUMN BODY */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 flex-1 min-h-0 overflow-hidden">

        {/* COL 1 — Activity Stream */}
        <div className="md:col-span-4 rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white/70 backdrop-blur-xl overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1 custom-scrollbar">
            {activityEntries.map((e, i) => {
              const Icon = e.icon;
              const tone = accentStyles[e.accent];
              return (
                <button
                  key={i}
                  onClick={() => setIsRoadmapOpen(true)}
                  className={cn(
                    "w-full text-left rounded-lg border p-2 hover:brightness-105 transition-all cursor-pointer",
                    tone.card,
                    "dark:bg-white/[0.02] bg-white/60"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn("mt-0.5 shrink-0 size-[22px] rounded-lg flex items-center justify-center", tone.badge)}>
                      <Icon className="size-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{e.time}</span>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", tone.badge)}>{e.tag}</span>
                      </div>
                      <p className="text-[11px] font-semibold dark:text-white text-slate-800 leading-tight">{e.title}</p>
                      <p className="text-[9.5px] dark:text-slate-300 text-slate-600 leading-snug mt-0.5">{e.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* COL 2 — Workflow Trace + Risk */}
        <div className="md:col-span-4 flex flex-col gap-2 min-h-0 overflow-hidden">
          
          {/* Workflow Trace — compact inline grid */}
          <div className="rounded-xl border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.02] bg-white/70 backdrop-blur-xl p-2.5 shrink-0">
            <div className="grid grid-cols-3 gap-1.5">
              {/* Row 1 */}
              <WfBox step={workflowSteps[0]} />
              <div className="flex items-center justify-center"><ArrowRight className="size-3.5 text-slate-400" /></div>
              <WfBox step={workflowSteps[1]} />
              
              {/* Arrow down from right */}
              <div /><div /><div className="flex justify-center py-0.5"><ArrowDown className="size-3.5 text-slate-400" /></div>
              
              {/* Row 2 — reversed */}
              <WfBox step={workflowSteps[3]} />
              <div className="flex items-center justify-center"><ArrowLeft className="size-3.5 text-slate-400" /></div>
              <WfBox step={workflowSteps[2]} />
              
              {/* Arrow down from left */}
              <div className="flex justify-center py-0.5"><ArrowDown className="size-3.5 text-slate-400" /></div><div /><div />
              
              {/* Row 3 */}
              <WfBox step={workflowSteps[4]} />
              <div className="flex items-center justify-center"><ArrowRight className="size-3.5 text-slate-400" /></div>
              <WfBox step={workflowSteps[5]} />
            </div>
          </div>

          {/* Risk / Attention Needed */}
          <div className="rounded-xl border border-red-500/20 dark:border-red-400/15 dark:bg-white/[0.02] bg-white/70 backdrop-blur-xl flex-1 overflow-y-auto p-2.5 custom-scrollbar min-h-0">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldAlert className="size-4 text-red-400" />
              <span className="text-[12px] font-bold dark:text-white text-slate-900">Risk / Attention Needed</span>
              <AlertTriangle className="size-3 text-amber-400 ml-auto" />
            </div>
            <div className="space-y-1.5">
              {riskItems.map((r, i) => {
                const Icon = r.icon;
                return (
                  <div key={i} className={cn("rounded-lg border p-2 dark:bg-white/[0.02] bg-white/60", r.border)}>
                    <div className="flex gap-2">
                      <div className="shrink-0 mt-0.5 size-5 rounded-md flex items-center justify-center bg-rose-500/12 text-rose-600 dark:bg-rose-400/12 dark:text-rose-300">
                        <Icon className="size-3" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold dark:text-white text-slate-900">{r.title}</p>
                          <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">{r.time}</p>
                        </div>
                        <p className="text-[9.5px] dark:text-slate-300 text-slate-600 leading-snug mt-0.5">{r.detail}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COL 3 — Admin Control Panel */}
        <div className="md:col-span-4 rounded-xl border dark:border-cyan-400/10 border-slate-200 dark:bg-white/[0.02] bg-white/70 backdrop-blur-xl overflow-y-auto flex flex-col min-h-0 custom-scrollbar">
          <div className="p-2.5 space-y-2">
            {/* Panel Header */}
            <div className="text-center border-b dark:border-white/[0.06] border-slate-200 pb-2 mb-1">
              <div className="w-10 h-[2px] mx-auto rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 mb-1" />
              <h2 className="text-[13px] font-bold dark:text-white text-slate-900">Admin Control Panel</h2>
            </div>

            {/* User Status Toggles */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">User Status Toggles</h3>
              <div className="space-y-1">
                {userStatuses.map((u, i) => {
                  const isAlex = u.name === "Alex Chen";
                  const Row = isAlex ? "button" : "div";
                  return (
                    <Row
                      key={i}
                      {...(isAlex ? { onClick: () => setIsRoadmapOpen(true), type: "button" as const } : {})}
                      className={cn(
                        "flex items-center justify-between px-2 py-1.5 rounded-lg dark:bg-white/[0.02] bg-white/60 border dark:border-white/[0.04] border-slate-100 w-full text-left",
                        isAlex && "cursor-pointer hover:dark:bg-white/[0.04] hover:bg-slate-100 transition-colors"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="size-[24px] rounded-full bg-gradient-to-br from-cyan-400/20 to-violet-500/20 flex items-center justify-center text-[8px] font-bold dark:text-slate-100 text-slate-700">{getInitials(u.name)}</div>
                        <span className="text-[11px] font-medium dark:text-white text-slate-800 truncate max-w-[110px]">{u.name}</span>
                      </div>
                      <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border", statusStyles[u.status])}>{u.status}</span>
                    </Row>
                  );
                })}
              </div>
            </div>

            {/* Billing Status */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Billing Status</h3>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { icon: CheckCircle2, label: "Paid", key: "Paid" },
                  { icon: AlertTriangle, label: "Due", key: "Due" },
                  { icon: Ban, label: "Unsubscribed", key: "Unsubscribed" },
                ].map((b) => (
                  <div key={b.label} className={cn("flex flex-col items-center gap-0.5 py-1.5 rounded-lg border text-center", statusStyles[b.key])}>
                    <b.icon className="size-4" />
                    <span className="text-[10px] font-semibold">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Permission Controls */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Permission Controls</h3>
              <div className="rounded-lg dark:bg-white/[0.02] bg-white/60 border dark:border-white/[0.04] border-slate-100 p-2">
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <span className="text-[10px] font-medium dark:text-white text-slate-800">Assign user module access</span>
                  </div>
                  <div className="w-7 h-3.5 rounded-full bg-cyan-500 flex items-center justify-end px-0.5">
                    <div className="size-2.5 rounded-full bg-white shadow-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Module</span>
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Access</span>
                  {permissionRows.map((m) => {
                    const Icon = m.icon;
                    return (
                      <div key={m.module} className="contents">
                        <div className="flex items-center gap-1.5">
                          <div className="size-4 rounded flex items-center justify-center bg-cyan-500/10 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300">
                            <Icon className="size-2.5" />
                          </div>
                          <span className="text-[10px] dark:text-slate-200 text-slate-700">{m.module}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-md border dark:border-white/[0.06] border-slate-200 dark:bg-white/[0.03] bg-white px-1.5 py-0.5">
                          <span className="text-[9.5px] dark:text-slate-200 text-slate-600">{m.access}</span>
                          <ChevronDown className="size-2.5 text-slate-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Emergency Disable Service */}
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Emergency Disable Service</h3>
              <div className="rounded-lg dark:bg-white/[0.02] bg-white/60 border dark:border-white/[0.04] border-slate-100 p-2">
                <p className="text-[9.5px] dark:text-slate-300 text-slate-600 mb-1.5">Click your emergency disable service.</p>
                <button className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 py-1.5 text-[9.5px] font-bold uppercase tracking-wider transition-all">
                  <AlertTriangle className="size-3" />
                  EMERGENCY DISABLE SERVICE
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Roadmap Dialog */}
      <AuditLogRoadmapDialog open={isRoadmapOpen} onOpenChange={setIsRoadmapOpen} />
    </div>
  );
}

/* Workflow box helper */
function WfBox({ step }: { step: WorkflowStep }) {
  const Icon = step.icon;
  const tone = accentStyles[step.accent];
  return (
    <div className={cn("rounded-lg border p-2 dark:bg-white/[0.02] bg-white/60 text-center", tone.card)}>
      <div className="flex items-center justify-center gap-1.5 mb-0.5">
        <div className={cn("size-[20px] rounded-md flex items-center justify-center", tone.badge)}>
          <Icon className="size-3" />
        </div>
        <span className="text-[10px] font-bold dark:text-white text-slate-800 truncate leading-tight">{step.title}</span>
      </div>
      <p className="text-[9px] text-slate-500 dark:text-slate-400">{step.time}</p>
    </div>
  );
}
