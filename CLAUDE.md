# Prismconnex CRM — Project Guide

Multi-tenant B2B CRM built with **Next.js 14 (App Router) + TypeScript + Prisma + SQLite + Tailwind**. Focus areas: company discovery at large scale, trade-show ("Find Shows") discovery, leads → deals pipeline, email sequences.

> **⚠️ Disk-space constraint (applies to ALL AI agents/models):** The owner's C: drive has previously filled up during coding sessions, freezing the entire system — the project was moved to D: because of it. Do NOT install dependencies, generate large files, or run seed/build/benchmark steps unless explicitly asked. Keep all temp/large data on D:, never C:. After heavy SQLite writes, checkpoint the WAL (`PRAGMA wal_checkpoint(TRUNCATE)`) so the journal doesn't balloon beside the 27 GB DB.

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` / `npm start` — production
- `npm run lint` — next lint
- `npm test` — vitest in **watch mode**; use `npx vitest run` for one-shot (tests in `tests/integration`, node environment, `@/` alias = repo root, setup in `tests/setup.ts`)
- `npx vitest run tests/integration/rbac.test.ts` — run a single test file
- `npm run sqlite:optimize` — apply SQLite pragmas/indexes for the Company table
- `npm run benchmark:companies:before|after` — company query benchmarks

## Database (important)

- SQLite via Prisma. `DATABASE_URL="file:./dev.db"` resolves **relative to `prisma/`**, so the live DB is `prisma/dev.db` — it is **~27 GB** with millions of seeded Company rows. Never copy/back it up casually, never run `prisma migrate reset` or destructive commands against it without explicit user confirmation.
- The root-level `dev.db` (168 KB) is stale/unused.
- Prisma client singleton: `lib/db/prisma.ts` (applies WAL/cache PRAGMAs on startup).
- Company perf work: raw SQL in `app/api/companies/route.ts` (cursor pagination on `rowid`, NOCASE prefix search on `name`), indexes in `prisma/migrations/20260616000000_optimize_company_sqlite/`. OpenSearch was tried and removed (see git history).
- `prisma/seed-*.ts` — many one-off seed scripts from scaling experiments; `scripts/` has similar one-off utilities.

## Architecture (docs/ARCHITECTURE.md; see also docs/ENV.md, docs/RUNBOOK.md, docs/TENANCY_RBAC.md)

MVC-ish layering, only fully realized for Leads so far:
- `models/` — Zod schemas + DTO types (e.g. `models/lead.ts`)
- `repositories/` — Prisma queries, tenant-scoped by `workspaceId`
- `services/` — business logic + audit logging (`lib/audit/audit.service.ts`)
- `app/api/*/route.ts` — controllers: `resolveTenant()` → `validateBody()` → service → `jsonOk`/`jsonError` (`lib/http/`)
- `components/` — UI only

**Exception:** `/api/companies` intentionally bypasses tenancy/Prisma and queries the whole Company table with raw SQL for speed (it's a shared discovery dataset, not workspace data).

## Auth & tenancy

- AWS Cognito intended for prod (`lib/auth/cognito.ts`, `aws-jwt-verify`), but currently **demo mode**: `/api/auth/sign-in` signs a local HS256 JWT (`lib/auth.ts`, fallback secret `prismconnex-dev-secret`) into the `pcx_session` cookie. All Cognito env vars are optional (`lib/env.ts`).
- `lib/auth/tenant.ts` → `resolveTenant()` returns `{userId, email, workspaceId, role}`; uses the user's **first** membership (no workspace switching yet).
- RBAC: `lib/rbac/authorize.ts` — role hierarchy VIEWER < SUPPORT < SALES_REP < ADMIN.
- `middleware.ts` handles locale redirects + auth gating via cookies (`pcx_session`, `pcx_onboarded`, `pc_locale`/`pcx_locale`); API routes are excluded from middleware.

## Routing / UI

- Route groups: `app/(public)` marketing pages, `app/(auth)` sign-in/up/onboarding, `app/(app)/app/[...slug]` — the whole CRM app is one catch-all rendering `components/crm/section-router.tsx` (dashboard, events, companies, people, leads, deals, sequences, automation, analytics, integrations, deliverability, team, settings, audit-log).
- `app/[locale]/(public)` duplicates the public pages for i18n (next-intl, 8 locales, `i18n/routing.ts`, messages in `messages/*.json`). Changes to public pages usually need to be made in **both** trees.
- CRM sections in `components/crm/*.tsx` are large client components; most non-company data is still mock/hardcoded inside them. `components/ui/` = shadcn-style primitives; Radix + framer-motion + lucide throughout.
- Styling convention: Tailwind with explicit dark-mode hex tokens (`dark:bg-[#111B2E]`, borders `#22304A`) and bracketed font sizes (`text-[13px]`).

## Find Shows

Public trade-show discovery: `components/find-shows/*`, data from `data/find-shows-seed.json` via `lib/find-shows/catalog.ts`, exhibitor scraping/import via `scripts/import-eventseye-country.mjs` and `lib/find-shows/eventseye.ts`.

## Gotchas

- `/api/companies` search uses a prefix-range trick (`name >= ? AND name < ?` COLLATE NOCASE) — prefix-only matching, by design; `formatCompany` strips trailing numeric suffixes from seeded names.
- `total`/`totalPages` are deliberately `null` (COUNT(*) on 27 GB is too slow); UI uses cursor-based next/prev.
- Some API routes throw plain `Error("Unauthorized")` which `jsonError` maps to 500, not 401 — use `UnauthorizedError` from `lib/http/errors.ts` in new code.
- Company logos come from `logo.clearbit.com/<domain>` with a heuristic (`isRealDomain`) to skip generated seed domains.
