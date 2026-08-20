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

### Still to run by hand

`supabase/sql/003_avatars_storage.sql` — creates the `avatars` Storage bucket
(public, 2 MiB, images only) and its RLS policies. **Photo upload returns a
"bucket does not exist" error until this is run.** There is no Prisma
counterpart: `storage.objects` is not a schema Prisma manages.

Run it in **Supabase Dashboard → SQL Editor**.

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
