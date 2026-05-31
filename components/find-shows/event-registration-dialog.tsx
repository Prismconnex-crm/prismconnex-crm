"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ExternalLink, ArrowLeft, Building2, Ticket, Sparkles, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Intent = "none" | "attending" | "exhibiting";

interface EventRegistrationDialogProps {
  registerUrl: string | null;
  eventName: string;
}

export function EventRegistrationDialog({ registerUrl, eventName }: EventRegistrationDialogProps) {
  const [intent, setIntent] = useState<Intent>("none");
  const [isOpen, setIsOpen] = useState(false);

  // Reset intent when modal closes so it always opens fresh
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTimeout(() => setIntent("none"), 300);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {registerUrl ? (
          <button className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(79,70,229,0.15)] transition-all hover:scale-[1.02] hover:bg-indigo-500 hover:shadow-[0_0_25px_rgba(79,70,229,0.25)] active:scale-[0.98]">
            <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
              <div className="relative h-full w-8 bg-white/20" />
            </div>
            Register for Event
            <Sparkles className="size-4 opacity-70 transition-opacity group-hover:opacity-100" />
          </button>
        ) : (
          <button
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-200 px-6 py-3.5 text-sm font-bold text-slate-400 dark:bg-white/5 dark:text-slate-500"
          >
            Registration TBA
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden border-slate-200/60 dark:border-white/[0.08] dark:bg-[#0c1322]/95 bg-white/95 backdrop-blur-3xl shadow-2xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 blur-[50px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 blur-[40px] rounded-full pointer-events-none" />

        <div className="p-6 relative z-10">
          <DialogHeader className="mb-6 relative">
            <div className="flex items-center justify-between mb-1.5 min-h-[24px]">
              {intent !== "none" ? (
                <button
                  onClick={() => setIntent("none")}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors uppercase tracking-wider"
                >
                  <ArrowLeft className="size-3" /> Back
                </button>
              ) : (
                <div /> // Spacer for alignment
              )}
            </div>
            
            <DialogTitle className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
              {intent === "none" ? "Select Your Intent" : intent === "attending" ? "Visitor Registration" : "Booth Inquiry"}
            </DialogTitle>
            <p className="text-[13px] font-medium leading-relaxed text-slate-500 dark:text-slate-400/90 mt-1">
              {intent === "none" ? (
                <span className="line-clamp-2">How do you plan to participate in <strong className="font-semibold text-slate-700 dark:text-slate-300">{eventName}</strong>?</span>
              ) : intent === "attending" ? (
                "Proceed to the official ticketing portal."
              ) : (
                "Request exhibitor details for this event."
              )}
            </p>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {intent === "none" ? (
              <motion.div
                key="intent-selection"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="grid gap-3"
              >
                <button
                  onClick={() => setIntent("attending")}
                  className="flex items-center gap-4 rounded-xl border border-slate-200/70 bg-slate-50/50 p-4 transition-all hover:border-emerald-500/30 hover:bg-emerald-50 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 group"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-[#151e32] transition-colors group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20">
                    <Ticket className="size-4.5 text-emerald-600 dark:text-emerald-400 transition-transform group-hover:scale-110" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">I am Attending</div>
                    <div className="text-[11.5px] text-slate-500 dark:text-slate-400 font-medium leading-tight">As a visitor or delegate</div>
                  </div>
                </button>

                <button
                  onClick={() => setIntent("exhibiting")}
                  className="flex items-center gap-4 rounded-xl border border-slate-200/70 bg-slate-50/50 p-4 transition-all hover:border-indigo-500/30 hover:bg-indigo-50 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10 group"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-[#151e32] transition-colors group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20">
                    <Building2 className="size-4.5 text-indigo-600 dark:text-indigo-400 transition-transform group-hover:scale-110" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="text-sm font-bold text-slate-900 dark:text-white mb-0.5">I am Exhibiting</div>
                    <div className="text-[11.5px] text-slate-500 dark:text-slate-400 font-medium leading-tight">Request a booth or sponsorship</div>
                  </div>
                </button>
              </motion.div>
            ) : intent === "attending" ? (
              <motion.div
                key="attending-flow"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="pt-2"
              >
                <div className="rounded-xl border border-dashed border-emerald-200/70 bg-emerald-50/50 p-4 mb-6 dark:border-emerald-500/20 dark:bg-emerald-500/5 flex items-start gap-3">
                   <div className="size-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0 animate-pulse" />
                   <p className="text-[12.5px] text-emerald-800 dark:text-emerald-300/90 leading-relaxed font-medium">You are about to securely leave Prism Connex to purchase tickets directly from the organizer&apos;s platform.</p>
                </div>
                {registerUrl && (
                  <a
                    href={registerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-[13px] font-bold text-white shadow-[0_0_20px_rgba(79,70,229,0.2)] transition-all hover:bg-indigo-500 hover:shadow-[0_0_25px_rgba(79,70,229,0.3)] active:scale-[0.98]"
                  >
                    Proceed to Official Site
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="exhibiting-flow"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="pt-2"
              >
                <div className="rounded-xl shadow-inner bg-slate-100 p-4 mb-6 dark:bg-[#111928] border dark:border-white/[0.04]">
                   <p className="text-[12.5px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">Booth spaces are managed directly by event organizers. Submit a request to be placed on the exhibitor waitlist.</p>
                </div>
                {registerUrl && (
                  <a
                    href={registerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-6 py-3.5 text-[13px] font-bold text-white dark:text-slate-900 shadow-xl transition-all hover:bg-slate-800 dark:hover:bg-slate-100 active:scale-[0.98]"
                  >
                    Submit Official Request
                    <ExternalLink className="size-4 ml-0.5" />
                  </a>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
