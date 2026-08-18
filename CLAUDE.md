# Prismconnex CRM — Project Guide

Multi-tenant B2B CRM built with **Next.js 14 (App Router) + TypeScript + Prisma + SQLite + Tailwind**. Focus areas: company discovery at large scale, trade-show ("Find Shows") discovery, leads → deals pipeline, email sequences.

> **⚠️ Disk-space constraint (applies to ALL AI agents/models):** The owner's C: drive has previously filled up during coding sessions, freezing the entire system — the project was moved to D: because of it. Do NOT install dependencies, generate large files, or run seed/build/benchmark steps unless explicitly asked. Keep all temp/large data on D:, never C:. After heavy SQLite writes, checkpoint the WAL (`PRAGMA wal_checkpoint(TRUNCATE)`) so the journal doesn't balloon beside the 27 GB DB.

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` / `npm start` — production
- `npm run lint` — next lint
- `npm test` — vitest in **watch mode**; use `npx vitest run` for one-shot (tests in `tests/integration`, node environment, `@/` alias = repo root, setup in `tests/setup.ts`)
- `npx vitest run tests/integration/rbac.test.ts` — run a single test file
- `npm run db:seed` — seed demo user/workspace + 500 companies into Postgres
- `npm run generate:sqlite` — regenerate the SQLite companies client (also runs on `postinstall`)
- `npm run sqlite:optimize` — apply SQLite pragmas/indexes for the Company table (heavy — see Database)
- `npm run benchmark:companies:before|after` — company query benchmarks

## Database (important)

**Two databases** since the 2026-07 Postgres migration:

- **CRM data → local PostgreSQL 17** (portable install, nothing on C:): binaries `D:\PostgreSQL\pgsql`, data `D:\PostgreSQL\data`, start/stop via `D:\PostgreSQL\start-postgres.cmd` / `stop-postgres.cmd` (must be running for the app). DB `prismconnex_dev`, user `postgres`, password `prismconnex_local`, `DATABASE_URL` in `.env`. Prisma client singleton: `lib/db/prisma.ts`. Migrations in `prisma/migrations/` (fresh Postgres baseline; the old SQLite one is archived in `prisma/migrations-sqlite-archive/`).
- **Company discovery dataset → PostgreSQL**, table `"DiscoveryCompany"`, queried with raw SQL through `lib/db/prisma.ts`. Query construction lives in `lib/companies/search.ts` (prisma imported lazily so the module can be pulled into a test's import graph without constructing a client); `app/api/companies/route.ts` is a thin caller. `total`/`totalPages` are deliberately `null` — counting per request is too slow, so the UI pages by cursor on `rowCursor`. The legacy SQLite client (`prisma/sqlite-companies.prisma`, `lib/db/sqlite-companies.ts`, `lib/generated/sqlite-client`) is no longer the live path; the `prisma/dev.db` on a dev machine may be a 4 KB stub rather than the old 27 GB file.
- Company perf: raw SQL in `app/api/companies/route.ts` (cursor pagination on `rowid`, NOCASE prefix search on `name`). ⚠️ The live `dev.db` currently has **no index on `name`** (only category/employeeRange/region/filters), so prefix search full-scans (~60 s cold). `npm run sqlite:optimize` builds `idx_company_name_nocase` — heavy multi-minute write on the 27 GB file, run only when explicitly asked (checkpoint the WAL afterwards). OpenSearch was tried and removed (see git history).
- `prisma/seed.ts` (`npm run db:seed`, runs via node type-stripping) seeds demo user/workspace + 500 companies into Postgres. `prisma/seed-*.ts` — one-off scripts from SQLite scaling experiments; `scripts/*.js` SQLite utilities now require `lib/generated/sqlite-client`.

## Architecture (docs/ARCHITECTURE.md; see also docs/ENV.md, docs/RUNBOOK.md, docs/TENANCY_RBAC.md)

MVC-ish layering, only fully realized for Leads and Saved Companies so far:
- `models/` — Zod schemas + DTO types (e.g. `models/lead.ts`)
- `repositories/` — Prisma queries, tenant-scoped by `workspaceId`
- `services/` — business logic + audit logging (`lib/audit/audit.service.ts`)
- `app/api/*/route.ts` — controllers: `resolveTenant()` → `validateBody()` → service → `jsonOk`/`jsonError` (`lib/http/`)
- `components/` — UI only

**Exception:** `/api/companies` intentionally bypasses tenancy and queries the whole `"DiscoveryCompany"` table with raw SQL via `lib/companies/search.ts` for speed (it's a shared discovery dataset, not workspace data).

**Assistant routing:** `POST /api/assistant/chat` classifies every question into `companies | events | people` before answering, then either answers inline or returns a navigation handoff. `lib/assistant/` holds the router; each entity is an `EntityAdapter` in `lib/assistant/adapters/` that owns its own filter type, search and prose — an adapter cannot return another entity's rows, which is what prevents wrong-entity answers. Signal words live once in `lib/assistant/signals.ts` and feed both the deterministic classifier and the model prompt. Confidence is computed from the two classifiers' agreement, never self-reported by the model. Swap an adapter in tests via `setAdapterForTests`/`resetAdapters` in `lib/assistant/registry.ts` so the suite never touches a database. Two legacy AI routes remain — `/api/companies/ask` and `/api/events/search` — used only by the Companies page and deleted in Spec 2c. The Events and People legacy routes were removed in Spec 2b.

**Assistant conversation (UI):** `components/assistant/` holds one conversation shared across Companies, Events and People. `AssistantConversationProvider` is mounted in `components/app-shell/app-shell.tsx` — an App Router layout persists across navigation within its segment, so the thread survives a page handoff with plain React state; `sessionStorage` only covers a refresh. All behaviour lives in pure, node-tested modules (`conversation-reducer.ts`, `handoff.ts`, `session-mirror.ts`, `stream-reader.ts`, `bindings/*`) because the repo has no jsdom, React Testing Library or Playwright — React components here are deliberately thin and untested. A cross-page question is two requests: phase one classifies and returns `action: 'navigate'` with no rows; phase two re-sends with `forceEntity` + `presetFilters`, which skips both classifiers so a navigate→navigate bounce cannot be expressed. People and Events are migrated; Companies still runs the legacy `/api/companies/ask` path and migrates in Spec 2c (`hasBinding` guards it until then). Events uses one filter stack for both the rail and the assistant: the array-valued `EventQueryState` in `lib/events/` (`filterEventList`, `computeEventFacets`, `buildEventFilterChips`, `buildEventAnswer`). `favouritesOnly` is deliberately absent from the events tool schema — favourites live in browser `localStorage`, so the server passes an empty set and could never match it. `lib/find-shows/filter-events.ts` and the scalar `EventFilters` in `models/event-query.ts` survive only for the Companies page.

## Auth & tenancy

- AWS Cognito intended for prod (`lib/auth/cognito.ts`, `aws-jwt-verify`), but currently **demo mode**: `/api/auth/sign-in` signs a local HS256 JWT (`lib/auth.ts`, fallback secret `prismconnex-dev-secret`) into the `pcx_session` cookie; `getSessionPayload` verifies Cognito first, then falls back to the local HS256 session. All Cognito env vars are optional (`lib/env.ts`). Demo sign-in email must be `demo@prismconnex.com` (the seeded user) for tenant-scoped APIs to resolve.
- `lib/auth/tenant.ts` → `resolveTenant()` returns `{userId, email, workspaceId, role}`; uses the user's **first** membership (no workspace switching yet).
- RBAC: `lib/rbac/authorize.ts` — role hierarchy VIEWER < SUPPORT < SALES_REP < ADMIN.
- `middleware.ts` handles locale redirects + auth gating via cookies (`pcx_session`, `pcx_onboarded`, `pc_locale`/`pcx_locale`); API routes are excluded from middleware.

## Routing / UI

- Route groups: `app/(public)` marketing pages, `app/(auth)` sign-in/up/onboarding, `app/(app)/app/[...slug]` — the whole CRM app is one catch-all rendering `components/crm/section-router.tsx` (dashboard, events, companies, people, leads, deals, sequences, automation, analytics, integrations, deliverability, team, settings, audit-log).
- `app/[locale]/(public)` duplicates the public pages for i18n (next-intl, 8 locales, `i18n/routing.ts`, messages in `messages/*.json`). Changes to public pages usually need to be made in **both** trees.
- `components/crm/events-section.tsx` is now a thin router over `components/events/{event-detail-view,exhibitor-detail-view,ticket-booking-view,event-list-view}.tsx` (the exhibitor and ticket views have had no caller since the initial commit and are kept unwired). Other CRM sections in `components/crm/*.tsx` are large client components; most non-company data is still mock/hardcoded inside them. `components/ui/` = shadcn-style primitives; Radix + framer-motion + lucide throughout.
- Styling convention: Tailwind with explicit dark-mode hex tokens (`dark:bg-[#111B2E]`, borders `#22304A`) and bracketed font sizes (`text-[13px]`).

## Find Shows

Public trade-show discovery: `components/find-shows/*`, data from `data/find-shows-seed.json` via `lib/find-shows/catalog.ts`, exhibitor scraping/import via `scripts/import-eventseye-country.mjs` and `lib/find-shows/eventseye.ts`.

## Gotchas

- `/api/companies` search uses a prefix-range trick (`name >= ? AND name < ?` COLLATE NOCASE) — prefix-only matching, by design; `formatCompany` strips trailing numeric suffixes from seeded names.
- `total`/`totalPages` are deliberately `null` (COUNT(*) on 27 GB is too slow); UI uses cursor-based next/prev.
- Some API routes throw plain `Error("Unauthorized")` which `jsonError` maps to 500, not 401 — use `UnauthorizedError` from `lib/http/errors.ts` in new code.
- Company logos come from `logo.clearbit.com/<domain>` with a heuristic (`isRealDomain`) to skip generated seed domains.
