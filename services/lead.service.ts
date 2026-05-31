import { LeadRepository } from "@/repositories/lead.repository";
import { CreateLeadDTO, UpdateLeadDTO, ConvertLeadToDealDTO } from "@/models/lead";
import { AuditService } from "@/lib/audit/audit.service";
import { NotFoundError, BadRequestError } from "@/lib/http/errors";
import { prisma } from "@/lib/db/prisma";
import { TenantContext } from "@/lib/auth/tenant";

export class LeadService {
    constructor(private tenant: TenantContext) { }

    async list() {
        return LeadRepository.findMany(this.tenant.workspaceId);
    }

    async get(id: string) {
        const lead = await LeadRepository.findById(this.tenant.workspaceId, id);
        if (!lead) throw new NotFoundError("Lead not found in this workspace");
        return lead;
    }

    async create(data: CreateLeadDTO) {
        const lead = await LeadRepository.create(this.tenant.workspaceId, data);

        await AuditService.log(
            this.tenant.workspaceId,
            this.tenant.userId,
            "LEAD",
            lead.id,
            "CREATE"
        );
        return lead;
    }

    async update(id: string, data: UpdateLeadDTO) {
        const existing = await this.get(id); // Ensure authorization
        const updated = await prisma.lead.update({ where: { id }, data });

        await AuditService.log(
            this.tenant.workspaceId,
            this.tenant.userId,
            "LEAD",
            id,
            "UPDATE"
        );
        return updated;
    }

    async convertToDeal(leadId: string, data: ConvertLeadToDealDTO) {
        const lead = await this.get(leadId); // Authorize
        if (lead.status === "CONVERTED") {
            throw new BadRequestError("Lead is already converted");
        }

        return await prisma.$transaction(async (tx) => {
            // 1. Update lead status
            await tx.lead.update({
                where: { id: lead.id },
                data: { status: "CONVERTED" },
            });

            // 2. Create Deal
            const deal = await tx.deal.create({
                data: {
                    workspaceId: this.tenant.workspaceId,
                    name: data.dealName,
                    amount: data.amount,
                    companyId: lead.companyId,
                    leadId: lead.id,
                    stage: "DISCOVERY",
                },
            });

            // 3. Log Audit
            await tx.auditLog.create({
                data: {
                    workspaceId: this.tenant.workspaceId,
                    userId: this.tenant.userId,
                    entity: "DEAL",
                    entityId: deal.id,
                    action: "CONVERT_FROM_LEAD",
                }
            });

            return deal;
        });
    }
}
