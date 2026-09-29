# Signup email verification (OTP)

How `/auth/sign-up → /auth/verify` works, and the two Supabase **Dashboard**
settings it depends on that no amount of code can substitute for.

## The flow

```
POST /api/auth/sign-up
  └─ AuthService.signUp
       └─ gotrue.signUp            → POST {SUPABASE_URL}/auth/v1/signup
            · Supabase creates auth.users row
            · generates a 6-digit OTP, stores it hashed in
              auth.users.confirmation_token (sha224 → 56 hex chars)
            · stamps auth.users.confirmation_sent_at
            · hands the message to whichever SMTP the project is configured with
  └─ no session in the response ⇒ emailConfirmationRequired: true
       ⇒ sign-up-form.tsx redirects to /auth/verify?email=…

POST /api/auth/verify  { email, code }
  └─ AuthService.verify
       ├─ SignUpOtpRepository.findConfirmationSentAt   ← the 90s gate
       │    older than 90s ⇒ OtpExpiredError (HTTP 410)
       └─ gotrue.verifySignUpOtp  → POST /auth/v1/verify { type:"signup", … }
            ⇒ auth.users.email_confirmed_at is set
       ⇒ redirect to /auth/sign-in?verified=true

POST /api/auth/resend  { email }
  ├─ cooldown gate: last send under 60s ago ⇒ 429 "wait N seconds"
  └─ gotrue.resendSignUpOtp  → POST /auth/v1/resend { type:"signup", … }
       · new OTP, new confirmation_sent_at ⇒ the 90s window restarts
```

No `@supabase/supabase-js` is involved: this project talks to GoTrue's REST API
directly (`lib/supabase/gotrue.ts`), which is why there are no supabase-js
version concerns. The wire calls are the exact equivalents —
`supabase.auth.signUp()` → `POST /auth/v1/signup`,
`supabase.auth.verifyOtp({ email, token, type:'signup' })` →
`POST /auth/v1/verify`, and `supabase.auth.resend({ type:'signup', email })` →
`POST /auth/v1/resend`.

## Resend cooldown

`RESEND_COOLDOWN_SECONDS` (60s, `models/auth.ts`) is enforced in
`AuthService.resendSignUpOtp` from the same `confirmation_sent_at` the expiry
gate reads, so hammering `/api/auth/resend` directly is refused with an exact
wait time instead of spending a message from Supabase's quota. It is shorter than
the 90s TTL on purpose: Resend is only offered once the code has expired, by
which point the cooldown has always elapsed, so it never blocks the real path.

Two different 429s can surface, and the page shows both verbatim rather than
flattening them, because they need different actions: ours ("Please wait N
seconds…") means wait, Supabase's ("Too many emails have been sent from this
Supabase project…") means configure custom SMTP.

## Existing unverified users

Signing up again with an address that already has an unconfirmed account does
**not** create a duplicate: GoTrue re-sends the confirmation for that same user.
For an already-*confirmed* address it returns an obfuscated user with a
fabricated id (enumeration protection), which has no `auth.users` row — the
`P2003` branch in `ProfileRepository.createIfMissing` catches the resulting
foreign-key violation and returns null so signup cannot 500. Both behaviours are
pre-existing and unchanged.

The application expects **`{{ .Token }}`** — a numeric code the user types. It
does not use `{{ .ConfirmationURL }}` for signup, and there is no
`/auth/confirm` link handler for the signup flow. (Password *recovery* is
different: it accepts both a code and a link — see `lib/auth/recovery-link.ts`.)

## Dashboard changes — required, and not doable from the editor

Both of these live in Supabase's hosted project config. They are not in this
repo, not in Postgres, and not reachable with the anon key.

### 1. Put the code in the signup email

**Authentication → Emails → "Confirm signup"** template
(`https://supabase.com/dashboard/project/<ref>/auth/templates`)

The stock template contains only a `{{ .ConfirmationURL }}` link, so the email
arrives with **no code in it** and there is nothing for the user to type.

Paste **`supabase/email-templates/confirm-signup.html`** into that field. It is
kept in the repo for the same reason `supabase/sql/` is — Supabase stores the
template in project config, not here, so the copy under version control is what
makes the applied version reviewable and reproducible in a second environment.

The short version, if you are reading this without the file to hand:

```html
<h2>Confirm your email</h2>

<p>Enter this code on the verification page:</p>

<p style="font-size:28px;font-weight:700;letter-spacing:4px;">{{ .Token }}</p>

<p>The code expires in 90 seconds.</p>
```

`{{ .Token }}` *is* the 6-digit OTP; it is generated on every signup whether or
not the template prints it. Do **not** keep a `{{ .ConfirmationURL }}` link
alongside it: there is no `/auth/confirm` handler for signup so the link leads
nowhere, mail scanners prefetch links and silently consume the single-use token,
and a link-free text-only message is markedly less likely to be filed as spam —
which is where the stock template landed on 2026-09-19.

### 2. Make delivery actually happen

**Project Settings → Authentication → SMTP Settings**
(`https://supabase.com/dashboard/project/<ref>/settings/auth`)

Until a custom SMTP provider is configured, the project uses Supabase's built-in
mailer, which per Supabase's own documentation:

- **only delivers to addresses that are members of the project's team** — every
  other address fails with *"Email address not authorized."* This is why signing
  up with a **new** address produces no email at all, while the API still answers
  `200` with `confirmation_sent_at` populated;
- is capped at **2 messages per hour for the whole project** — exhausted quickly
  while testing, after which sends fail with
  `429 over_email_send_rate_limit`;
- carries **no delivery SLA** and is explicitly not for production.

Point it at any SMTP provider (Resend, SendGrid, SES, Postmark, Mailgun…) and
both restrictions disappear. Nothing in this repo needs to change: the sender is
entirely Supabase-side.

While still on the built-in mailer, the only addresses that will receive anything
are those listed under **Organization → Team**.

## Why 90 seconds is enforced in this app, not in Supabase

Supabase exposes one **Email OTP Expiration** value —
**Authentication → Sign In / Providers → Email**, minimum 60 seconds — and it
applies to *every* email OTP the project issues. Lowering it to 90s would expire
**password-reset links after 90 seconds too**, which is unacceptable.

So that setting is left alone (default, typically 3600s) and the signup-only
deadline is enforced server-side in `AuthService.verify`, from Supabase's own
`auth.users.confirmation_sent_at`:

- **Server-authoritative.** The countdown on `/auth/verify` is cosmetic. A client
  that patches out the timer, replays an old code, or calls the API directly
  still gets `410 OtpExpiredError` — the check runs before the code reaches
  GoTrue.
- **No second auth system.** Nothing about the OTP is stored by this app. The
  timestamp read is one column of one row of `auth.users`, written by GoTrue
  itself on both signup and resend. Supabase Auth remains the only authority;
  the token hash in that table is never selected.
- **Recovery untouched.** The gate is reached only from `/api/auth/verify`.
  `resetPassword` / `completeResetFromLink` keep the project-wide expiry.

One consequence worth knowing: Supabase still considers the code valid for its
own (longer) window. Expiry is this application's policy, so a code refused here
would have been accepted by a direct call to Supabase with the anon key. That is
the accepted trade for not breaking password reset, and it is not a privilege
boundary — the holder of the code is the owner of the inbox either way.

### Expired vs. incorrect

GoTrue answers `403 otp_expired` — *"Token has expired or is invalid"* — for a
**wrong** code just as it does for a stale one, so it cannot tell the two apart.
The timestamp check is what separates them:

| Situation | Response | What the page shows |
|---|---|---|
| Code older than 90s | `410 OtpExpiredError` | "Verification code has expired." + **Resend Verification Code** |
| Within 90s, wrong digits | `400 BadRequestError` | "Incorrect verification code. Please check and try again." |
| Within 90s, right digits | `200` | redirect to `/auth/sign-in?verified=true` |

## Diagnosing "no email arrived"

Run `node scripts/diagnose-supabase-email.mjs` first. It is read-only (apart
from an explicit `--send`), prints no secret values, and reports the env, the
project's auth settings, and every user's confirmed/unconfirmed state in one
pass. Export `SUPABASE_ACCESS_TOKEN` (a dashboard personal access token) and it
also reads the SMTP settings and the "Confirm signup" template, which otherwise
live only in the dashboard. `--send you@example.com` issues a real OTP email and
reports the exact status Supabase answered with.

`AUTH_DEBUG=1` (on by default outside production) traces every hop to the server
console — `lib/auth/auth-debug.ts`, addresses masked, never a token or password.

```
[auth:reset] POST /signup -> supabase { email: 'pr******@gmail.com' }
[auth:reset] supabase accepted the signup; confirmation email queued {
  userId: '…', emailConfirmedAt: null, confirmationSentAt: '2026-09-18T17:29:42Z',
  note: "confirmation_sent_at only means 'queued to the mailer', not 'delivered'" }
```

Read it as:

| Log / response | Meaning |
|---|---|
| `confirmationSentAt` set, no email | Handed to SMTP and dropped there → the built-in mailer refused a non-team address, or spam filtering. **Check #2 above.** |
| Email arrives with a link but no code | Template still `{{ .ConfirmationURL }}`. **Check #1 above.** |
| `429 over_email_send_rate_limit` | Built-in mailer's 2/hour project-wide quota. **Check #2 above.** |
| `"supabase returned a session — email confirmation is DISABLED"` | "Confirm email" is off for the project; no email is sent by design and signup logs the user straight in. |
| `500 Supabase Auth is not configured` | `SUPABASE_URL` / `SUPABASE_ANON_KEY` missing from `.env`. |

`GET {SUPABASE_URL}/auth/v1/settings` (anon key, safe to curl) confirms the
project side: `mailer_autoconfirm: false` means confirmation is required,
`disable_signup: false` means signups are open.
