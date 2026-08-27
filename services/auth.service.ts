import * as gotrue from "@/lib/supabase/gotrue";
import type { OAuthProviderKey, SupabaseSession } from "@/lib/supabase/gotrue";
import { ProfileService } from "@/services/profile.service";
import { BadRequestError, UnauthorizedError } from "@/lib/http/errors";
import type { ProfileDTO } from "@/models/profile";

/**
 * Authentication against Supabase Auth.
 *
 * Passwords are only ever sent to Supabase and stored in
 * auth.users.encrypted_password. Nothing password-related is persisted in our
 * own Postgres tables.
 *
 * Replaces the previous AWS Cognito implementation. The class and method names
 * are unchanged so the API routes that import it keep working; the legacy
 * Cognito helpers in lib/auth/cognito.ts remain but are no longer called.
 */

export type SignUpParams = {
    email: string;
    password: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    phone?: string;
};

export type AuthResult = {
    session: SupabaseSession;
    profile: ProfileDTO;
};

/**
 * Which sessions a sign-out ends. Mirrors GoTrue's `?scope=` parameter, and is
 * the type the /api/auth/sign-out route validates the request body against.
 */
export type SignOutScope = "local" | "global";

export function isSignOutScope(value: unknown): value is SignOutScope {
    return value === "local" || value === "global";
}

export class AuthService {
    /**
     * Creates the user in Supabase Auth and returns the profile row that the
     * on_auth_user_created trigger produced from the metadata below.
     *
     * `emailConfirmationRequired` is true when Supabase returned no session,
     * which is how the project's email-confirmation setting is detected at
     * runtime rather than hard-coded — the caller uses it to decide between
     * sending the user to /auth/verify and signing them straight in.
     */
    static async signUp(params: SignUpParams) {
        const { user, session } = await gotrue.signUp(params.email, params.password, {
            first_name: params.firstName,
            middle_name: params.middleName,
            last_name: params.lastName,
            phone: params.phone,
        });

        // The trigger has already committed the profile alongside the auth user.
        // ensureProfile() is the fallback if the trigger is ever missing.
        const profile = await ProfileService.ensureProfile(user);

        return {
            userId: user.id,
            profile,
            session,
            emailConfirmationRequired: session === null,
        };
    }

    /** Confirms a signup with the emailed OTP, then loads the profile. */
    static async verify(email: string, code: string): Promise<AuthResult> {
        const session = await gotrue.verifySignUpOtp(email, code);
        const profile = await ProfileService.ensureProfileForSession(session.user);
        return { session, profile };
    }

    /**
     * Verifies credentials against Supabase Auth and loads the profile.
     *
     * `identifier` may be an email address or an Indian mobile number; the
     * latter is resolved to an email via the profiles table first, because
     * Supabase's password grant only accepts email.
     */
    static async signIn(identifier: string, password: string): Promise<AuthResult> {
        const email = await ProfileService.resolveIdentifierToEmail(identifier);

        // Deliberately the same message as a wrong password: distinguishing
        // "no such account" from "wrong password" enables account enumeration.
        if (!email) throw new UnauthorizedError("Invalid email or password");

        const session = await gotrue.signInWithPassword(email, password);
        const profile = await ProfileService.ensureProfileForSession(session.user);

        return { session, profile };
    }

    /** Builds the provider redirect for Google/Microsoft sign-in. */
    static startOAuth(provider: OAuthProviderKey, redirectTo: string) {
        const codeVerifier = gotrue.createCodeVerifier();
        const authorizeUrl = gotrue.buildAuthorizeUrl({
            provider,
            redirectTo,
            codeChallenge: gotrue.createCodeChallenge(codeVerifier),
        });

        return { authorizeUrl, codeVerifier };
    }

    /**
     * Completes Google/Microsoft sign-in.
     *
     * ensureProfile() is what satisfies "OAuth login also creates a profile if
     * one doesn't already exist" from the application side; the trigger on
     * auth.users normally gets there first, and an existing profile is left
     * untouched either way.
     */
    static async completeOAuth(authCode: string, codeVerifier: string): Promise<AuthResult> {
        const session = await gotrue.exchangeCodeForSession(authCode, codeVerifier);
        const profile = await ProfileService.ensureProfileForSession(session.user);
        return { session, profile };
    }

    /**
     * Revokes the Supabase session — `supabase.auth.signOut()` server-side.
     *
     * The stored access token is usually expired by logout time (Supabase issues
     * them for one hour; our app session lasts eight), and Supabase's logout
     * endpoint rejects an expired token. So the refresh token is exchanged for a
     * fresh access token first, then that is used to revoke.
     *
     * `scope` selects WHICH sessions die, and maps 1:1 onto GoTrue's
     * POST /logout?scope= — the wire form of `supabase.auth.signOut({ scope })`:
     *
     *   "local"  — only the refresh token behind this browser's session. Other
     *              devices stay signed in.
     *   "global" — every refresh token the user holds, on every device. This is
     *              supabase-js's own default and stays the default here so the
     *              behaviour of callers that pass nothing is unchanged.
     *
     * Note the refresh above is scope-safe: GoTrue's refresh_token grant rotates
     * the token inside the SAME session, so revoking with the refreshed access
     * token still targets the session the user is actually sitting in.
     *
     * Returns whether revocation happened. A false return is not an error: it
     * means the Supabase session was already gone, which is the desired end
     * state anyway. The caller clears cookies regardless.
     */
    static async signOut(
        tokens: { access_token: string; refresh_token: string },
        scope: SignOutScope = "global"
    ) {
        try {
            const refreshed = await gotrue.refreshSession(tokens.refresh_token);
            await gotrue.signOut(refreshed.access_token, scope);
            return true;
        } catch {
            // The refresh token was already revoked or expired — nothing to do.
        }

        try {
            // Fall back to the stored access token in case it is still valid
            // (logout within the first hour, or refresh being unavailable).
            await gotrue.signOut(tokens.access_token, scope);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Sends the "reset your password" email.
     *
     * `redirectTo` must be an absolute URL that is listed under Authentication →
     * URL Configuration → Redirect URLs in the Supabase dashboard. Supabase
     * silently substitutes the project's Site URL for anything not on that list,
     * which surfaces as a reset link that drops the user on the wrong page —
     * so the caller passes an explicit URL built from APP_URL.
     */
    static async requestPasswordReset(email: string, redirectTo?: string) {
        await gotrue.sendRecoveryEmail(email, redirectTo);
    }

    static async resetPassword(email: string, code: string, newPassword: string) {
        const session = await gotrue.verifyRecoveryOtp(email, code);
        await gotrue.updatePassword(session.access_token, newPassword);
        return session;
    }

    /**
     * Completes a reset from the emailed link.
     *
     * Accepts any of the link shapes described in lib/auth/recovery-link.ts:
     *   - `tokenHash`   — not yet verified, so exchange it for a session first.
     *   - `accessToken` — GoTrue already verified the link and handed us the
     *                     session in the redirect fragment; use it directly.
     *   - `code`        — PKCE authorization code, exchanged at /token.
     *
     * All end at the same place: PUT /auth/v1/user with the new password, which
     * is what `supabase.auth.updateUser({ password })` does on the wire. The
     * password is only ever stored by Supabase, never in our Postgres.
     */
    static async resetPasswordFromLink(
        token: { tokenHash?: string; accessToken?: string; code?: string },
        newPassword: string
    ) {
        const accessToken = token.tokenHash
            ? (await this.exchangeRecoveryToken(token.tokenHash)).access_token
            : token.code
              ? (await this.exchangeRecoveryCode(token.code)).access_token
              : token.accessToken;

        if (!accessToken) {
            throw new UnauthorizedError(
                "This password reset link is invalid. Please request a new one."
            );
        }

        try {
            await gotrue.updatePassword(accessToken, newPassword);
        } catch (error) {
            // A stale fragment (link opened long after it was issued, or the
            // page left sitting open) fails here rather than at verify time.
            throw AuthService.asRecoveryError(error);
        }
    }

    /**
     * Wraps the token exchange so an expired link reads as an expired link.
     *
     * gotrue.request() maps every 401 to "Invalid email or password" because
     * that is the right message on the sign-in path, which is the only caller it
     * was written for. On a reset page that text is actively misleading — the
     * user is not entering a password at that point — so it is translated here
     * instead of changing the shared helper and disturbing sign-in.
     */
    private static async exchangeRecoveryToken(tokenHash: string) {
        try {
            return await gotrue.verifyRecoveryTokenHash(tokenHash);
        } catch (error) {
            throw AuthService.asRecoveryError(error);
        }
    }

    /**
     * Exchanges a PKCE `?code=` from a recovery link for a session.
     *
     * This app asks for the recovery email over the REST API without sending a
     * `code_challenge`, so GoTrue answers with the implicit shapes (fragment
     * tokens, or `token_hash` when the template emits `{{ .TokenHash }}`) and a
     * `code` should not normally arrive. It can if the project is reconfigured
     * to the PKCE flow, and before this branch existed such a link parsed as
     * "no token at all" and rendered as "Invalid reset link" — the failure this
     * whole path was added to stop.
     *
     * The exchange is attempted with an empty verifier because we never issued a
     * challenge to match. GoTrue rejects that when the code genuinely was
     * PKCE-issued, so the message below is what the user sees: it names the
     * mismatch instead of blaming the link, which is the actionable difference.
     */
    private static async exchangeRecoveryCode(code: string) {
        try {
            return await gotrue.exchangeCodeForSession(code, "");
        } catch {
            throw new UnauthorizedError(
                "This reset link uses the PKCE flow, which this app did not start. " +
                    "Set the recovery email template to {{ .TokenHash }} " +
                    "(or {{ .ConfirmationURL }}) and request a new link."
            );
        }
    }

    private static asRecoveryError(error: unknown) {
        if (error instanceof UnauthorizedError || error instanceof BadRequestError) {
            return new UnauthorizedError(
                "This password reset link has expired or has already been used. " +
                    "Please request a new one."
            );
        }
        return error;
    }
}
