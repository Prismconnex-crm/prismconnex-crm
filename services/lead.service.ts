import { LeadRepository, type LeadRow } from "@/repositories/lead.repository";
import { WorkspaceMemberRepository } from "@/repositories/workspace-member.repository";
import {
    LEAD_STATUSES,
    type ConvertLeadToDealDTO,
    type CreateLeadDTO,
    type LeadDTO,
    type LeadDetailDTO,
    type LeadListDTO,
    type LeadListQuery,
    type LeadNoteDTO,
    type LeadNoteInput,
    type LeadPersonRef,
    type LeadStatus,
    type UpdateLeadDTO,
} from "@/models/lead";
import { AuditService } from "@/lib/audit/audit.service";
import { NotFoundError, BadRequestError } from "@/lib/http/errors";
import { prisma } from "@/lib/db/prisma";
import { TenantContext } from "@/lib/auth/tenant";
import { authorize, Role } from "@/lib/rbac/authorize";
import { WebhookService } from "@/services/webhook.service";

type Person = { id: string; name: string | null; email: string } | null;

/** User.name is set at onboarding; email is the fallback for older rows. */
function toPersonRef(person: Person): LeadPersonRef | null {
    if (!person) return null;
    return { id: person.id, name: person.name?.trim() || person.email };
}

function toLeadDTO(lead: LeadRow): LeadDTO {
    return {
        id: lead.id,
        // Rows created before lead management have no name; the list must
        // still render them rather than show an empty cell.
        fullName: lead.fullName ?? "Unnamed lead",
        email: lead.email,
        phone: lead.phone,
        jobTitle: lead.jobTitle,
        companyName: lead.companyName,
        companyId: lead.companyId,
        source: lead.source,
        status: lead.status,
        score: lead.score,
        owner: toPersonRef(lead.owner),
        nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
        deal: lead.deal,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
    };
}

function toNoteDTO(note: { id: string; body: string; createdAt: Date; author: Person }): LeadNoteDTO {
    return {
        id: note.id,
        body: note.body,
        createdAt: note.createdAt.toISOString(),
        author: toPersonRef(note.author),
    };
}

const CONVERT_ONLY = "A lead becomes Converted only through Convert to Deal.";

/**
 * Lead management for one workspace.
 *
 * Permissions: every role can read; SUPPORT can also add notes; SALES_REP can
 * create, edit, assign and convert; only ADMIN can delete.
 */
export class LeadService {
    constructor(private tenant: TenantContext) { }

    async list(query: LeadListQuery): Promise<LeadListDTO> {
        authorize(this.tenant, Role.VIEWER);

        const [rows, grouped] = await Promise.all([
            LeadRepository.list(this.tenant.workspaceId, {
                q: query.q || undefined,
                status: query.status,
                ownerId: this.resolveOwnerFilter(query.owner),
                cursor: query.cursor,
                // One extra row tells us whether another page exists without
                // a COUNT query.
                take: query.limit + 1,
            }),
            LeadRepository.stats(this.tenant.workspaceId),
        ]);

        const page = rows.slice(0, query.limit);
        const byStatus = Object.fromEntries(LEAD_STATUSES.map((status) => [status, 0])) as Record<
            LeadStatus,
            number
        >;
        let total = 0;
        for (const row of grouped) {
            total += row._count._all;
            if (row.status in byStatus) byStatus[row.status as LeadStatus] = row._count._all;
        }

        return {
            items: page.map(toLeadDTO),
            nextCursor: rows.length > query.limit ? page[page.length - 1].id : null,
            stats: {
                total,
                byStatus,
                conversionRate: total > 0 ? Math.round((byStatus.CONVERTED / total) * 100) : 0,
            },
        };
    }

    async get(id: string): Promise<LeadDetailDTO> {
        authorize(this.tenant, Role.VIEWER);

        const lead = await this.load(id);
        return { ...toLeadDTO(lead), notes: lead.notes.map(toNoteDTO) };
    }

    async create(data: CreateLeadDTO): Promise<LeadDTO> {
        authorize(this.tenant, Role.SALES_REP);

        if (data.status === "CONVERTED") throw new BadRequestError(CONVERT_ONLY);

        // Omitted owner = the creator; an explicit null stays unassigned.
        const ownerId = data.ownerId === undefined ? this.tenant.userId : data.ownerId;
        if (ownerId && ownerId !== this.tenant.userId) await this.assertMember(ownerId);
        if (data.companyId) await this.assertCompany(data.companyId);

        const lead = await LeadRepository.create(this.tenant.workspaceId, { ...data, ownerId });

        await AuditService.log(this.tenant.workspaceId, this.tenant.userId, "LEAD", lead.id, "CREATE");
        const dto = toLeadDTO(lead);
        await WebhookService.publish(this.tenant, "lead.created", dto);
        return dto;
    }

    async update(id: string, data: UpdateLeadDTO): Promise<LeadDTO> {
        authorize(this.tenant, Role.SALES_REP);

        const existing = await this.load(id); // Also the tenancy check.

        const statusChanged = data.status !== undefined && data.status !== existing.status;
        if (statusChanged && data.status === "CONVERTED") throw new BadRequestError(CONVERT_ONLY);
        if (statusChanged && existing.status === "CONVERTED") {
            throw new BadRequestError("This lead is already converted to a deal; its status can no longer change.");
        }

        const ownerChanged = data.ownerId !== undefined && data.ownerId !== existing.ownerId;
        if (ownerChanged && data.ownerId) await this.assertMember(data.ownerId);
        if (data.companyId && data.companyId !== existing.companyId) await this.assertCompany(data.companyId);

        const updated = await LeadRepository.update(id, data);

        const { status: _status, ownerId: _ownerId, ...otherFields } = data;
        if (statusChanged) await this.audit(id, "STATUS_CHANGE");
        if (ownerChanged) await this.audit(id, "ASSIGN");
        if (Object.keys(otherFields).length > 0) await this.audit(id, "UPDATE");

        const dto = toLeadDTO(updated);
        await WebhookService.publish(this.tenant, "lead.updated", dto);
        if (statusChanged) {
            await WebhookService.publish(this.tenant, "lead.status_changed", {
                id: dto.id,
                previousStatus: existing.status,
                status: dto.status,
                lead: dto,
            });
        }
        if (ownerChanged) {
            await WebhookService.publish(this.tenant, "lead.assigned", {
                id: dto.id,
                previousOwnerId: existing.ownerId,
                owner: dto.owner,
                lead: dto,
            });
        }
        return dto;
    }

    async remove(id: string): Promise<void> {
        authorize(this.tenant, Role.ADMIN);

        const lead = await this.load(id);
        await LeadRepository.remove(id);
        await this.audit(id, "DELETE");
        await WebhookService.publish(this.tenant, "lead.deleted", toLeadDTO(lead));
    }

    async addNote(id: string, input: LeadNoteInput): Promise<LeadNoteDTO> {
        authorize(this.tenant, Role.SUPPORT);

        await this.load(id);
        const note = await LeadRepository.createNote({
            workspaceId: this.tenant.workspaceId,
            leadId: id,
            authorId: this.tenant.userId,
            body: input.body,
        });

        await this.audit(id, "NOTE");
        return toNoteDTO(note);
    }

    async convertToDeal(leadId: string, data: ConvertLeadToDealDTO) {
        authorize(this.tenant, Role.SALES_REP);

        const lead = await this.load(leadId);
        if (lead.status === "CONVERTED" || lead.deal) {
            throw new BadRequestError("Lead is already converted");
        }

        const deal = await prisma.$transaction(async (tx) => {
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
        await WebhookService.publish(this.tenant, "lead.status_changed", {
            id: lead.id,
            previousStatus: lead.status,
            status: "CONVERTED",
        });
        await WebhookService.publish(this.tenant, "deal.created", deal);
        return deal;
    }

    /** Loads a lead in the caller's workspace; another workspace's lead is a 404. */
    private async load(id: string) {
        const lead = await LeadRepository.findById(this.tenant.workspaceId, id);
        if (!lead) throw new NotFoundError("Lead not found in this workspace");
        return lead;
    }

    private async assertMember(userId: string) {
        if (!(await WorkspaceMemberRepository.isMember(this.tenant.workspaceId, userId))) {
            throw new BadRequestError("The selected owner is not a member of this workspace.");
        }
    }

    /** Stops a lead (and the deal it converts into) linking another workspace's company. */
    private async assertCompany(companyId: string) {
        if (!(await LeadRepository.companyInWorkspace(this.tenant.workspaceId, companyId))) {
            throw new BadRequestError("The selected company does not belong to this workspace.");
        }
    }

    private resolveOwnerFilter(owner: string | undefined): string | null | undefined {
        if (!owner || owner === "all") return undefined;
        if (owner === "me") return this.tenant.userId;
        if (owner === "unassigned") return null;
        return owner;
    }

    private audit(entityId: string, action: string) {
        return AuditService.log(this.tenant.workspaceId, this.tenant.userId, "LEAD", entityId, action);
    }
}
