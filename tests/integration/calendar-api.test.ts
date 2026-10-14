import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Calendar data API (after a connection exists): the provider client, input
 * validation, and the service's token handling. No provider or database is
 * touched — fetch and the repository are mocked.
 */

const repo = vi.hoisted(() => ({
    find: vi.fn(),
    update: vi.fn(),
    listForUser: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    assertReady: vi.fn(),
}));

vi.mock("@/repositories/integration-connection.repository", () => ({
    IntegrationConnectionRepository: repo,
}));
vi.mock("@/lib/audit/audit.service", () => ({
    AuditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

const KEY = "k".repeat(40);
const TENANT = { userId: "user-1", email: "a@b.com", workspaceId: "ws-1", role: "ADMIN" } as never;

function json(status: number, body: unknown) {
    return new Response(status === 204 ? null : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

const fetchMock = vi.fn();

beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GOOGLE_CLIENT_ID", "gid");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "gsecret");
    vi.stubEnv("MICROSOFT_CLIENT_ID", "mid");
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "msecret");
    vi.stubEnv("INTEGRATIONS_ENCRYPTION_KEY", KEY);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    fetchMock.mockReset();
    Object.values(repo).forEach((fn) => fn.mockReset());
});

describe("calendar API client — Google", () => {
    it("lists events in the window, expands recurrences, drops cancelled ones", async () => {
        const { listEvents } = await import("@/lib/integrations/calendar/api");
        fetchMock.mockResolvedValueOnce(
            json(200, {
                items: [
                    {
                        id: "e1",
                        summary: "Demo",
                        start: { dateTime: "2026-10-01T10:00:00+05:30" },
                        end: { dateTime: "2026-10-01T11:00:00+05:30" },
                        attendees: [{ email: "x@y.com", responseStatus: "accepted" }],
                    },
                    { id: "e2", summary: "Offsite", start: { date: "2026-10-02" }, end: { date: "2026-10-03" } },
                    { id: "e3", status: "cancelled" },
                ],
            })
        );

        const events = await listEvents("google", "tok", {
            calendarId: "primary",
            from: "2026-10-01T00:00:00.000Z",
            to: "2026-10-31T00:00:00.000Z",
            limit: 5,
        });

        const [url, init] = fetchMock.mock.calls[0];
        const u = new URL(url);
        expect(u.pathname).toBe("/calendar/v3/calendars/primary/events");
        expect(u.searchParams.get("singleEvents")).toBe("true");
        expect(u.searchParams.get("timeMin")).toBe("2026-10-01T00:00:00.000Z");
        expect(u.searchParams.get("maxResults")).toBe("5");
        expect(init.headers.Authorization).toBe("Bearer tok");

        expect(events).toHaveLength(2);
        expect(events[0]).toMatchObject({
            id: "e1",
            start: "2026-10-01T04:30:00.000Z",
            allDay: false,
            attendees: [{ email: "x@y.com", response: "accepted", name: null }],
        });
        expect(events[1]).toMatchObject({ allDay: true, start: "2026-10-02", end: "2026-10-03" });
    });

    it("maps the primary calendar to the neutral 'primary' id", async () => {
        const { listCalendars } = await import("@/lib/integrations/calendar/api");
        fetchMock.mockResolvedValueOnce(
            json(200, {
                items: [
                    { id: "me@gmail.com", summary: "me@gmail.com", primary: true, accessRole: "owner" },
                    { id: "holidays", summary: "Holidays", accessRole: "reader" },
                ],
            })
        );
        const calendars = await listCalendars("google", "tok");
        expect(calendars[0]).toMatchObject({ id: "primary", primary: true, canEdit: true });
        expect(calendars[1]).toMatchObject({ id: "holidays", canEdit: false });
    });

    it("builds create/patch bodies with only the fields given", async () => {
        const { toGoogleBody } = await import("@/lib/integrations/calendar/api");
        expect(
            toGoogleBody({
                title: "Call",
                start: "2026-10-01T09:00:00Z",
                end: "2026-10-01T09:30:00Z",
                timeZone: "Asia/Kolkata",
                attendees: ["a@b.com"],
            })
        ).toEqual({
            summary: "Call",
            start: { dateTime: "2026-10-01T09:00:00Z", timeZone: "Asia/Kolkata" },
            end: { dateTime: "2026-10-01T09:30:00Z", timeZone: "Asia/Kolkata" },
            attendees: [{ email: "a@b.com" }],
        });
        expect(toGoogleBody({ start: "2026-10-01", end: "2026-10-02" })).toEqual({
            start: { date: "2026-10-01" },
            end: { date: "2026-10-02" },
        });
    });
});

describe("calendar API client — Microsoft Graph", () => {
    it("reads calendarView in UTC and normalizes Graph's zone-less times", async () => {
        const { listEvents, GRAPH_READ_HEADERS } = await import("@/lib/integrations/calendar/api");
        fetchMock.mockResolvedValueOnce(
            json(200, {
                value: [
                    {
                        id: "m1",
                        subject: "Sync",
                        start: { dateTime: "2026-10-01T09:00:00.0000000", timeZone: "UTC" },
                        end: { dateTime: "2026-10-01T09:30:00.0000000", timeZone: "UTC" },
                        location: { displayName: "Room 1" },
                    },
                    { id: "m2", isCancelled: true },
                ],
            })
        );

        const events = await listEvents("outlook", "tok", {
            calendarId: "primary",
            from: "2026-10-01T00:00:00.000Z",
            to: "2026-10-02T00:00:00.000Z",
            limit: 10,
        });

        const [url, init] = fetchMock.mock.calls[0];
        expect(new URL(url).pathname).toBe("/v1.0/me/calendar/calendarView");
        expect(init.headers.Prefer).toBe(GRAPH_READ_HEADERS.Prefer);
        expect(events).toEqual([
            expect.objectContaining({
                id: "m1",
                start: "2026-10-01T09:00:00.000Z",
                end: "2026-10-01T09:30:00.000Z",
                location: "Room 1",
                allDay: false,
            }),
        ]);
    });

    it("writes times as UTC and flags all-day events", async () => {
        const { toGraphBody } = await import("@/lib/integrations/calendar/api");
        expect(toGraphBody({ start: "2026-10-01T10:00:00+05:30", end: "2026-10-01T11:00:00+05:30" })).toEqual({
            start: { dateTime: "2026-10-01T04:30:00.000", timeZone: "UTC" },
            end: { dateTime: "2026-10-01T05:30:00.000", timeZone: "UTC" },
            isAllDay: false,
        });
        expect(toGraphBody({ start: "2026-10-01", end: "2026-10-02" })).toMatchObject({ isAllDay: true });
    });

    it("updates and deletes by mailbox-wide event id", async () => {
        const { updateEvent, deleteEvent } = await import("@/lib/integrations/calendar/api");
        fetchMock.mockResolvedValueOnce(json(200, { id: "m1", subject: "Renamed" }));
        fetchMock.mockResolvedValueOnce(json(204, null));

        await updateEvent("microsoft365", "tok", "primary", "m1", { title: "Renamed" });
        await deleteEvent("microsoft365", "tok", "primary", "m1");

        expect(fetchMock.mock.calls[0][0]).toBe("https://graph.microsoft.com/v1.0/me/events/m1");
        expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
        expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
    });
});

describe("calendar API client — errors", () => {
    it.each([
        [401, "", "token_expired"],
        [403, "insufficientPermissions", "permission_denied"],
        [403, '{"reason":"rateLimitExceeded"}', "provider_api_failed"],
        [404, "", "not_found"],
        [400, "", "invalid_request"],
        [500, "", "provider_api_failed"],
    ])("maps HTTP %i to %s", async (status, body, code) => {
        const { listCalendars } = await import("@/lib/integrations/calendar/api");
        fetchMock.mockResolvedValueOnce(new Response(body, { status }));
        await expect(listCalendars("google", "tok")).rejects.toMatchObject({ code });
    });

    it("maps a network failure to provider_api_failed", async () => {
        const { listCalendars } = await import("@/lib/integrations/calendar/api");
        fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
        await expect(listCalendars("outlook", "tok")).rejects.toMatchObject({ code: "provider_api_failed" });
    });

    it("gives each code a sensible HTTP status on JSON routes", async () => {
        const { calendarApiError } = await import("@/lib/integrations/calendar/route-helpers");
        const { CalendarIntegrationError } = await import("@/lib/integrations/calendar/oauth");
        const status = (code: string) => calendarApiError(new CalendarIntegrationError(code as never)).statusCode;
        expect(status("not_connected")).toBe(409);
        expect(status("token_expired")).toBe(409);
        expect(status("not_found")).toBe(404);
        expect(status("provider_api_failed")).toBe(502);
        expect(status("database_unavailable")).toBe(503);
        expect(calendarApiError(new CalendarIntegrationError("not_found")).message).not.toMatch(/status|404/);
    });
});

describe("event input validation", () => {
    it("accepts timed and all-day events", async () => {
        const { CalendarEventInputSchema } = await import("@/models/calendar-integration");
        expect(
            CalendarEventInputSchema.safeParse({
                title: "Call",
                start: "2026-10-01T09:00:00Z",
                end: "2026-10-01T09:30:00+00:00",
            }).success
        ).toBe(true);
        expect(
            CalendarEventInputSchema.safeParse({ title: "Offsite", start: "2026-10-01", end: "2026-10-02" }).success
        ).toBe(true);
    });

    it("rejects zone-less times, mixed kinds, inverted ranges and bad emails", async () => {
        const { CalendarEventInputSchema } = await import("@/models/calendar-integration");
        const bad = [
            { title: "x", start: "2026-10-01T09:00:00", end: "2026-10-01T10:00:00" },
            { title: "x", start: "2026-10-01", end: "2026-10-01T10:00:00Z" },
            { title: "x", start: "2026-10-01T10:00:00Z", end: "2026-10-01T09:00:00Z" },
            { title: "x", start: "2026-10-01", end: "2026-10-02", attendees: ["not-an-email"] },
            { title: "  ", start: "2026-10-01", end: "2026-10-02" },
        ];
        for (const input of bad) expect(CalendarEventInputSchema.safeParse(input).success).toBe(false);
    });

    it("requires start and end to change together, and something to change", async () => {
        const { CalendarEventPatchSchema } = await import("@/models/calendar-integration");
        expect(CalendarEventPatchSchema.safeParse({ title: "Renamed" }).success).toBe(true);
        expect(CalendarEventPatchSchema.safeParse({ start: "2026-10-01T09:00:00Z" }).success).toBe(false);
        expect(CalendarEventPatchSchema.safeParse({}).success).toBe(false);
    });

    it("defaults the list window to the next 30 days and caps it at a year", async () => {
        const { CalendarEventListQuerySchema } = await import("@/models/calendar-integration");
        const q = CalendarEventListQuerySchema.parse({ from: "2026-10-01T00:00:00Z" });
        expect(q).toMatchObject({ calendarId: "primary", limit: 50, to: "2026-10-31T00:00:00.000Z" });
        expect(
            CalendarEventListQuerySchema.safeParse({ from: "2026-01-01T00:00:00Z", to: "2027-06-01T00:00:00Z" })
                .success
        ).toBe(false);
    });
});

describe("CalendarIntegrationService token handling", () => {
    async function row(overrides: Record<string, unknown> = {}) {
        const { encryptSecret } = await import("@/lib/integrations/token-crypto");
        return {
            id: "conn-1",
            workspaceId: "ws-1",
            userId: "user-1",
            provider: "google",
            accessTokenEnc: encryptSecret("old-access", KEY),
            refreshTokenEnc: encryptSecret("refresh-1", KEY),
            tokenExpiresAt: new Date(Date.now() + 30 * 60_000),
            ...overrides,
        };
    }

    it("only ever looks up the caller's own connection", async () => {
        const { CalendarIntegrationService } = await import("@/services/calendar-integration.service");
        repo.find.mockResolvedValueOnce(null);
        await expect(CalendarIntegrationService.listCalendars(TENANT, "google")).rejects.toMatchObject({
            code: "not_connected",
        });
        expect(repo.find).toHaveBeenCalledWith("ws-1", "user-1", "google");
    });

    it("uses the stored token while it is valid, without writing", async () => {
        const { CalendarIntegrationService } = await import("@/services/calendar-integration.service");
        repo.find.mockResolvedValueOnce(await row());
        fetchMock.mockResolvedValueOnce(json(200, { items: [] }));

        await CalendarIntegrationService.listCalendars(TENANT, "google");
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer old-access");
        expect(repo.update).not.toHaveBeenCalled();
    });

    it("refreshes an expired token first and stores the new one encrypted", async () => {
        const { CalendarIntegrationService } = await import("@/services/calendar-integration.service");
        const { decryptSecret } = await import("@/lib/integrations/token-crypto");
        repo.find.mockResolvedValueOnce(await row({ tokenExpiresAt: new Date(Date.now() - 1000) }));
        repo.update.mockResolvedValue({});
        fetchMock
            .mockResolvedValueOnce(json(200, { access_token: "new-access", expires_in: 3600 }))
            .mockResolvedValueOnce(json(200, { items: [] }));

        await CalendarIntegrationService.listCalendars(TENANT, "google");

        expect(fetchMock.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
        expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer new-access");
        const saved = repo.update.mock.calls[0][1];
        expect(saved.accessTokenEnc).not.toContain("new-access");
        expect(decryptSecret(saved.accessTokenEnc, KEY)).toBe("new-access");
    });

    it("retries once with a forced refresh when the provider answers 401", async () => {
        const { CalendarIntegrationService } = await import("@/services/calendar-integration.service");
        repo.find.mockResolvedValueOnce(await row());
        repo.update.mockResolvedValue({});
        fetchMock
            .mockResolvedValueOnce(new Response("", { status: 401 }))
            .mockResolvedValueOnce(json(200, { access_token: "new-access", expires_in: 3600 }))
            .mockResolvedValueOnce(json(200, { items: [{ id: "c", summary: "C", accessRole: "owner" }] }));

        const calendars = await CalendarIntegrationService.listCalendars(TENANT, "google");
        expect(calendars).toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("marks the connection expired when the refresh token was revoked", async () => {
        const { CalendarIntegrationService } = await import("@/services/calendar-integration.service");
        repo.find.mockResolvedValueOnce(await row({ tokenExpiresAt: new Date(0) }));
        repo.update.mockResolvedValue({});
        fetchMock.mockResolvedValueOnce(json(400, { error: "invalid_grant" }));

        await expect(CalendarIntegrationService.listCalendars(TENANT, "google")).rejects.toMatchObject({
            code: "token_expired",
        });
        expect(repo.update).toHaveBeenCalledWith("conn-1", expect.objectContaining({ status: "expired" }));
    });

    it("does not mark the connection broken for a missing event", async () => {
        const { CalendarIntegrationService } = await import("@/services/calendar-integration.service");
        repo.find.mockResolvedValueOnce(await row());
        fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));

        await expect(
            CalendarIntegrationService.deleteEvent(TENANT, "google", "primary", "gone")
        ).rejects.toMatchObject({ code: "not_found" });
        expect(repo.update).not.toHaveBeenCalled();
    });

    it("reports a missing table and an unreachable database differently", async () => {
        const { CalendarIntegrationService } = await import("@/services/calendar-integration.service");
        repo.listForUser.mockRejectedValueOnce(Object.assign(new Error("no table"), { code: "P2021" }));
        const notMigrated = await CalendarIntegrationService.status(TENANT);
        expect(notMigrated.storageError).toMatch(/migration/);

        repo.listForUser.mockRejectedValueOnce(
            Object.assign(new Error("Can't reach database server"), {
                name: "PrismaClientInitializationError",
                errorCode: "P1001",
            })
        );
        const down = await CalendarIntegrationService.status(TENANT);
        expect(down.storageError).toMatch(/can't be reached/);
    });

    it("never returns tokens in the status response", async () => {
        const { CalendarIntegrationService } = await import("@/services/calendar-integration.service");
        repo.listForUser.mockResolvedValueOnce([
            {
                ...(await row()),
                category: "calendar",
                accountEmail: "me@gmail.com",
                status: "connected",
                lastError: null,
                connectedAt: new Date(),
                lastCheckedAt: null,
            },
        ]);
        const status = await CalendarIntegrationService.status(TENANT);
        const serialized = JSON.stringify(status);
        expect(serialized).not.toMatch(/accessTokenEnc|refreshTokenEnc|v1\./);
        expect(status.providers.every((p) => p.configured)).toBe(true);
    });
});
