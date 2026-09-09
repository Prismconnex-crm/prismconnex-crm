import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ProfileSchema, UpsertProfileSchema } from "@/models/profile";

/**
 * Cover for migration 20260909120000_profile_numeric_id, which split the one
 * uuid column `profiles.id` into two:
 *
 *     id      bigint identity  — the sequential profile number (1, 2, 3, ...)
 *     user_id uuid             — the Supabase Auth user, FK to auth.users
 *
 * Three things can break here, and each has a test below.
 *
 * 1. The two identifiers get confused. They were the same value for the whole
 *    life of the table before this migration, so a uuid landing in `id` (or a
 *    number in `userId`) is the obvious regression — and one that would only
 *    surface as a Postgres cast error at runtime.
 *
 * 2. The client starts supplying the id. The requirement is that Postgres
 *    allocates it, so the write path must have nowhere to put a caller's value.
 *
 * 3. The migration's setval is lost in an edit. That one is not a cosmetic
 *    failure: the identity sequence starts at 1, so without it the first signup
 *    after the migration collides with a backfilled row, and because the insert
 *    happens inside the signup transaction the collision aborts sign-up itself.
 *
 * No database is touched — the repo's suite is node-only, and the DB-side
 * behaviour (sequential allocation, RLS, the FK) is verified separately by
 * scripts/verify-profile-numeric-id.mjs against a real Supabase instance.
 */

const REPO_ROOT = join(__dirname, "..", "..");

/** A complete, valid row so each test states only what it varies. */
const BASE = {
    id: 1,
    userId: "a3d012d7-8493-4c8d-bd12-7d82107f27bf",
    firstName: "Ada",
    middleName: null,
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),

    avatarUrl: null,
    username: null,

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

    company: null,
    bio: null,
    website: null,
    linkedinUrl: null,

    accountStatus: "active",
    lastLoginAt: null,
    deactivatedAt: null,
    deletedAt: null,

    language: "en-US",
    timeZone: "Europe/Berlin",
    dateFormat: "DD MMM YYYY",
    currency: "EUR",
    theme: "system",

    notifyEmail: true,
    notifySms: false,
    notifyPush: true,
    notifyNewLead: true,
    notifyNewCustomer: true,
    notifyDeal: true,
    notifyTask: true,
    notifySystem: true,

    updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("ProfileSchema — the two identifiers", () => {
    it("accepts a numeric id alongside the auth uuid", () => {
        const parsed = ProfileSchema.parse(BASE);
        expect(parsed.id).toBe(1);
        expect(parsed.userId).toBe("a3d012d7-8493-4c8d-bd12-7d82107f27bf");
    });

    it("rejects the pre-migration shape, where id held the auth uuid", () => {
        expect(() =>
            ProfileSchema.parse({ ...BASE, id: "a3d012d7-8493-4c8d-bd12-7d82107f27bf" })
        ).toThrow();
    });

    it("rejects a numeric userId", () => {
        expect(() => ProfileSchema.parse({ ...BASE, userId: 1 })).toThrow();
    });

    it("rejects a non-positive or fractional id, which no identity produces", () => {
        expect(() => ProfileSchema.parse({ ...BASE, id: 0 })).toThrow();
        expect(() => ProfileSchema.parse({ ...BASE, id: -1 })).toThrow();
        expect(() => ProfileSchema.parse({ ...BASE, id: 1.5 })).toThrow();
    });

    it("survives JSON round-tripping, which a raw BigInt would not", () => {
        // The database column is BIGINT and Prisma hands back a JS BigInt.
        // JSON.stringify throws on those, so ProfileService.toDTO narrows it
        // with Number() before any route returns it. This asserts the shape
        // that reaches the wire is the narrowed one.
        expect(() => JSON.stringify(BigInt(1))).toThrow(TypeError);
        expect(JSON.parse(JSON.stringify(ProfileSchema.parse(BASE))).id).toBe(1);
    });
});

describe("UpsertProfileSchema — the client cannot choose a profile number", () => {
    const input = {
        userId: "a3d012d7-8493-4c8d-bd12-7d82107f27bf",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
    };

    it("carries the auth uuid", () => {
        expect(UpsertProfileSchema.parse(input).userId).toBe(input.userId);
    });

    it("requires the auth uuid", () => {
        const { userId: _omitted, ...withoutUserId } = input;
        expect(() => UpsertProfileSchema.parse(withoutUserId)).toThrow();
    });

    it("drops an id supplied by the caller instead of passing it through", () => {
        // The id is allocated by the Postgres identity. If this key ever
        // survived parsing it would reach prisma.profile.create() and let a
        // request pick its own profile number.
        const parsed = UpsertProfileSchema.parse({ ...input, id: 999 });
        expect(parsed).not.toHaveProperty("id");
    });
});

describe("006_profile_numeric_id.sql — the parts that must not be edited away", () => {
    const sql = readFileSync(
        join(REPO_ROOT, "supabase", "sql", "006_profile_numeric_id.sql"),
        "utf8"
    );

    it("advances the identity sequence past the backfilled rows", () => {
        // Without this the next signup is handed id 1, collides with a
        // backfilled row, and the unique violation rolls back the auth.users
        // insert that the trigger is running inside — i.e. sign-up breaks.
        expect(sql).toMatch(/setval\(\s*pg_get_serial_sequence\('public\.profiles',\s*'id'\)/);
    });

    it("has the signup trigger omit id so the identity fires", () => {
        expect(sql).toContain(
            "insert into public.profiles (user_id, first_name, middle_name, last_name, email, phone)"
        );
    });

    it("keys the trigger's conflict target on user_id", () => {
        expect(sql).toContain("on conflict (user_id) do nothing");
    });

    it("recreates all three RLS policies against user_id, not id", () => {
        for (const policy of ["profiles_select_own", "profiles_insert_own", "profiles_update_own"]) {
            expect(sql).toContain(`create policy ${policy}`);
        }
        expect(sql).toContain("auth.uid() = user_id");
        // The old comparison would now be uuid = bigint, which cannot be
        // written; asserting its absence keeps a careless revert visible.
        expect(sql).not.toMatch(/auth\.uid\(\)\s*=\s*id\b/);
    });

    it("keeps the uuid's foreign key to auth.users rather than dropping it", () => {
        expect(sql).toContain("rename column id to user_id");
        expect(sql).toContain("rename constraint profiles_id_fkey to profiles_user_id_fkey");
        expect(sql).not.toMatch(/drop\s+constraint\s+profiles_id_fkey/i);
    });

    it("uses none of the destructive statements this migration must never need", () => {
        expect(sql).not.toMatch(/drop\s+table\s+public\.profiles\b/i);
        expect(sql).not.toMatch(/truncate/i);
        expect(sql).not.toMatch(/delete\s+from\s+public\.profiles\b/i);
    });
});
