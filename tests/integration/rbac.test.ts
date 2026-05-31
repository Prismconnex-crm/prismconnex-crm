import { describe, it, expect } from "vitest";
import { authorize, Role } from "@/lib/rbac/authorize";
import { ForbiddenError } from "@/lib/http/errors";

describe("RBAC Authorization", () => {
    const adminTenant = { userId: "1", email: "a@a.com", workspaceId: "w1", role: "ADMIN" };
    const viewerTenant = { userId: "2", email: "v@v.com", workspaceId: "w1", role: "VIEWER" };
    const supportTenant = { userId: "3", email: "s@s.com", workspaceId: "w1", role: "SUPPORT" };

    it("allows ADMIN to perform SALES_REP actions", () => {
        expect(() => authorize(adminTenant, Role.SALES_REP)).not.toThrow();
    });

    it("prevents VIEWER from exporting CSV (requires ADMIN/SALES_REP)", () => {
        expect(() => authorize(viewerTenant, Role.SALES_REP)).toThrow(ForbiddenError);
    });

    it("prevents SUPPORT from launching sequence enrollment (requires ADMIN/SALES_REP)", () => {
        expect(() => authorize(supportTenant, Role.SALES_REP)).toThrow(ForbiddenError);
    });
});
