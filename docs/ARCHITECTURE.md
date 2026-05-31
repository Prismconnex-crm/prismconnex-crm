# Architecture: Prism Connex

## MVC Foundation
This project follows a strict MVC pattern adapted for Next.js App Router to remain maintainable while supporting multi-tenant isolation.
- **Models**: Defines Zod schemas and DTO types (`/models`).
- **Repositories**: Encapsulates Prisma queries. Operations enforce tenant isolation by requiring `workspaceId` (`/repositories`).
- **Services**: Pure business logic, RBAC validation via Authorization utility, and Audit Log triggers (`/services`).
- **Controllers**: Next.js API Routes. They resolve the tenant context, parse inputs via `lib/http/validate.ts`, invoke services, and standardize outputs via `lib/http/response.ts` (`/app/api`).
- **Views**: React client/server components focusing strictly on UI and data presentation (`/components`).
