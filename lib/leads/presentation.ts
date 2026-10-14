import { LEAD_SOURCES, LEAD_STATUSES, type LeadStatus } from "@/models/lead";
import { formatDate } from "@/components/crm/profile/profile-ui";

/**
 * Display rules for leads, kept out of the components so they are node-tested
 * (the repo has no DOM test environment) and shared by every lead view.
 */

const STATUS_META: Record<LeadStatus, { label: string; className: string }> = {
    NEW: {
        label: "New",
        className:
            "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20",
    },
    CONTACTED: {
        label: "Contacted",
        className:
            "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
    },
    QUALIFIED: {
        label: "Qualified",
        className:
            "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
    },
    NURTURING: {
        label: "Nurturing",
        className:
            "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/20",
    },
    CONVERTED: {
        label: "Converted",
        className:
            "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/20",
    },
    LOST: {
        label: "Lost",
        className:
            "bg-slate-100 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-500/20",
    },
};

const FALLBACK_STATUS_CLASS = STATUS_META.LOST.className;

function isLeadStatus(value: string): value is LeadStatus {
    return (LEAD_STATUSES as readonly string[]).includes(value);
}

/** A value outside the list (an older row) shows as-is rather than blank. */
export function statusLabel(status: string): string {
    return isLeadStatus(status) ? STATUS_META[status].label : status;
}

export function statusClassName(status: string): string {
    return isLeadStatus(status) ? STATUS_META[status].className : FALLBACK_STATUS_CLASS;
}

/** Columns of the pipeline overview. Lost leads have left the pipeline. */
export const PIPELINE_STATUSES = LEAD_STATUSES.filter((status) => status !== "LOST");

/** Statuses a user may pick by hand — Converted comes only from Convert to Deal. */
export const SELECTABLE_STATUS_OPTIONS = LEAD_STATUSES.filter((status) => status !== "CONVERTED").map(
    (status) => ({ value: status, label: STATUS_META[status].label })
);

const SOURCE_LABELS: Record<(typeof LEAD_SOURCES)[number], string> = {
    MANUAL: "Manual entry",
    EVENT: "Event",
    IMPORT: "Import",
    REFERRAL: "Referral",
    WEBSITE: "Website",
    DISCOVERY: "Company discovery",
    OTHER: "Other",
};

export function sourceLabel(source: string): string {
    return (SOURCE_LABELS as Record<string, string>)[source] ?? source;
}

export const SOURCE_OPTIONS = LEAD_SOURCES.map((source) => ({ value: source, label: SOURCE_LABELS[source] }));

export function leadInitials(name: string): string {
    const initials = name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]!.toUpperCase())
        .join("");
    return initials || "?";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Today" / "Tomorrow" / "Overdue · <date>" / "<date>".
 *
 * The stored follow-up is a calendar date at UTC midnight, so it is compared
 * by its UTC date against the viewer's local calendar date — comparing two
 * timestamps would flip a day early or late for anyone east or west of UTC.
 */
export function describeFollowUp(
    iso: string | null,
    now: Date = new Date()
): { label: string; overdue: boolean } | null {
    if (!iso) return null;

    const due = new Date(iso);
    if (Number.isNaN(due.getTime())) return null;

    const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((dueDay - today) / DAY_MS);

    if (days < 0) return { label: `Overdue · ${formatDate(iso)}`, overdue: true };
    if (days === 0) return { label: "Today", overdue: false };
    if (days === 1) return { label: "Tomorrow", overdue: false };
    return { label: formatDate(iso), overdue: false };
}

/** The value an <input type="date"> expects. */
export function toDateInputValue(iso: string | null): string {
    return iso ? iso.slice(0, 10) : "";
}
