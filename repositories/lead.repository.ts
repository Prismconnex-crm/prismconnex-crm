import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

const PERSON_SELECT = { select: { id: true, name: true, email: true } } as const;

/** What every lead read returns: the lead plus its owner and any deal. */
const LEAD_INCLUDE = {
    owner: PERSON_SELECT,
    deal: { select: { id: true, name: true } },
} satisfies Prisma.LeadInclude;

/** Newest first; the timeline shows the most recent notes. */
const NOTES_LIMIT = 100;

export type LeadRow = Prisma.LeadGetPayload<{ include: typeof LEAD_INCLUDE }>;

export type LeadListFilter = {
    q?: string;
    status?: string;
    /** undefined = any owner, null = unassigned, string = that CRM User.id */
    ownerId?: string | null;
    cursor?: string;
    /** Rows to fetch — the service asks for one more than a page. */
    take: number;
};

type LeadWriteData = {
    fullName?: string;
    email?: string | null;
    phone?: string | null;
    jobTitle?: string | null;
    companyName?: string | null;
    companyId?: string | null;
    source?: string;
    status?: string;
    score?: number;
    ownerId?: string | null;
    nextFollowUpAt?: Date | null;
};

/**
 * Every read is scoped by workspaceId. Writes by id are only ever reached
 * after LeadService has loaded the lead through findById for the caller's
 * workspace, which is what makes them tenant-safe.
 */
export class LeadRepository {
    static async list(workspaceId: string, filter: LeadListFilter) {
        const where: Prisma.LeadWhereInput = { workspaceId };

        if (filter.status) where.status = filter.status;
        if (filter.ownerId !== undefined) where.ownerId = filter.ownerId;
        if (filter.q) {
            where.OR = [
                { fullName: { contains: filter.q, mode: "insensitive" } },
                { email: { contains: filter.q, mode: "insensitive" } },
                { companyName: { contains: filter.q, mode: "insensitive" } },
            ];
        }

        return prisma.lead.findMany({
            where,
            include: LEAD_INCLUDE,
            // id breaks createdAt ties so the cursor never skips or repeats a row.
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: filter.take,
            ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
        });
    }

    /** Counts per status across the whole workspace, unaffected by filters. */
    static async stats(workspaceId: string) {
        return prisma.lead.groupBy({
            by: ["status"],
            where: { workspaceId },
            _count: { _all: true },
        });
    }

    static async findById(workspaceId: string, id: string) {
        return prisma.lead.findFirst({
            where: { id, workspaceId },
            include: {
                ...LEAD_INCLUDE,
                notes: {
                    include: { author: PERSON_SELECT },
                    orderBy: { createdAt: "desc" },
                    take: NOTES_LIMIT,
                },
            },
        });
    }

    static async create(workspaceId: string, data: LeadWriteData & { fullName: string; source: string }) {
        return prisma.lead.create({
            data: { workspaceId, ...data },
            include: LEAD_INCLUDE,
        });
    }

    static async update(id: string, data: LeadWriteData) {
        return prisma.lead.update({
            where: { id },
            data,
            include: LEAD_INCLUDE,
        });
    }

    static async remove(id: string) {
        await prisma.lead.delete({ where: { id } });
    }

    static async companyInWorkspace(workspaceId: string, companyId: string) {
        const company = await prisma.company.findFirst({
            where: { id: companyId, workspaceId },
            select: { id: true },
        });
        return Boolean(company);
    }

    static async createNote(data: { workspaceId: string; leadId: string; authorId: string; body: string }) {
        return prisma.leadNote.create({
            data,
            include: { author: PERSON_SELECT },
        });
    }
}
