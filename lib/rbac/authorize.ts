import { TenantContext } from "../auth/tenant";
import { ForbiddenError } from "../http/errors";

export enum Role {
    ADMIN = "ADMIN",
    SALES_REP = "SALES_REP",
    SUPPORT = "SUPPORT",
    VIEWER = "VIEWER"
}

const roleHierarchy: Record<string, number> = {
    [Role.VIEWER]: 1,
    [Role.SUPPORT]: 2,
    [Role.SALES_REP]: 3,
    [Role.ADMIN]: 4,
};

export function hasPermission(userRole: string, requiredRole: string) {
    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    return userLevel >= requiredLevel;
}

export function authorize(tenant: TenantContext, requiredRole: Role) {
    if (!hasPermission(tenant.role, requiredRole)) {
        throw new ForbiddenError(`Requires ${requiredRole} privileges`);
    }
}
