# Developer Runbook

## Setup & Run
1. `npm install`
2. Setup environment variables in `.env`.
3. Link database and build prisma client with `npx prisma generate`.
4. Run migrations via `npx prisma db push` or `npx prisma migrate dev`.
5. Apply mock testing data with `npx tsx prisma/seed.ts`.
6. Boot the application: `npm run dev`.

## Troubleshooting
- **Missing PrismaTypes / Type Errors**: Ensure `npx prisma generate` was run after pulling any schema changes relative to Prisma v7.
- **Route Access Denied immediately upon Login**: Ensure tokens are valid, and verify cookies are allowed in your browser to maintain the `pcx_session` state handler. Add `--debug` context if checking Cognito.
- **Workspace/Tenancy Error**: If deleting the Database, re-run `prisma/seed.ts` immediately to automatically reinstate the Admin fallback user dependencies.
