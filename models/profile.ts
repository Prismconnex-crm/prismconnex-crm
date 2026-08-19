import { z } from "zod";
import { isEmail, isIndianPhone } from "@/models/auth";

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

    // ─── Profile page fields ──────────────────────────────────────────
    avatarUrl: z.string().nullable(),
    username: z.string().nullable(),

    alternatePhone: z.string().nullable(),
    dateOfBirth: z.date().nullable(),
    addressLine: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    country: z.string().nullable(),
    postalCode: z.string().nullable(),

    employeeId: z.string().nullable(),
    department: z.string().nullable(),
    designation: z.string().nullable(),
    reportingManager: z.string().nullable(),
    team: z.string().nullable(),
    joiningDate: z.date().nullable(),
    skills: z.array(z.string()),

    accountStatus: z.string(),
    lastLoginAt: z.date().nullable(),
    deactivatedAt: z.date().nullable(),
    deletedAt: z.date().nullable(),

    language: z.string(),
    timeZone: z.string(),
    dateFormat: z.string(),
    currency: z.string(),
    theme: z.string(),

    notifyEmail: z.boolean(),
    notifySms: z.boolean(),
    notifyPush: z.boolean(),
    notifyNewLead: z.boolean(),
    notifyNewCustomer: z.boolean(),
    notifyDeal: z.boolean(),
    notifyTask: z.boolean(),
    notifySystem: z.boolean(),

    updatedAt: z.date(),
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

// ─── Profile page input schemas ──────────────────────────────────────
//
// One schema per card, rather than one big partial. Each PATCH carries exactly
// the fields its card owns, so a bug in the Preferences form can never blank a
// personal-information field, and a validation message always names something
// the user can actually see on screen.

/**
 * Optional free-text field.
 *
 * Trims, and maps "" to null so a cleared input becomes SQL NULL rather than an
 * empty string — otherwise `city IS NULL` and `city = ''` both mean "unset" and
 * every read has to test for two things.
 */
const optionalText = (max: number) =>
    z
        .string()
        .trim()
        .max(max, `Must be ${max} characters or fewer`)
        .transform((value) => (value === "" ? null : value))
        .nullable()
        .optional();

const optionalPhone = z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine((value) => value === null || value === undefined || isIndianPhone(value), {
        message: "Enter a valid 10-digit Indian mobile number",
    });

/**
 * `YYYY-MM-DD` from a native <input type="date">, or null when cleared.
 *
 * Kept as a string at the boundary and converted to a Date in the service:
 * `new Date("1990-05-04")` parses as UTC midnight, so building it here and
 * letting it round-trip through a local-time formatter is how a birthday
 * silently becomes the 3rd for anyone west of UTC.
 */
const optionalDateString = z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .refine(
        (value) => value === null || value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value),
        { message: "Use the date picker to choose a valid date" }
    );

export const UpdatePersonalInfoSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required").max(80),
    middleName: optionalText(80),
    lastName: z.string().trim().min(1, "Last name is required").max(80),

    /**
     * Changing this does NOT write public.profiles.email. It is forwarded to
     * Supabase Auth, which emails a confirmation link; the existing
     * on_auth_user_email_updated trigger syncs the column only once the change
     * is confirmed. Writing the column directly would desync it from
     * auth.users and break sign-in, which resolves the identifier through this
     * very table.
     */
    email: z
        .string()
        .trim()
        .min(1, "Email address is required")
        .refine(isEmail, { message: "Enter a valid email address" }),

    phone: optionalPhone,
    alternatePhone: optionalPhone,
    dateOfBirth: optionalDateString,
    addressLine: optionalText(200),
    city: optionalText(80),
    state: optionalText(80),
    country: optionalText(80),
    postalCode: optionalText(16),
});

export const UpdateProfessionalInfoSchema = z.object({
    employeeId: optionalText(40),
    department: optionalText(80),
    designation: optionalText(80),
    reportingManager: optionalText(120),
    team: optionalText(80),
    joiningDate: optionalDateString,
    /**
     * Deduplicated case-insensitively and capped. The cap is not arbitrary
     * politeness: skills render as chips in a fixed-height card, and an
     * unbounded array is a trivially abusable way to bloat every profile read.
     */
    skills: z
        .array(z.string().trim().min(1).max(40))
        .max(30, "You can list up to 30 skills")
        .transform((values) => {
            const seen = new Set<string>();
            return values.filter((value) => {
                const key = value.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        })
        .optional(),
});

export const LANGUAGE_OPTIONS = [
    { value: "en-US", label: "English (United States)" },
    { value: "en-GB", label: "English (United Kingdom)" },
    { value: "de", label: "Deutsch" },
    { value: "fr", label: "Français" },
    { value: "es", label: "Español" },
    { value: "it", label: "Italiano" },
    { value: "pt", label: "Português" },
    { value: "hi", label: "हिन्दी" },
] as const;

export const DATE_FORMAT_OPTIONS = [
    { value: "DD MMM YYYY", label: "DD MMM YYYY (15 Aug 2026)" },
    { value: "DD/MM/YYYY", label: "DD/MM/YYYY (15/08/2026)" },
    { value: "MM/DD/YYYY", label: "MM/DD/YYYY (08/15/2026)" },
    { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-08-15)" },
] as const;

export const CURRENCY_OPTIONS = [
    { value: "EUR", label: "EUR — Euro" },
    { value: "USD", label: "USD — US Dollar" },
    { value: "GBP", label: "GBP — British Pound" },
    { value: "INR", label: "INR — Indian Rupee" },
    { value: "AED", label: "AED — UAE Dirham" },
    { value: "SGD", label: "SGD — Singapore Dollar" },
] as const;

export const THEME_OPTIONS = ["light", "dark", "system"] as const;

export const UpdatePreferencesSchema = z.object({
    language: z.enum(LANGUAGE_OPTIONS.map((o) => o.value) as [string, ...string[]]),
    /**
     * Validated against the runtime's own tz database rather than a hard-coded
     * list, so the set never goes stale and an unknown zone cannot be stored —
     * a bad value here would throw inside every date formatter that reads it.
     */
    timeZone: z.string().refine(
        (value) => {
            try {
                new Intl.DateTimeFormat("en-US", { timeZone: value });
                return true;
            } catch {
                return false;
            }
        },
        { message: "Unknown time zone" }
    ),
    dateFormat: z.enum(DATE_FORMAT_OPTIONS.map((o) => o.value) as [string, ...string[]]),
    currency: z.enum(CURRENCY_OPTIONS.map((o) => o.value) as [string, ...string[]]),
    theme: z.enum(THEME_OPTIONS),
});

export const UpdateNotificationsSchema = z.object({
    notifyEmail: z.boolean(),
    notifySms: z.boolean(),
    notifyPush: z.boolean(),
    notifyNewLead: z.boolean(),
    notifyNewCustomer: z.boolean(),
    notifyDeal: z.boolean(),
    notifyTask: z.boolean(),
    notifySystem: z.boolean(),
});

/**
 * Password rules, matched to the sign-up route's own minimum (8) so a password
 * that was accepted at registration can never be rejected as "too weak" when
 * the same person tries to re-enter it here.
 *
 * `confirmPassword` is checked server-side as well as in the form: the
 * client-side check is a convenience, and a mismatched pair arriving by any
 * other route must not silently set the first value.
 */
export const ChangePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, "Enter your current password"),
        newPassword: z.string().min(8, "New password must be at least 8 characters").max(72),
        confirmPassword: z.string().min(1, "Confirm your new password"),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "New passwords do not match",
        path: ["confirmPassword"],
    })
    .refine((data) => data.newPassword !== data.currentPassword, {
        message: "New password must be different from the current one",
        path: ["newPassword"],
    });

/** Six digits from an authenticator app. */
export const MfaCodeSchema = z.object({
    code: z
        .string()
        .trim()
        .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});

/**
 * Deleting requires typing the exact word, not just clicking through a modal.
 * The literal is checked on the server too, so the confirmation cannot be
 * skipped by calling the endpoint directly.
 */
export const DeleteAccountSchema = z.object({
    confirmation: z.literal("DELETE", {
        message: 'Type DELETE exactly to confirm',
    }),
});

export type UpdatePersonalInfoDTO = z.infer<typeof UpdatePersonalInfoSchema>;
export type UpdateProfessionalInfoDTO = z.infer<typeof UpdateProfessionalInfoSchema>;
export type UpdatePreferencesDTO = z.infer<typeof UpdatePreferencesSchema>;
export type UpdateNotificationsDTO = z.infer<typeof UpdateNotificationsSchema>;
export type ChangePasswordDTO = z.infer<typeof ChangePasswordSchema>;

/**
 * Password strength, shared by the meter in the UI and nothing else.
 *
 * Deliberately advisory: the only hard rule is the 8-character minimum above.
 * A meter that blocks submission on a heuristic score is how users end up with
 * `Password1!` — it scores well and is guessed first.
 */
export type PasswordStrength = {
    score: 0 | 1 | 2 | 3 | 4;
    label: "Very weak" | "Weak" | "Fair" | "Strong" | "Very strong";
    suggestions: string[];
};

export function scorePassword(password: string): PasswordStrength {
    const suggestions: string[] = [];
    let score = 0;

    if (password.length >= 8) score++;
    else suggestions.push("Use at least 8 characters");

    if (password.length >= 12) score++;
    else if (password.length >= 8) suggestions.push("12 or more characters is stronger");

    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    else suggestions.push("Mix upper and lower case");

    if (/\d/.test(password)) score++;
    else suggestions.push("Add a number");

    if (/[^A-Za-z0-9]/.test(password)) score++;
    else suggestions.push("Add a symbol");

    // A long repeated or sequential string passes the character-class tests
    // while being trivially guessable, so it is capped rather than rewarded.
    if (/^(.)\1+$/.test(password) || /^(?:0123|1234|abcd|qwer|password)/i.test(password)) {
        score = Math.min(score, 1);
        suggestions.unshift("Avoid repeated characters and common sequences");
    }

    const clamped = Math.max(0, Math.min(4, score - 1)) as 0 | 1 | 2 | 3 | 4;
    const labels: PasswordStrength["label"][] = [
        "Very weak",
        "Weak",
        "Fair",
        "Strong",
        "Very strong",
    ];

    return { score: clamped, label: labels[clamped], suggestions: suggestions.slice(0, 2) };
}

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
