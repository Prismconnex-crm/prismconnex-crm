"use client";

import { AnimatePresence, motion, useReducedMotion, type MotionProps } from "framer-motion";
import {
    ArrowUp,
    Sparkles,
    Building2,
    UserSearch,
    CalendarSearch,
    TrendingUp,
    Bookmark,
    Repeat2,
    Layers,
    Clock,
    ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// ── Mock searches ────────────────────────────────────────────────────────────
// UI only for now — nothing here is wired to a backend.
type SearchCard = {
    id: string;
    time: string;
    type: string;
    icon: React.ElementType;
    query: string;
    chips: string[];
};

const RECENT_SEARCHES: SearchCard[] = [
    {
        id: "r1",
        time: "12 min ago",
        type: "Company discovery",
        icon: Building2,
        query: "Robotics manufacturers in Germany with 50–200 staff exhibiting next quarter",
        chips: ["Germany", "Robotics", "50–200 staff", "Exhibiting", "Verified domain", "Has website"],
    },
    {
        id: "r2",
        time: "1 hour ago",
        type: "Contact lookup",
        icon: UserSearch,
        query: "Heads of procurement at exhibitors from Berlin Tech Expo 2026",
        chips: ["Berlin Tech Expo", "Procurement", "Decision maker", "Email found"],
    },
    {
        id: "r3",
        time: "Yesterday",
        type: "Event scouting",
        icon: CalendarSearch,
        query: "Medtech shows across Europe between May and September with booths still open",
        chips: ["Europe", "Medtech", "May–Sep", "Booths open"],
    },
    {
        id: "r4",
        time: "2 days ago",
        type: "Pipeline question",
        icon: TrendingUp,
        query: "Deals sitting in Negotiation longer than 21 days above $50K",
        chips: ["Stalled 21d+", "Above $50K", "Negotiation"],
    },
];

const SAVED_SEARCHES: SearchCard[] = [
    {
        id: "s1",
        time: "Pinned",
        type: "Territory list",
        icon: Layers,
        query: "Automation suppliers across DACH added to the catalog this month",
        chips: ["DACH", "Automation", "Added this month", "Supplier"],
    },
    {
        id: "s2",
        time: "Pinned",
        type: "Warm re-entry",
        icon: Repeat2,
        query: "Companies that replied last season but never booked a meeting",
        chips: ["Replied", "No meeting", "Last season"],
    },
    {
        id: "s3",
        time: "Pinned",
        type: "Show shortlist",
        icon: Bookmark,
        query: "Trade shows where my top 20 accounts exhibit in the same week",
        chips: ["Top 20 accounts", "Same week", "Overlap"],
    },
];

const TABS = [
    { key: "recent", label: "Recent Searches", data: RECENT_SEARCHES },
    { key: "saved", label: "Saved Searches", data: SAVED_SEARCHES },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const VISIBLE_CHIPS = 3;

// Glass surface shared by the prompt box and every card.
const GLASS =
    "border border-white/60 bg-white/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111B2E]/70";

function SearchCardItem({ card, animate, delay }: { card: SearchCard; animate: boolean; delay: number }) {
    const [expanded, setExpanded] = useState(false);
    const Icon = card.icon;
    const hidden = card.chips.length - VISIBLE_CHIPS;
    const shown = expanded ? card.chips : card.chips.slice(0, VISIBLE_CHIPS);

    return (
        <motion.li
            {...(animate
                ? { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay } }
                : { initial: false as const, animate: { opacity: 1, y: 0 } })}
            className={cn(
                GLASS,
                "group relative overflow-hidden rounded-[14px] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-[0_18px_40px_-26px_rgba(99,102,241,0.8)] motion-reduce:transform-none dark:hover:border-indigo-400/40"
            )}
        >
            {/* neon edge that lights up on hover */}
            <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />

            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/20">
                        <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                            <Clock className="size-3" aria-hidden="true" />
                            {card.time}
                        </p>
                        <p className="truncate text-[13px] font-bold text-slate-900 dark:text-white">{card.type}</p>
                    </div>
                </div>

                <button
                    type="button"
                    className="shrink-0 rounded-[9px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-indigo-500/40 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 motion-reduce:transform-none dark:border-[#22304A] dark:bg-[#16233A] dark:text-slate-200 dark:hover:border-indigo-400/40 dark:hover:text-indigo-300"
                >
                    View
                </button>
            </div>

            <div className="mt-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Query</p>
                <p className="mt-1 text-[13.5px] font-medium leading-snug text-slate-900 dark:text-white">{card.query}</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <AnimatePresence initial={false}>
                    {shown.map((chip) => (
                        <motion.span
                            key={chip}
                            initial={animate ? { opacity: 0, scale: 0.92 } : false}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={animate ? { opacity: 0, scale: 0.92 } : undefined}
                            transition={{ duration: 0.18 }}
                            className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-[#22304A] dark:bg-[#16233A]/80 dark:text-slate-300"
                        >
                            {chip}
                        </motion.span>
                    ))}
                </AnimatePresence>

                {hidden > 0 && (
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        aria-expanded={expanded}
                        className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[11px] font-bold text-indigo-600 transition-colors hover:bg-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300"
                    >
                        {expanded ? "Show less" : `Show more (${hidden})`}
                        <ChevronDown
                            className={cn("size-3 transition-transform motion-reduce:transition-none", expanded && "rotate-180")}
                            aria-hidden="true"
                        />
                    </button>
                )}
            </div>
        </motion.li>
    );
}

export function OpportunitiesSection() {
    const reduceMotion = useReducedMotion();
    const animate = !reduceMotion;
    const [tab, setTab] = useState<TabKey>("recent");
    const [prompt, setPrompt] = useState("");

    const rise = (delay: number): MotionProps =>
        reduceMotion
            ? { initial: false, animate: { opacity: 1, y: 0 } }
            : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay, ease: "easeOut" } };

    const active = TABS.find((t) => t.key === tab) ?? TABS[0];

    return (
        <div className="relative mx-auto flex w-full max-w-[1100px] flex-col gap-8 pb-14">
            {/* Ambient neon field */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-28 -z-10 h-[560px] overflow-hidden">
                <div className="absolute left-1/2 top-0 size-[520px] -translate-x-1/2 rounded-full bg-indigo-500/[0.16] blur-[140px] dark:bg-indigo-500/25" />
                <div className="absolute left-[8%] top-24 size-[340px] rounded-full bg-cyan-400/[0.13] blur-[120px] dark:bg-cyan-500/20" />
                <div className="absolute right-[6%] top-16 size-[380px] rounded-full bg-violet-500/[0.14] blur-[130px] dark:bg-violet-500/20" />
            </div>

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <motion.header {...rise(0.04)} className="flex flex-col items-center gap-3 pt-8 text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-600 dark:border-indigo-400/20 dark:text-indigo-300">
                    <Sparkles className="size-3" aria-hidden="true" />
                    Prismconnex AI
                </span>
                <h1 className="text-[40px] font-black leading-[1.05] tracking-tight text-slate-900 sm:text-[52px] dark:text-white">
                    Ask{" "}
                    <span className="bg-gradient-to-r from-indigo-600 via-violet-500 to-cyan-500 bg-clip-text text-transparent dark:from-indigo-300 dark:via-violet-300 dark:to-cyan-300">
                        anything
                    </span>
                </h1>
                <p className="max-w-[54ch] text-[14px] font-medium text-slate-700 dark:text-slate-300">
                    Describe the accounts, people or shows you are after in plain language — the workspace turns it into a
                    filtered list you can work.
                </p>
            </motion.header>

            {/* ── Prompt box ───────────────────────────────────────────────── */}
            <motion.div {...rise(0.12)} className="relative">
                {/* gradient halo behind the glass */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-[1px] rounded-[18px] bg-gradient-to-r from-indigo-500/40 via-violet-500/30 to-cyan-500/40 opacity-60 blur-[2px] transition-opacity duration-300"
                />
                <div className={cn(GLASS, "relative rounded-[17px] p-4 transition-colors focus-within:border-indigo-500/50")}>
                    <div className="flex items-start gap-3">
                        <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_8px_20px_-10px_rgba(99,102,241,0.9)]">
                            <Sparkles className="size-4" aria-hidden="true" />
                        </span>

                        <textarea
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            rows={3}
                            aria-label="Describe what you are looking for"
                            placeholder="Try: packaging suppliers in Northern Italy attending a show before June, with a named operations contact…"
                            className="min-h-[72px] w-full flex-1 resize-none bg-transparent pt-1.5 text-[14px] font-medium leading-relaxed text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-400"
                        />

                        <button
                            type="button"
                            aria-label="Send prompt"
                            className="group/send mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_10px_24px_-12px_rgba(124,58,237,0.95)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-12px_rgba(124,58,237,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 motion-reduce:transform-none dark:focus-visible:ring-offset-[#0B1220]"
                        >
                            <ArrowUp className="size-4 transition-transform group-hover/send:-translate-y-0.5 motion-reduce:transition-none" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* ── Tabs ─────────────────────────────────────────────────────── */}
            <motion.div {...rise(0.2)} className="flex flex-col gap-4">
                <div role="tablist" aria-label="Search history" className="flex items-center gap-1 border-b border-slate-200 dark:border-[#22304A]">
                    {TABS.map((item) => {
                        const selected = item.key === tab;
                        return (
                            <button
                                key={item.key}
                                role="tab"
                                type="button"
                                aria-selected={selected}
                                onClick={() => setTab(item.key)}
                                className={cn(
                                    "relative px-3.5 py-2.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                                    selected
                                        ? "text-slate-900 dark:text-white"
                                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                                )}
                            >
                                {item.label}
                                {selected && (
                                    <motion.span
                                        layoutId="ask-tab-underline"
                                        className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                                        transition={{ duration: 0.25, ease: "easeOut" }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>

                <ul className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                    {active.data.map((card, index) => (
                        <SearchCardItem key={card.id} card={card} animate={animate} delay={0.05 + index * 0.06} />
                    ))}
                </ul>
            </motion.div>
        </div>
    );
}
