import {
  COMPANY_CATEGORIES,
  COMPANY_EMPLOYEE_RANGES,
} from "./company-classification";

// Parses a free-text lead prompt ("10 IT companies in India with 51-200
// employees") into the concrete filters the companies list understands.
export type ParsedLeadQuery = {
  category: string | null;
  country: string | null;
  region: string | null;
  employeeRange: string | null;
  limit: number | null;
};

const CATEGORY_ALIASES: Record<string, string> = {
  "information technology": "information technology & services",
  "it services": "information technology & services",
  tech: "information technology & services",
  software: "computer software",
  saas: "computer software",
  fintech: "financial services",
  finance: "financial services",
  financial: "financial services",
  banking: "financial services",
  healthcare: "hospital & health care",
  hospital: "hospital & health care",
  health: "health, wellness & fitness",
  wellness: "health, wellness & fitness",
  fitness: "health, wellness & fitness",
  marketing: "marketing and advertising",
  advertising: "marketing and advertising",
  "real estate": "real estate",
  property: "real estate",
  realty: "real estate",
  construction: "construction",
  retail: "retail",
  automotive: "automotive",
  education: "education management",
  agriculture: "agriculture",
  farming: "agriculture",
  hospitality: "hospitality",
  hotels: "hospitality",
  restaurants: "restaurants",
  food: "restaurants",
  accounting: "accounting",
  consulting: "management consulting",
  consultancy: "management consulting",
  internet: "internet",
  design: "design",
  "trade show": "trade show events",
  events: "trade show events",
  "consumer services": "consumer services",
  electronics: "consumer electronics",
  "consumer electronics": "consumer electronics",
};

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "USA",
  "united states": "USA",
  america: "USA",
  american: "USA",
  "u.s.": "USA",
  uk: "UK",
  "united kingdom": "UK",
  britain: "UK",
  british: "UK",
  england: "UK",
  india: "India",
  indian: "India",
  germany: "Germany",
  german: "Germany",
  france: "France",
  french: "France",
  japan: "Japan",
  japanese: "Japan",
  canada: "Canada",
  canadian: "Canada",
  australia: "Australia",
  australian: "Australia",
  singapore: "Singapore",
};

const REGION_ALIASES: Record<string, string> = {
  americas: "Americas",
  "north america": "Americas",
  "south america": "Americas",
  europe: "Europe",
  european: "Europe",
  asia: "Asia-Pacific",
  "asia-pacific": "Asia-Pacific",
  "asia pacific": "Asia-Pacific",
  apac: "Asia-Pacific",
  africa: "Africa & Middle East",
  "middle east": "Africa & Middle East",
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchAlias(text: string, aliases: Record<string, string>): string | null {
  // Longest alias first so "united states" wins over "us"-style fragments
  const keys = Object.keys(aliases).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (new RegExp(`\\b${escapeRegExp(key)}\\b`, "i").test(text)) {
      return aliases[key];
    }
  }
  return null;
}

export function parseLeadQuery(raw: string): ParsedLeadQuery {
  const text = raw.toLowerCase();

  // "10 companies / 10 IT companies / 10 fintech leads" → page size
  // (allows a few descriptive words between the number and the noun)
  const limitMatch = text.match(/\b(\d{1,3})\s+(?:[a-z&,'-]+\s+){0,4}?(?:companies|company|leads|results|firms)\b/);
  const limit = limitMatch ? Number.parseInt(limitMatch[1], 10) : null;

  // Employee headcount: an exact known range ("51-200", "10001+") or
  // "<n> employees" mapped onto the range containing n.
  let employeeRange: string | null = null;
  for (const range of COMPANY_EMPLOYEE_RANGES) {
    if (text.includes(range.toLowerCase())) {
      employeeRange = range;
      break;
    }
  }
  if (!employeeRange) {
    const empMatch = text.match(/\b(\d{1,6})\s*\+?\s*(?:employees|staff|people|headcount)\b/);
    if (empMatch) {
      const n = Number.parseInt(empMatch[1], 10);
      employeeRange =
        COMPANY_EMPLOYEE_RANGES.find((range) => {
          if (range.endsWith("+")) return n >= Number.parseInt(range, 10);
          const [lo, hi] = range.split("-").map((v) => Number.parseInt(v, 10));
          return n >= lo && n <= hi;
        }) ?? null;
    }
  }

  // Category: exact catalogue names first, then aliases ("IT" only when it
  // clearly refers to the sector, not the pronoun).
  let category: string | null = null;
  for (const name of COMPANY_CATEGORIES) {
    if (text.includes(name)) {
      category = name;
      break;
    }
  }
  if (!category) category = matchAlias(text, CATEGORY_ALIASES);
  if (!category && /\bit\b\s+(?:companies|company|sector|industry|firms|services|startups)/.test(text)) {
    category = "information technology & services";
  }

  const country = matchAlias(text, COUNTRY_ALIASES);
  const region = matchAlias(text, REGION_ALIASES);

  return { category, country, region, employeeRange, limit };
}
