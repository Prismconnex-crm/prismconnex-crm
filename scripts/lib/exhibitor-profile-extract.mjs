// Pure extraction rules for the exhibitor profile enrichment
// (scripts/enrich-exhibitor-profiles.mjs). No network, no database: given one
// directory detail page's HTML, return what it says about the company's
// official website, country and logo. Kept apart so the rules run offline in
// tests/integration/exhibitor-profile-extract.test.ts.
//
// Two stages, because one page cannot tell a company's link from the
// directory's own chrome:
//   1. extractCandidates(html, …) — every plausible signal on the page;
//   2. decideProfile(candidates, chromeCounts) — keeps a candidate only when it
//      is specific to this exhibitor. A website or logo that recurs across many
//      exhibitors of the same directory host (organiser site, sponsor banner,
//      show logo) is chrome, and is dropped rather than shown as the company's.
//
// Nothing is inferred: no candidate, no value. A blank card field is better
// than an exhibitor linked to somebody else's website.

import { decodeEntities } from "./exhibitor-name-key.mjs";

// ── Countries ───────────────────────────────────────────────────────────────

const REGION = new Intl.DisplayNames(["en"], { type: "region" });

/** ISO 3166-1 alpha-2 → English name, for every code Intl knows as a country. */
const ISO_TO_NAME = new Map();
for (let a = 65; a <= 90; a++) {
  for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b);
    let name;
    try {
      name = REGION.of(code);
    } catch {
      continue;
    }
    // Intl echoes unknown codes back; skip those and the non-country pseudo-regions.
    if (!name || name === code || /unknown|outlying|pseudo|world|europe|union|nations/i.test(name)) continue;
    ISO_TO_NAME.set(code, name);
  }
}
// Codes that are not countries but Intl names anyway, and aliases that read badly in a card.
for (const code of ["EU", "EZ", "UN", "QO", "XA", "XB", "ZZ"]) ISO_TO_NAME.delete(code);
ISO_TO_NAME.set("UK", "United Kingdom");
// Intl's CLDR names that read badly on a card; the plain forms people write.
for (const [code, name] of Object.entries({
  HK: "Hong Kong", MO: "Macau", BA: "Bosnia and Herzegovina", AG: "Antigua and Barbuda",
  TT: "Trinidad and Tobago", KN: "Saint Kitts and Nevis", LC: "Saint Lucia", VC: "Saint Vincent and the Grenadines",
  ST: "Sao Tome and Principe", PS: "Palestine", MM: "Myanmar", CD: "DR Congo", CG: "Republic of the Congo",
  CI: "Côte d'Ivoire", FM: "Micronesia", VA: "Vatican City", PM: "Saint Pierre and Miquelon",
  SH: "Saint Helena", TC: "Turks and Caicos Islands", WF: "Wallis and Futuna", HM: "Heard and McDonald Islands",
})) ISO_TO_NAME.set(code, name);

const ALIASES = {
  usa: "United States", "u.s.a.": "United States", "u.s.": "United States", us: "United States",
  "united states of america": "United States", america: "United States",
  uk: "United Kingdom", "great britain": "United Kingdom", england: "United Kingdom",
  scotland: "United Kingdom", wales: "United Kingdom", "northern ireland": "United Kingdom",
  turkey: "Türkiye", turkiye: "Türkiye", "republic of korea": "South Korea", korea: "South Korea",
  "korea, republic of": "South Korea", "korea (south)": "South Korea", "p.r. china": "China",
  "pr china": "China", "people's republic of china": "China", prc: "China", uae: "United Arab Emirates",
  "u.a.e.": "United Arab Emirates", holland: "Netherlands", "the netherlands": "Netherlands",
  "russian federation": "Russia", "viet nam": "Vietnam", "czech republic": "Czechia",
  deutschland: "Germany", allemagne: "Germany", alemania: "Germany", germania: "Germany",
  frankreich: "France", francia: "France", italien: "Italy", italia: "Italy", italie: "Italy",
  spanien: "Spain", espagne: "Spain", "españa": "Spain", espana: "Spain", spagna: "Spain",
  niederlande: "Netherlands", "pays-bas": "Netherlands", nederland: "Netherlands",
  schweiz: "Switzerland", suisse: "Switzerland", svizzera: "Switzerland", suiza: "Switzerland",
  "österreich": "Austria", osterreich: "Austria", autriche: "Austria",
  belgien: "Belgium", belgique: "Belgium", "belgië": "Belgium", belgie: "Belgium",
  "royaume-uni": "United Kingdom", "reino unido": "United Kingdom", "vereinigtes königreich": "United Kingdom",
  "états-unis": "United States", "etats-unis": "United States", "estados unidos": "United States",
  chine: "China", "japon": "Japan", "brasil": "Brazil", "brésil": "Brazil", "méxico": "Mexico",
  polen: "Poland", pologne: "Poland", polska: "Poland", schweden: "Sweden", "suède": "Sweden",
  sverige: "Sweden", "dänemark": "Denmark", danemark: "Denmark", danmark: "Denmark",
  portugal: "Portugal", "türkei": "Türkiye", turquie: "Türkiye", "inde": "India", indien: "India",
};

const NAME_TO_COUNTRY = new Map();
for (const name of ISO_TO_NAME.values()) NAME_TO_COUNTRY.set(name.toLowerCase(), name);
for (const [alias, name] of Object.entries(ALIASES)) NAME_TO_COUNTRY.set(alias, name);

/**
 * A country value as the CRM stores it ("United Kingdom", "Türkiye"), or null.
 * Accepts an ISO alpha-2 code, an English name or a common local/alias name.
 * Anything else — a city, a region, free text — is rejected, never guessed.
 */
export function normaliseCountry(raw) {
  if (typeof raw !== "string") return null;
  const value = decodeEntities(raw).replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "");
  if (!value || value.length > 40) return null;
  if (/^[A-Za-z]{2}$/.test(value)) return ISO_TO_NAME.get(value.toUpperCase()) ?? null;
  return NAME_TO_COUNTRY.get(value.toLowerCase()) ?? null;
}

// ── URLs ────────────────────────────────────────────────────────────────────

/** Hosts that are never a company's own website: social, maps, shorteners, tickets, analytics, platforms. */
const NOT_A_COMPANY_SITE =
  /(^|\.)(facebook|fb|twitter|x|linkedin|instagram|youtube|youtu|tiktok|pinterest|vimeo|flickr|wa|whatsapp|t|telegram|google|goo|gstatic|googleapis|googletagmanager|doubleclick|apple|microsoft|bing|maps|w3|schema|wordpress|wp|gravatar|cloudflare|cookiebot|onetrust|cookielaw|usercentrics|hubspot|hsforms|mailchimp|eventbrite|ticketmaster|eventscribe|mapyourshow|a2zinc|expocad|swapcard|grip|cvent|n200|map-dynamics|rxglobal|reedexpo|informa|informamarkets|messe|bit|tinyurl|ow|lnkd|addtoany|sharethis|issuu|calameo|yumpu|adobe|typeform|jotform|zoom|teams|vk|weibo|wechat|line|xing|amazon|amazonaws|cloudfront|akamaized|jsdelivr|unpkg|cdnjs|bootstrapcdn|fontawesome|fonts|recaptcha|hotjar|matomo|piwik|clarity|trustpilot|tripadvisor|wikipedia|github|medium|blogspot|substack|calendly|mailto|example)\.[a-z.]+$/i;

/** "https://www.acme.co.uk/en/" → "acme.co.uk"; null when not an http(s) URL. */
export function siteHost(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.toLowerCase().replace(/^www\d?\./, "");
  } catch {
    return null;
  }
}

/** Registrable-ish root ("shop.acme.co.uk" → "acme.co.uk"), good enough to compare two hosts. */
function rootOf(host) {
  const parts = host.split(".");
  const twoPartTld = /^(co|com|org|net|gov|ac|edu|ne|or|go)$/.test(parts[parts.length - 2] ?? "") && (parts[parts.length - 1] ?? "").length === 2;
  return parts.slice(twoPartTld ? -3 : -2).join(".");
}

/** Canonical website value: origin + path, no query or fragment, so chrome-counting compares like with like. */
export function canonicalSite(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${u.hostname.toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

function absolutise(href, base) {
  try {
    return new URL(decodeEntities(href.trim()), base).href;
  } catch {
    return null;
  }
}

const stripTags = (s) => decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Words of a company name long enough to identify it in a domain ("Acme Tools GmbH" → ["acme","tools"]). */
function nameTokens(companyName) {
  return decodeEntities(String(companyName ?? ""))
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !/^(the|and|ltd|llc|inc|gmbh|co|corp|company|group|limited|sas|sarl|spa|srl|bv|ag|plc|pty|sa|ab|oy|as|kft|sro|ooo|international|global|industries|industry|technologies|technology|solutions|services|products|trading|systems|manufacturing)$/.test(t));
}

/** True when the site's domain visibly belongs to the company: a name word appears in it, or its initials do. */
export function domainMatchesName(host, companyName) {
  const label = rootOf(host).split(".")[0].replace(/-/g, "");
  const tokens = nameTokens(companyName);
  if (tokens.some((t) => label.includes(t) || (label.length >= 4 && t.includes(label)))) return true;
  // Initials count every word but articles and legal forms: "International Business Machines" → "ibm".
  const initials = decodeEntities(String(companyName ?? ""))
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !/^(the|and|of|ltd|llc|inc|gmbh|co|corp|limited|sas|sarl|spa|srl|bv|ag|plc|pty|sa|ab|oy|as)$/.test(t))
    .map((t) => t[0])
    .join("");
  return initials.length >= 3 && label === initials;
}

const WEBSITE_LABEL = /\b(web ?site|webseite|site web|site internet|sitio web|página web|homepage|home page|visit (our )?(web)?site|www)\b/i;
const DOMAIN_TEXT = /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;

// ── JSON-LD ─────────────────────────────────────────────────────────────────

function* walkLd(node) {
  if (Array.isArray(node)) {
    for (const n of node) yield* walkLd(n);
  } else if (node && typeof node === "object") {
    yield node;
    for (const key of ["@graph", "mainEntity", "about", "organizer", "sponsor", "brand"]) {
      if (node[key]) yield* walkLd(node[key]);
    }
  }
}

const ORG_TYPES = /^(Organization|Corporation|LocalBusiness|Company|Brand|NGO|EducationalOrganization|MedicalOrganization)$/;

function ldOrganisations(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    for (const node of walkLd(data)) {
      const types = [].concat(node["@type"] ?? []);
      if (types.some((t) => ORG_TYPES.test(String(t)))) out.push(node);
    }
  }
  return out;
}

const firstString = (v) => (typeof v === "string" ? v : Array.isArray(v) ? v.find((x) => typeof x === "string") : v && typeof v === "object" ? v.url ?? v["@id"] ?? null : null);

// ── Stage 1: candidates from one page ───────────────────────────────────────

/**
 * Every signal one directory detail page offers about its exhibitor.
 * `pageUrl` is the final URL after redirects (links resolve against it, and its
 * host is the directory, never the company).
 */
export function extractCandidates(html, { pageUrl, companyName }) {
  const directoryHost = siteHost(pageUrl) ?? "";
  const directoryRoot = rootOf(directoryHost);
  const websites = [];
  const logos = [];
  const countries = [];

  const pushWebsite = (url, source, strong) => {
    const host = siteHost(url ?? "");
    if (!host || rootOf(host) === directoryRoot || NOT_A_COMPANY_SITE.test(host)) return;
    if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|pptx?|mp4)(\?|$)/i.test(url)) return;
    const site = canonicalSite(url);
    if (site) websites.push({ url: site, host, source, strong: strong || domainMatchesName(host, companyName) });
  };

  // JSON-LD Organization for the exhibitor (Messe Düsseldorf "vis", many CMSs).
  // The directory's own Organization node is excluded by its host check in pushWebsite.
  for (const org of ldOrganisations(html)) {
    const orgName = typeof org.name === "string" ? org.name : "";
    const isExhibitor = !orgName || domainMatchesName(orgName.replace(/\s+/g, ""), companyName) || nameTokens(orgName).some((t) => nameTokens(companyName).includes(t));
    if (!isExhibitor) continue;
    if (org.url) pushWebsite(absolutise(firstString(org.url), pageUrl), "jsonld", true);
    const address = [].concat(org.address ?? []).find((a) => a && typeof a === "object");
    const country = normaliseCountry(firstString(address?.addressCountry?.name ?? address?.addressCountry));
    if (country) countries.push({ value: country, source: "jsonld" });
    const logo = absolutise(firstString(org.logo) ?? firstString(org.image) ?? "", pageUrl);
    if (logo && /^https?:/.test(logo)) logos.push({ url: logo, source: "jsonld" });
  }

  // Anchors pointing off the directory. Strong when labelled as a website, when
  // the visible text is the domain itself, or when the domain carries the company name.
  for (const m of html.matchAll(/<a\b([^>]*?)href\s*=\s*["']([^"'#]+)["']([^>]*)>([\s\S]{0,400}?)<\/a>/gi)) {
    const attrs = `${m[1]} ${m[3]}`;
    const url = absolutise(m[2], pageUrl);
    if (!url || !/^https?:/i.test(url)) continue;
    const text = stripTags(m[4]);
    const title = (attrs.match(/(?:title|aria-label)\s*=\s*["']([^"']+)["']/i) ?? [])[1] ?? "";
    const labelled = WEBSITE_LABEL.test(`${text} ${title}`) || /website|webseite|homepage|weblink|company-?url|exhibitor-?web/i.test(attrs);
    const domainText = DOMAIN_TEXT.test(text) && siteHost(text.startsWith("http") ? text : `https://${text}`) === siteHost(url);
    pushWebsite(url, labelled ? "labelled-link" : domainText ? "domain-text-link" : "link", labelled || domainText);
  }

  // Country written as a labelled field: "Country</dt><dd>Germany", "Land: Deutschland", …
  const labelled = /(?:country|land|pays|pa[ií]s|paese|herkunftsland|country\/region)\s*(?::|<\/[a-z0-9]+>)\s*(?:<[^>]+>\s*)*([^<\n]{2,40})</gi;
  for (const m of html.matchAll(labelled)) {
    const country = normaliseCountry(m[1]);
    if (country) countries.push({ value: country, source: "label" });
  }
  // Address data embedded as JSON for a client-side template (MapYourShow: addressValues: {"COUNTRY":"China",…}).
  for (const m of html.matchAll(/addressValues\s*:\s*\{[^}]*?"COUNTRY"\s*:\s*"([^"]{2,40})"/g)) {
    const country = normaliseCountry(m[1]);
    if (country) countries.push({ value: country, source: "label" });
  }
  // A postal address block whose last line is a country.
  for (const m of html.matchAll(/<(address|[a-z]+ [^>]*class=["'][^"']*address[^"']*["'])[^>]*>([\s\S]{0,600}?)<\/(?:address|div|p|span|li)>/gi)) {
    const lines = m[2].split(/<br\s*\/?>|\n|,/i).map(stripTags).filter(Boolean);
    const country = normaliseCountry(lines[lines.length - 1] ?? "");
    if (country) countries.push({ value: country, source: "address" });
  }

  // Logos: an <img> that names the company or is marked as a logo, then og:image.
  for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = m[1];
    const src = (attrs.match(/\s(?:data-src|data-lazy-src|src)\s*=\s*["']([^"']+)["']/i) ?? [])[1];
    if (!src || src.startsWith("data:")) continue;
    const alt = (attrs.match(/\salt\s*=\s*["']([^"']*)["']/i) ?? [])[1] ?? "";
    const cls = (attrs.match(/\s(?:class|id)\s*=\s*["']([^"']*)["']/i) ?? [])[1] ?? "";
    const namesCompany = alt && nameTokens(alt).some((t) => nameTokens(companyName).includes(t));
    const fileNamedLogo = /logo[^\/]*\.(png|jpe?g|svg|webp|gif)(\?|$)/i.test(src);
    if (!namesCompany && !/logo/i.test(`${cls} ${alt}`) && !fileNamedLogo) continue;
    const url = absolutise(src, pageUrl);
    if (url && /^https?:/.test(url) && !/\.svg\?|sprite|placeholder|default|blank|spacer|pixel|1x1/i.test(url)) {
      logos.push({ url, source: namesCompany ? "img-named" : "img-logo" });
    }
  }
  const og = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ?? [])[1];
  if (og) {
    const url = absolutise(og, pageUrl);
    if (url) logos.push({ url, source: "og" });
  }
  // apple-touch-icon: the site's square brand mark (~180px). On a directory page it is the directory's own
  // icon, repeated on every page, so chrome counting drops it there.
  for (const m of html.matchAll(/<link\b[^>]*rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/gi)) {
    const href = (m[0].match(/\shref\s*=\s*["']([^"']+)["']/i) ?? [])[1];
    const url = href && absolutise(href, pageUrl);
    if (url && /^https?:/.test(url)) {
      logos.push({ url, source: "touch-icon" });
      break;
    }
  }

  const contacts = extractContacts(html, pageUrl);
  // Fallback description: the first paragraph that names the company and reads like prose.
  const tokens = nameTokens(companyName);
  for (const m of html.replace(/<(script|style|nav|footer|header)\b[\s\S]*?<\/\1>/gi, "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = decodeEntities(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (text.length < 80 || text.length > 900 || !/[.!]/.test(text) || /cookie|javascript|browser|©|copyright|all rights reserved|privacy/i.test(text)) continue;
    // It must name the company early and say what it does — not a news item, interview or product manual line.
    const head = text.slice(0, 80).toLowerCase();
    if (!tokens.some((t) => head.includes(t))) continue;
    if (!/\b(is|are|was founded|offers?|specializ|specialis|manufactur|provid|develop|design|produc|suppl|deliver|leader|leading)\w*/i.test(text)) continue;
    if (/\b(announce|pleased|interview|webinar|join us|register|press release|news|congratulat|award(ed)? |visit us|booth)\b/i.test(text)) continue;
    contacts.descriptions.push(text.slice(0, 600));
    break;
  }
  return { websites, logos, countries, ...contacts };
}

/** "https://uk.linkedin.com/company/acme/?trk=x" → "https://www.linkedin.com/company/acme"; null for personal/feed links. */
export function canonicalLinkedIn(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/(company|school|showcase)\/([^/?#]+)/i);
    if (!m) return null;
    return `https://www.linkedin.com/${m[1].toLowerCase()}/${decodeURIComponent(m[2]).toLowerCase()}`;
  } catch {
    return null;
  }
}

/** A phone as written, kept only when it has 7–16 digits (an agenda time "4.30-4.40" or a year is not a phone). */
export function cleanPhone(raw) {
  if (typeof raw !== "string") return null;
  const value = decodeEntities(raw).replace(/^tel:/i, "").replace(/%20/g, " ").replace(/\s+/g, " ").trim();
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 16) return null;
  // Template placeholders: "(000) 000-0000", "123-456-7890", one digit repeated.
  if (digits.replace(/0/g, "").length < 3 || /^(\d)\1+$/.test(digits) || /1234567/.test(digits)) return null;
  if (!/^[+()\d][\d\s().\-/]*$/.test(value)) return null;
  return value;
}

/**
 * Company LinkedIn page, phone numbers and the page's own description. Judged later like everything
 * else: a LinkedIn page or phone repeated across a directory's exhibitors is the organiser's.
 */
export function extractContacts(html, pageUrl) {
  const linkedins = [];
  const phones = [];
  const descriptions = [];
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const href = decodeEntities(m[1]);
    const li = canonicalLinkedIn(href);
    if (li) linkedins.push(li);
    else if (/^tel:/i.test(href)) {
      const p = cleanPhone(href);
      if (p) phones.push({ value: p, source: "tel" });
    }
  }
  for (const m of html.matchAll(/(?:phone|tel(?:ephone)?|t[ée]l[ée]phone|telefon|tel[ée]fono|fon)\s*(?::|<\/[a-z0-9]+>)\s*(?:<[^>]+>\s*)*([+()\d][\d\s().\-/]{6,24})/gi)) {
    const p = cleanPhone(m[1]);
    if (p) phones.push({ value: p, source: "label" });
  }
  for (const m of html.matchAll(/"telephone"\s*:\s*"([^"]{6,30})"/g)) {
    const p = cleanPhone(m[1]);
    if (p) phones.push({ value: p, source: "jsonld" });
  }
  for (const re of [/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i]) {
    const d = (html.match(re) ?? [])[1];
    if (d) {
      const text = decodeEntities(d).replace(/\s+/g, " ").trim();
      if (text.length >= 40) descriptions.push(text.slice(0, 600));
    }
  }
  void pageUrl;
  return { linkedins: [...new Set(linkedins)], phones, descriptions: [...new Set(descriptions)] };
}

/**
 * True for a URL that serves an image: an image extension, or an image CDN /
 * upload path. A JSON-LD `image` that is really the profile page itself is not a logo.
 */
export function looksLikeImage(url) {
  try {
    const u = new URL(url);
    // UI furniture, never an exhibitor's logo.
    if (/\/(icons?|clientlibs|sprites?|flags?|emoji|social|share)\/|favicon|privacy|cookie|placeholder|no-?logo|default-?logo|avatar/i.test(u.pathname)) return false;
    // Tiny UI icons ("icon15x20.png", "?h=16&w=16", "apple-icon-57x57" is still fine at 57).
    if (/(^|[^0-9])([1-9]|[12][0-9]|3[01])x([1-9]|[12][0-9]|3[01])([^0-9]|$)/.test(u.pathname) || /assistant|chatbot/i.test(u.pathname)) return false;
    // A social network's icon or a social-share card, wherever it is stored.
    if (/(^|[\/_-])(icon-?)?(linkedin|facebook|twitter|instagram|youtube|whatsapp|tiktok|pinterest|xing)[^\/]*$|[\/_-]social[_-]/i.test(u.pathname)) return false;
    if (/\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(u.pathname)) return true;
    if (/\.(html?|php|aspx?|cfm|jsp)$/i.test(u.pathname)) return false;
    return /(cloudinary|imgix|imagekit|cloudfront|amazonaws|googleusercontent|akamaihd|twimg|ctfassets|sanity|storyblok|contentful|wixstatic|squarespace-cdn)\./i.test(u.hostname) ||
      /\/(images?|img|uploads?|media|logos?|assets|files)\//i.test(u.pathname) ||
      /[?&](format|fm|f)=(png|jpe?g|webp|auto)/i.test(u.search);
  } catch {
    return false;
  }
}

// ── Stage 2: decide, with chrome removed ────────────────────────────────────

/**
 * How many exhibitors on one directory host each website host and logo URL
 * appear for. Feed every page's candidates for that host through this before deciding.
 */
/**
 * Identity of a logo for chrome counting: the URL without its query string, because
 * cache-busters ("show_logo.png?breakcache=<random>") make one show logo look unique per page.
 */
export function logoKey(url) {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase()}${u.pathname}`;
  } catch {
    return url;
  }
}

export function countChrome(candidateList) {
  const websiteHosts = new Map();
  const logoUrls = new Map();
  const linkedins = new Map();
  const phones = new Map();
  const descriptions = new Map();
  const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
  for (const c of candidateList) {
    for (const v of new Set(c.linkedins ?? [])) bump(linkedins, v);
    for (const v of new Set((c.phones ?? []).map((p) => p.value.replace(/\D/g, "")))) bump(phones, v);
    for (const v of new Set(c.descriptions ?? [])) bump(descriptions, v);
  }
  for (const c of candidateList) {
    for (const h of new Set(c.websites.map((w) => w.host))) websiteHosts.set(h, (websiteHosts.get(h) ?? 0) + 1);
    for (const u of new Set(c.logos.map((l) => logoKey(l.url)))) logoUrls.set(u, (logoUrls.get(u) ?? 0) + 1);
  }
  return { websiteHosts, logoUrls, linkedins, phones, descriptions, pages: candidateList.length };
}

/**
 * A value seen on more pages than this is chrome. Two allows the same company
 * listed twice (two stands, two halls); a third occurrence on a big directory is
 * the organiser or a sponsor. With only a handful of pages sampled, any repeat is chrome.
 */
function chromeLimit(pages) {
  return pages >= 20 ? 2 : 1;
}

const LOGO_RANK = { jsonld: 0, "img-named": 1, "img-logo": 2, "touch-icon": 3, og: 4 };
const COUNTRY_RANK = { jsonld: 0, label: 1, address: 2 };

/** The profile this page supports, or nulls. Only strong website candidates are ever accepted. */
export function decideProfile(candidates, chrome, companyName) {
  const limit = chromeLimit(chrome.pages);
  // Strength is re-judged here (not trusted from the cache) so a rule change applies without re-fetching.
  const isStrong = (w) => w.source !== "link" || (companyName ? domainMatchesName(w.host, companyName) : w.strong);
  const websites = candidates.websites.filter((w) => isStrong(w) && (chrome.websiteHosts.get(w.host) ?? 0) <= limit);
  // One company, one site: disagreeing strong candidates mean the page is ambiguous.
  const hosts = new Set(websites.map((w) => rootOf(w.host)));
  const website = hosts.size === 1 ? websites.sort((a, b) => a.url.length - b.url.length)[0].url : null;

  const logo =
    candidates.logos
      .filter((l) => looksLikeImage(l.url) && (chrome.logoUrls.get(logoKey(l.url)) ?? 0) <= limit)
      .sort((a, b) => LOGO_RANK[a.source] - LOGO_RANK[b.source])[0]?.url ?? null;

  const countryValues = new Set(candidates.countries.map((c) => c.value));
  const country =
    countryValues.size === 1
      ? candidates.countries[0].value
      : candidates.countries.sort((a, b) => COUNTRY_RANK[a.source] - COUNTRY_RANK[b.source]).find((c) => c.source === "jsonld")?.value ?? null;

  // LinkedIn: only a company page whose address carries the company's name. A site or directory page
  // also links the shows it attends ("linkedin.com/company/gulfood"), and a numeric id cannot be checked.
  const lis = (candidates.linkedins ?? []).filter((v) => (chrome.linkedins?.get(v) ?? 0) <= limit);
  const named = companyName ? lis.filter((v) => domainMatchesName(v.split("/").pop().replace(/[^a-z0-9-]/g, "") + ".com", companyName)) : [];
  const linkedin = new Set(named).size === 1 ? named[0] : null;

  const PHONE_RANK = { jsonld: 0, label: 1, tel: 2 };
  const phone =
    (candidates.phones ?? [])
      .filter((p) => (chrome.phones?.get(p.value.replace(/\D/g, "")) ?? 0) <= limit)
      .sort((a, b) => PHONE_RANK[a.source] - PHONE_RANK[b.source])[0]?.value ?? null;

  // A directory's templated blurb ("Visit Acme at stand B12…") says nothing about the company.
  const description =
    (candidates.descriptions ?? []).find(
      (d) => (chrome.descriptions?.get(d) ?? 0) <= limit && !/\b(stand|booth|hall \d|exhibitor (profile|details|list)|find us at|visit us at|exhibiting at)\b/i.test(d),
    ) ?? null;

  return { website, country, logo, linkedin, phone, description };
}
