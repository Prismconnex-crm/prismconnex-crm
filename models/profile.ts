import { z } from "zod";

/**
 * Profile of a Supabase Auth user (public.profiles).
 *
 * `id` is the Supabase Auth user id (auth.users.id). Passwords are not
 * represented here at any layer — they live only in Supabase Auth.
 */
export const ProfileSchema = z.object({
    id: z.uuid(),
    firstName: z.string().min(1),
    middleName: z.string().nullable(),
    lastName: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    createdAt: z.date(),
});

/** Input for the OAuth fallback path in ProfileService.ensureProfile(). */
export const UpsertProfileSchema = z.object({
    id: z.uuid(),
    firstName: z.string().min(1),
    middleName: z.string().nullable().optional(),
    lastName: z.string().default(""),
    email: z.string(),
    phone: z.string().nullable().optional(),
});

export const UpdateProfileSchema = z.object({
    firstName: z.string().min(1).optional(),
    middleName: z.string().nullable().optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().nullable().optional(),
});

export type ProfileDTO = z.infer<typeof ProfileSchema>;
export type UpsertProfileDTO = z.infer<typeof UpsertProfileSchema>;
export type UpdateProfileDTO = z.infer<typeof UpdateProfileSchema>;

/**
 * Derives first/middle/last from provider metadata.
 *
 * The `on_auth_user_created` trigger already does this in SQL for every signup
 * path; this mirrors it for the OAuth fallback in ensureProfile(), where we may
 * need to construct a profile from a session's user_metadata in app code.
 * Google and Microsoft send given_name/family_name or a single full_name/name —
 * never the discrete fields our own form posts.
 */
export function deriveNamesFromMetadata(
    metadata: Record<string, unknown> | null | undefined,
    email: string | null | undefined
) {
    const meta = metadata ?? {};
    const str = (key: string) => {
        const value = meta[key];
        return typeof value === "string" && value.trim() ? value.trim() : undefined;
    };

    let firstName = str("first_name") ?? str("given_name");
    let lastName = str("last_name") ?? str("family_name");
    let middleName = str("middle_name");

    const full = str("full_name") ?? str("name");
    if (full && (!firstName || !lastName)) {
        const parts = full.replace(/\s+/g, " ").split(" ");
        firstName ??= parts[0];
        if (!lastName && parts.length > 1) lastName = parts[parts.length - 1];
        if (!middleName && parts.length > 2) middleName = parts.slice(1, -1).join(" ");
    }

    return {
        firstName: firstName ?? (email ? email.split("@")[0] : "User"),
        middleName: middleName ?? null,
        lastName: lastName ?? "",
        phone: str("phone") ?? null,
    };
}
