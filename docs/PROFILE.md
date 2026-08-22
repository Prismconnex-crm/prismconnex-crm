# Profile Page

The signed-in user's own profile: `/app/profile`.

Entry points: the topbar user menu ("Profile"), or the URL directly.
`components/crm/section-router.tsx` maps the `profile` slug to
`ProfileSection`.

---

## Layout

One card per concern, top to bottom, matching the order the page is read in:

| # | Card | Writes to |
|---|------|-----------|
| 1 | Profile header (photo, identity, status) | `/api/profile/avatar` |
| 2 | Personal Information | `/api/profile/personal` |
| 3 | Professional Information | `/api/profile/professional` |
| 4 | Account Information | *read-only* |
| 5 | Security (password, 2FA, sessions) | `/api/profile/password`, `/api/profile/mfa`, `/api/profile/sessions` |
| 6 | Preferences | `/api/profile/preferences` |
| 7 | Notification Settings | `/api/profile/notifications` |
| 8 | Activity | *read-only* (`/api/profile/activity`) |
| 9 | Account Actions | `/api/profile/account` |

State lives once, in `ProfileSection`. Each card receives the profile and
reports saves back through `onProfileChange`, which replaces it with the row the
server returned. Cards do not fetch or cache their own copy — that is what stops
the header showing a name the Personal card has already changed.

---

## Authorization

Every Profile route begins with `requireSessionUser()`
(`lib/auth/require-session.ts`), which reads the verified `pcx_session` cookie
and returns the Supabase user id.

**No Profile endpoint accepts a user id from a request body, query string or
header.** That is the whole of the "a user can only see and edit their own
profile" guarantee — there is no parameter to tamper with. Row Level Security on
`public.profiles` (own-row `SELECT`/`INSERT`/`UPDATE`, no `DELETE`) is the
second line of defence, and applies to direct anon-key browser access; the app's
own reads go through Prisma as `postgres`, which bypasses RLS by design.

Passwords are never stored, logged or proxied through our database. They go
straight to Supabase Auth and live only in `auth.users.encrypted_password`.

---

## Database changes

### Applied

`prisma/migrations/20260815120000_extend_profiles_for_profile_page/` — identical
copy at `supabase/sql/002_extend_profiles.sql` for the Supabase SQL editor. Adds
34 columns to `public.profiles`, all nullable or defaulted.

`prisma/migrations/20260822120000_add_profile_bio_and_links/` — identical copy
at `supabase/sql/005_profile_bio_and_links.sql`. Adds the last four fields the
Professional Information card owns: `company`, `bio`, `website`,
`linkedin_url`, all `text` and all nullable.

No index was added for those four. They are display-only — nothing filters,
sorts, joins or aggregates on them, and the page reads one row by primary key —
so an index would cost every profile save and serve no read.

`website` and `linkedin_url` store **absolute** URLs including the scheme.
`optionalUrl()` in `models/profile.ts` prefixes `https://` when the user omits
it and rejects any other scheme. Both halves matter: a bare `example.com` in an
`href` is resolved by the browser as a *relative* path, and an unrejected
`javascript:` URL is stored XSS in the anchor the card renders.

> Every column **must** stay nullable-or-defaulted. The
> `on_auth_user_created` trigger inserts only the seven original columns, and it
> runs inside the signup transaction — a `NOT NULL` column without a default
> would make that insert raise and **abort every signup**.

Also adds:
- `profiles_username_lower_key` — case-insensitive unique username, partial on
  `username IS NOT NULL`
- `profiles_account_status_idx` — partial, for filtering non-active accounts
- `profiles_set_updated_at` trigger — a `DEFAULT` only fires on INSERT, so
  without this `updated_at` would record creation time forever

RLS needed no changes: policies filter *rows*, so every new column is covered by
the existing own-row rules.

### Storage

`supabase/sql/003_avatars_storage.sql` — creates the `avatars` Storage bucket
(public, **5 MiB**, images only) and its four RLS policies. There is no Prisma
counterpart: `storage.objects` is not a schema Prisma manages, so this file is
the only definition.

**Applied** — verified against the live project on 2026-08-22: the bucket
exists with a 5242880-byte limit and the PNG/JPEG/JPG/WebP/GIF mime list, and
`avatars_public_read`, `avatars_insert_own`, `avatars_update_own` and
`avatars_delete_own` are all present. If you rebuild the project from scratch,
run it in **Supabase Dashboard → SQL Editor**; until it is run, photo upload
fails with a "bucket does not exist" error.

The 5 MiB limit is enforced twice: at the bucket, and again by
`MAX_AVATAR_BYTES` in `lib/supabase/storage.ts`. Keep the two in step — if the
bucket is the stricter of the two, the readable server-side error is skipped
and the failure surfaces from Storage instead.

---

### Migration-history drift (pre-existing)

`_prisma_migrations` in the live project has two rows for
`20260801_add_company_contact` — one `finished_at IS NULL` (a failed attempt)
and one successful — and a row for `20260819120000_add_user_sessions_valid_from`
whose folder is no longer in `prisma/migrations/`.

**`prisma migrate deploy` will refuse to run** while the failed row is there,
reporting the migration as failed. This predates the Profile page and is
untouched here because clearing it means deleting a row from migration history,
which is the project owner's call. Resolve it with either:

```
npx prisma migrate resolve --applied 20260801_add_company_contact
# or, if that attempt genuinely did nothing:
npx prisma migrate resolve --rolled-back 20260801_add_company_contact
```

Until then, apply new migrations the way `20260822120000_add_profile_bio_and_links`
was: run the `supabase/sql/*.sql` twin in the Dashboard SQL Editor, then record
it with `prisma migrate resolve --applied <name>`.

---

## Known limitations

These are deliberate, and the UI states each one rather than hiding it.

### Account deletion is a soft delete

`account_status = 'deleted'`, personal data scrubbed, all sessions revoked,
sign-in refused. The `auth.users` row survives.

Removing it requires `DELETE /auth/v1/admin/users/{id}`, which needs the
**service_role** key. This project holds only `SUPABASE_ANON_KEY`. To enable a
true hard delete: add `SUPABASE_SERVICE_ROLE_KEY` to `.env` and `lib/env.ts`,
then call that endpoint from `ProfileService.softDelete`. The delete modal says
plainly that the login record is retained.

### Active sessions shows one device

GoTrue exposes no user-facing "list my sessions" endpoint; the only enumeration
is a service_role admin call. So the panel reports what it can prove — this
browser (user-agent, IP, signed-in time) — plus a working "log out from all
devices", which uses the existing `scope=global` revocation.

A real multi-device list needs a `user_sessions` table written on every sign-in
and cleared on sign-out.

### CRM counters are workspace-scoped

`Lead`, `Deal` and `Contact` have a `workspaceId` but **no owner column**, so
per-user attribution is impossible with the current schema. Each counter is
returned with an explicit `scope` and the UI prints it as a `YOU` / `WORKSPACE`
badge. `Task` has `ownerId`, so task counts are genuinely per-user.

Adding `ownerId` to Lead/Deal/Contact would make the rest per-user; it is not
done here because it touches the creation path of three CRM sections.

### Audit trail may be unavailable

The live database's `AuditLog` table has only
`(id, workspaceId, userId, action)`, while `prisma/schema.prisma` also declares
`entity`, `entityId` and `createdAt`. This drift **predates the Profile page**
and belongs to the still-unapplied `20260801_add_company_contact` migration.

Prisma selects all scalar fields by default, so a plain `findMany()` raises
*"The column AuditLog.entity does not exist"*. `readRecentActivity` isolates that
failure so it degrades to an "Audit trail unavailable" empty state instead of
taking the whole Activity card down. It starts working on its own once the
pending migration is applied.

### Notification toggles are preferences only

Nothing in this codebase sends email, SMS or push yet. The card says so.

---

## Two-factor authentication

TOTP, via Supabase's `/factors` endpoints (wrapped in `lib/supabase/gotrue.ts`).

**An enrolled factor is inert until verified.** `beginMfaEnrolment` returns a
secret and QR, but the factor stays `unverified` and gates nothing until the
first code is confirmed. Only `status === "verified"` counts as "2FA on"
anywhere in this codebase — treating enrolment alone as protection would leave a
user who scanned the QR and wandered off believing they were secured.

### Sign-in flow

Supabase returns an `aal1` session for a password grant **even when the user has
a verified factor** — it does not refuse. The gate is ours:

```
POST /api/auth/sign-in
  password verified by Supabase
  verified TOTP factor?
    no  -> mint pcx_session, done          (unchanged for everyone without 2FA)
    yes -> park the aal1 session in pcx_mfa (httpOnly, 5 min)
           respond { mfaRequired: true }    — NO pcx_session is issued
POST /api/auth/mfa-challenge
  code verified -> aal2 session -> mint pcx_session, clear pcx_mfa
```

`pcx_mfa` is not a session and grants nothing. It is short-lived because a
long-lived one would be a password-only bypass of the second factor.

**The same gate is in the OAuth callback.** Supabase links a Google/Microsoft
identity to an existing account by email, so without it anyone who enrolled TOTP
after signing up with a password could skip it by clicking "Continue with
Google". The callback redirects to `/auth/sign-in?mfa=1`, which renders the code
step directly.

Changing password or MFA needs a *live* Supabase access token, but ours expire
after an hour while `pcx_session` lasts eight.
`lib/supabase/access-token.ts` refreshes on demand and **persists the rotated
pair** — Supabase rotates refresh tokens, so dropping the new pair would leave a
spent token in the cookie.

---

## Testing

Sign in with a real email/password account (OAuth-only and mock sessions carry
no Supabase tokens, so the security actions correctly report themselves
unavailable).

| Feature | How |
|---|---|
| Photo upload | Run `003_avatars_storage.sql` first. Upload > 2 MB or a PDF → rejected with a readable message |
| Personal info | Edit → enter phone `12345` → inline error; fix → Save |
| Email change | Change the address → confirmation link is emailed; the column only moves once confirmed |
| Professional | Add skills with Enter/comma; duplicates (differing only in case) are dropped |
| Company / About | Edit → Save → reopen: both persist. A bio over 1000 chars is refused inline |
| Website / LinkedIn | Type `linkedin.com/in/you` → saved as `https://linkedin.com/in/you`, and the read view links to it. `javascript:alert(1)` → rejected inline |
| Password | Wrong current password → "Your current password is incorrect" |
| 2FA | Enable → scan QR → enter code. Then sign out and back in: the code step appears |
| 2FA via OAuth | With 2FA on, "Continue with Google" also lands on the code step |
| Sessions | "Log out from all devices" → every device signed out |
| Deactivate | Signs you out; sign in again and Reactivate from Account Actions |
| Delete | Type anything but `DELETE` → button stays disabled, and the API rejects it too |
| Reduced motion | Status messages stop animating; nothing becomes unreadable |
| Mobile | Cards stack; no horizontal page scroll |

Supabase's built-in SMTP allows only a few emails per hour project-wide, which
is the usual reason an email-change confirmation does not arrive.
