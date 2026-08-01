import * as gotrue from "@/lib/supabase/gotrue";
import type { OAuthProviderKey, SupabaseSession } from "@/lib/supabase/gotrue";
import { ProfileService } from "@/services/profile.service";
import { UnauthorizedError } from "@/lib/http/errors";
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
     * Returns whether revocation happened. A false return is not an error: it
     * means the Supabase session was already gone, which is the desired end
     * state anyway. The caller clears cookies regardless.
     */
    static async signOut(tokens: { access_token: string; refresh_token: string }) {
        try {
            const refreshed = await gotrue.refreshSession(tokens.refresh_token);
            await gotrue.signOut(refreshed.access_token, "global");
            return true;
        } catch {
            // The refresh token was already revoked or expired — nothing to do.
        }

        try {
            // Fall back to the stored access token in case it is still valid
            // (logout within the first hour, or refresh being unavailable).
            await gotrue.signOut(tokens.access_token, "global");
            return true;
        } catch {
            return false;
        }
    }

    static async requestPasswordReset(email: string, redirectTo?: string) {
        await gotrue.sendRecoveryEmail(email, redirectTo);
    }

    static async resetPassword(email: string, code: string, newPassword: string) {
        const session = await gotrue.verifyRecoveryOtp(email, code);
        await gotrue.updatePassword(session.access_token, newPassword);
        return session;
    }
}
