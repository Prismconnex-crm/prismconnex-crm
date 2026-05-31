import { prisma } from "@/lib/db/prisma";
import { CreateLeadDTO } from "@/models/lead";

export class LeadRepository {
    static async findMany(workspaceId: string) {
        return prisma.lead.findMany({
            where: { workspaceId },
            include: { company: true },
            orderBy: { createdAt: "desc" },
        });
    }

    static async findById(workspaceId: string, id: string) {
        return prisma.lead.findFirst({
            where: { id, workspaceId },
            include: { company: true },
        });
    }

    static async create(workspaceId: string, data: CreateLeadDTO) {
        return prisma.lead.create({
            data: {
                workspaceId,
                ...data,
            },
        });
    }
}
