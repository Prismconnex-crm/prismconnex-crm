import { ProfileRepository } from "@/repositories/profile.repository";
import { deriveNamesFromMetadata, ProfileDTO, UpdateProfileDTO } from "@/models/profile";
import type { SupabaseUser } from "@/lib/supabase/gotrue";
import { isEmail } from "@/models/auth";
import { NotFoundError } from "@/lib/http/errors";

type ProfileRow = {
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    email: string;
    phone: string | null;
    createdAt: Date;
};

function toDTO(row: ProfileRow): ProfileDTO {
    return {
        id: row.id,
        firstName: row.firstName,
        middleName: row.middleName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        createdAt: row.createdAt,
    };
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
