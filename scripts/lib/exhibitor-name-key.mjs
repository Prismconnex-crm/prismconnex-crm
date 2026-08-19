// Stable upsert key for an exhibitor within one event.
//
// The same company reaches us from two sources whose spellings differ: the Bett
// directory listing ("BalanceBox", "JP Sa Couto SA") and the enriched sheet
// ("BalanceBox®", "JP Sá Couto, SA"). Keying on the raw name would create
// duplicate rows, so both importers reduce the name to this canonical form.
//
// Deliberately aggressive: diacritics folded, trademark marks and legal suffixes
// dropped, punctuation removed. Two genuinely different exhibitors would have to
// differ only by suffix or accent to collide.

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  reg: "®", trade: "™", copy: "©", deg: "°", bull: "•",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…",
  aacute: "á", agrave: "à", acirc: "â", atilde: "ã", auml: "ä", aring: "å", aelig: "æ",
  ccedil: "ç", eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
  iacute: "í", igrave: "ì", icirc: "î", iuml: "ï", ntilde: "ñ",
  oacute: "ó", ograve: "ò", ocirc: "ô", otilde: "õ", ouml: "ö", oslash: "ø",
  uacute: "ú", ugrave: "ù", ucirc: "û", uuml: "ü", yacute: "ý", szlig: "ß",
};

/**
 * Decodes the HTML entities that come through in scraped directory names, so
 * "BalanceBox&reg;" is stored (and displayed) as "BalanceBox®".
 */
export function decodeEntities(value) {
  if (typeof value !== "string" || !value.includes("&")) return value;
  return value
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => NAMED_ENTITIES[n] ?? m);
}

const LEGAL_SUFFIXES = [
  "ltd", "limited", "llp", "lp", "inc", "incorporated", "llc", "plc",
  "gmbh", "ggmbh", "mbh", "ag", "kg", "ohg",
  "bv", "nv", "sarl", "sas", "sa", "srl", "spa", "sl", "sau",
  "ab", "as", "asa", "oy", "oyj", "aps", "kk", "kft", "zrt", "doo", "dooel",
  "pte", "pty", "pvt", "private", "co", "corp", "corporation", "company",
  "holding", "holdings", "group",
];

/**
 * @param {string} name Exhibitor name as published.
 * @returns {string} Canonical key, e.g. "BalanceBox®" -> "balancebox".
 */
export function exhibitorNameKey(name) {
  const folded = decodeEntities(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // combining accents
    .replace(/[®™©]/g, " ")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/&/g, " and ")
    .toLowerCase();

  const words = folded
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  // Only strip a suffix when something else remains — "Group" alone stays "group".
  const kept = words.filter((w, i) => !(LEGAL_SUFFIXES.includes(w) && i > 0));
  const key = (kept.length ? kept : words).join("");
  return key || (name ?? "").trim().toLowerCase();
}
