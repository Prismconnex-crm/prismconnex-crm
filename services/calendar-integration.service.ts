import type { TenantContext } from "@/lib/auth/tenant";
import { AuditService } from "@/lib/audit/audit.service";
import { encryptSecret, decryptSecret } from "@/lib/integrations/token-crypto";
import { calendarErrorMessage } from "@/lib/integrations/calendar/errors";
import {
    CALENDAR_PROVIDERS,
    CALENDAR_PROVIDER_META,
    hasCalendarScope,
    missingCalendarEnv,
    readIdTokenClaims,
    type CalendarProvider,
} from "@/lib/integrations/calendar/providers";
import {
    CalendarIntegrationError,
    calendarCredentials,
    exchangeCode,
    refreshAccessToken,
    revokeToken,
    verifyCalendarAccess,
} from "@/lib/integrations/calendar/oauth";
import * as CalendarApi from "@/lib/integrations/calendar/api";
import { classifyDbConnectionError } from "@/lib/db/connection-errors";
import { IntegrationConnectionRepository } from "@/repositories/integration-connection.repository";
import type {
    CalendarConnectionDTO,
    CalendarEventInput,
    CalendarEventPatch,
    CalendarStatusResponse,
} from "@/models/calendar-integration";

const CATEGORY = "calendar";

/**
 * Turns a Prisma failure into a calendar error code: P2021 = the table does not
 * exist (migration not applied); a connection failure (P1001, pool timeout …)
 * = database unreachable; anything else is a generic save failure. Matched by
 * shape so this file does not import @prisma/client.
 */
function asDbError(error: unknown): CalendarIntegrationError {
    if (error instanceof CalendarIntegrationError) return error;
    const code = (error as { code?: string })?.code;
    const connection = classifyDbConnectionError(error);
    console.error("[calendar] database error", {
        prismaCode: connection?.code ?? code,
        message: (error as Error)?.message,
        hint: connection?.hint,
    });
    if (code === "P2021") return new CalendarIntegrationError("database_not_ready", code);
    if (connection) return new CalendarIntegrationError("database_unavailable", connection.code ?? undefined);
    return new CalendarIntegrationError("database_failed", code);
}

async function db<T>(op: () => Promise<T>): Promise<T> {
    try {
        return await op();
    } catch (error) {
        throw asDbError(error);
    }
}

function toDTO(row: {
    provider: string;
    accountEmail: string | null;
    status: string;
    lastError: string | null;
    connectedAt: Date;
    lastCheckedAt: Date | null;
}): CalendarConnectionDTO {
    return {
        provider: row.provider as CalendarProvider,
        accountEmail: row.accountEmail,
        status: row.status as CalendarConnectionDTO["status"],
        lastError: row.lastError,
        connectedAt: row.connectedAt.toISOString(),
        lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    };
}

function expiryFrom(expiresIn: number | undefined) {
    return expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
}

type ConnectionRow = NonNullable<Awaited<ReturnType<typeof IntegrationConnectionRepository.find>>>;
type RowUpdates = Parameters<typeof IntegrationConnectionRepository.update>[1];

/** Refreshes when the stored access token expires within this window. */
const EXPIRY_SKEW_MS = 60_000;

async function refreshedToken(row: ConnectionRow, provider: CalendarProvider, key: string, updates: RowUpdates) {
    if (!row.refreshTokenEnc) throw new CalendarIntegrationError("token_expired", "no refresh token");
    let refreshToken: string;
    try {
        refreshToken = decryptSecret(row.refreshTokenEnc, key);
    } catch {
        // INTEGRATIONS_ENCRYPTION_KEY changed since the token was stored.
        console.error("[calendar] refresh token could not be decrypted", { provider, connectionId: row.id });
        throw new CalendarIntegrationError("token_expired", "refresh token undecryptable");
    }

    const refreshed = await refreshAccessToken(provider, refreshToken);
    updates.accessTokenEnc = encryptSecret(refreshed.access_token, key);
    updates.tokenExpiresAt = expiryFrom(refreshed.expires_in);
    if (refreshed.refresh_token) updates.refreshTokenEnc = encryptSecret(refreshed.refresh_token, key);
    return refreshed.access_token;
}

async function storedOrRefreshedToken(row: ConnectionRow, provider: CalendarProvider, key: string, updates: RowUpdates) {
    const expired = !row.tokenExpiresAt || row.tokenExpiresAt.getTime() < Date.now() + EXPIRY_SKEW_MS;
    if (expired) return refreshedToken(row, provider, key, updates);
    try {
        return decryptSecret(row.accessTokenEnc, key);
    } catch {
        console.error("[calendar] access token could not be decrypted; refreshing", { provider, connectionId: row.id });
        return refreshedToken(row, provider, key, updates);
    }
}

export class CalendarIntegrationService {
    /** Provider list, configuration state and this user's connections. Never tokens. */
    static async status(tenant: TenantContext): Promise<CalendarStatusResponse> {
        const providers = CALENDAR_PROVIDERS.map((provider) => ({
            provider,
            ...CALENDAR_PROVIDER_META[provider],
            configured: missingCalendarEnv(provider).length === 0,
            missingEnv: missingCalendarEnv(provider),
        }));

        try {
            const rows = await IntegrationConnectionRepository.listForUser(
                tenant.workspaceId,
                tenant.userId,
                CATEGORY
            );
            return { providers, connections: rows.map(toDTO), storageError: null };
        } catch (error) {
            // Still render the provider picker; say why connections can't load.
            const dbError = asDbError(error);
            return { providers, connections: [], storageError: calendarErrorMessage(dbError.code) };
        }
    }

    static assertStorageReady() {
        return db(() => IntegrationConnectionRepository.assertReady());
    }

    /**
     * Finishes the OAuth flow. Saves a connection only after the code exchange
     * succeeded, calendar scope was granted and a real calendar API call worked.
     */
    static async completeConnection(
        tenant: TenantContext,
        params: { provider: CalendarProvider; code: string; verifier: string; redirectUri: string }
    ) {
        const { encryptionKey } = calendarCredentials(params.provider);
        const tokens = await exchangeCode(params);

        // Google omits `scope` only if nothing changed; Microsoft always sends it.
        if (tokens.scope !== undefined && !hasCalendarScope(params.provider, tokens.scope)) {
            throw new CalendarIntegrationError("permission_denied", "calendar scope not granted");
        }

        const { ownerEmail } = await verifyCalendarAccess(params.provider, tokens.access_token);
        const claims = readIdTokenClaims(tokens.id_token);
        const accountEmail = claims.email ?? claims.preferred_username ?? ownerEmail ?? null;

        // A Google reconnect without a new refresh token keeps the old one.
        const existing = await db(() =>
            IntegrationConnectionRepository.find(tenant.workspaceId, tenant.userId, params.provider)
        );

        const row = await db(() =>
            IntegrationConnectionRepository.upsert({
                workspaceId: tenant.workspaceId,
                userId: tenant.userId,
                category: CATEGORY,
                provider: params.provider,
                accountEmail,
                scopes: tokens.scope ?? "",
                accessTokenEnc: encryptSecret(tokens.access_token, encryptionKey),
                refreshTokenEnc: tokens.refresh_token
                    ? encryptSecret(tokens.refresh_token, encryptionKey)
                    : existing?.refreshTokenEnc ?? null,
                tokenExpiresAt: expiryFrom(tokens.expires_in),
            })
        );

        await AuditService.log(tenant.workspaceId, tenant.userId, "IntegrationConnection", row.id, `calendar.connect.${params.provider}`).catch(
            (error) => console.warn("[calendar] audit log failed (ignored)", String(error))
        );

        return toDTO(row);
    }

    /**
     * Runs `call` with a valid access token for the caller's own connection:
     * decrypts the stored token, refreshes it when expired, and retries once
     * with a forced refresh if the provider still answers 401. New tokens are
     * re-encrypted and saved. A revoked grant or missing consent marks the
     * connection so the page offers Reconnect.
     *
     * `markAnyFailure` (the explicit health check) records every failure on the
     * row; ordinary calendar calls only record ones that mean the connection
     * itself is broken — a 404 on one event says nothing about the connection.
     */
    private static async withAccessToken<T>(
        tenant: TenantContext,
        provider: CalendarProvider,
        call: (accessToken: string) => Promise<T>,
        options: { markAnyFailure?: boolean } = {}
    ): Promise<{ result: T; row: ConnectionRow }> {
        const row = await db(() =>
            IntegrationConnectionRepository.find(tenant.workspaceId, tenant.userId, provider)
        );
        if (!row) throw new CalendarIntegrationError("not_connected", provider);

        const { encryptionKey } = calendarCredentials(provider);
        const updates: RowUpdates = {};

        try {
            let accessToken = await storedOrRefreshedToken(row, provider, encryptionKey, updates);
            let result: T;
            try {
                result = await call(accessToken);
            } catch (error) {
                const alreadyRefreshed = updates.accessTokenEnc !== undefined;
                if (!(error instanceof CalendarIntegrationError) || error.code !== "token_expired" || alreadyRefreshed) {
                    throw error;
                }
                // Access token revoked or expired early: one forced refresh, one retry.
                accessToken = await refreshedToken(row, provider, encryptionKey, updates);
                result = await call(accessToken);
            }

            if (Object.keys(updates).length) {
                await db(() => IntegrationConnectionRepository.update(row.id, updates));
            }
            return { result, row };
        } catch (error) {
            const failure = error instanceof CalendarIntegrationError ? error : asDbError(error);
            const breaksConnection = failure.code === "token_expired" || failure.code === "permission_denied";
            const isDb = failure.code.startsWith("database_");
            if (!isDb && (breaksConnection || options.markAnyFailure)) {
                await IntegrationConnectionRepository.update(row.id, {
                    status: failure.code === "token_expired" ? "expired" : "error",
                    lastError: calendarErrorMessage(failure.code),
                    lastCheckedAt: new Date(),
                }).catch(() => undefined);
            }
            throw failure;
        }
    }

    /**
     * Re-checks a connection against the provider, refreshing the access token
     * when it has expired. Records the outcome so the page shows the truth.
     */
    static async check(tenant: TenantContext, provider: CalendarProvider) {
        const { row } = await this.withAccessToken(
            tenant,
            provider,
            (token) => verifyCalendarAccess(provider, token),
            { markAnyFailure: true }
        );
        const saved = await db(() =>
            IntegrationConnectionRepository.update(row.id, {
                status: "connected",
                lastError: null,
                lastCheckedAt: new Date(),
            })
        );
        return toDTO(saved);
    }

    static async listCalendars(tenant: TenantContext, provider: CalendarProvider) {
        return (await this.withAccessToken(tenant, provider, (t) => CalendarApi.listCalendars(provider, t))).result;
    }

    static async listEvents(
        tenant: TenantContext,
        provider: CalendarProvider,
        query: { calendarId: string; from: string; to: string; limit: number }
    ) {
        return (await this.withAccessToken(tenant, provider, (t) => CalendarApi.listEvents(provider, t, query))).result;
    }

    static async createEvent(
        tenant: TenantContext,
        provider: CalendarProvider,
        calendarId: string,
        input: CalendarEventInput
    ) {
        const { result, row } = await this.withAccessToken(tenant, provider, (t) =>
            CalendarApi.createEvent(provider, t, calendarId, input)
        );
        await this.audit(tenant, row.id, `calendar.event.create.${provider}`);
        return result;
    }

    static async updateEvent(
        tenant: TenantContext,
        provider: CalendarProvider,
        calendarId: string,
        eventId: string,
        patch: CalendarEventPatch
    ) {
        const { result, row } = await this.withAccessToken(tenant, provider, (t) =>
            CalendarApi.updateEvent(provider, t, calendarId, eventId, patch)
        );
        await this.audit(tenant, row.id, `calendar.event.update.${provider}`);
        return result;
    }

    static async deleteEvent(tenant: TenantContext, provider: CalendarProvider, calendarId: string, eventId: string) {
        const { row } = await this.withAccessToken(tenant, provider, (t) =>
            CalendarApi.deleteEvent(provider, t, calendarId, eventId)
        );
        await this.audit(tenant, row.id, `calendar.event.delete.${provider}`);
    }

    private static audit(tenant: TenantContext, connectionId: string, action: string) {
        return AuditService.log(tenant.workspaceId, tenant.userId, "IntegrationConnection", connectionId, action).catch(
            (error) => console.warn("[calendar] audit log failed (ignored)", String(error))
        );
    }

    static async disconnect(tenant: TenantContext, provider: CalendarProvider) {
        const row = await db(() =>
            IntegrationConnectionRepository.find(tenant.workspaceId, tenant.userId, provider)
        );
        if (!row) return;

        const key = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim();
        if (key && row.refreshTokenEnc) {
            try {
                await revokeToken(provider, decryptSecret(row.refreshTokenEnc, key));
            } catch {
                // Undecryptable token: nothing to revoke, still delete the row.
            }
        }

        await db(() => IntegrationConnectionRepository.delete(row.id));
        await AuditService.log(tenant.workspaceId, tenant.userId, "IntegrationConnection", row.id, `calendar.disconnect.${provider}`).catch(
            (error) => console.warn("[calendar] audit log failed (ignored)", String(error))
        );
    }
}
