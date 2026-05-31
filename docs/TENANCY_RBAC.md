# Tenancy & RBAC

## Tenant Isolation
Prism Connex is a multi-tenant SaaS application. Every entity (Company, Contact, Lead, Event, Deal, Sequence) includes a strict `workspaceId` constraint.
- The `resolveTenant` utility (`lib/auth/tenant.ts`) extracts `workspaceId` seamlessly from the user session.
- Every repository method strictly takes `workspaceId` as its first argument to prevent cross-tenant data leaks. Controllers must pass this down.

## Role-Based Access Control (RBAC)
Auth levels:
1. `ADMIN`
2. `SALES_REP`
3. `SUPPORT`
4. `VIEWER`

Role hierarchy is enforced at the Application level in `services/` using the `authorize(tenant, requiredRole)` utility. Higher precedence roles can seamlessly perform actions designated for lower precedence roles.
