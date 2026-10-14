import { z } from "zod";
import type { CalendarProvider } from "@/lib/integrations/calendar/providers";

/** A calendar connection as the browser sees it — never any token. */
export type CalendarConnectionDTO = {
    provider: CalendarProvider;
    accountEmail: string | null;
    /** connected | expired | error */
    status: "connected" | "expired" | "error";
    lastError: string | null;
    connectedAt: string;
    lastCheckedAt: string | null;
};

export type CalendarProviderStatusDTO = {
    provider: CalendarProvider;
    label: string;
    description: string;
    accountHint: string;
    /** false when the server lacks this provider's OAuth credentials. */
    configured: boolean;
    /** Env var NAMES only, so an admin knows what to add. */
    missingEnv: string[];
};

export type CalendarStatusResponse = {
    providers: CalendarProviderStatusDTO[];
    connections: CalendarConnectionDTO[];
    /** Set when connections could not be read (e.g. migration not applied). */
    storageError: string | null;
};

/* ------------------------------------------------------------------ */
/* Calendar data (after a connection exists)                           */
/* ------------------------------------------------------------------ */

export type CalendarSummaryDTO = {
    /** "primary" for the account's default calendar, otherwise the provider's id. */
    id: string;
    name: string;
    primary: boolean;
    canEdit: boolean;
    timeZone: string | null;
    color: string | null;
};

export type CalendarEventDTO = {
    id: string;
    calendarId: string;
    title: string;
    description: string | null;
    location: string | null;
    /** ISO instant, or YYYY-MM-DD when allDay (end date exclusive). */
    start: string;
    end: string;
    allDay: boolean;
    organizerEmail: string | null;
    attendees: { email: string; name: string | null; response: string | null }[];
    webLink: string | null;
    /** Google Meet conference URL, if the event has a video conference. */
    meetingUrl: string | null;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** ISO 8601 with an explicit offset — a zone-less time would be ambiguous. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

const EventTime = z
    .string()
    .trim()
    .refine((v) => (DATE_ONLY.test(v) || INSTANT.test(v)) && !Number.isNaN(Date.parse(v)), {
        message: "Use YYYY-MM-DD for all-day events or an ISO 8601 time with an offset, e.g. 2026-10-01T09:00:00Z",
    });

const eventFields = {
    title: z.string().trim().min(1, "Title is required").max(500),
    description: z.string().max(8000).nullable().optional(),
    location: z.string().max(500).nullable().optional(),
    start: EventTime,
    end: EventTime,
    /** IANA zone Google should display the event in; the instant itself comes from the offset. */
    timeZone: z.string().max(64).optional(),
    attendees: z.array(z.string().trim().email()).max(100).optional(),
};

function checkRange(v: { start?: string; end?: string }, ctx: z.RefinementCtx) {
    if (v.start === undefined || v.end === undefined) return;
    if (DATE_ONLY.test(v.start) !== DATE_ONLY.test(v.end)) {
        ctx.addIssue({ code: "custom", path: ["end"], message: "start and end must both be dates or both be times" });
        return;
    }
    if (Date.parse(v.end) <= Date.parse(v.start)) {
        ctx.addIssue({ code: "custom", path: ["end"], message: "end must be after start" });
    }
}

export const CalendarEventInputSchema = z.object(eventFields).superRefine(checkRange);
export type CalendarEventInput = z.infer<typeof CalendarEventInputSchema>;

export const CalendarEventPatchSchema = z
    .object(eventFields)
    .partial()
    .superRefine((v, ctx) => {
        if ((v.start === undefined) !== (v.end === undefined)) {
            ctx.addIssue({ code: "custom", path: ["end"], message: "start and end must be changed together" });
        }
        checkRange(v, ctx);
    })
    .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Nothing to update" });
export type CalendarEventPatch = z.infer<typeof CalendarEventPatchSchema>;

const DAY_MS = 24 * 60 * 60 * 1000;

export const CalendarEventListQuerySchema = z
    .object({
        calendarId: z.string().min(1).max(512).default("primary"),
        from: EventTime.optional(),
        to: EventTime.optional(),
        limit: z.coerce.number().int().min(1).max(250).default(50),
    })
    .transform((q) => {
        const from = q.from ? new Date(q.from) : new Date();
        const to = q.to ? new Date(q.to) : new Date(from.getTime() + 30 * DAY_MS);
        return { calendarId: q.calendarId, from: from.toISOString(), to: to.toISOString(), limit: q.limit };
    })
    .refine((q) => q.to > q.from, { message: "to must be after from", path: ["to"] })
    .refine((q) => Date.parse(q.to) - Date.parse(q.from) <= 366 * DAY_MS, {
        message: "The range can be at most one year",
        path: ["to"],
    });
