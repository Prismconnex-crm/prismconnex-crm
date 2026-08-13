/**
 * Step-by-step tracing for the password reset flow.
 *
 * The flow spans four hops — browser -> our API -> Supabase GoTrue -> SMTP —
 * and the failure that actually blocked it (a 429 from Supabase's built-in
 * mailer) was invisible from the UI, because /api/auth/forgot-password answers
 * "check your inbox" even when the send fails. That silence is deliberate
 * (see the enumeration note in that route) but it makes the flow undebuggable,
 * so every step is traced here instead.
 *
 * Enabled outside production, or anywhere with AUTH_DEBUG=1. Never enabled by
 * accident in production, where the log would carry email addresses.
 */

const enabled = () => process.env.AUTH_DEBUG === "1" || process.env.NODE_ENV !== "production";

/** Shows enough of an address to recognise it without logging it in full. */
export function maskEmail(email: string) {
    const [local = "", domain = ""] = email.split("@");
    const head = local.slice(0, 2);
    return `${head}${"*".repeat(Math.max(local.length - 2, 0))}@${domain}`;
}

/** Truncates a token to a recognisable prefix — never log a usable credential. */
export function maskToken(token: string | undefined | null) {
    if (!token) return "<none>";
    return `${token.slice(0, 6)}…(${token.length} chars)`;
}

export function authDebug(step: string, data?: Record<string, unknown>) {
    if (!enabled()) return;

    if (data === undefined) {
        console.log(`[auth:reset] ${step}`);
        return;
    }
    console.log(`[auth:reset] ${step}`, data);
}

/**
 * Logs a failure with everything needed to place it in the chain, including the
 * raw GoTrue body when one survived (ApiError.details carries it — see
 * lib/supabase/gotrue.ts).
 */
export function authDebugError(step: string, error: unknown) {
    if (!enabled()) return;

    const info: Record<string, unknown> = { step };

    if (error && typeof error === "object") {
        const e = error as { message?: string; statusCode?: number; details?: unknown };
        info.message = e.message;
        info.statusCode = e.statusCode;
        if (e.details !== undefined) info.supabaseResponse = e.details;
    } else {
        info.error = error;
    }

    console.error(`[auth:reset] FAILED at ${step}`, info);
}

/**
 * True when the caller may include the underlying Supabase error in an HTTP
 * response. Production keeps the generic answer so the endpoint cannot be used
 * to discover which addresses have accounts.
 */
export function canExposeAuthErrors() {
    return process.env.NODE_ENV !== "production";
}
