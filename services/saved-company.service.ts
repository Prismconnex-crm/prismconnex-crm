import { SavedCompanyRepository } from "@/repositories/saved-company.repository";
import { SaveCompanyDTO } from "@/models/saved-company";
import { AuditService } from "@/lib/audit/audit.service";
import { TenantContext } from "@/lib/auth/tenant";

export class SavedCompanyService {
    constructor(private tenant: TenantContext) { }

    async list() {
        return SavedCompanyRepository.findMany(this.tenant.workspaceId);
    }

    async save(data: SaveCompanyDTO) {
        const saved = await SavedCompanyRepository.upsert(this.tenant.workspaceId, data);

        await AuditService.log(
            this.tenant.workspaceId,
            this.tenant.userId,
            "SAVED_COMPANY",
            saved.companyId,
            "SAVE"
        );
        return saved;
    }

    async remove(companyId: string) {
        await SavedCompanyRepository.delete(this.tenant.workspaceId, companyId);

        await AuditService.log(
            this.tenant.workspaceId,
            this.tenant.userId,
            "SAVED_COMPANY",
            companyId,
            "REMOVE"
        );
    }
}
