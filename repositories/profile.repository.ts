import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { UpdateProfileDTO, UpsertProfileDTO } from "@/models/profile";

/**
 * Data access for public.profiles.
 *
 * Unlike the other repositories this is NOT tenant-scoped: a profile belongs to
 * a Supabase Auth user, not to a workspace. Workspace membership lives on
 * User/Membership and is resolved separately by resolveTenant().
 *
 * Reads run as the `postgres` role via Prisma, which bypasses the table's RLS
 * policies. Those policies exist for direct browser access with the anon key.
 *
 * EVERY method here keys on `userId` — the Supabase Auth uuid — and not on the
 * numeric `id` that migration 20260909120000_profile_numeric_id introduced.
 * That is deliberate: the auth uuid is the only identifier the request path
 * actually holds (it comes from the verified session cookie), and keying on it
 * is what keeps "a user can only touch their own row" true by construction.
 * The numeric id is an output — a stable, human-quotable profile number — not
 * a lookup key, so no method takes one.
 */
export class ProfileRepository {
    static async findByUserId(userId: string) {
        return prisma.profile.findUnique({ where: { userId } });
    }

    static async findByEmail(email: string) {
        return prisma.profile.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
        });
    }

    /**
     * Looks a profile up by phone number for sign-in, where the identifier may
     * be typed as 9876543210, 09876543210, +919876543210 or with separators.
     *
     * Compares the last 10 digits of both sides, so stored and typed formats do
     * not have to agree. Raw SQL because Prisma cannot express the normalization
     * in a `where` clause.
     */
    static async findByPhone(phone: string) {
        const digits = phone.replace(/\D/g, "");
        if (digits.length < 10) return null;
        const last10 = digits.slice(-10);

        // Selects user_id, not id: the caller is the sign-in path, which needs
        // the auth uuid. (Before 20260909120000 these were the same column.)
        const rows = await prisma.$queryRaw<{ user_id: string }[]>(
            Prisma.sql`
                SELECT user_id
                  FROM public.profiles
                 WHERE phone IS NOT NULL
                   AND right(regexp_replace(phone, '\D', '', 'g'), 10) = ${last10}
                 LIMIT 2
            `
        );

        // Ambiguous match: refuse rather than sign the wrong person in.
        if (rows.length !== 1) return null;

        return this.findByUserId(rows[0].user_id);
    }

    /**
     * Creates the profile only if the trigger did not already do so.
     * `ON CONFLICT DO NOTHING` semantics — an existing row is never overwritten,
     * which is what "create a profile if one doesn't already exist" requires.
     */
    static async createIfMissing(data: UpsertProfileDTO) {
        const existing = await this.findByUserId(data.userId);
        if (existing) return existing;

        try {
            return await prisma.profile.create({
                data: {
                    // `id` is deliberately absent: the column is an identity,
                    // so Postgres allocates the next profile number. Passing
                    // one here would be the frontend generating the id, which
                    // this design rules out.
                    userId: data.userId,
                    firstName: data.firstName,
                    middleName: data.middleName ?? null,
                    lastName: data.lastName,
                    email: data.email,
                    phone: data.phone ?? null,
                },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                // P2002 — unique violation: the trigger won a concurrent race.
                if (error.code === "P2002") return this.findByUserId(data.userId);

                // P2003 — foreign key violation: no auth.users row with this id.
                // Happens when Supabase returns an obfuscated user for a signup
                // with an already-registered email (enumeration protection): the
                // id it hands back is not a real auth user. Signup must not 500.
                if (error.code === "P2003") return null;
            }
            throw error;
        }
    }

    static async update(userId: string, data: UpdateProfileDTO) {
        return prisma.profile.update({
            where: { userId },
            data: {
                ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
                ...(data.middleName !== undefined ? { middleName: data.middleName } : {}),
                ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
                ...(data.phone !== undefined ? { phone: data.phone } : {}),
            },
        });
    }

    // ─── Profile page writes ─────────────────────────────────────────
    //
    // One method per card, mirroring the schemas in models/profile.ts. Each
    // takes an already-validated payload and writes only its own columns, so
    // no path can blank a field belonging to a different section.
    //
    // `Prisma.ProfileUpdateInput` is not used as the parameter type on purpose:
    // that would let a caller pass arbitrary columns straight through from a
    // request body — including `userId`, which is the one column that must
    // never move: reassigning it hands the row to a different auth user.

    /** Personal information. Note: `email` is NOT written here — see the service. */
    static async updatePersonalInfo(
        userId: string,
        data: {
            firstName: string;
            middleName: string | null;
            lastName: string;
            phone: string | null;
            alternatePhone: string | null;
            dateOfBirth: Date | null;
            addressLine: string | null;
            city: string | null;
            state: string | null;
            country: string | null;
            postalCode: string | null;
        }
    ) {
        return prisma.profile.update({ where: { userId }, data });
    }

    static async updateProfessionalInfo(
        userId: string,
        data: {
            employeeId: string | null;
            department: string | null;
            designation: string | null;
            reportingManager: string | null;
            team: string | null;
            joiningDate: Date | null;
            skills: string[];
            company: string | null;
            bio: string | null;
            website: string | null;
            linkedinUrl: string | null;
        }
    ) {
        return prisma.profile.update({ where: { userId }, data });
    }

    static async updatePreferences(
        userId: string,
        data: {
            language: string;
            timeZone: string;
            dateFormat: string;
            currency: string;
            theme: string;
        }
    ) {
        return prisma.profile.update({ where: { userId }, data });
    }

    static async updateNotifications(
        userId: string,
        data: {
            notifyEmail: boolean;
            notifySms: boolean;
            notifyPush: boolean;
            notifyNewLead: boolean;
            notifyNewCustomer: boolean;
            notifyDeal: boolean;
            notifyTask: boolean;
            notifySystem: boolean;
        }
    ) {
        return prisma.profile.update({ where: { userId }, data });
    }

    static async setAvatarUrl(userId: string, avatarUrl: string | null) {
        return prisma.profile.update({ where: { userId }, data: { avatarUrl } });
    }

    /**
     * Stamps the sign-in time.
     *
     * Deliberately swallows its own errors: this is called from the sign-in
     * path, and a failure to record a timestamp must never be the reason a
     * user cannot log in. A legacy session whose `sub` is not a uuid, or a
     * profile row that does not exist yet, both land here.
     */
    static async touchLastLogin(userId: string) {
        try {
            await prisma.profile.update({
                where: { userId },
                data: { lastLoginAt: new Date() },
            });
        } catch {
            // Non-fatal by design — see above.
        }
    }

    static async setAccountStatus(
        userId: string,
        status: "active" | "inactive" | "deleted",
        stamps: { deactivatedAt?: Date | null; deletedAt?: Date | null } = {}
    ) {
        return prisma.profile.update({
            where: { userId },
            data: {
                accountStatus: status,
                ...(stamps.deactivatedAt !== undefined
                    ? { deactivatedAt: stamps.deactivatedAt }
                    : {}),
                ...(stamps.deletedAt !== undefined ? { deletedAt: stamps.deletedAt } : {}),
            },
        });
    }

    /**
     * Scrubs the personal data off a soft-deleted profile.
     *
     * A soft delete that leaves the row fully populated is not a deletion in
     * any sense the user meant. Name and email are kept minimally — email
     * because it is NOT NULL and still mirrors auth.users, first/last because
     * they are NOT NULL — but everything discretionary goes.
     */
    static async scrubPersonalData(userId: string) {
        return prisma.profile.update({
            where: { userId },
            data: {
                avatarUrl: null,
                phone: null,
                alternatePhone: null,
                dateOfBirth: null,
                addressLine: null,
                city: null,
                state: null,
                country: null,
                postalCode: null,
                employeeId: null,
                department: null,
                designation: null,
                reportingManager: null,
                team: null,
                joiningDate: null,
                skills: [],
            },
        });
    }
}
