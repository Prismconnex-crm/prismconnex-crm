import { ProfileRepository } from "@/repositories/profile.repository";
import {
    deriveNamesFromMetadata,
    ProfileDTO,
    UpdateProfileDTO,
    UpdateNotificationsDTO,
    UpdatePersonalInfoDTO,
    UpdatePreferencesDTO,
    UpdateProfessionalInfoDTO,
} from "@/models/profile";
import type { SupabaseUser } from "@/lib/supabase/gotrue";
import { updateUserEmail } from "@/lib/supabase/gotrue";
import { isEmail } from "@/models/auth";
import { BadRequestError, NotFoundError } from "@/lib/http/errors";

/**
 * The Prisma row shape, rather than a hand-written mirror of it.
 *
 * The previous hand-written type had to be edited in lockstep with every
 * schema change; deriving it means a column added to the model is a compile
 * error here until it is mapped, instead of silently missing from the DTO.
 */
type ProfileRow = NonNullable<Awaited<ReturnType<typeof ProfileRepository.findById>>>;

function toDTO(row: ProfileRow): ProfileDTO {
    return {
        id: row.id,
        firstName: row.firstName,
        middleName: row.middleName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        createdAt: row.createdAt,

        avatarUrl: row.avatarUrl,
        username: row.username,

        alternatePhone: row.alternatePhone,
        dateOfBirth: row.dateOfBirth,
        addressLine: row.addressLine,
        city: row.city,
        state: row.state,
        country: row.country,
        postalCode: row.postalCode,

        employeeId: row.employeeId,
        department: row.department,
        designation: row.designation,
        reportingManager: row.reportingManager,
        team: row.team,
        joiningDate: row.joiningDate,
        skills: row.skills,

        accountStatus: row.accountStatus,
        lastLoginAt: row.lastLoginAt,
        deactivatedAt: row.deactivatedAt,
        deletedAt: row.deletedAt,

        language: row.language,
        timeZone: row.timeZone,
        dateFormat: row.dateFormat,
        currency: row.currency,
        theme: row.theme,

        notifyEmail: row.notifyEmail,
        notifySms: row.notifySms,
        notifyPush: row.notifyPush,
        notifyNewLead: row.notifyNewLead,
        notifyNewCustomer: row.notifyNewCustomer,
        notifyDeal: row.notifyDeal,
        notifyTask: row.notifyTask,
        notifySystem: row.notifySystem,

        updatedAt: row.updatedAt,
    };
}

/**
 * Parses `YYYY-MM-DD` into a Date pinned to UTC midnight.
 *
 * `new Date("1990-05-04")` already parses as UTC, but building it explicitly
 * documents the intent and keeps it correct if the input ever gains a time
 * component. The column is `date`, so only the calendar day survives — the
 * point is that the day stored is the day typed, in every server time zone.
 */
function parseDateOnly(value: string | null | undefined): Date | null {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Profile business logic.
 *
 * NOTE: no audit logging here, unlike the Lead/Deal services. AuditService.log
 * requires a workspaceId that is a foreign key to Workspace, and at signup time
 * the user has no workspace yet (one is created later by /api/onboarding).
 * Writing an audit row here would fail the FK constraint.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ProfileService {
    /**
     * profiles.id is a uuid column, so a non-uuid id must be rejected before it
     * reaches Postgres — otherwise sessions minted by the legacy demo path
     * (sub: "demo-user") produce an invalid-uuid cast error instead of a miss.
     */
    static async getByUserId(userId: string): Promise<ProfileDTO | null> {
        if (!UUID_PATTERN.test(userId)) return null;

        const row = await ProfileRepository.findById(userId);
        return row ? toDTO(row) : null;
    }

    static async requireByUserId(userId: string): Promise<ProfileDTO> {
        const profile = await this.getByUserId(userId);
        if (!profile) throw new NotFoundError("Profile not found");
        return profile;
    }

    /**
     * Guarantees a profile row exists for a Supabase Auth user.
     *
     * The `on_auth_user_created` trigger already creates one for every signup
     * path, including Google and Microsoft. This is the application-side safety
     * net for the cases the trigger cannot cover:
     *   - the trigger was dropped or failed silently
     *   - the auth user predates this migration (signed up before profiles existed)
     *
     * Never overwrites an existing profile — an OAuth sign-in by a user who
     * already has a profile is a no-op, which is what
     * "create a profile if one doesn't already exist" requires.
     *
     * Returns null only when the id does not correspond to a real auth user,
     * which happens for the obfuscated user Supabase returns when someone signs
     * up with an already-registered email.
     */
    static async ensureProfile(user: SupabaseUser): Promise<ProfileDTO | null> {
        if (!UUID_PATTERN.test(user.id)) return null;

        const existing = await ProfileRepository.findById(user.id);
        if (existing) return toDTO(existing);

        const derived = deriveNamesFromMetadata(user.user_metadata, user.email);

        const created = await ProfileRepository.createIfMissing({
            id: user.id,
            firstName: derived.firstName,
            middleName: derived.middleName,
            lastName: derived.lastName,
            email: user.email ?? "",
            phone: derived.phone ?? user.phone ?? null,
        });

        return created ? toDTO(created) : null;
    }

    /**
     * ensureProfile() for the paths that hold a real session (sign in, verify,
     * OAuth callback) — there the auth user provably exists, so a missing
     * profile is a server-side fault rather than a user error.
     */
    static async ensureProfileForSession(user: SupabaseUser): Promise<ProfileDTO> {
        const profile = await this.ensureProfile(user);
        if (!profile) throw new NotFoundError("Profile not found for authenticated user");
        return profile;
    }

    static async update(userId: string, data: UpdateProfileDTO): Promise<ProfileDTO> {
        await this.requireByUserId(userId);
        const row = await ProfileRepository.update(userId, data);
        return toDTO(row);
    }

    // ─── Profile page ────────────────────────────────────────────────
    //
    // Every method takes the user id from the caller's verified session. None
    // accepts an id from a request body, which is what makes "a user can only
    // edit their own profile" true regardless of what a client sends.

    /**
     * Personal information, plus the email change if the address differs.
     *
     * The email is handled apart from the row on purpose. public.profiles.email
     * mirrors auth.users.email through a trigger and is what sign-in resolves a
     * typed identifier against; writing it here would desync the two and let a
     * user lock themselves out by "changing" an email Supabase never accepted.
     * So the new address is handed to Supabase, which sends a confirmation
     * link, and the column moves only once that link is followed.
     *
     * Returns `emailChangePending` so the UI can say what actually happened
     * rather than claiming the address is already updated.
     */
    static async updatePersonalInfo(
        userId: string,
        data: UpdatePersonalInfoDTO,
        context: { accessToken: string | null }
    ): Promise<{ profile: ProfileDTO; emailChangePending: boolean }> {
        const existing = await this.requireByUserId(userId);

        const row = await ProfileRepository.updatePersonalInfo(userId, {
            firstName: data.firstName,
            middleName: data.middleName ?? null,
            lastName: data.lastName,
            phone: data.phone ?? null,
            alternatePhone: data.alternatePhone ?? null,
            dateOfBirth: parseDateOnly(data.dateOfBirth),
            addressLine: data.addressLine ?? null,
            city: data.city ?? null,
            state: data.state ?? null,
            country: data.country ?? null,
            postalCode: data.postalCode ?? null,
        });

        const emailChanged =
            data.email.trim().toLowerCase() !== existing.email.trim().toLowerCase();

        if (!emailChanged) {
            return { profile: toDTO(row), emailChangePending: false };
        }

        if (!context.accessToken) {
            throw new BadRequestError(
                "Changing your email address needs a fresh sign-in. " +
                    "Everything else was saved — sign out and back in, then try the email again."
            );
        }

        await updateUserEmail(context.accessToken, data.email.trim());

        return { profile: toDTO(row), emailChangePending: true };
    }

    static async updateProfessionalInfo(
        userId: string,
        data: UpdateProfessionalInfoDTO
    ): Promise<ProfileDTO> {
        await this.requireByUserId(userId);

        const row = await ProfileRepository.updateProfessionalInfo(userId, {
            employeeId: data.employeeId ?? null,
            department: data.department ?? null,
            designation: data.designation ?? null,
            reportingManager: data.reportingManager ?? null,
            team: data.team ?? null,
            joiningDate: parseDateOnly(data.joiningDate),
            skills: data.skills ?? [],
        });

        return toDTO(row);
    }

    static async updatePreferences(
        userId: string,
        data: UpdatePreferencesDTO
    ): Promise<ProfileDTO> {
        await this.requireByUserId(userId);
        return toDTO(await ProfileRepository.updatePreferences(userId, data));
    }

    static async updateNotifications(
        userId: string,
        data: UpdateNotificationsDTO
    ): Promise<ProfileDTO> {
        await this.requireByUserId(userId);
        return toDTO(await ProfileRepository.updateNotifications(userId, data));
    }

    static async setAvatarUrl(userId: string, avatarUrl: string | null): Promise<ProfileDTO> {
        await this.requireByUserId(userId);
        return toDTO(await ProfileRepository.setAvatarUrl(userId, avatarUrl));
    }

    /** Reversible: the user can sign back in, and the Profile page offers it. */
    static async deactivate(userId: string): Promise<ProfileDTO> {
        await this.requireByUserId(userId);
        return toDTO(
            await ProfileRepository.setAccountStatus(userId, "inactive", {
                deactivatedAt: new Date(),
            })
        );
    }

    static async reactivate(userId: string): Promise<ProfileDTO> {
        await this.requireByUserId(userId);
        return toDTO(
            await ProfileRepository.setAccountStatus(userId, "active", {
                deactivatedAt: null,
            })
        );
    }

    /**
     * Soft delete: marks the account deleted and scrubs the discretionary
     * personal data off the row.
     *
     * The auth.users row survives, so this is not the irreversible deletion the
     * modal promises in spirit — it is the strongest deletion available without
     * the service_role key, which this project deliberately does not hold. The
     * UI says exactly this, and docs/PROFILE.md records what to add for a hard
     * delete. The account cannot be used afterwards: sign-in is refused for a
     * deleted profile.
     */
    static async softDelete(userId: string): Promise<void> {
        await this.requireByUserId(userId);
        await ProfileRepository.setAccountStatus(userId, "deleted", {
            deletedAt: new Date(),
        });
        await ProfileRepository.scrubPersonalData(userId);
    }

    /** Stamps sign-in time. Never throws — see the repository method. */
    static async recordLogin(userId: string): Promise<void> {
        if (!UUID_PATTERN.test(userId)) return;
        await ProfileRepository.touchLastLogin(userId);
    }

    /**
     * Resolves the identifier typed on the sign-in form to an email address.
     *
     * The form accepts either an email or an Indian mobile number (see
     * models/auth.ts). Supabase's password grant only accepts email, so a phone
     * identifier is looked up in profiles first. Using the profiles table for
     * this is why phone is indexed there.
     */
    static async resolveIdentifierToEmail(identifier: string): Promise<string | null> {
        const value = identifier.trim();
        if (isEmail(value)) return value;

        const profile = await ProfileRepository.findByPhone(value);
        return profile?.email ?? null;
    }
}
