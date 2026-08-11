/**
 * Enables Google / Microsoft sign-in on the Supabase project via the Management
 * API, then verifies the change actually took effect.
 *
 * This exists because the dashboard toggle is easy to get wrong in ways that
 * look like success: the panel needs an explicit Save, it silently refuses to
 * save with an empty client id or secret, and it is trivial to edit a different
 * project than the one SUPABASE_URL points at. The app reads the truth from
 * GET /auth/v1/settings, so this script writes the config and then reads that
 * same endpoint back — if it prints "verified", the sign-in button will work.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."
 *   $env:GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
 *   $env:GOOGLE_CLIENT_SECRET="GOCSPX-..."
 *   node scripts/configure-oauth-providers.mjs google
 *
 *   $env:AZURE_CLIENT_ID="..."
 *   $env:AZURE_CLIENT_SECRET="..."
 *   node scripts/configure-oauth-providers.mjs microsoft
 *
 * Pass both provider names to do both at once. Add --check to only report the
 * current state and write nothing.
 *
 * SUPABASE_ACCESS_TOKEN is a personal access token from
 * https://supabase.com/dashboard/account/tokens — it is NOT the anon key and
 * NOT the service_role key. Keep it out of .env, which is tracked in git here;
 * set it in the shell for the length of the session instead.
 */

import { readFileSync } from "node:fs";

const MANAGEMENT_API = "https://api.supabase.com";

/** Supabase's provider slugs. Microsoft is `azure` — see lib/supabase/gotrue.ts. */
const PROVIDERS = {
    google: {
        slug: "google",
        label: "Google",
        idEnv: "GOOGLE_CLIENT_ID",
        secretEnv: "GOOGLE_CLIENT_SECRET",
        console: "https://console.cloud.google.com/apis/credentials",
    },
    microsoft: {
        slug: "azure",
        label: "Microsoft (Entra ID)",
        idEnv: "AZURE_CLIENT_ID",
        secretEnv: "AZURE_CLIENT_SECRET",
        console: "https://portal.azure.com",
    },
};

/**
 * Thrown rather than process.exit()-ed: calling process.exit() while a fetch
 * handle is still tearing down trips a libuv assertion on Windows, which turns
 * a clean run into exit code 127.
 */
class SetupError extends Error {}

function fail(message) {
    throw new SetupError(message);
}

function readEnvFile() {
    try {
        return Object.fromEntries(
            readFileSync(".env", "utf8")
                .split("\n")
                .filter((line) => /^[A-Z_]+=/.test(line))
                .map((line) => {
                    const i = line.indexOf("=");
                    return [
                        line.slice(0, i),
                        line.slice(i + 1).trim().replace(/^["']|["']$/g, ""),
                    ];
                })
        );
    } catch {
        return {};
    }
}

const fileEnv = readEnvFile();
const env = (key) => process.env[key] || fileEnv[key];

/** Reads what the app itself reads, using the anon key. No management token needed. */
async function readLiveSettings(supabaseUrl) {
    const anonKey = env("SUPABASE_ANON_KEY");
    if (!anonKey) fail("SUPABASE_ANON_KEY is not set.");

    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/settings?cb=${Date.now()}`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        cache: "no-store",
    });

    if (!res.ok) fail(`GET /auth/v1/settings returned ${res.status}`);
    return res.json();
}

function reportState(settings, projectRef) {
    console.log(`\nProvider state on ${projectRef} (live, as the app sees it):`);
    for (const { slug, label } of Object.values(PROVIDERS)) {
        const on = settings.external?.[slug] === true;
        console.log(`  ${on ? "✅" : "❌"}  ${label.padEnd(22)} external.${slug} = ${on}`);
    }
}

async function managementRequest(method, path, body, projectRef) {
    const token = env("SUPABASE_ACCESS_TOKEN");
    if (!token) {
        fail(
            "SUPABASE_ACCESS_TOKEN is not set.\n" +
                "  Create one at https://supabase.com/dashboard/account/tokens (it starts with `sbp_`),\n" +
                '  then set it in this shell only:  $env:SUPABASE_ACCESS_TOKEN="sbp_..."\n' +
                "  Do not put it in .env — that file is tracked in git in this repo."
        );
    }

    const res = await fetch(`${MANAGEMENT_API}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();

    if (!res.ok) {
        if (res.status === 401) {
            fail("The Management API rejected the token (401). It may be expired or mistyped.");
        }
        if (res.status === 403 || res.status === 404) {
            fail(
                `The token cannot reach project ${projectRef} (${res.status}).\n` +
                    "  Confirm the token belongs to the same Supabase account that owns this project."
            );
        }
        fail(`Management API ${method} ${path} -> ${res.status}: ${text}`);
    }

    return text ? JSON.parse(text) : null;
}

async function main() {
    const supabaseUrl = env("SUPABASE_URL");
    if (!supabaseUrl) fail("SUPABASE_URL is not set (checked the environment and .env).");

    /** The project ref is the subdomain: https://<ref>.supabase.co */
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

    const args = process.argv.slice(2);
    const checkOnly = args.includes("--check");
    const requested = args.filter((a) => !a.startsWith("--"));

    if (!checkOnly && requested.length === 0) {
        fail(
            "Name at least one provider: `node scripts/configure-oauth-providers.mjs google microsoft`,\n" +
                "  or pass --check to report the current state without changing anything."
        );
    }

    for (const name of requested) {
        if (!PROVIDERS[name]) fail(`Unknown provider "${name}". Use "google" and/or "microsoft".`);
    }

    console.log(`Project:  ${supabaseUrl}`);
    console.log(`Ref:      ${projectRef}`);

    reportState(await readLiveSettings(supabaseUrl), projectRef);

    if (checkOnly) {
        console.log("\n--check given; nothing was modified.");
        return;
    }

    // The Management API takes a flat auth-config object keyed
    // external_<slug>_enabled / _client_id / _secret.
    const patch = {};
    const configured = [];

    for (const name of requested) {
        const provider = PROVIDERS[name];
        const clientId = env(provider.idEnv);
        const clientSecret = env(provider.secretEnv);

        if (!clientId || !clientSecret) {
            fail(
                `${provider.label} needs ${provider.idEnv} and ${provider.secretEnv} set.\n` +
                    `  Create the OAuth client at ${provider.console}\n` +
                    `  and use this callback URL:  ${supabaseUrl.replace(/\/$/, "")}/auth/v1/callback`
            );
        }

        patch[`external_${provider.slug}_enabled`] = true;
        patch[`external_${provider.slug}_client_id`] = clientId;
        patch[`external_${provider.slug}_secret`] = clientSecret;

        // Single-tenant Entra registrations must point GoTrue at that tenant;
        // the default common/ endpoint rejects them with AADSTS50194 only after
        // the user has already signed in, so it reads as a broken callback.
        // Multi-tenant registrations leave this unset.
        if (provider.slug === "azure") {
            const tenantUrl = env("AZURE_TENANT_URL");
            if (tenantUrl) patch.external_azure_url = tenantUrl;
        }

        configured.push(provider);
    }

    console.log(`\nEnabling: ${configured.map((p) => p.label).join(", ")}`);

    await managementRequest("PATCH", `/v1/projects/${projectRef}/config/auth`, patch, projectRef);

    console.log("Management API accepted the change.");

    // GoTrue reloads its config asynchronously, so a read straight after the
    // write can still show the old value. Poll rather than sleep a fixed amount.
    console.log("\nVerifying against the live settings endpoint…");

    for (let attempt = 1; attempt <= 6; attempt++) {
        const settings = await readLiveSettings(supabaseUrl);
        const allOn = configured.every((p) => settings.external?.[p.slug] === true);

        console.log(
            `  attempt ${attempt}/6 — ` +
                configured.map((p) => `${p.slug}=${settings.external?.[p.slug]}`).join(" ")
        );

        if (allOn) {
            reportState(settings, projectRef);
            console.log(
                "\n✅ Verified. Restart `npm run dev` (or wait 60s) — lib/supabase/gotrue.ts\n" +
                    "   caches the provider list for a minute, so the sign-in page can otherwise\n" +
                    '   still show the old "not enabled" message.'
            );
            return;
        }

        if (attempt < 6) await new Promise((r) => setTimeout(r, 5000));
    }

    fail(
        "The write succeeded but the provider still reads as disabled after ~30s.\n" +
            "  This usually means the credentials were rejected. Re-run with --check in a minute;\n" +
            "  if it is still false, check the provider panel in the dashboard for a validation error."
    );
}

main().catch((error) => {
    if (error instanceof SetupError) {
        console.error(`\n✖ ${error.message}\n`);
    } else {
        console.error("\n✖ Unexpected failure:", error);
    }
    process.exitCode = 1;
});
