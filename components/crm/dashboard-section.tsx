"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, type MotionProps } from "framer-motion";
import { useTheme } from "next-themes";
import {
    ArrowUpRight,
    ArrowDownRight,
    Target,
    Send,
    Percent,
    Trophy,
    MessageSquareReply,
    Repeat2,
    Radar,
    Sparkles,
    CalendarDays,
    ChevronRight,
    Bot,
    MailOpen,
    MousePointerClick,
    CornerUpLeft,
    ShieldAlert,
    Table2,
    AreaChart as AreaChartIcon,
    Activity,
    UserPlus,
    FileSignature,
    CheckCircle2,
    CalendarClock,
    CornerDownRight,
} from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

// ── Accent system ────────────────────────────────────────────────────────────
// Tailwind can't build class names at runtime, so every accent keeps its full
// literal strings here.
const ACCENTS = {
    indigo: {
        stroke: "#6366F1",
        chip: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/20",
        border: "hover:border-indigo-500/50 dark:hover:border-indigo-400/50",
        glow: "group-hover:shadow-[0_18px_40px_-24px_rgba(99,102,241,0.65)]",
        rail: "from-indigo-500/0 via-indigo-500 to-indigo-500/0",
    },
    cyan: {
        stroke: "#06B6D4",
        chip: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/20 dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/20",
        border: "hover:border-cyan-500/50 dark:hover:border-cyan-400/50",
        glow: "group-hover:shadow-[0_18px_40px_-24px_rgba(6,182,212,0.65)]",
        rail: "from-cyan-500/0 via-cyan-500 to-cyan-500/0",
    },
    violet: {
        stroke: "#A855F7",
        chip: "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20",
        border: "hover:border-violet-500/50 dark:hover:border-violet-400/50",
        glow: "group-hover:shadow-[0_18px_40px_-24px_rgba(168,85,247,0.65)]",
        rail: "from-violet-500/0 via-violet-500 to-violet-500/0",
    },
    emerald: {
        stroke: "#10B981",
        chip: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20",
        border: "hover:border-emerald-500/50 dark:hover:border-emerald-400/50",
        glow: "group-hover:shadow-[0_18px_40px_-24px_rgba(16,185,129,0.65)]",
        rail: "from-emerald-500/0 via-emerald-500 to-emerald-500/0",
    },
} as const;

type AccentKey = keyof typeof ACCENTS;

// ── Mock data ────────────────────────────────────────────────────────────────
const PRIMARY_KPIS = [
    {
        key: "leads",
        label: "Total Leads",
        value: 1284,
        format: "int" as const,
        delta: 12.4,
        caption: "vs. previous 30 days",
        icon: Target,
        accent: "indigo" as AccentKey,
        spark: "M0,26 C12,24 20,27 32,21 C44,15 54,22 66,14 C78,6 88,11 100,4",
    },
    {
        key: "sent",
        label: "Emails Sent",
        value: 12540,
        format: "int" as const,
        delta: 8.1,
        caption: "across 6 active sequences",
        icon: Send,
        accent: "cyan" as AccentKey,
        spark: "M0,28 C14,26 22,20 36,22 C50,24 60,12 74,11 C86,10 92,6 100,5",
    },
    {
        key: "response",
        label: "Response Rate",
        value: 24.8,
        format: "pct" as const,
        delta: -1.6,
        caption: "3,109 replies captured",
        icon: Percent,
        accent: "violet" as AccentKey,
        spark: "M0,10 C12,12 22,8 34,15 C46,22 56,17 68,21 C80,25 90,20 100,24",
    },
    {
        key: "won",
        label: "Deals Won",
        value: 37,
        format: "int" as const,
        delta: 21.3,
        caption: "37 deals closed this cycle",
        icon: Trophy,
        accent: "emerald" as AccentKey,
        spark: "M0,27 C12,25 20,26 32,19 C44,12 52,18 64,12 C76,6 88,9 100,2",
    },
];

const COMMS_KPIS = [
    { key: "outreached", label: "Emails Outreached", value: "1,250", caption: "Signals dispatched this cycle", icon: Send },
    { key: "responses", label: "Email Responses", value: "64", caption: "Replies captured from orbit", icon: MessageSquareReply },
    { key: "followups", label: "Email Follow-ups", value: "310", caption: "Sequenced touches in flight", icon: Repeat2 },
];

// Two-series chart palette — validated for CVD separation, chroma and contrast
// against both the light (#FFFFFF) and dark (#111B2E) card surfaces, so one pair
// serves both themes.
const SERIES = {
    pipeline: { key: "pipeline", label: "Pipeline created", color: "#6366F1" },
    won: { key: "won", label: "Closed won", color: "#0DA97C" },
} as const;

// Deal counts, not revenue — the dashboard shows no currency amounts anywhere.
// Same unit for both series, so one y-axis, never two.
const SALES_SERIES = [
    { month: "Sep", pipeline: 1, won: 1 },
    { month: "Oct", pipeline: 2, won: 1 },
    { month: "Nov", pipeline: 3, won: 2 },
    { month: "Dec", pipeline: 3, won: 2 },
    { month: "Jan", pipeline: 4, won: 3 },
    { month: "Feb", pipeline: 4, won: 3 },
    { month: "Mar", pipeline: 5, won: 3 },
    { month: "Apr", pipeline: 5, won: 4 },
    { month: "May", pipeline: 6, won: 4 },
    { month: "Jun", pipeline: 6, won: 4 },
    { month: "Jul", pipeline: 7, won: 5 },
    { month: "Aug", pipeline: 8, won: 5 },
];

// Headline figures for the Sales Overview card. Deliberately fixed rather than
// summed from SALES_SERIES: "Pipeline created" is the workspace's current open
// count (1), not a 12-month rollup.
const SALES_TOTALS = { pipeline: 1, won: 37 } as const;

const SALES_RANGES = [
    { key: "6m", label: "6M", months: 6 },
    { key: "12m", label: "12M", months: 12 },
] as const;

// Ordered funnel — a single hue deepening by stage (magnitude, not identity).
const PIPELINE_STAGES = [
    { stage: "Prospecting", count: 486, share: 100, fill: "#C7D2FE", ink: "#4338CA" },
    { stage: "Qualified", count: 312, share: 64, fill: "#A5B4FC", ink: "#4338CA" },
    { stage: "Proposal", count: 174, share: 36, fill: "#818CF8", ink: "#FFFFFF" },
    { stage: "Negotiation", count: 96, share: 20, fill: "#6366F1", ink: "#FFFFFF" },
    { stage: "Won", count: 37, share: 8, fill: "#4F46E5", ink: "#FFFFFF" },
];

const AI_INSIGHTS = [
    {
        title: "Berlin Tech Expo cohort is cooling",
        detail: "18 exhibitors have gone 9 days without a touch. Re-engage before the show list refreshes.",
        impact: "High impact",
        tone: "high" as const,
        icon: Radar,
    },
    {
        title: "Tuesday 09:00 sends reply 2.3× better",
        detail: "Shift the Enterprise sequence window — projected +41 replies per cycle.",
        impact: "Quick win",
        tone: "medium" as const,
        icon: CalendarClock,
    },
    {
        title: "3 deals stalled in Negotiation",
        detail: "Three deals sitting past 21 days. Draft a close plan for NovaAI, Helix and Orbit Labs.",
        impact: "Revenue risk",
        tone: "risk" as const,
        icon: ShieldAlert,
    },
];

// Rotating headline — what the AI can do for you, in the workspace's own terms.
const AI_HIGHLIGHTS = [
    "You can find your leads across 36.5M companies",
    "You can pull exhibitor lists before a show fills up",
    "You can turn replies into deals without leaving this deck",
    "You can score every lead by fit, intent and timing",
];

const AI_CAPABILITIES = ["Lead discovery", "Exhibitor intel", "Sequence tuning", "Deal risk"];

const AI_FOOTPRINT = [
    { label: "Companies", value: "36.5M" },
    { label: "Shows", value: "2,140" },
    { label: "Signals today", value: "318" },
];

// Bounce is a status metric, not a fourth series — it keeps the reserved
// critical color plus an icon and label, never color alone.
const EMAIL_METRICS = [
    { label: "Open rate", value: 42.6, delta: 3.4, icon: MailOpen, status: false },
    { label: "Click rate", value: 12.4, delta: 1.1, icon: MousePointerClick, status: false },
    { label: "Reply rate", value: 6.1, delta: -0.4, icon: CornerUpLeft, status: false },
    { label: "Bounce rate", value: 1.2, delta: -0.3, icon: ShieldAlert, status: true },
];

const DELIVERABILITY = 98.8;

// Daily send volume, last 14 days — relative heights only, labelled by the header.
const SEND_VOLUME = [38, 52, 46, 61, 74, 58, 30, 44, 67, 82, 71, 88, 76, 94];

const RECENT_ACTIVITY = [
    { actor: "Ana Ruiz", action: "converted", target: "Helix Robotics", meta: "Lead → Deal", time: "2m ago", icon: CheckCircle2, tone: "emerald" as const },
    { actor: "Sequence · Enterprise EU", action: "sent", target: "142 emails", meta: "Step 2 of 5 · 0 bounces", time: "18m ago", icon: Send, tone: "indigo" as const },
    { actor: "Marek Novak", action: "replied from", target: "NovaAI Systems", meta: "Interested — asked for pricing", time: "1h ago", icon: CornerDownRight, tone: "violet" as const },
    { actor: "You", action: "added", target: "26 exhibitors", meta: "Berlin Tech Expo 2026", time: "3h ago", icon: UserPlus, tone: "cyan" as const },
    { actor: "Priya Shah", action: "signed", target: "Global Exhibitor Pass", meta: "Closed won", time: "Yesterday", icon: FileSignature, tone: "emerald" as const },
];

const ACTIVITY_TONES = {
    emerald: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20",
    indigo: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/20",
    violet: "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20",
    cyan: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/20 dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/20",
} as const;

// ── Hooks ────────────────────────────────────────────────────────────────────

type MeUser = { email: string; name: string | null; role: string | null; workspace: string | null };

/** Session identity for the greeting. Falls back silently — the deck still renders. */
function useCurrentUser() {
    const [user, setUser] = useState<MeUser | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        let alive = true;
        fetch("/api/auth/me")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!alive) return;
                setUser(data?.user ?? null);
                setLoaded(true);
            })
            .catch(() => alive && setLoaded(true));
        return () => {
            alive = false;
        };
    }, []);

    return { user, loaded };
}

/** rAF count-up with ease-out. Server and first client frame both start at 0. */
function useCountUp(target: number, animate: boolean, duration = 1200) {
    const [value, setValue] = useState(0);

    useEffect(() => {
        if (!animate) {
            setValue(target);
            return;
        }
        let frame = 0;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            setValue(target * (1 - Math.pow(1 - t, 3)));
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target, animate, duration]);

    return value;
}

/** Chart axis/grid ink has to be resolved in JS — Recharts takes props, not classes. */
function useChartInk() {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    const dark = mounted && resolvedTheme === "dark";

    return {
        // Axis labels are read as text, so they carry text-weight contrast,
        // not the recessive tint used for the grid.
        axis: dark ? "#CBD5E1" : "#475569",
        grid: dark ? "#22304A" : "#E2E8F0",
    };
}

function displayName(user: MeUser | null) {
    if (user?.name?.trim()) return user.name.trim().split(/\s+/)[0];
    if (user?.email) {
        const local = user.email.split("@")[0].replace(/[._-]+/g, " ").trim();
        if (local) return local.charAt(0).toUpperCase() + local.slice(1);
    }
    return "Admin";
}

function roleLabel(role: string | null | undefined) {
    if (!role) return "Member";
    return role
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

// ── Primitives ───────────────────────────────────────────────────────────────

/** useId keeps gradient ids stable across server/client render. */
function Sparkline({ path, color, animate }: { path: string; color: string; animate: boolean }) {
    const gradientId = useId();

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 overflow-hidden rounded-b-[14px]" aria-hidden="true">
            <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-full w-full">
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <motion.path
                    d={`${path} L100,30 L0,30 Z`}
                    fill={`url(#${gradientId})`}
                    initial={animate ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.35 }}
                />
                <motion.path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    initial={animate ? { pathLength: 0 } : false}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.1, ease: "easeOut" }}
                />
            </svg>
        </div>
    );
}

const PANEL =
    "relative overflow-hidden rounded-[14px] border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-[#22304A] dark:bg-[#111B2E]";

/** Diagonal light sweep on hover — the "futuristic" tell, disabled for reduced motion. */
function Shine() {
    return (
        <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-px translate-x-[-120%] bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 transition-all duration-700 ease-out group-hover:translate-x-[120%] group-hover:opacity-100 motion-reduce:hidden dark:via-white/[0.07]"
        />
    );
}

function PanelHeader({
    title,
    subtitle,
    icon: Icon,
    tone = "indigo",
    children,
}: {
    title: string;
    subtitle: string;
    icon: React.ElementType;
    tone?: "indigo" | "violet" | "cyan" | "emerald";
    children?: React.ReactNode;
}) {
    return (
        <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
                <span
                    className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-[9px] ring-1 ring-inset",
                        ACCENTS[tone].chip
                    )}
                >
                    <Icon className="size-4" aria-hidden="true" />
                </span>
                <div>
                    <h2 className="text-[15px] font-bold leading-tight text-slate-900 dark:text-white">{title}</h2>
                    <p className="mt-0.5 text-[12px] text-slate-700 dark:text-slate-300">{subtitle}</p>
                </div>
            </div>
            {children}
        </div>
    );
}

type ChartTooltipProps = {
    active?: boolean;
    label?: string | number;
    payload?: { dataKey?: string | number; name?: string | number; value?: number; color?: string }[];
};

/** Theme-aware replacement for the default Recharts tooltip. */
function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-[10px] border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur dark:border-[#22304A] dark:bg-[#0B1220]/95">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">{label}</p>
            <ul className="space-y-1">
                {payload.map((entry) => (
                    <li key={entry.dataKey as string} className="flex items-center gap-2 text-[12px]">
                        <span className="size-2 rounded-[3px]" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">{entry.name}</span>
                        <span className="ml-auto font-bold tabular-nums text-slate-900 dark:text-white">{entry.value}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ── Sales Overview ───────────────────────────────────────────────────────────

function SalesOverview({ rise, animate }: { rise: MotionProps; animate: boolean }) {
    const [range, setRange] = useState<(typeof SALES_RANGES)[number]["key"]>("12m");
    const [view, setView] = useState<"chart" | "table">("chart");
    const ink = useChartInk();
    const gradientPipeline = useId().replace(/:/g, "");
    const gradientWon = useId().replace(/:/g, "");

    const data = useMemo(() => {
        const months = SALES_RANGES.find((r) => r.key === range)?.months ?? 12;
        return SALES_SERIES.slice(-months);
    }, [range]);

    const totals = SALES_TOTALS;

    return (
        <motion.section {...rise} aria-label="Sales overview" className={cn(PANEL, "flex flex-col p-5 lg:col-span-8")}>
            <PanelHeader title="Sales Overview" subtitle="Pipeline created vs. closed won, by deal count" icon={AreaChartIcon}>
                <div className="flex items-center gap-1.5">
                    <div className="flex rounded-[9px] border border-slate-200 bg-slate-50 p-0.5 dark:border-[#22304A] dark:bg-[#0B1220]">
                        {SALES_RANGES.map((option) => (
                            <button
                                key={option.key}
                                type="button"
                                onClick={() => setRange(option.key)}
                                aria-pressed={range === option.key}
                                className={cn(
                                    "rounded-[7px] px-2.5 py-1 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                                    range === option.key
                                        ? "bg-white text-slate-900 shadow-sm dark:bg-[#16233A] dark:text-white"
                                        : "text-slate-700 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-200"
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => setView((v) => (v === "chart" ? "table" : "chart"))}
                        aria-pressed={view === "table"}
                        title={view === "chart" ? "Show data table" : "Show chart"}
                        className="flex size-[30px] items-center justify-center rounded-[9px] border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-[#22304A] dark:bg-[#0B1220] dark:hover:text-white"
                    >
                        {view === "chart" ? <Table2 className="size-3.5" aria-hidden="true" /> : <AreaChartIcon className="size-3.5" aria-hidden="true" />}
                        <span className="sr-only">{view === "chart" ? "Show data table" : "Show chart"}</span>
                    </button>
                </div>
            </PanelHeader>

            {/* Totals + legend — identity is never carried by color alone */}
            <div className="relative z-10 mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
                {([SERIES.pipeline, SERIES.won] as const).map((series) => (
                    <div key={series.key}>
                        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                            <span className="size-2 rounded-[3px]" style={{ backgroundColor: series.color }} aria-hidden="true" />
                            {series.label}
                        </span>
                        <span className="mt-1 block text-[26px] font-black leading-none tabular-nums text-slate-900 dark:text-white">
                            {totals[series.key as "pipeline" | "won"].toLocaleString()}
                        </span>
                    </div>
                ))}
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300">
                    <ArrowUpRight className="size-3" aria-hidden="true" />
                    21.3% vs. last period
                </span>
            </div>

            {view === "chart" ? (
                // A definite height is required here: ResponsiveContainer asks its
                // parent for height="100%", and in an auto-height flex column that
                // resolves to nothing, so recharts falls back to a width-derived
                // height and the card balloons.
                <div className="relative z-10 mt-4 h-[236px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                            <defs>
                                <linearGradient id={gradientPipeline} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={SERIES.pipeline.color} stopOpacity={0.3} />
                                    <stop offset="100%" stopColor={SERIES.pipeline.color} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id={gradientWon} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={SERIES.won.color} stopOpacity={0.3} />
                                    <stop offset="100%" stopColor={SERIES.won.color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke={ink.grid} strokeDasharray="3 4" />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: ink.axis, fontWeight: 600 }} axisLine={false} tickLine={false} dy={8} />
                            {/* Deal counts are whole numbers — no 0.5 ticks. */}
                            <YAxis tick={{ fontSize: 11, fill: ink.axis, fontWeight: 600 }} axisLine={false} tickLine={false} width={54} allowDecimals={false} />
                            <Tooltip content={<ChartTooltip />} cursor={{ stroke: ink.axis, strokeWidth: 1, strokeDasharray: "3 3" }} />
                            <Area
                                type="monotone"
                                dataKey={SERIES.pipeline.key}
                                name={SERIES.pipeline.label}
                                stroke={SERIES.pipeline.color}
                                strokeWidth={2}
                                fill={`url(#${gradientPipeline})`}
                                isAnimationActive={animate}
                                activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                            />
                            <Area
                                type="monotone"
                                dataKey={SERIES.won.key}
                                name={SERIES.won.label}
                                stroke={SERIES.won.color}
                                strokeWidth={2}
                                fill={`url(#${gradientWon})`}
                                isAnimationActive={animate}
                                activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="relative z-10 mt-4 h-[236px] overflow-y-auto">
                    <table className="w-full border-collapse text-left">
                        <thead className="sticky top-0 bg-white dark:bg-[#111B2E]">
                            <tr>
                                <th scope="col" className="pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Month</th>
                                <th scope="col" className="pb-2 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Pipeline</th>
                                <th scope="col" className="pb-2 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Closed won</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#22304A]">
                            {data.map((row) => (
                                <tr key={row.month}>
                                    <td className="py-2 text-[12px] font-bold text-slate-900 dark:text-white">{row.month}</td>
                                    <td className="py-2 text-right text-[12px] font-medium tabular-nums text-slate-700 dark:text-[#E5E7EB]">{row.pipeline}</td>
                                    <td className="py-2 text-right text-[12px] font-medium tabular-nums text-slate-700 dark:text-[#E5E7EB]">{row.won}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </motion.section>
    );
}

// ── Prismconnex AI ───────────────────────────────────────────────────────────────

function PrismconnexAi({ rise, animate }: { rise: MotionProps; animate: boolean }) {
    const [highlight, setHighlight] = useState(0);

    // Cycle the headline. Static for reduced motion — the first line still reads.
    useEffect(() => {
        if (!animate) return;
        const id = setInterval(() => setHighlight((i) => (i + 1) % AI_HIGHLIGHTS.length), 4200);
        return () => clearInterval(id);
    }, [animate]);

    return (
        <motion.section {...rise} aria-label="Prismconnex AI" className={cn(PANEL, "group flex flex-col p-5 lg:col-span-4 lg:row-span-2")}>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-violet-500/20 blur-3xl"
            />
            <PanelHeader title="Prismconnex AI" subtitle="Opportunities surfaced from your workspace" icon={Bot} tone="violet">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-600 ring-1 ring-inset ring-violet-500/20 dark:text-violet-300">
                    <span className="relative flex size-1.5">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-violet-500 opacity-75 motion-reduce:hidden" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-violet-500" />
                    </span>
                    Live
                </span>
            </PanelHeader>

            {/* Rotating capability headline */}
            <div className="relative z-10 mt-4 overflow-hidden rounded-[10px] border border-violet-500/20 bg-gradient-to-r from-violet-500/[0.08] via-indigo-500/[0.06] to-transparent px-3.5 py-3 dark:border-violet-400/20 dark:from-violet-400/[0.12] dark:via-indigo-400/[0.08]">
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-violet-500/0 via-violet-500 to-violet-500/0"
                />
                <div className="flex items-start gap-2.5">
                    <Sparkles className="mt-[1px] size-3.5 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                    <div className="min-h-[34px] min-w-0 flex-1">
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.p
                                key={highlight}
                                initial={animate ? { opacity: 0, y: 6 } : false}
                                animate={{ opacity: 1, y: 0 }}
                                exit={animate ? { opacity: 0, y: -6 } : undefined}
                                transition={{ duration: 0.3 }}
                                className="text-[13px] font-bold leading-snug text-slate-900 dark:text-white"
                            >
                                {AI_HIGHLIGHTS[highlight]}
                            </motion.p>
                        </AnimatePresence>
                    </div>
                </div>
                {/* Progress ticks double as a position indicator for the rotation */}
                <div className="mt-2 flex gap-1 pl-6" aria-hidden="true">
                    {AI_HIGHLIGHTS.map((item, index) => (
                        <span
                            key={item}
                            className={cn(
                                "h-[3px] flex-1 rounded-full transition-colors duration-300",
                                index === highlight ? "bg-violet-500 dark:bg-violet-400" : "bg-violet-500/20 dark:bg-violet-400/20"
                            )}
                        />
                    ))}
                </div>
            </div>

            <ul className="relative z-10 mt-4 space-y-2.5">
                {AI_INSIGHTS.map((insight, index) => {
                    const Icon = insight.icon;
                    return (
                        <motion.li
                            key={insight.title}
                            {...(animate
                                ? {
                                      initial: { opacity: 0, y: 8 },
                                      animate: { opacity: 1, y: 0 },
                                      transition: { duration: 0.35, delay: 0.15 + index * 0.08 },
                                  }
                                : { initial: false as const, animate: { opacity: 1, y: 0 } })}
                            className="group/insight cursor-pointer rounded-[10px] border border-slate-200 bg-slate-50/70 p-3 transition-all hover:-translate-y-0.5 hover:border-violet-500/40 hover:shadow-md motion-reduce:transform-none dark:border-[#22304A] dark:bg-[#0B1220] dark:hover:border-violet-400/40"
                        >
                            <div className="flex items-start gap-2.5">
                                <Icon className="mt-0.5 size-3.5 shrink-0 text-violet-500 dark:text-violet-300" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="text-[13px] font-bold leading-snug text-slate-900 dark:text-white">{insight.title}</p>
                                    <p className="mt-1 text-[11.5px] leading-snug text-slate-700 dark:text-slate-300">{insight.detail}</p>
                                    <span
                                        className={cn(
                                            "mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ring-1 ring-inset",
                                            insight.tone === "risk"
                                                ? "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-300"
                                                : insight.tone === "high"
                                                  ? "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-300"
                                                  : "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300"
                                        )}
                                    >
                                        {insight.impact}
                                    </span>
                                </div>
                                <ChevronRight
                                    className="ml-auto mt-0.5 size-3.5 shrink-0 text-slate-500 transition-transform group-hover/insight:translate-x-0.5 motion-reduce:transition-none dark:text-slate-400"
                                    aria-hidden="true"
                                />
                            </div>
                        </motion.li>
                    );
                })}
            </ul>

            <ul className="relative z-10 mt-4 flex flex-wrap gap-1.5">
                {AI_CAPABILITIES.map((capability) => (
                    <li
                        key={capability}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-[#22304A] dark:bg-[#16233A] dark:text-slate-300"
                    >
                        {capability}
                    </li>
                ))}
            </ul>

            {/* What the model is reading, so the panel is never a black box */}
            <dl className="relative z-10 mt-auto grid grid-cols-3 gap-2 border-t border-slate-200 pt-4 dark:border-[#22304A]">
                {AI_FOOTPRINT.map((stat) => (
                    <div key={stat.label}>
                        <dt className="text-[10px] font-bold uppercase leading-tight tracking-[0.1em] text-slate-600 dark:text-slate-300">
                            {stat.label}
                        </dt>
                        <dd className="mt-0.5 text-[15px] font-black tabular-nums text-slate-900 dark:text-white">{stat.value}</dd>
                    </div>
                ))}
            </dl>

            <Link
                href="/app/opportunities"
                className="group/cta relative z-10 mt-3 flex items-center justify-center gap-2 overflow-hidden rounded-[10px] bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-[length:200%_100%] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_10px_30px_-16px_rgba(124,58,237,0.9)] transition-all duration-500 hover:-translate-y-0.5 hover:bg-[position:100%_0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none dark:focus-visible:ring-offset-[#111B2E]"
            >
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-px translate-x-[-120%] bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-out group-hover/cta:translate-x-[120%] motion-reduce:hidden"
                />
                <Sparkles className="relative size-4" aria-hidden="true" />
                <span className="relative">View opportunities</span>
                <ChevronRight
                    className="relative size-3.5 transition-transform group-hover/cta:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden="true"
                />
            </Link>
        </motion.section>
    );
}

// ── Pipeline Overview ────────────────────────────────────────────────────────

function PipelineOverview({ rise, animate }: { rise: MotionProps; animate: boolean }) {
    return (
        <motion.section {...rise} aria-label="Pipeline overview" className={cn(PANEL, "flex flex-col p-5 lg:col-span-4")}>
            <PanelHeader title="Pipeline Overview" subtitle="Funnel depth by stage" icon={Target} />

            <ul className="relative z-10 mt-5 space-y-3.5">
                {PIPELINE_STAGES.map((stage, index) => {
                    const previous = PIPELINE_STAGES[index - 1];
                    const conversion = previous ? Math.round((stage.count / previous.count) * 100) : null;

                    return (
                        <li key={stage.stage}>
                            <div className="mb-1.5 flex items-baseline justify-between gap-2">
                                <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">{stage.stage}</span>
                                <span className="flex items-baseline gap-2">
                                    {conversion !== null && (
                                        <span className="text-[10px] font-bold tabular-nums text-slate-600 dark:text-slate-300">{conversion}% →</span>
                                    )}
                                    <span className="text-[12px] font-bold tabular-nums text-slate-900 dark:text-white">{stage.count}</span>
                                </span>
                            </div>
                            <div
                                className="group/bar relative h-[26px] w-full rounded-[6px] bg-slate-100 dark:bg-[#0B1220]"
                                title={`${stage.stage}: ${stage.count} deals · ${stage.share}% of the funnel`}
                            >
                                <motion.div
                                    className="flex h-full items-center overflow-hidden rounded-[6px] px-2.5 transition-[filter] duration-200 group-hover/bar:brightness-105"
                                    style={{ backgroundColor: stage.fill }}
                                    initial={animate ? { width: 0 } : false}
                                    animate={{ width: `${stage.share}%` }}
                                    transition={{ duration: 0.7, delay: 0.2 + index * 0.08, ease: "easeOut" }}
                                >
                                    {/* Narrow bars can't hold their label — it moves outside instead */}
                                    {stage.share >= 30 && (
                                        <span className="truncate text-[11px] font-bold tabular-nums" style={{ color: stage.ink }}>
                                            {stage.share}%
                                        </span>
                                    )}
                                </motion.div>
                                {stage.share < 30 && (
                                    <span
                                        className="pointer-events-none absolute inset-y-0 flex items-center pl-2 text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-300"
                                        style={{ left: `${stage.share}%` }}
                                    >
                                        {stage.share}%
                                    </span>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>

            <div className="relative z-10 mt-auto flex items-center justify-between border-t border-slate-200 pt-4 dark:border-[#22304A]">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Win rate</span>
                <span className="text-[15px] font-black tabular-nums text-slate-900 dark:text-white">7.6%</span>
            </div>
        </motion.section>
    );
}

// ── Email Performance ────────────────────────────────────────────────────────

function EmailPerformance({ rise, animate }: { rise: MotionProps; animate: boolean }) {
    const circumference = 2 * Math.PI * 34;
    const deliverability = useCountUp(DELIVERABILITY, animate);

    return (
        <motion.section {...rise} aria-label="Email performance" className={cn(PANEL, "flex flex-col p-5 lg:col-span-4")}>
            <PanelHeader title="Email Performance" subtitle="Last 30 days across all sequences" icon={Send} tone="cyan" />

            <div className="relative z-10 mt-5 flex items-center gap-5">
                <div className="relative shrink-0">
                    <svg viewBox="0 0 80 80" className="size-[92px] -rotate-90" role="img" aria-label={`Deliverability ${DELIVERABILITY}%`}>
                        <circle cx="40" cy="40" r="34" fill="none" strokeWidth="7" className="stroke-slate-100 dark:stroke-[#0B1220]" />
                        <motion.circle
                            cx="40"
                            cy="40"
                            r="34"
                            fill="none"
                            stroke="#06B6D4"
                            strokeWidth="7"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            initial={animate ? { strokeDashoffset: circumference } : false}
                            animate={{ strokeDashoffset: circumference * (1 - DELIVERABILITY / 100) }}
                            transition={{ duration: 1.1, delay: 0.2, ease: "easeOut" }}
                        />
                    </svg>
                    <span className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[17px] font-black leading-none tabular-nums text-slate-900 dark:text-white">
                            {deliverability.toFixed(1)}%
                        </span>
                        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600 dark:text-slate-300">Delivered</span>
                    </span>
                </div>

                <dl className="min-w-0 flex-1 space-y-2.5">
                    {EMAIL_METRICS.map((metric, index) => {
                        const Icon = metric.icon;
                        const positive = metric.status ? metric.delta <= 0 : metric.delta >= 0;
                        return (
                            <div key={metric.label}>
                                <div className="flex items-baseline justify-between gap-2">
                                    <dt className="flex items-center gap-1.5 truncate text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">
                                        <Icon
                                            className={cn("size-3 shrink-0", metric.status ? "text-rose-500 dark:text-rose-400" : "text-cyan-500 dark:text-cyan-400")}
                                            aria-hidden="true"
                                        />
                                        {metric.label}
                                    </dt>
                                    <dd className="flex items-baseline gap-1.5">
                                        <span className="text-[12.5px] font-black tabular-nums text-slate-900 dark:text-white">{metric.value}%</span>
                                        <span
                                            className={cn(
                                                "text-[10px] font-bold tabular-nums",
                                                positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                            )}
                                        >
                                            {metric.delta >= 0 ? "+" : ""}
                                            {metric.delta}
                                        </span>
                                    </dd>
                                </div>
                                <div className="mt-1 h-[5px] w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#0B1220]">
                                    <motion.span
                                        className={cn("block h-full rounded-full", metric.status ? "bg-rose-500" : "bg-cyan-500")}
                                        initial={animate ? { width: 0 } : false}
                                        // All four bars share one 0–50% scale, so their lengths stay comparable.
                                        animate={{ width: `${Math.min(100, (metric.value / 50) * 100)}%` }}
                                        transition={{ duration: 0.7, delay: 0.25 + index * 0.07, ease: "easeOut" }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </dl>
            </div>

            <div className="relative z-10 mt-6">
                <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                        Send volume · last 14 days
                    </span>
                    <span className="text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-300">Peak 94</span>
                </div>
                <div className="flex h-[52px] items-end gap-[3px]" role="img" aria-label="Daily send volume for the last 14 days, trending up">
                    {SEND_VOLUME.map((height, index) => (
                        <motion.span
                            key={index}
                            className="flex-1 rounded-t-[3px] bg-cyan-500/70 transition-colors hover:bg-cyan-500 dark:bg-cyan-400/60 dark:hover:bg-cyan-400"
                            title={`Day ${index + 1}: ${height}`}
                            initial={animate ? { height: 0 } : false}
                            animate={{ height: `${height}%` }}
                            transition={{ duration: 0.5, delay: 0.35 + index * 0.03, ease: "easeOut" }}
                        />
                    ))}
                </div>
            </div>

            <div className="relative z-10 mt-auto flex items-center justify-between border-t border-slate-200 pt-4 dark:border-[#22304A]">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">Emails sent</span>
                <span className="text-[15px] font-black tabular-nums text-slate-900 dark:text-white">12,540</span>
            </div>
        </motion.section>
    );
}

// ── Recent Activity ──────────────────────────────────────────────────────────

function RecentActivity({ rise, animate }: { rise: MotionProps; animate: boolean }) {
    return (
        <motion.section {...rise} aria-label="Recent activity" className={cn(PANEL, "flex flex-col p-5 lg:col-span-12")}>
            <PanelHeader title="Recent Activity" subtitle="Everything moving in your workspace" icon={Activity} tone="emerald" />

            <ol className="relative z-10 mt-5 space-y-4">
                {/* Timeline rail */}
                <span
                    aria-hidden="true"
                    className="absolute left-[15px] top-2 h-[calc(100%-1.5rem)] w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent dark:from-[#22304A] dark:via-[#22304A]"
                />
                {RECENT_ACTIVITY.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <motion.li
                            key={`${item.actor}-${item.target}`}
                            {...(animate
                                ? {
                                      initial: { opacity: 0, x: -8 },
                                      animate: { opacity: 1, x: 0 },
                                      transition: { duration: 0.35, delay: 0.2 + index * 0.07 },
                                  }
                                : { initial: false as const, animate: { opacity: 1, x: 0 } })}
                            className="relative flex gap-3"
                        >
                            <span
                                className={cn(
                                    "relative z-10 flex size-[31px] shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
                                    ACTIVITY_TONES[item.tone],
                                    "bg-white dark:bg-[#111B2E]"
                                )}
                            >
                                <Icon className="size-3.5" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 pt-0.5">
                                <p className="text-[12.5px] leading-snug text-slate-700 dark:text-slate-300">
                                    <span className="font-bold text-slate-900 dark:text-white">{item.actor}</span> {item.action}{" "}
                                    <span className="font-bold text-slate-900 dark:text-white">{item.target}</span>
                                </p>
                                <p className="mt-0.5 truncate text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                    {item.meta} · {item.time}
                                </p>
                            </div>
                        </motion.li>
                    );
                })}
            </ol>

            <Link
                href="/app/audit-log"
                className="relative z-10 mt-auto flex items-center justify-center gap-1 border-t border-slate-200 pt-4 text-[12px] font-bold text-slate-700 transition-colors hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-[#22304A] dark:text-slate-300 dark:hover:text-indigo-300"
            >
                View full activity log
                <ChevronRight className="size-3.5" aria-hidden="true" />
            </Link>
        </motion.section>
    );
}

// ── Section ──────────────────────────────────────────────────────────────────

export function DashboardSection() {
    const reduceMotion = useReducedMotion();
    const animate = !reduceMotion;
    const { user, loaded } = useCurrentUser();
    const [now, setNow] = useState<Date | null>(null);

    // Rendered client-side only so the clock never mismatches during hydration.
    useEffect(() => {
        setNow(new Date());
        const id = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(id);
    }, []);

    const rise = (delay: number): MotionProps =>
        reduceMotion
            ? { initial: false, animate: { opacity: 1, y: 0 } }
            : {
                  initial: { opacity: 0, y: 14 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.45, delay, ease: "easeOut" },
              };

    return (
        <div className="relative mx-auto flex w-full max-w-[1600px] flex-col gap-6 pb-12">
            {/* Ambient backdrop — pure decoration, sits behind every panel */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[520px] overflow-hidden">
                <div className="absolute left-[-10%] top-0 size-[460px] rounded-full bg-indigo-500/[0.13] blur-[130px] dark:bg-indigo-500/20" />
                <div className="absolute right-[-6%] top-10 size-[380px] rounded-full bg-cyan-400/[0.12] blur-[120px] dark:bg-cyan-500/[0.16]" />
                <div className="absolute left-1/3 top-40 size-[320px] rounded-full bg-violet-500/[0.10] blur-[120px] dark:bg-violet-500/[0.14]" />
            </div>

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <motion.header
                {...(reduceMotion
                    ? { initial: false as const, animate: { opacity: 1, y: 0 } }
                    : { initial: { opacity: 0, y: -12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: "easeOut" } })}
                className={cn(PANEL, "group px-6 py-7 sm:px-8 sm:py-8")}
            >
                {/* Grid mesh + horizon glow */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-[0.55] [mask-image:radial-gradient(120%_100%_at_20%_0%,black,transparent_70%)] dark:opacity-[0.35]"
                    style={{
                        backgroundImage:
                            "linear-gradient(to right, rgba(99,102,241,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.16) 1px, transparent 1px)",
                        backgroundSize: "44px 44px",
                    }}
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-24 -top-32 size-[360px] rounded-full bg-gradient-to-br from-indigo-500/25 via-violet-500/15 to-transparent blur-3xl"
                />
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent"
                />

                <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300">
                                <span className="relative flex size-1.5">
                                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:hidden" />
                                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                                </span>
                                Systems nominal
                            </span>
                            {loaded && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-300">
                                    {roleLabel(user?.role)}
                                </span>
                            )}
                            {user?.workspace && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700 ring-1 ring-inset ring-slate-500/20 dark:text-slate-300">
                                    {user.workspace}
                                </span>
                            )}
                        </div>

                        <h1 className="text-[30px] font-black leading-[1.05] tracking-tight text-slate-900 sm:text-[38px] dark:text-white">
                            Welcome back,{" "}
                            {loaded ? (
                                <motion.span
                                    initial={animate ? { opacity: 0, filter: "blur(6px)" } : false}
                                    animate={{ opacity: 1, filter: "blur(0px)" }}
                                    transition={{ duration: 0.5 }}
                                    className="bg-gradient-to-r from-indigo-600 via-violet-500 to-cyan-500 bg-clip-text text-transparent dark:from-indigo-300 dark:via-violet-300 dark:to-cyan-300"
                                >
                                    {displayName(user)}
                                </motion.span>
                            ) : (
                                <span className="inline-block h-[0.85em] w-[132px] animate-pulse rounded-md bg-slate-200 align-middle dark:bg-[#22304A] motion-reduce:animate-none" />
                            )}
                        </h1>

                        <p className="max-w-[52ch] text-[13px] font-medium text-slate-700 dark:text-slate-300">
                            Your outreach command deck — signals, sequences, and momentum, live.
                        </p>
                    </div>

                    <div className="flex flex-col items-start gap-4 lg:items-end">
                        <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                            <CalendarDays className="size-3.5" aria-hidden="true" />
                            {/* Empty until mounted so SSR and client agree */}
                            <span suppressHydrationWarning>
                                {now
                                    ? now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
                                    : " "}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <Link
                                href="/app/leads"
                                className="group/btn inline-flex items-center gap-2 rounded-[10px] bg-slate-900 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-14px_rgba(15,23,42,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 motion-reduce:transform-none dark:bg-white dark:text-[#0B1220] dark:hover:shadow-[0_12px_28px_-14px_rgba(255,255,255,0.5)] dark:focus-visible:ring-offset-[#0B1220]"
                            >
                                <Radar className="size-4" aria-hidden="true" />
                                Work the pipeline
                                <ChevronRight className="size-3.5 transition-transform group-hover/btn:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                            </Link>
                            <Link
                                href="/app/events"
                                className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white/70 px-4 py-2.5 text-[13px] font-bold text-slate-700 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-indigo-500/40 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 motion-reduce:transform-none dark:border-[#22304A] dark:bg-[#16233A]/70 dark:text-slate-200 dark:hover:border-indigo-400/40 dark:hover:text-indigo-300 dark:focus-visible:ring-offset-[#0B1220]"
                            >
                                <Sparkles className="size-4" aria-hidden="true" />
                                Explore events
                            </Link>
                        </div>
                    </div>
                </div>
            </motion.header>

            {/* ── Primary KPIs ─────────────────────────────────────────────── */}
            <section aria-label="Key performance indicators" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {PRIMARY_KPIS.map((kpi, index) => (
                    <KpiTile key={kpi.key} kpi={kpi} animate={animate} rise={rise(0.08 + index * 0.06)} />
                ))}
            </section>

            {/* ── Comms strip ──────────────────────────────────────────────── */}
            <section aria-label="Communication volume" className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                {COMMS_KPIS.map((kpi, index) => {
                    const Icon = kpi.icon;
                    return (
                        <motion.article
                            key={kpi.key}
                            {...rise(0.32 + index * 0.05)}
                            className={cn(
                                PANEL,
                                "group flex items-center gap-4 px-5 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-500/40 dark:hover:border-indigo-400/40 motion-reduce:transform-none"
                            )}
                        >
                            <Shine />
                            <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-indigo-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-500/20 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/20">
                                <Icon className="size-[18px]" aria-hidden="true" />
                            </span>
                            <div className="relative z-10 min-w-0">
                                <p className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                                    {kpi.label}
                                </p>
                                <p className="text-[22px] font-black leading-tight text-slate-900 dark:text-white">{kpi.value}</p>
                                <p className="truncate text-[11px] font-medium text-slate-700 dark:text-slate-300">{kpi.caption}</p>
                            </div>
                        </motion.article>
                    );
                })}
            </section>

            {/* ── Sales Overview + Pipeline + Email, with AI down the right ─────
                One grid, not two rows: the AI panel's insight list is far taller
                than the sales chart, so it spans both rows while Pipeline and
                Email sit directly beneath Sales Overview. items-start keeps every
                card at its own content height — stretching used to inflate the
                sales chart to match the AI panel. */}
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
                <SalesOverview rise={rise(0.46)} animate={animate} />
                <PrismconnexAi rise={rise(0.52)} animate={animate} />
                <PipelineOverview rise={rise(0.58)} animate={animate} />
                <EmailPerformance rise={rise(0.64)} animate={animate} />
            </div>

            {/* ── Recent Activity ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <RecentActivity rise={rise(0.7)} animate={animate} />
            </div>
        </div>
    );
}

// ── KPI tile ─────────────────────────────────────────────────────────────────

function KpiTile({
    kpi,
    animate,
    rise,
}: {
    kpi: (typeof PRIMARY_KPIS)[number];
    animate: boolean;
    rise: MotionProps;
}) {
    const accent = ACCENTS[kpi.accent];
    const Icon = kpi.icon;
    const current = useCountUp(kpi.value, animate);
    const positive = kpi.delta >= 0;
    const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight;

    const shown =
        kpi.format === "pct"
            ? `${current.toFixed(1)}%`
            : Math.round(current).toLocaleString();

    return (
        <motion.article
            {...rise}
            className={cn(
                PANEL,
                "group h-[168px] p-5 transition-all duration-300 hover:-translate-y-1 motion-reduce:transform-none",
                accent.border,
                accent.glow
            )}
        >
            <Shine />
            {/* Accent rail along the top edge */}
            <span
                aria-hidden="true"
                className={cn(
                    "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-40 transition-opacity duration-300 group-hover:opacity-100",
                    accent.rail
                )}
            />

            <div className="relative z-10 flex items-start justify-between">
                <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300">
                        {kpi.label}
                    </span>
                    <span
                        className="text-[34px] font-black leading-none tracking-tight tabular-nums text-slate-900 dark:text-white"
                        aria-label={`${kpi.label}: ${kpi.format === "pct" ? `${kpi.value}%` : kpi.value.toLocaleString()}`}
                    >
                        {shown}
                    </span>
                </div>
                <span
                    className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-inset transition-transform duration-300 group-hover:scale-110 motion-reduce:transform-none",
                        accent.chip
                    )}
                >
                    <Icon className="size-[17px]" aria-hidden="true" />
                </span>
            </div>

            <div className="relative z-10 mt-3 flex items-center gap-2">
                <span
                    className={cn(
                        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ring-1 ring-inset",
                        positive
                            ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-300"
                            : "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-300"
                    )}
                >
                    <DeltaIcon className="size-3" aria-hidden="true" />
                    {Math.abs(kpi.delta).toFixed(1)}%
                </span>
                <span className="truncate text-[11px] font-medium text-slate-700 dark:text-slate-300">{kpi.caption}</span>
            </div>

            <Sparkline path={kpi.spark} color={accent.stroke} animate={animate} />
        </motion.article>
    );
}
