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
 */
export class ProfileRepository {
    static async findById(id: string) {
        return prisma.profile.findUnique({ where: { id } });
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

        const rows = await prisma.$queryRaw<{ id: string }[]>(
            Prisma.sql`
                SELECT id
                  FROM public.profiles
                 WHERE phone IS NOT NULL
                   AND right(regexp_replace(phone, '\D', '', 'g'), 10) = ${last10}
                 LIMIT 2
            `
        );

        // Ambiguous match: refuse rather than sign the wrong person in.
        if (rows.length !== 1) return null;

        return this.findById(rows[0].id);
    }

    /**
     * Creates the profile only if the trigger did not already do so.
     * `ON CONFLICT DO NOTHING` semantics — an existing row is never overwritten,
     * which is what "create a profile if one doesn't already exist" requires.
     */
    static async createIfMissing(data: UpsertProfileDTO) {
        const existing = await this.findById(data.id);
        if (existing) return existing;

        try {
            return await prisma.profile.create({
                data: {
                    id: data.id,
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
                if (error.code === "P2002") return this.findById(data.id);

                // P2003 — foreign key violation: no auth.users row with this id.
                // Happens when Supabase returns an obfuscated user for a signup
                // with an already-registered email (enumeration protection): the
                // id it hands back is not a real auth user. Signup must not 500.
                if (error.code === "P2003") return null;
            }
            throw error;
        }
    }

    static async update(id: string, data: UpdateProfileDTO) {
        return prisma.profile.update({
            where: { id },
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
    // that would let a caller pass arbitrary columns (including `id`) straight
    // through from a request body.

    /** Personal information. Note: `email` is NOT written here — see the service. */
    static async updatePersonalInfo(
        id: string,
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
        return prisma.profile.update({ where: { id }, data });
    }

    static async updateProfessionalInfo(
        id: string,
        data: {
            employeeId: string | null;
            department: string | null;
            designation: string | null;
            reportingManager: string | null;
            team: string | null;
            joiningDate: Date | null;
            skills: string[];
        }
    ) {
        return prisma.profile.update({ where: { id }, data });
    }

    static async updatePreferences(
        id: string,
        data: {
            language: string;
            timeZone: string;
            dateFormat: string;
            currency: string;
            theme: string;
        }
    ) {
        return prisma.profile.update({ where: { id }, data });
    }

    static async updateNotifications(
        id: string,
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
        return prisma.profile.update({ where: { id }, data });
    }

    static async setAvatarUrl(id: string, avatarUrl: string | null) {
        return prisma.profile.update({ where: { id }, data: { avatarUrl } });
    }

    /**
     * Stamps the sign-in time.
     *
     * Deliberately swallows its own errors: this is called from the sign-in
     * path, and a failure to record a timestamp must never be the reason a
     * user cannot log in. A legacy session whose `sub` is not a uuid, or a
     * profile row that does not exist yet, both land here.
     */
    static async touchLastLogin(id: string) {
        try {
            await prisma.profile.update({
                where: { id },
                data: { lastLoginAt: new Date() },
            });
        } catch {
            // Non-fatal by design — see above.
        }
    }

    static async setAccountStatus(
        id: string,
        status: "active" | "inactive" | "deleted",
        stamps: { deactivatedAt?: Date | null; deletedAt?: Date | null } = {}
    ) {
        return prisma.profile.update({
            where: { id },
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
    static async scrubPersonalData(id: string) {
        return prisma.profile.update({
            where: { id },
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
