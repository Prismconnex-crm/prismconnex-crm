#!/usr/bin/env node
/**
 * Read-only diagnosis of "the verification email never arrives".
 *
 *   node scripts/diagnose-supabase-email.mjs
 *   node scripts/diagnose-supabase-email.mjs --user you@example.com
 *   node scripts/diagnose-supabase-email.mjs --send you@example.com   # real email
 *
 * The flow spans four hops — our API → GoTrue → Supabase's mail config → the
 * recipient's mail server — and only the first two are visible from this repo.
 * This script reports each hop it can observe and says plainly where the
 * visible chain ends, so "Supabase accepted it" is never mistaken for
 * "it was delivered".
 *
 * NOTHING SECRET IS PRINTED. Keys are reported by length and by the `role`
 * claim of their JWT payload; values, tokens and passwords never are. Email
 * addresses are masked. The only write this performs is `--send`, which asks
 * Supabase to re-issue a signup OTP — the same call the Resend button makes.
 *
 * Optional: export SUPABASE_ACCESS_TOKEN (a personal access token from
 * https://supabase.com/dashboard/account/tokens) to also read the project's
 * SMTP settings and email templates through the Management API. Without it
 * those two live only in the dashboard and this script says so rather than
 * guessing.
 */

import { readFileSync } from "node:fs";

// ─── env ─────────────────────────────────────────────────────────────

/** Minimal .env reader — the app is not booted, so Next.js has not loaded it. */
function readEnvFile(path) {
    try {
        return Object.fromEntries(
            readFileSync(path, "utf8")
                .split(/\r?\n/)
                .filter((line) => /^\s*[A-Za-z_][A-Za-z0-9_]*=/.test(line))
                .map((line) => {
                    const eq = line.indexOf("=");
                    const key = line.slice(0, eq).trim();
                    const value = line
                        .slice(eq + 1)
                        .trim()
                        .replace(/^["']|["']$/g, "");
                    return [key, value];
                })
        );
    } catch {
        return {};
    }
}

const fileEnv = readEnvFile(".env");
const env = { ...fileEnv, ...process.env };

function maskEmail(email) {
    const [local = "", domain = ""] = String(email ?? "").split("@");
    return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 0))}@${domain}`;
}

/**
 * The `role` claim of a Supabase API key.
 *
 * Worth checking rather than assuming: an `anon` and a `service_role` key look
 * identical in a .env file, and pasting the wrong one leaves every request
 * working while silently running as an RLS-bypassing superuser.
 */
function keyRole(key) {
    try {
        const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
        return { role: payload.role, ref: payload.ref };
    } catch {
        return { role: "<unreadable JWT>", ref: null };
    }
}

const ok = (s) => `  OK    ${s}`;
const warn = (s) => `  WARN  ${s}`;
const bad = (s) => `  FAIL  ${s}`;
const info = (s) => `        ${s}`;

function heading(text) {
    console.log(`\n${text}\n${"─".repeat(text.length)}`);
}

// ─── 1. environment ──────────────────────────────────────────────────

heading("1. Environment");

const supabaseUrl = (env.SUPABASE_URL ?? "").replace(/\/$/, "");
const apiKey = env.SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl) console.log(bad("SUPABASE_URL is not set"));
else console.log(ok(`SUPABASE_URL      ${new URL(supabaseUrl).host}`));

if (!apiKey) {
    console.log(bad("SUPABASE_ANON_KEY is not set"));
} else {
    const { role, ref } = keyRole(apiKey);
    console.log(ok(`SUPABASE_ANON_KEY set (${apiKey.length} chars, role="${role}")`));

    if (role === "service_role") {
        console.log(
            warn("that is a SERVICE_ROLE key, not the anon key — it bypasses every RLS policy")
        );
        console.log(info("Dashboard → Project Settings → API Keys → copy the `anon` `public` key"));
    }

    // A key from a different project than SUPABASE_URL points at is the one
    // misconfiguration where every call still succeeds — against the wrong
    // project, whose dashboard then shows no users and no logs.
    const urlRef = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\./)?.[1];
    if (ref && urlRef && ref !== urlRef) {
        console.log(bad(`key belongs to project "${ref}" but SUPABASE_URL points at "${urlRef}"`));
    } else if (ref) {
        console.log(ok(`key and URL agree on project "${ref}"`));
    }
}

for (const name of ["DATABASE_URL", "DIRECT_URL", "APP_URL"]) {
    console.log(env[name] ? ok(`${name} set`) : warn(`${name} is not set`));
}

if (!supabaseUrl || !apiKey) {
    console.log("\nCannot continue without SUPABASE_URL and SUPABASE_ANON_KEY.");
    process.exit(1);
}

const authHeaders = { apikey: apiKey, Authorization: `Bearer ${apiKey}` };
const projectRef = keyRole(apiKey).ref ?? supabaseUrl.match(/^https:\/\/([a-z0-9]+)\./)?.[1] ?? "<ref>";

// ─── 2. project auth settings ────────────────────────────────────────

heading("2. Supabase Auth settings (GET /auth/v1/settings)");

const settingsRes = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: authHeaders });
console.log(info(`HTTP ${settingsRes.status}`));

let settings = null;
if (settingsRes.ok) {
    settings = await settingsRes.json();

    console.log(
        settings.external?.email
            ? ok("email provider is enabled")
            : bad("email provider is DISABLED — no signup email can ever be sent")
    );
    console.log(
        settings.disable_signup
            ? bad("signups are disabled for this project")
            : ok("signups are enabled")
    );

    // mailer_autoconfirm is the switch that decides whether an email is sent at
    // all. With it on, GoTrue confirms the user itself and sends nothing — an
    // empty inbox is then correct behaviour, not a delivery failure.
    console.log(
        settings.mailer_autoconfirm
            ? warn('"Confirm email" is OFF (mailer_autoconfirm: true) — NO email is sent by design')
            : ok('"Confirm email" is ON (mailer_autoconfirm: false) — a confirmation email is sent')
    );
} else {
    console.log(bad(await settingsRes.text()));
}

// ─── 3. the user in Authentication → Users ───────────────────────────

const argOf = (flag) => {
    const i = process.argv.indexOf(flag);
    return i === -1 ? null : process.argv[i + 1] ?? null;
};
const targetUser = argOf("--user") ?? argOf("--send");

heading("3. Authentication → Users");

const isAdminKey = keyRole(apiKey).role === "service_role";

if (!isAdminKey) {
    console.log(info("needs the service_role key; skipped with an anon key"));
    console.log(
        info(`check by hand: https://supabase.com/dashboard/project/${projectRef}/auth/users`)
    );
} else {
    const usersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=10`, {
        headers: authHeaders,
    });
    console.log(info(`HTTP ${usersRes.status}`));

    if (usersRes.ok) {
        const { users = [] } = await usersRes.json();
        console.log(info(`${users.length} most recent users:\n`));

        for (const u of users) {
            // confirmation_sent_at set + email_confirmed_at null is the exact
            // signature of "Supabase sent it, the inbox never saw it".
            const state = u.email_confirmed_at
                ? "CONFIRMED"
                : u.confirmation_sent_at
                  ? "sent, never confirmed"
                  : "no email ever sent";
            console.log(
                `        ${maskEmail(u.email).padEnd(34)} ${String(u.created_at).slice(0, 19)}  ${state}`
            );
        }
    } else {
        console.log(bad(await usersRes.text()));
    }
}

// ─── 4. SMTP + templates (Management API, needs a PAT) ───────────────

heading("4. Email provider and templates");

const pat = env.SUPABASE_ACCESS_TOKEN;

if (!pat) {
    console.log(info("SUPABASE_ACCESS_TOKEN not set — SMTP config and templates cannot be read."));
    console.log(info("They are project config, not repo config. Check by hand:"));
    console.log(info(`  SMTP      https://supabase.com/dashboard/project/${projectRef}/settings/auth`));
    console.log(info(`  Templates https://supabase.com/dashboard/project/${projectRef}/auth/templates`));
} else {
    const cfgRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
        headers: { Authorization: `Bearer ${pat}` },
    });
    console.log(info(`GET /v1/projects/${projectRef}/config/auth → HTTP ${cfgRes.status}`));

    if (cfgRes.ok) {
        const cfg = await cfgRes.json();

        if (cfg.smtp_host) {
            console.log(ok(`custom SMTP configured: ${cfg.smtp_host}:${cfg.smtp_port ?? "?"}`));
            console.log(info(`sender: ${maskEmail(cfg.smtp_admin_email)} (${cfg.smtp_sender_name ?? "no name"})`));
        } else {
            // The built-in mailer is the single most common reason a signup
            // email never arrives: it refuses every address that is not on the
            // project's team, and caps the whole project at a few per hour.
            console.log(warn("using Supabase's BUILT-IN email service — no custom SMTP"));
            console.log(info("it only delivers to project team members and is capped per hour"));
        }

        console.log(
            info(`email OTP expiry: ${cfg.mailer_otp_exp ?? "?"}s, OTP length: ${cfg.mailer_otp_length ?? "?"}`)
        );

        // The template decides whether the email contains something to type.
        // A template with only {{ .ConfirmationURL }} produces an email that
        // arrives and is still useless to an OTP form.
        const tpl = cfg.mailer_templates_confirmation_content;
        if (!tpl) {
            console.log(warn('"Confirm signup" template is the Supabase default'));
            console.log(info("the default contains {{ .ConfirmationURL }} only — no code to type"));
        } else {
            const hasToken = tpl.includes("{{ .Token }}");
            const hasUrl = tpl.includes("{{ .ConfirmationURL }}");
            console.log(
                hasToken
                    ? ok('"Confirm signup" template contains {{ .Token }} — the OTP is in the email')
                    : bad('"Confirm signup" template has NO {{ .Token }} — this app cannot use it')
            );
            if (hasUrl) console.log(info("it also contains {{ .ConfirmationURL }}"));
        }
    } else {
        console.log(bad(await cfgRes.text()));
    }
}

// ─── 5. live send ────────────────────────────────────────────────────

const sendTo = argOf("--send");

heading("5. Live send");

if (!sendTo) {
    console.log(info("skipped. Re-run with --send you@example.com to issue a real OTP email."));
} else {
    console.log(info(`POST /auth/v1/resend { type: "signup" } for ${maskEmail(sendTo)}`));

    const startedAt = Date.now();
    const res = await fetch(`${supabaseUrl}/auth/v1/resend`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "signup", email: sendTo }),
    });
    const body = await res.text();

    console.log(info(`HTTP ${res.status} in ${Date.now() - startedAt}ms — ${body || "<empty body>"}`));

    if (res.ok) {
        console.log(ok("Supabase accepted the request and handed the message to its mailer"));
        console.log(
            warn("this is NOT proof of delivery — it means SMTP accepted it, nothing more")
        );
        console.log(info("check the inbox AND the spam folder; then check the Auth logs:"));
        console.log(info(`  https://supabase.com/dashboard/project/${projectRef}/logs/auth-logs`));
    } else if (res.status === 429) {
        console.log(bad("rate limited — the project's hourly email quota is spent"));
    } else {
        console.log(bad("Supabase refused the send; the message above is its reason"));
    }
}

console.log(
    "\nThe chain this script can see ends at Supabase's mailer. Anything past that" +
        "\nlives in the Auth logs and in the recipient's mail server."
);
