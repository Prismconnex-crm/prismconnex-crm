#!/usr/bin/env node
/**
 * Fills each EventExhibitor's official website, country and logo from its own
 * directory detail page (sourceDetailUrl), for every event — the fields BETT's
 * importer filled for BETT and no other source fills (see lib/exhibitors/crm-sync.ts:
 * websiteUrl and country are CRM-owned, written only by enrichment imports).
 *
 *   node --env-file=.env scripts/enrich-exhibitor-profiles.mjs [options]
 *
 * Two phases, both resumable:
 *   fetch   — visits detail pages of rows missing any of the three fields and
 *             caches what each page says (candidates, not raw HTML) in
 *             .next/cache/exhibitor-enrichment/candidates.jsonl. Re-running
 *             skips pages already cached.
 *   decide  — per directory host, drops chrome (a website/logo recurring across
 *             that host's exhibitors) and keeps what is specific to each one;
 *             with --write, fills ONLY empty columns (COALESCE), so nothing a
 *             person or another import set is ever overwritten.
 * Rules live in scripts/lib/exhibitor-profile-extract.mjs (tested offline).
 *
 * Options:
 *   --write              apply to the database (default: dry run, report only)
 *   --phase=fetch|decide|all   (default all)
 *   --host=<substring>   only directory hosts containing this
 *   --event=<substring>  only event slugs containing this
 *   --sample=N           at most N pages per host (coverage probe)
 *   --limit=N            stop after N new fetches in total
 *   --hosts-parallel=N   directory hosts fetched at once (default 10)
 *   --delay=MS           pause between two requests to the same host (default 800)
 *
 * Report: reports/exhibitor-enrichment/summary.md + hosts.csv.
 * Polite by design: one request in flight per host, a real delay, and hosts
 * that block automated visitors (HTTP 202/403/429, challenge pages) are
 * recorded as blocked and stop being hit after a few tries.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { extractCandidates, countChrome, decideProfile, siteHost } from "./lib/exhibitor-profile-extract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, ".next", "cache", "exhibitor-enrichment");
const cacheFile = path.join(cacheDir, "candidates.jsonl");
const browserCacheFile = path.join(cacheDir, "candidates-browser.jsonl");
const reportDir = path.join(root, "reports", "exhibitor-enrichment");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);
const WRITE = args.write === true;
const PHASE = args.phase ?? "all";
const SAMPLE = args.sample ? Number(args.sample) : Infinity;
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const HOSTS_PARALLEL = Number(args["hosts-parallel"] ?? 10);
const DELAY = Number(args.delay ?? 800);
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const BLOCK_AFTER = 4; // consecutive blocked responses before a host is skipped for this run

const prisma = new PrismaClient();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hostOf = (u) => {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return null;
  }
};

function readCache() {
  // Both caches; a readable record beats a blocked one, whichever file or order it came in.
  const byId = new Map();
  for (const file of [cacheFile, browserCacheFile]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        continue; // a torn last line from an interrupted run
      }
      const prev = byId.get(rec.id);
      if (!prev || !prev.candidates || rec.candidates) byId.set(rec.id, rec);
    }
  }
  return byId;
}

async function loadRows() {
  const rows = await prisma.$queryRawUnsafe(
    `select id, "eventSlug", "companyName", "sourceDetailUrl", "websiteUrl", country, "logoUrl",
            "companyLinkedInUrl", phone, description
       from "EventExhibitor"
      where ("websiteUrl" is null or country is null or "logoUrl" is null
             or "companyLinkedInUrl" is null or phone is null or description is null)
        and "sourceDetailUrl" ~ '^https?://'`,
  );
  return rows.filter(
    (r) =>
      (!args.event || r.eventSlug.includes(args.event)) &&
      (!args.host || (hostOf(r.sourceDetailUrl) ?? "").includes(args.host)),
  );
}

// ── fetch phase ─────────────────────────────────────────────────────────────

// Hard ceiling on one page, body included: a stalled body stream holds no timer, and when every worker waits on
// one Node exits with "unsettled top-level await" (exit 13). The racing timer keeps the loop alive and bounds it.
function fetchPage(url) {
  let timer;
  const ceiling = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("page timeout")), 40000);
  });
  return Promise.race([fetchPageInner(url), ceiling]).finally(() => clearTimeout(timer));
}

/** Reads at most maxBytes of a response body, then cancels the rest. */
async function readCapped(res, maxBytes) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks)).slice(0, maxBytes);
}
async function fetchPageInner(url) {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "en;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  // Skip non-HTML and giant bodies (a multi-hundred-MB "page" crashed V8): everything read lives in the first ~1.5 MB.
  const type = res.headers.get("content-type") ?? "";
  const size = Number(res.headers.get("content-length") ?? 0);
  const readable = res.ok && (!type || /html|xml|text/i.test(type)) && size < 8_000_000;
  const html = readable ? await readCapped(res, 1_500_000) : (res.body?.cancel().catch(() => {}), "");
  const challenged = res.status === 202 || /cf-chl|challenge-platform|captcha|access denied|just a moment/i.test(html.slice(0, 4000));
  return { status: res.status, finalUrl: res.url, html, blocked: challenged || [202, 403, 429, 503].includes(res.status) };
}

async function fetchPhase(rows) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const cache = readCache();
  const out = fs.createWriteStream(cacheFile, { flags: "a" });
  // Hosts whose pages are readable but carry nothing usable (JavaScript-rendered
  // directories): after 6 such pages, fetching the rest only costs time.
  const barren = new Set();
  const seen = new Map();
  for (const rec of cache.values()) {
    if (!rec.candidates) continue;
    const s = seen.get(rec.host) ?? { pages: 0, useful: 0 };
    s.pages++;
    const c = rec.candidates;
    if (c.countries.length || c.logos.length || c.websites.some((w) => w.source !== "link")) s.useful++;
    seen.set(rec.host, s);
  }
  for (const [h, s] of seen) if (s.pages >= 6 && s.useful === 0) barren.add(h);
  if (barren.size) console.log(`fetch: skipping ${barren.size} hosts with no usable data on their pages`);

  const byHost = new Map();
  for (const r of rows) {
    const cached = cache.get(r.id);
    // --refetch-v1: re-read pages cached before contacts (LinkedIn/phone/description) were extracted.
    const stale = args["refetch-v1"] && cached?.candidates && !cached.candidates.linkedins;
    if (cached && !stale) continue;
    const h = hostOf(r.sourceDetailUrl);
    if (barren.has(h)) continue;
    if (!byHost.has(h)) byHost.set(h, []);
    if (byHost.get(h).length < SAMPLE) byHost.get(h).push(r);
  }
  const queue = [...byHost.entries()].sort((a, b) => b[1].length - a[1].length);
  const total = queue.reduce((n, [, list]) => n + list.length, 0);
  console.log(`fetch: ${total} pages over ${queue.length} hosts (${cache.size} already cached)`);
  let done = 0;
  let started = 0;

  async function worker() {
    while (queue.length) {
      const [host, list] = queue.shift();
      let blockedRun = 0;
      let readable = 0;
      let useful = 0;
      for (const r of list) {
        if (started >= LIMIT) return;
        started++;
        let rec;
        try {
          const page = await fetchPage(r.sourceDetailUrl);
          blockedRun = page.blocked ? blockedRun + 1 : 0;
          rec = {
            id: r.id,
            host,
            status: page.status,
            blocked: page.blocked,
            candidates: page.blocked || !page.html ? null : extractCandidates(page.html, { pageUrl: page.finalUrl, companyName: r.companyName }),
          };
        } catch (e) {
          rec = { id: r.id, host, status: 0, error: String(e.message ?? e).slice(0, 120), candidates: null };
          blockedRun++;
        }
        out.write(`${JSON.stringify(rec)}\n`);
        done++;
        if (done % 200 === 0) console.log(`  ${done}/${total}`);
        if (rec.candidates) {
          const c = rec.candidates;
          readable++;
          if (c.countries.length || c.logos.length || c.linkedins?.length || c.phones?.length || c.websites.some((w) => w.source !== "link")) useful++;
          if (readable >= 8 && useful === 0) {
            console.log(`  ${host}: ${readable} pages with nothing usable — skipping the rest`);
            break;
          }
        }
        if (blockedRun >= BLOCK_AFTER) {
          console.log(`  ${host}: blocked/unreachable ${blockedRun}x in a row — skipping the rest this run`);
          break;
        }
        await sleep(DELAY);
      }
    }
  }
  await Promise.all(Array.from({ length: HOSTS_PARALLEL }, worker));
  await new Promise((r) => out.end(r));
  console.log(`fetch: ${done} pages fetched`);
}

// ── decide phase ────────────────────────────────────────────────────────────

async function decidePhase(rows) {
  const cache = readCache();
  const rowById = new Map(rows.map((r) => [r.id, r]));
  // Chrome is judged over every cached page of a host, not just this run's filter.
  const byHost = new Map();
  for (const rec of cache.values()) {
    if (!byHost.has(rec.host)) byHost.set(rec.host, []);
    byHost.get(rec.host).push(rec);
  }

  // --complete-only: decide a host only once every page it has is cached, so chrome is
  // judged over the whole directory (lets finished hosts be written while others still fetch).
  const rowsPerHost = new Map();
  for (const r of rows) rowsPerHost.set(hostOf(r.sourceDetailUrl), (rowsPerHost.get(hostOf(r.sourceDetailUrl)) ?? 0) + 1);

  const updates = [];
  const hostStats = [];
  for (const [host, recs] of byHost) {
    const cachedOfHost = recs.filter((rec) => rowById.has(rec.id)).length;
    if (args["complete-only"] && cachedOfHost < (rowsPerHost.get(host) ?? 0)) continue;
    const ok = recs.filter((r) => r.candidates);
    // Count each directory page once: several catalog slugs can list the same edition
    // (e.g. "ALL ABOUT AUTOMATION" / "- ZURICH" / "- ZÜRICH"), and a company seen on one
    // page three times is not chrome.
    const seenPages = new Set();
    const distinct = ok.filter((r) => {
      const url = rowById.get(r.id)?.sourceDetailUrl ?? r.id;
      if (seenPages.has(url)) return false;
      seenPages.add(url);
      return true;
    });
    const chrome = countChrome(distinct.map((r) => r.candidates));
    const s = { host, pages: recs.length, readable: ok.length, blocked: recs.filter((r) => r.blocked || r.error).length, website: 0, country: 0, logo: 0 };
    for (const rec of ok) {
      const row = rowById.get(rec.id);
      if (!row) continue;
      const d = decideProfile(rec.candidates, chrome, row.companyName);
      const u = {
        id: row.id,
        websiteUrl: row.websiteUrl ? null : d.website,
        country: row.country ? null : d.country,
        logoUrl: row.logoUrl ? null : d.logo,
        linkedin: row.companyLinkedInUrl ? null : d.linkedin,
        phone: row.phone ? null : d.phone,
        description: row.description ? null : d.description,
        // The directory's page said it; the profile prints "Source: <domain>".
        descriptionSource: host.replace(/^www\./, ""),
      };
      if (u.websiteUrl) s.website++;
      if (u.country) s.country++;
      if (u.logoUrl) s.logo++;
      if (u.websiteUrl || u.country || u.logoUrl || u.linkedin || u.phone || u.description) updates.push(u);
    }
    hostStats.push(s);
  }

  // --show=N prints N random decisions next to the company name, for a human accuracy check.
  if (args.show) {
    const shuffled = [...updates].sort(() => Math.random() - 0.5).slice(0, Number(args.show));
    for (const u of shuffled) {
      const row = rowById.get(u.id);
      console.log(`${row.companyName.slice(0, 40).padEnd(40)} | ${u.websiteUrl ?? "-"} | ${u.country ?? "-"} | ${(u.logoUrl ?? "-").slice(0, 70)}`);
    }
  }

  if (WRITE && updates.length) {
    // Small batches: the pooled Supabase connection drops long transactions (P1017). Re-running is safe — COALESCE.
    for (let i = 0; i < updates.length; i += 50) {
      const chunk = updates.slice(i, i + 50);
      await prisma.$transaction(chunk.map(fillBlanks));
    }
  }
  writeReport(hostStats, updates);
}

/** One row's update; every column only fills a blank, and descriptionSource moves only with its description. */
function fillBlanks(u) {
  return prisma.$executeRaw`update "EventExhibitor"
     set "websiteUrl"         = coalesce("websiteUrl", ${u.websiteUrl ?? null}),
         country              = coalesce(country, ${u.country ?? null}),
         "logoUrl"            = coalesce("logoUrl", ${u.logoUrl ?? null}),
         "companyLinkedInUrl" = coalesce("companyLinkedInUrl", ${u.linkedin ?? null}),
         phone                = coalesce(phone, ${u.phone ?? null}),
         "descriptionSource"  = case when description is null and ${u.description ?? null}::text is not null
                                     then ${u.descriptionSource ?? null} else "descriptionSource" end,
         description          = coalesce(description, ${u.description ?? null})
   where id = ${u.id}`;
}

// ── site phase ──────────────────────────────────────────────────────────────
//
// The company's own homepage, for exhibitors whose website is known: the first-party source BETT's
// profiles were filled from. One fetch per site (a company at several shows shares it). Cached in
// site-candidates.jsonl by site URL; fills LinkedIn, phone and description (source = that domain).

const siteCacheFile = path.join(cacheDir, "site-candidates.jsonl");

function siteKey(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname.toLowerCase()}/`;
  } catch {
    return null;
  }
}

async function sitePhase() {
  const rows = (
    await prisma.$queryRawUnsafe(
      `select id, "eventSlug", "companyName", "websiteUrl", "companyLinkedInUrl", phone, description, "logoUrl", country
         from "EventExhibitor"
        where "websiteUrl" ~ '^https?://'
          and ("companyLinkedInUrl" is null or phone is null or description is null or "logoUrl" is null or country is null)`,
    )
  ).filter((r) => !args.event || r.eventSlug?.includes(args.event));
  const cache = new Map();
  if (fs.existsSync(siteCacheFile)) {
    for (const line of fs.readFileSync(siteCacheFile, "utf8").split("\n")) {
      try {
        const rec = JSON.parse(line);
        cache.set(rec.site, rec);
      } catch {}
    }
  }
  const sites = new Map();
  for (const r of rows) {
    const k = siteKey(r.websiteUrl);
    if (!k) continue;
    if (!sites.has(k)) sites.set(k, { url: r.websiteUrl, names: new Set() });
    sites.get(k).names.add(r.companyName);
  }
  const todo = [...sites.entries()].filter(([k]) => !cache.has(k)).slice(0, LIMIT);
  console.log(`site: ${rows.length} rows over ${sites.size} sites; ${todo.length} to fetch (${cache.size} cached)`);

  if (PHASE === "site" || PHASE === "site-fetch") {
    fs.mkdirSync(cacheDir, { recursive: true });
    const out = fs.createWriteStream(siteCacheFile, { flags: "a" });
    let i = 0;
    let done = 0;
    const PAR = Number(args["sites-parallel"] ?? 24);
    await Promise.all(
      Array.from({ length: PAR }, async () => {
        while (i < todo.length) {
          const [site, info] = todo[i++];
          let rec;
          try {
            const page = await fetchPage(info.url);
            rec = { site, status: page.status, candidates: page.blocked || !page.html ? null : extractCandidates(page.html, { pageUrl: page.finalUrl, companyName: [...info.names][0] }) };
          } catch (e) {
            rec = { site, status: 0, error: String(e.message ?? e).slice(0, 80), candidates: null };
          }
          cache.set(site, rec);
          out.write(`${JSON.stringify(rec)}\n`);
          if (++done % 500 === 0) console.log(`  ${done}/${todo.length}`);
        }
      }),
    );
    await new Promise((r) => out.end(r));
  }

  // Decide per row. A company's own site has no directory chrome, but a site shared by many
  // listed companies (a group or reseller) is skipped for LinkedIn/phone — whose would they be?
  const updates = [];
  for (const r of rows) {
    const k = siteKey(r.websiteUrl);
    const rec = k && cache.get(k);
    if (!rec?.candidates) continue;
    const shared = (sites.get(k)?.names.size ?? 1) > 3;
    const d = decideProfile(rec.candidates, countChrome([rec.candidates]), r.companyName);
    // Logo from the company's own site: its JSON-LD logo or an <img> marked as the logo. og:image is
    // usually a banner photo, not a logo, so it is not used here.
    const ownLogo = decideProfile({ ...rec.candidates, logos: rec.candidates.logos.filter((l) => l.source !== "og") }, countChrome([rec.candidates]), r.companyName).logo;
    const u = {
      id: r.id,
      logoUrl: r.logoUrl || shared ? null : ownLogo,
      country: r.country || shared ? null : d.country,
      linkedin: r.companyLinkedInUrl || shared ? null : d.linkedin,
      phone: r.phone || shared ? null : d.phone,
      description: r.description ? null : d.description,
      descriptionSource: siteHost(r.websiteUrl),
    };
    if (u.logoUrl || u.country || u.linkedin || u.phone || u.description) updates.push(u);
  }
  console.log(`site: rows gaining logo ${updates.filter((u) => u.logoUrl).length}, country ${updates.filter((u) => u.country).length}, LinkedIn ${updates.filter((u) => u.linkedin).length}, phone ${updates.filter((u) => u.phone).length}, description ${updates.filter((u) => u.description).length}`);
  if (args.show) {
    for (const u of [...updates].sort(() => Math.random() - 0.5).slice(0, Number(args.show))) {
      const r = rows.find((x) => x.id === u.id);
      console.log(`${r.companyName.slice(0, 32).padEnd(32)} | ${(u.logoUrl ?? "-").slice(0, 80)} | ${u.linkedin ?? "-"} | ${u.phone ?? "-"} | ${(u.description ?? "-").slice(0, 60)}`);
    }
  }
  if (WRITE) {
    for (let j = 0; j < updates.length; j += 50) await prisma.$transaction(updates.slice(j, j + 50).map(fillBlanks));
    console.log("site: written");
  }
}

function writeReport(hostStats, updates) {
  fs.mkdirSync(reportDir, { recursive: true });
  hostStats.sort((a, b) => b.pages - a.pages);
  const csv = ["host,pages,readable,blocked,website,country,logo", ...hostStats.map((s) => [s.host, s.pages, s.readable, s.blocked, s.website, s.country, s.logo].join(","))];
  fs.writeFileSync(path.join(reportDir, "hosts.csv"), `${csv.join("\n")}\n`);
  const sum = (k) => hostStats.reduce((n, s) => n + s[k], 0);
  const md = [
    `# Exhibitor profile enrichment — ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    "",
    `Mode: ${WRITE ? "WRITE (empty columns filled)" : "dry run (nothing written)"}`,
    "",
    `| | count |`,
    `|---|---:|`,
    `| Pages cached | ${sum("pages")} |`,
    `| Readable | ${sum("readable")} |`,
    `| Blocked / unreachable | ${sum("blocked")} |`,
    `| Rows gaining a website | ${sum("website")} |`,
    `| Rows gaining a country | ${sum("country")} |`,
    `| Rows gaining a logo | ${sum("logo")} |`,
    `| Rows changed | ${updates.length} |`,
    "",
    "Per host: hosts.csv. Blocked hosts need a platform-specific source (API or browser) — never filled by guessing.",
  ];
  fs.writeFileSync(path.join(reportDir, "summary.md"), `${md.join("\n")}\n`);
  console.log(md.slice(4, 14).join("\n"));
}

// ── browser collector ───────────────────────────────────────────────────────
//
// Some directories (MapYourShow, CPHI, …) answer plain HTTP with a bot challenge
// but serve a real browser. `--phase=collect --port=8765` serves those pages'
// jobs to a browser session that has passed the challenge and caches what it
// posts back, through the same extraction as the fetch phase:
//   GET  /next?host=<substring>&n=40  → [{id, url, companyName}] still uncached or blocked
//   POST /result {id, url, finalUrl, status, html}
// The browser side only fetches and forwards; every rule stays in this repo.

async function collectPhase(rows) {
  const http = await import("node:http");
  fs.mkdirSync(cacheDir, { recursive: true });
  const cache = readCache();
  const out = fs.createWriteStream(browserCacheFile, { flags: "a" });
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const handedOut = new Set();
  let received = 0;
  const pending = rows.filter((r) => {
    const rec = cache.get(r.id);
    return !rec || rec.blocked || rec.error;
  });
  console.log(`collect: ${pending.length} pages waiting for a browser on port ${args.port ?? 8765}`);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("content-type", "application/json");
    if (req.method === "GET" && url.pathname === "/next") {
      const host = url.searchParams.get("host") ?? "";
      const n = Number(url.searchParams.get("n") ?? 40);
      const jobs = [];
      for (const r of pending) {
        if (jobs.length >= n) break;
        if (handedOut.has(r.id) || !(hostOf(r.sourceDetailUrl) ?? "").includes(host)) continue;
        handedOut.add(r.id);
        jobs.push({ id: r.id, url: r.sourceDetailUrl, companyName: r.companyName });
      }
      res.end(JSON.stringify(jobs));
      return;
    }
    if (req.method === "GET" && url.pathname === "/hosts") {
      const counts = {};
      for (const r of pending) if (!handedOut.has(r.id)) counts[hostOf(r.sourceDetailUrl)] = (counts[hostOf(r.sourceDetailUrl)] ?? 0) + 1;
      res.end(JSON.stringify(counts));
      return;
    }
    if (req.method === "POST" && url.pathname === "/result") {
      let body = "";
      for await (const chunk of req) body += chunk;
      try {
        const p = JSON.parse(body);
        const row = rowById.get(p.id);
        if (row) {
          const blocked = p.status !== 200 || /cf-chl|challenge-platform|captcha|just a moment/i.test((p.html ?? "").slice(0, 4000));
          const rec = {
            id: p.id,
            host: hostOf(row.sourceDetailUrl),
            status: p.status,
            blocked,
            via: "browser",
            candidates: blocked ? null : extractCandidates(p.html, { pageUrl: p.finalUrl || row.sourceDetailUrl, companyName: row.companyName }),
          };
          // A blocked answer (rate limit, expired challenge) goes back in the queue for a later try.
          if (blocked) handedOut.delete(p.id);
          else out.write(`${JSON.stringify(rec)}\n`);
          received++;
          if (received % 200 === 0) console.log(`  received ${received}`);
        }
        res.end('{"ok":true}');
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: String(e.message) }));
      }
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  server.listen(Number(args.port ?? 8765), "127.0.0.1");
  await new Promise((resolve) => process.on("SIGINT", resolve));
  server.close();
  await new Promise((r) => out.end(r));
  console.log(`collect: ${received} pages received`);
}

try {
  const rows = await loadRows();
  if (PHASE === "collect") await collectPhase(rows);
  if (PHASE === "site" || PHASE === "site-fetch" || PHASE === "site-decide") await sitePhase();
  if (PHASE === "fetch" || PHASE === "all") await fetchPhase(rows);
  if (PHASE === "decide" || PHASE === "all") await decidePhase(rows);
} finally {
  await prisma.$disconnect();
}
