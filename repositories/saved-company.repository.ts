import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { SaveCompanyDTO } from "@/models/saved-company";

export class SavedCompanyRepository {
    static async findMany(workspaceId: string) {
        return prisma.savedCompany.findMany({
            where: { workspaceId },
            orderBy: { createdAt: "desc" },
        });
    }

    static async upsert(workspaceId: string, data: SaveCompanyDTO) {
        return prisma.savedCompany.upsert({
            where: {
                workspaceId_companyId: { workspaceId, companyId: data.companyId },
            },
            create: {
                workspaceId,
                companyId: data.companyId,
                snapshot: data.snapshot as Prisma.InputJsonValue,
            },
            update: {
                snapshot: data.snapshot as Prisma.InputJsonValue,
            },
        });
    }

    static async delete(workspaceId: string, companyId: string) {
        return prisma.savedCompany.deleteMany({
            where: { workspaceId, companyId },
        });
    }
}
