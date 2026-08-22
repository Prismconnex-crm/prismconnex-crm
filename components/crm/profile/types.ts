/**
 * Client-side shapes for the Profile page.
 *
 * Every Date on ProfileDTO arrives here as an ISO string, because that is what
 * JSON.stringify produces on the wire. Modelling them as `string` rather than
 * reusing ProfileDTO directly is deliberate: typing them as Date would compile
 * and then fail at runtime on the first `.getTime()`, which is exactly the bug
 * a shared type is supposed to prevent.
 */

export type ProfileView = {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    email: string;
    phone: string | null;
    createdAt: string;

    avatarUrl: string | null;
    username: string | null;

    alternatePhone: string | null;
    dateOfBirth: string | null;
    addressLine: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;

    employeeId: string | null;
    department: string | null;
    designation: string | null;
    reportingManager: string | null;
    team: string | null;
    joiningDate: string | null;
    skills: string[];

    company: string | null;
    bio: string | null;
    /** Absolute, scheme included — normalised by UpdateProfessionalInfoSchema. */
    website: string | null;
    linkedinUrl: string | null;

    accountStatus: string;
    lastLoginAt: string | null;
    deactivatedAt: string | null;
    deletedAt: string | null;

    language: string;
    timeZone: string;
    dateFormat: string;
    currency: string;
    theme: string;

    notifyEmail: boolean;
    notifySms: boolean;
    notifyPush: boolean;
    notifyNewLead: boolean;
    notifyNewCustomer: boolean;
    notifyDeal: boolean;
    notifyTask: boolean;
    notifySystem: boolean;

    updatedAt: string;
};

export type AccountView = {
    role: string | null;
    workspaceId: string | null;
    /** null when it could not be determined — rendered as "Unknown", not a tick. */
    emailVerified: boolean | null;
    /**
     * Whether the Supabase tokens exist. False for demo/mock sessions, and the
     * reason the security actions are disabled rather than left to 401.
     */
    hasSupabaseSession: boolean;
};

export type MfaView = {
    enabled: boolean;
    pendingFactorId: string | null;
    verifiedFactorId: string | null;
    friendlyName: string | null;
    enrolledAt: string | null;
};

export type SessionView = {
    browser: string;
    os: string;
    ip: string | null;
    signedInAt: string | null;
    isCurrent: boolean;
};

export type ActivityCounterView = {
    key: string;
    label: string;
    value: number;
    scope: "user" | "workspace";
};

export type ActivityEntryView = {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    createdAt: string;
    byCurrentUser: boolean;
};

export type ActivityView = {
    counters: ActivityCounterView[];
    recent: ActivityEntryView[];
    /** True when the audit trail could not be read, as distinct from empty. */
    recentUnavailable: boolean;
    profileUpdatedAt: string | null;
    lastLoginAt: string | null;
    memberSince: string | null;
};

/** Full name, skipping the parts that are absent. */
export function fullNameOf(profile: ProfileView): string {
    return [profile.firstName, profile.middleName, profile.lastName]
        .filter(Boolean)
        .join(" ");
}

/** Initials for the avatar fallback, e.g. "Ada Byron Lovelace" -> "AL". */
export function initialsOf(profile: ProfileView): string {
    const first = profile.firstName?.[0] ?? "";
    const last = profile.lastName?.[0] ?? "";
    return (first + last).toUpperCase() || profile.email[0]?.toUpperCase() || "?";
}

/**
 * `YYYY-MM-DD` for a native date input.
 *
 * Slices the ISO string rather than going through the Date constructor: the
 * column is a `date`, serialised as UTC midnight, and formatting that in a
 * timezone behind UTC yields the previous day. Slicing keeps the stored day.
 */
export function toDateInputValue(iso: string | null): string {
    return iso ? iso.slice(0, 10) : "";
}
