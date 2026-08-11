# Sign-up company auto-detection — design

Date: 2026-08-04

## Goal

Add a Company Name field to the Sign Up form that fills itself from the email
domain. `john@fidensgen.com` → look up `fidensgen.com` → fill "FidensGen
Business Solutions Private Limited". No match means an empty field, no error,
and no company is ever created.

## Where things are

- Form: `app/(auth)/auth/sign-up/page.tsx` → `components/auth/auth-landing.tsx`
  → `auth-tabs.tsx` → **`components/auth/sign-up-form.tsx`**. There is no
  `app/[locale]/(auth)` duplicate, so the form exists once.
- Data: Supabase Postgres, reached through Prisma (`lib/db/prisma.ts`).
  `@supabase/supabase-js` is deliberately not a dependency — `lib/supabase/gotrue.ts`
  wraps the Auth REST API only, and all table access is Prisma.
  - `Company` — workspace-scoped CRM records. **500 rows, every one with a
    domain**, all owned by the single demo workspace. Clean Fortune-list names
    (`google.com` → "Google").
  - `DiscoveryCompany` — 383,136 rows (256,804 with a domain), `name` /
    `domain` / `website`. The bulk discovery dataset, shared and not
    workspace-scoped.
  - `CompanyContact` — the People records behind `/api/people`; `email` +
    `companyId` → `DiscoveryCompany.id`. 1 row.
  - `profiles` — id, first/middle/last name, email, phone. No company column.

## Decisions

**The field is display-only.** `companyName` is not added to the sign-up POST
body, not added to `createSignUpSchema`, and not persisted. `profiles` has no
company column and requirement 6 is to leave sign-up validation and auth
untouched, so nothing downstream of the form changes.

**Match `Company` first, then `DiscoveryCompany`, then `CompanyContact`.**

> Revised 2026-08-05. The original version of this spec recorded `Company` as
> having 0 rows and skipped it entirely. That was wrong — the table holds 500
> seeded rows, and only 213 of their domains also appear in `DiscoveryCompany`.
> Skipping it lost 287 domains, `google.com` among them, which is why the
> `john@google.com` example filled nothing.

`Company` leads because its rows are curated: clean names, no numeric seed
suffix, and coverage of well-known domains the bulk import missed.
`DiscoveryCompany` follows for reach (383k vs 500). `CompanyContact` is last
because inferring an employer from one person's mailbox is weaker evidence than
a domain column.

**Open tenancy risk.** `Company` is workspace-scoped and this endpoint is
unauthenticated, so the lookup reads across all workspaces — there is no session
at sign-up time to scope it to one. Acceptable while the table holds public
Fortune-list names in the single demo workspace. Once real tenants own rows it
will disclose their company names to anonymous callers, and the step must
either be restricted to a designated public workspace or dropped in favour of
`DiscoveryCompany` alone.

**An index is required.** `DiscoveryCompany` had no index on `domain`; a
`lower(domain) = $1` lookup measured **7.7 s**. The migration adds
`idx_discovery_domain_lower` on `(lower(domain), "rowCursor")`.

The second column is not decoration. With a `lower(domain)`-only index the
planner ignored it and walked the primary key in `rowCursor` order to satisfy
the `ORDER BY "rowCursor" ASC LIMIT 1` tie-break — fast for a low rowCursor
(`fidensgen.com`, 360 ms) but 10 s for a high one (`amazon.com`). Carrying
`rowCursor` in the index makes the matching entries pre-sorted, so the scan
stops at the first. Measured after: `EXPLAIN` shows
`Index Scan using idx_discovery_domain_lower`, ~200 ms end to end including the
round trip to ap-south-1.

## Matching logic

```
email  "john@fidensgen.com"
  |  extractEmailDomain(): lowercase, take after last '@', strip trailing dot,
  |  require a dot and valid host characters
domain "fidensgen.com"
  |  isFreeEmailProvider(): gmail / yahoo / outlook / rediffmail / ... -> no lookup,
  |  because a personal mailbox says nothing about an employer
  |  GET /api/companies/by-domain?domain=fidensgen.com
  |     1. Company where lower(domain) = domain
  |          order by createdAt asc, take 1          -> source "company"
  |     2. DiscoveryCompany where lower(domain) = domain
  |          order by rowCursor asc, take 1          -> source "discovery"
  |          (duplicate domains exist in this table)
  |     3. CompanyContact where lower(split_part(email,'@',2)) = domain
  |          -> companyId -> DiscoveryCompany.name   -> source "people"
  |     4. none -> { company: null }, HTTP 200
  |  strip trailing numeric suffix from the name, matching formatCompany()
  |  in app/api/companies/route.ts ("Sharma Build Enterprises 1817039")
name   "FidensGen Business Solutions Private Limited"
```

Step 2 exists because the original requirement named People data as a source.
It is ordered second because a bulk-dataset domain match is the more direct
answer and `CompanyContact` currently holds one row.

A miss is never an error: the route returns 200 with `company: null`, and the
client swallows network failures too.

## Client behaviour

- Lookup fires on email **blur** and on a 400 ms debounce while typing.
- Responses carry a request id; stale ones are discarded so a slow reply for an
  older email cannot overwrite a newer result.
- Auto-fill writes the Company Name field only while the user has not typed in
  it. After any manual edit the field is theirs and is never overwritten.
- The field is always editable, and empty on no match.

## Layering

| Layer | File |
|---|---|
| pure helper | `lib/auth/email-domain.ts` |
| model | `models/company-lookup.ts` — Zod query schema + `CompanyMatchDTO` |
| repository | `repositories/company-lookup.repository.ts` — Prisma queries |
| service | `services/company-lookup.service.ts` — order, name cleanup |
| controller | `app/api/companies/by-domain/route.ts` |
| UI | `components/auth/sign-up-form.tsx`, `components/auth/form-field.tsx` |

Also: `messages/*.json` (9 locales), a `prisma.schema` comment recording the
expression index, and the migration.

## Testing

`tests/integration/email-domain.test.ts` covers extraction and the free-provider
blocklist as pure functions — no database (39 cases).

The route was verified against the live Supabase data through a running dev
server (re-run 2026-08-05 after the `Company` step was added):

| domain | result | source |
|---|---|---|
| `google.com` | Google | company |
| `apple.com` | Apple | company |
| `amazon.com` | Amazon | company |
| `fidensgen.com` | FidensGen Business Solutions Private Limited | discovery |
| `nosuchdomain.example` | `{"company":null}` | — |
| `not a domain` | `{"company":null}` | — |
| *(empty)* | `{"company":null}` | — |

Every miss is `HTTP 200`. `fidensgen.com` still resolving through the discovery
step is the check that adding `Company` in front did not cost the 383k-row
reach.

The React hook is not unit-tested: `vitest` runs in the node environment here
and testing it would require adding `jsdom` and `@testing-library/react`, which
the project's disk-space constraint rules out. Its behaviour was reasoned
through case by case (stale response, user edit, domain change, request
failure) and the field was confirmed to render and post nothing.
