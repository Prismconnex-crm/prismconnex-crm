import type {
    CalendarEventDTO,
    CalendarEventInput,
    CalendarEventPatch,
    CalendarSummaryDTO,
} from "@/models/calendar-integration";
import { CalendarIntegrationError } from "./oauth";
import type { CalendarProvider } from "./providers";

/**
 * Server-side calendar API client: Google Calendar v3 and Microsoft Graph
 * behind one normalized shape, so routes and the UI never branch on provider.
 *
 * Every function takes a plain access token; getting a valid one (decrypting,
 * refreshing, retrying after a 401) is CalendarIntegrationService's job.
 *
 * Times: a timed event is an ISO 8601 instant; an all-day event is a
 * YYYY-MM-DD date with an EXCLUSIVE end date — the convention both providers
 * already use, so a one-day event is { start: "2026-10-01", end: "2026-10-02" }.
 *
 * Microsoft 365 and Outlook share this code: Graph is the same API for work
 * and personal accounts.
 */

const GOOGLE_BASE = "https://www.googleapis.com/calendar/v3";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

/** "primary" is the provider-neutral id for the account's default calendar. */
export const PRIMARY_CALENDAR = "primary";

export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

async function call<T>(
    provider: CalendarProvider,
    accessToken: string,
    url: string,
    init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<T | null> {
    let res: Response;
    try {
        res = await fetch(url, {
            method: init.method ?? "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
                ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
                ...init.headers,
            },
            body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
            cache: "no-store",
        });
    } catch (error) {
        throw new CalendarIntegrationError("provider_api_failed", `unreachable: ${String(error)}`);
    }

    if (res.ok) {
        if (res.status === 204) return null;
        return (await res.json().catch(() => null)) as T | null;
    }

    // Provider bodies can echo request details — server log only.
    const text = await res.text().catch(() => "");
    console.error("[calendar] provider API call failed", {
        provider,
        method: init.method ?? "GET",
        path: new URL(url).pathname,
        status: res.status,
        body: text.slice(0, 500),
    });

    if (res.status === 401) throw new CalendarIntegrationError("token_expired", "401 from calendar API");
    if (res.status === 403) {
        // Google reports quota exhaustion as 403 too; that is not a consent problem.
        if (/rateLimitExceeded|userRateLimitExceeded|quotaExceeded/.test(text)) {
            throw new CalendarIntegrationError("provider_api_failed", "rate limited");
        }
        throw new CalendarIntegrationError("permission_denied", "403 from calendar API");
    }
    if (res.status === 404 || res.status === 410) throw new CalendarIntegrationError("not_found", `status ${res.status}`);
    if (res.status === 400) throw new CalendarIntegrationError("invalid_request", "400 from calendar API");
    throw new CalendarIntegrationError("provider_api_failed", `status ${res.status}`);
}

/* ------------------------------------------------------------------ */
/* Google                                                              */
/* ------------------------------------------------------------------ */

type GoogleTime = { date?: string; dateTime?: string; timeZone?: string };
type GoogleEvent = {
    id: string;
    status?: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: GoogleTime;
    end?: GoogleTime;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: {
        entryPoints?: { entryPointType?: string; uri?: string }[];
    };
    organizer?: { email?: string };
    attendees?: { email?: string; displayName?: string; responseStatus?: string }[];
};

function fromGoogleTime(t: GoogleTime | undefined) {
    if (t?.date) return { value: t.date, allDay: true };
    return { value: t?.dateTime ? new Date(t.dateTime).toISOString() : "", allDay: false };
}

function fromGoogleEvent(calendarId: string, e: GoogleEvent): CalendarEventDTO {
    const start = fromGoogleTime(e.start);
    return {
        id: e.id,
        calendarId,
        title: e.summary ?? "(No title)",
        description: e.description ?? null,
        location: e.location ?? null,
        start: start.value,
        end: fromGoogleTime(e.end).value,
        allDay: start.allDay,
        organizerEmail: e.organizer?.email ?? null,
        attendees: (e.attendees ?? [])
            .filter((a) => a.email)
            .map((a) => ({ email: a.email!, name: a.displayName ?? null, response: a.responseStatus ?? null })),
        webLink: e.htmlLink ?? null,
        meetingUrl:
            e.hangoutLink ??
            e.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ??
            null,
    };
}

function toGoogleTime(value: string, timeZone: string | undefined): GoogleTime {
    return DATE_ONLY.test(value) ? { date: value } : { dateTime: value, ...(timeZone ? { timeZone } : {}) };
}

export function toGoogleBody(input: CalendarEventPatch) {
    const body: Record<string, unknown> = {};
    if (input.title !== undefined) body.summary = input.title;
    if (input.description !== undefined) body.description = input.description ?? "";
    if (input.location !== undefined) body.location = input.location ?? "";
    if (input.start !== undefined) body.start = toGoogleTime(input.start, input.timeZone);
    if (input.end !== undefined) body.end = toGoogleTime(input.end, input.timeZone);
    if (input.attendees !== undefined) body.attendees = input.attendees.map((email) => ({ email }));
    return body;
}

const googleCalendarPath = (calendarId: string) => `${GOOGLE_BASE}/calendars/${encodeURIComponent(calendarId)}`;

/* ------------------------------------------------------------------ */
/* Microsoft Graph                                                     */
/* ------------------------------------------------------------------ */

type GraphTime = { dateTime?: string; timeZone?: string };
type GraphEvent = {
    id: string;
    subject?: string;
    body?: { content?: string };
    bodyPreview?: string;
    location?: { displayName?: string };
    start?: GraphTime;
    end?: GraphTime;
    isAllDay?: boolean;
    isCancelled?: boolean;
    webLink?: string;
    organizer?: { emailAddress?: { address?: string } };
    attendees?: { emailAddress?: { address?: string; name?: string }; status?: { response?: string } }[];
};

/** Reads are requested in UTC (Prefer header), so Graph returns zone-less UTC wall time. */
export const GRAPH_READ_HEADERS = {
    Prefer: 'outlook.timezone="UTC", outlook.body-content-type="text"',
};

function fromGraphTime(t: GraphTime | undefined, allDay: boolean) {
    const raw = t?.dateTime ?? "";
    if (!raw) return "";
    if (allDay) return raw.slice(0, 10);
    // "2026-10-01T09:00:00.0000000" → trim to milliseconds and mark as UTC.
    return new Date(raw.replace(/(\.\d{3})\d*$/, "$1") + "Z").toISOString();
}

function fromGraphEvent(calendarId: string, e: GraphEvent): CalendarEventDTO {
    const allDay = Boolean(e.isAllDay);
    return {
        id: e.id,
        calendarId,
        title: e.subject || "(No title)",
        description: e.body?.content || e.bodyPreview || null,
        location: e.location?.displayName || null,
        start: fromGraphTime(e.start, allDay),
        end: fromGraphTime(e.end, allDay),
        allDay,
        organizerEmail: e.organizer?.emailAddress?.address ?? null,
        attendees: (e.attendees ?? [])
            .filter((a) => a.emailAddress?.address)
            .map((a) => ({
                email: a.emailAddress!.address!,
                name: a.emailAddress?.name ?? null,
                response: a.status?.response ?? null,
            })),
        webLink: e.webLink ?? null,
        meetingUrl: null,
    };
}

function toGraphTime(value: string): GraphTime {
    // Written in UTC so the event lands at the same instant the caller sent.
    if (DATE_ONLY.test(value)) return { dateTime: `${value}T00:00:00`, timeZone: "UTC" };
    return { dateTime: new Date(value).toISOString().replace(/Z$/, ""), timeZone: "UTC" };
}

export function toGraphBody(input: CalendarEventPatch) {
    const body: Record<string, unknown> = {};
    if (input.title !== undefined) body.subject = input.title;
    if (input.description !== undefined) body.body = { contentType: "text", content: input.description ?? "" };
    if (input.location !== undefined) body.location = { displayName: input.location ?? "" };
    if (input.start !== undefined) {
        body.start = toGraphTime(input.start);
        body.isAllDay = DATE_ONLY.test(input.start);
    }
    if (input.end !== undefined) body.end = toGraphTime(input.end);
    if (input.attendees !== undefined) {
        body.attendees = input.attendees.map((address) => ({ emailAddress: { address }, type: "required" }));
    }
    return body;
}

const graphCalendarPath = (calendarId: string) =>
    calendarId === PRIMARY_CALENDAR ? `${GRAPH_BASE}/me/calendar` : `${GRAPH_BASE}/me/calendars/${encodeURIComponent(calendarId)}`;

const GRAPH_EVENT_SELECT =
    "id,subject,body,bodyPreview,location,start,end,isAllDay,isCancelled,webLink,organizer,attendees";

/* ------------------------------------------------------------------ */
/* Provider-neutral operations                                         */
/* ------------------------------------------------------------------ */

export async function listCalendars(provider: CalendarProvider, accessToken: string): Promise<CalendarSummaryDTO[]> {
    if (provider === "google") {
        const json = await call<{
            items?: {
                id: string;
                summary?: string;
                summaryOverride?: string;
                primary?: boolean;
                accessRole?: string;
                timeZone?: string;
                backgroundColor?: string;
            }[];
        }>(provider, accessToken, `${GOOGLE_BASE}/users/me/calendarList?minAccessRole=reader&maxResults=250`);

        return (json?.items ?? []).map((c) => ({
            id: c.primary ? PRIMARY_CALENDAR : c.id,
            name: c.summaryOverride ?? c.summary ?? c.id,
            primary: Boolean(c.primary),
            canEdit: c.accessRole === "owner" || c.accessRole === "writer",
            timeZone: c.timeZone ?? null,
            color: c.backgroundColor ?? null,
        }));
    }

    const json = await call<{
        value?: { id: string; name?: string; isDefaultCalendar?: boolean; canEdit?: boolean; hexColor?: string }[];
    }>(provider, accessToken, `${GRAPH_BASE}/me/calendars?$select=id,name,isDefaultCalendar,canEdit,hexColor&$top=250`);

    return (json?.value ?? []).map((c) => ({
        id: c.isDefaultCalendar ? PRIMARY_CALENDAR : c.id,
        name: c.name ?? c.id,
        primary: Boolean(c.isDefaultCalendar),
        canEdit: c.canEdit !== false,
        timeZone: null,
        color: c.hexColor || null,
    }));
}

export async function listEvents(
    provider: CalendarProvider,
    accessToken: string,
    params: { calendarId: string; from: string; to: string; limit: number }
): Promise<CalendarEventDTO[]> {
    const { calendarId, from, to, limit } = params;

    if (provider === "google") {
        const url = new URL(`${googleCalendarPath(calendarId)}/events`);
        url.searchParams.set("timeMin", from);
        url.searchParams.set("timeMax", to);
        url.searchParams.set("singleEvents", "true");
        url.searchParams.set("orderBy", "startTime");
        url.searchParams.set("maxResults", String(limit));
        const json = await call<{ items?: GoogleEvent[] }>(provider, accessToken, url.toString());
        return (json?.items ?? []).filter((e) => e.status !== "cancelled").map((e) => fromGoogleEvent(calendarId, e));
    }

    const url = new URL(`${graphCalendarPath(calendarId)}/calendarView`);
    url.searchParams.set("startDateTime", from);
    url.searchParams.set("endDateTime", to);
    url.searchParams.set("$top", String(limit));
    url.searchParams.set("$orderby", "start/dateTime");
    url.searchParams.set("$select", GRAPH_EVENT_SELECT);
    const json = await call<{ value?: GraphEvent[] }>(provider, accessToken, url.toString(), {
        headers: GRAPH_READ_HEADERS,
    });
    return (json?.value ?? []).filter((e) => !e.isCancelled).map((e) => fromGraphEvent(calendarId, e));
}

export async function createEvent(
    provider: CalendarProvider,
    accessToken: string,
    calendarId: string,
    input: CalendarEventInput
): Promise<CalendarEventDTO> {
    if (provider === "google") {
        const created = await call<GoogleEvent>(provider, accessToken, `${googleCalendarPath(calendarId)}/events`, {
            method: "POST",
            body: toGoogleBody(input),
        });
        return fromGoogleEvent(calendarId, created!);
    }

    const created = await call<GraphEvent>(provider, accessToken, `${graphCalendarPath(calendarId)}/events`, {
        method: "POST",
        body: toGraphBody(input),
        headers: GRAPH_READ_HEADERS,
    });
    return fromGraphEvent(calendarId, created!);
}

export async function updateEvent(
    provider: CalendarProvider,
    accessToken: string,
    calendarId: string,
    eventId: string,
    patch: CalendarEventPatch
): Promise<CalendarEventDTO> {
    if (provider === "google") {
        const updated = await call<GoogleEvent>(
            provider,
            accessToken,
            `${googleCalendarPath(calendarId)}/events/${encodeURIComponent(eventId)}`,
            { method: "PATCH", body: toGoogleBody(patch) }
        );
        return fromGoogleEvent(calendarId, updated!);
    }

    // Graph event ids are unique per mailbox, so the calendar is not in the path.
    const updated = await call<GraphEvent>(provider, accessToken, `${GRAPH_BASE}/me/events/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        body: toGraphBody(patch),
        headers: GRAPH_READ_HEADERS,
    });
    return fromGraphEvent(calendarId, updated!);
}

export async function deleteEvent(
    provider: CalendarProvider,
    accessToken: string,
    calendarId: string,
    eventId: string
): Promise<void> {
    const url =
        provider === "google"
            ? `${googleCalendarPath(calendarId)}/events/${encodeURIComponent(eventId)}`
            : `${GRAPH_BASE}/me/events/${encodeURIComponent(eventId)}`;
    await call(provider, accessToken, url, { method: "DELETE" });
}
