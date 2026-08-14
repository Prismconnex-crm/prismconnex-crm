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
}
