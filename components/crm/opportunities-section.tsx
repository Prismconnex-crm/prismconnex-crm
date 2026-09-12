"use client";

import { AnimatePresence, motion, useReducedMotion, type MotionProps } from "framer-motion";
import {
    ArrowUp,
    Sparkles,
    Building2,
    CalendarSearch,
    Bookmark,
    BookmarkCheck,
    Clock,
    Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
    relativeTime,
    useQueryStore,
    type SavedQuery,
} from "@/components/search/query-store";
import { buildHandoffUrl, classifyAskDomain, type SearchDomain } from "@/lib/search/cross-intent";
import { cn } from "@/lib/utils";

/**
 * The Dashboard's "Ask anything" page.
 *
 * It owns no dataset, so it never answers a question — it decides which page
 * does and hands the sentence over. The decision is deterministic
 * (lib/search/cross-intent, the same signal scorer the Companies and Events
 * boxes use), which means Enter to a rendered result list involves zero
 * network calls from here: classify, push, done. The destination page reads
 * `?ask=` on mount and runs its own existing flow, so the rail, the chips and
 * the results are that page's native behaviour, not a copy of it.
 */

const TABS = [
    { key: "recent", label: "Recent Searches" },
    { key: "saved", label: "Saved Searches" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** What the Dashboard stores alongside a question: where it sent it. */
type AskPayload = { intent: SearchDomain };

const DOMAIN_META: Record<SearchDomain, { label: string; icon: React.ElementType }> = {
    companies: { label: "Company discovery", icon: Building2 },
    events: { label: "Event scouting", icon: CalendarSearch },
};

/** Falls back to a re-classify for an entry written before `payload` existed. */
function intentOf(entry: SavedQuery): SearchDomain {
    const payload = entry.payload as AskPayload | undefined;
    if (payload?.intent === "companies" || payload?.intent === "events") return payload.intent;
    return classifyAskDomain(entry.query).domain;
}

// Glass surface shared by the prompt box and every card.
const GLASS =
    "border border-white/60 bg-white/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111B2E]/70";

const ICON_BUTTON =
    "flex size-8 shrink-0 items-center justify-center rounded-[9px] border border-slate-200 bg-white text-slate-500 transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 motion-reduce:transform-none dark:border-[#22304A] dark:bg-[#16233A] dark:text-slate-400";

function SearchCardItem({
    entry,
    animate,
    delay,
    onView,
    onDelete,
    onToggleSaved,
}: {
    entry: SavedQuery;
    animate: boolean;
    delay: number;
    onView: (entry: SavedQuery) => void;
    onDelete: (id: string) => void;
    onToggleSaved: (id: string) => void;
}) {
    const intent = intentOf(entry);
    const meta = DOMAIN_META[intent];
    const Icon = meta.icon;

    return (
        <motion.li
            {...(animate
                ? { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, scale: 0.97 }, transition: { duration: 0.4, delay } }
                : { initial: false as const, animate: { opacity: 1, y: 0 } })}
            layout
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
                    <button
                        type="button"
                        onClick={() => onDelete(entry.id)}
                        aria-label={`Delete search: ${entry.query}`}
                        title="Delete"
                        className={cn(ICON_BUTTON, "hover:border-rose-500/40 hover:text-rose-600 dark:hover:border-rose-400/40 dark:hover:text-rose-300")}
                    >
                        <Trash2 className="size-4" aria-hidden="true" />
                    </button>

                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/20">
                        <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                            <Clock className="size-3" aria-hidden="true" />
                            {relativeTime(entry.createdAt)}
                        </p>
                        <p className="truncate text-[13px] font-bold text-slate-900 dark:text-white">{meta.label}</p>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onToggleSaved(entry.id)}
                        aria-pressed={entry.saved}
                        aria-label={entry.saved ? "Remove from saved searches" : "Save this search"}
                        title={entry.saved ? "Saved" : "Save"}
                        className={cn(
                            ICON_BUTTON,
                            "hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:border-indigo-400/40 dark:hover:text-indigo-300",
                            entry.saved && "border-indigo-500/40 text-indigo-600 dark:border-indigo-400/40 dark:text-indigo-300"
                        )}
                    >
                        {entry.saved ? (
                            <BookmarkCheck className="size-4" aria-hidden="true" />
                        ) : (
                            <Bookmark className="size-4" aria-hidden="true" />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => onView(entry)}
                        className="shrink-0 rounded-[9px] border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-bold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-indigo-500/40 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 motion-reduce:transform-none dark:border-[#22304A] dark:bg-[#16233A] dark:text-slate-200 dark:hover:border-indigo-400/40 dark:hover:text-indigo-300"
                    >
                        View
                    </button>
                </div>
            </div>

            <div className="mt-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">Query</p>
                <p className="mt-1 text-[13.5px] font-medium leading-snug text-slate-900 dark:text-white">{entry.query}</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {/* The Dashboard never parses the sentence — that is the
                    destination page's job — so the only thing it can honestly
                    label a search with is where it sent it. */}
                <span className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-[#22304A] dark:bg-[#16233A]/80 dark:text-slate-300">
                    {intent === "companies" ? "Companies" : "Events"}
                </span>
            </div>
        </motion.li>
    );
}

export function OpportunitiesSection() {
    const router = useRouter();
    const reduceMotion = useReducedMotion();
    const animate = !reduceMotion;
    const [tab, setTab] = useState<TabKey>("recent");
    const [prompt, setPrompt] = useState("");
    const { recent, saved, record, remove, toggleSaved } = useQueryStore("dashboard_ask");

    const rise = (delay: number): MotionProps =>
        reduceMotion
            ? { initial: false, animate: { opacity: 1, y: 0 } }
            : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay, ease: "easeOut" } };

    /**
     * Classify and go. Recording first means the entry is in localStorage
     * before the navigation starts, so it is already there when the user comes
     * back — the destination page records its own parsed entry separately,
     * under its own kind.
     */
    const send = useCallback(
        (text: string) => {
            const question = text.trim();
            if (!question) return;

            const { domain } = classifyAskDomain(question);
            record({ query: question, chips: [], payload: { intent: domain } satisfies AskPayload });
            setPrompt("");
            router.push(buildHandoffUrl(domain, question, "dashboard"));
        },
        [record, router]
    );

    /** "View" replays the question through the same handoff, not a cached page. */
    const view = useCallback(
        (entry: SavedQuery) => {
            router.push(buildHandoffUrl(intentOf(entry), entry.query, "dashboard"));
        },
        [router]
    );

    const entries = tab === "recent" ? recent : saved;

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
                            onKeyDown={(event) => {
                                // Enter sends; Shift+Enter keeps the newline, which a
                                // three-row box has to allow.
                                if (event.key !== "Enter" || event.shiftKey) return;
                                event.preventDefault();
                                send(prompt);
                            }}
                            rows={3}
                            aria-label="Describe what you are looking for"
                            placeholder="Try: packaging suppliers in Northern Italy attending a show before June, with a named operations contact…"
                            className="min-h-[72px] w-full flex-1 resize-none bg-transparent pt-1.5 text-[14px] font-medium leading-relaxed text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-400"
                        />

                        <button
                            type="button"
                            onClick={() => send(prompt)}
                            disabled={!prompt.trim()}
                            aria-label="Send prompt"
                            className="group/send mt-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-[0_10px_24px_-12px_rgba(124,58,237,0.95)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-12px_rgba(124,58,237,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 motion-reduce:transform-none dark:focus-visible:ring-offset-[#0B1220]"
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
                        const count = item.key === "recent" ? recent.length : saved.length;
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
                                {count > 0 ? (
                                    <span className="ml-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">{count}</span>
                                ) : null}
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

                {entries.length === 0 ? (
                    <div className={cn(GLASS, "rounded-[14px] px-5 py-8 text-center")}>
                        <p className="text-[13.5px] font-semibold text-slate-900 dark:text-white">
                            {tab === "recent" ? "No searches yet" : "Nothing saved yet"}
                        </p>
                        <p className="mt-1 text-[12.5px] font-medium text-slate-600 dark:text-slate-400">
                            {tab === "recent"
                                ? "Ask a question above — it lands here, and on the page that answered it."
                                : "Bookmark a recent search to pin it here."}
                        </p>
                    </div>
                ) : (
                    <ul className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                        <AnimatePresence initial={false}>
                            {entries.map((entry, index) => (
                                <SearchCardItem
                                    key={entry.id}
                                    entry={entry}
                                    animate={animate}
                                    delay={0.05 + index * 0.06}
                                    onView={view}
                                    onDelete={remove}
                                    onToggleSaved={toggleSaved}
                                />
                            ))}
                        </AnimatePresence>
                    </ul>
                )}
            </motion.div>
        </div>
    );
}
