// Generates data/people-seed.json — the committed People discovery dataset.
//
// Deterministic by construction: a seeded PRNG means re-running produces a
// byte-identical file, so tests can assert exact counts and the repo never
// churns. Run with:  node scripts/generate-people-seed.mjs
//
// The script asserts its own distributions BEFORE writing, so a change that
// starves a facet fails loudly here rather than silently emptying a filter
// group in the UI.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'data', 'people-seed.json');

const TOTAL = 2418;
/** Mean confidence must land on 84 so the strip reads "84% (Good)". */
const TARGET_MEAN_CONFIDENCE = 84;
/** How many German companies to guarantee, so country facets are never thin. */
const GUARANTEED_GERMAN_COMPANIES = 12;
/** How many rows the spec's worked example must return. */
const WORKED_EXAMPLE_ROWS = 14;

/** mulberry32 — small, fast, and stable across Node versions. */
function makeRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(20260816);

const pick = (list) => list[Math.floor(random() * list.length)];
const pickN = (list, n) => {
  const copy = [...list];
  const out = [];
  for (let i = 0; i < n && copy.length > 0; i += 1) {
    out.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
  }
  return out;
};
const intBetween = (min, max) => min + Math.floor(random() * (max - min + 1));

const FIRST_NAMES = [
  'Sarah', 'David', 'Amina', 'Jonas', 'Mia', 'Luca', 'Elena', 'Tomas', 'Priya', 'Marcus',
  'Chloe', 'Hiroshi', 'Ingrid', 'Rafael', 'Nadia', 'Oliver', 'Fatima', 'Sven', 'Yuki', 'Diego',
  'Anna', 'Peter', 'Leila', 'Andreas', 'Grace', 'Mateo', 'Sofia', 'Karl', 'Aisha', 'Daniel',
  'Emma', 'Viktor', 'Lucia', 'Samuel', 'Noor', 'Felix', 'Clara', 'Omar', 'Hannah', 'Niklas',
];

const LAST_NAMES = [
  'Miller', 'Lee', 'Khan', 'Richter', 'Thompson', 'Romano', 'Silva', 'Novak', 'Sharma', 'Weber',
  'Dubois', 'Tanaka', 'Larsen', 'Costa', 'Haddad', 'Bennett', 'Aziz', 'Andersson', 'Sato', 'Moreno',
  'Fischer', 'Walsh', 'Nasser', 'Berg', 'Okafor', 'Rossi', 'Garcia', 'Schmidt', 'Ali', 'Novotny',
  'Meyer', 'Petrov', 'Ferreira', 'Cohen', 'Yilmaz', 'Bauer', 'Lindqvist', 'Hassan', 'Krause', 'Vogel',
];

const SENIORITIES = ['C-Level', 'VP', 'Director', 'Manager', 'Senior', 'Individual Contributor', 'Entry'];
const DEPARTMENTS = ['Marketing', 'Sales', 'Engineering', 'Product', 'Operations', 'Finance', 'HR', 'Procurement', 'Legal', 'IT'];
const HEADCOUNT_BANDS = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'];
const VERIFICATION_STATUSES = ['verified', 'needs_verification', 'invalid'];
const DATA_SOURCES = ['user_import', 'licensed_dataset', 'enrichment'];
const BUYING_INTENTS = ['high', 'medium', 'low', 'none'];

/** Titles per department, so a title is never nonsense for its department. */
const TITLES_BY_DEPARTMENT = {
  Marketing: ['Marketing Manager', 'Head of Marketing', 'Demand Generation Manager', 'Brand Manager', 'Content Marketing Lead', 'Chief Marketing Officer', 'Marketing Coordinator'],
  Sales: ['Sales Director', 'Account Executive', 'Sales Manager', 'Business Development Manager', 'VP of Sales', 'Sales Development Representative'],
  Engineering: ['Engineering Manager', 'Senior Software Engineer', 'Head of Engineering', 'Platform Engineer', 'Chief Technology Officer', 'QA Engineer'],
  Product: ['Product Manager', 'Head of Product', 'Product Lead', 'Product Designer', 'Chief Product Officer', 'Associate Product Manager'],
  Operations: ['Operations Manager', 'Head of Operations', 'Supply Chain Manager', 'Chief Operating Officer', 'Operations Analyst'],
  Finance: ['Finance Director', 'Financial Controller', 'Chief Financial Officer', 'Finance Manager', 'Financial Analyst'],
  HR: ['HR Manager', 'Head of People', 'Talent Acquisition Lead', 'Chief People Officer', 'HR Business Partner'],
  Procurement: ['Procurement Lead', 'Purchasing Manager', 'Head of Procurement', 'Sourcing Specialist', 'Category Manager'],
  Legal: ['Legal Counsel', 'Head of Legal', 'Compliance Manager', 'General Counsel', 'Contracts Manager'],
  IT: ['IT Manager', 'Head of IT', 'Systems Administrator', 'Chief Information Officer', 'IT Support Specialist'],
};

/** Which seniority a title implies — keeps the two columns consistent. */
function seniorityForTitle(title) {
  if (/^Chief|^General Counsel/.test(title)) return 'C-Level';
  if (/^VP |Vice President/.test(title)) return 'VP';
  if (/^Head of|Director|Lead$|Counsel$/.test(title)) return 'Director';
  if (/Coordinator|Associate|Support|Representative/.test(title)) return 'Entry';
  if (/Manager|Controller|Partner$/.test(title)) return 'Manager';
  if (/^Senior/.test(title)) return 'Senior';
  return 'Individual Contributor';
}

const COUNTRIES = [
  { country: 'Germany', cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt'], tld: 'de' },
  { country: 'United Kingdom', cities: ['London', 'Manchester', 'Bristol'], tld: 'co.uk' },
  { country: 'France', cities: ['Paris', 'Lyon', 'Toulouse'], tld: 'fr' },
  { country: 'United States', cities: ['New York', 'San Francisco', 'Chicago', 'Austin'], tld: 'com' },
  { country: 'Netherlands', cities: ['Amsterdam', 'Rotterdam'], tld: 'nl' },
  { country: 'Spain', cities: ['Madrid', 'Barcelona'], tld: 'es' },
  { country: 'Italy', cities: ['Milan', 'Rome'], tld: 'it' },
  { country: 'Sweden', cities: ['Stockholm', 'Gothenburg'], tld: 'se' },
  { country: 'Poland', cities: ['Warsaw', 'Krakow'], tld: 'pl' },
  { country: 'India', cities: ['Bengaluru', 'Mumbai', 'Pune'], tld: 'in' },
  { country: 'Japan', cities: ['Tokyo', 'Osaka'], tld: 'jp' },
  { country: 'Canada', cities: ['Toronto', 'Vancouver'], tld: 'ca' },
  { country: 'Australia', cities: ['Sydney', 'Melbourne'], tld: 'com.au' },
  { country: 'Brazil', cities: ['Sao Paulo', 'Rio de Janeiro'], tld: 'com.br' },
  { country: 'Switzerland', cities: ['Zurich', 'Geneva'], tld: 'ch' },
  { country: 'Denmark', cities: ['Copenhagen'], tld: 'dk' },
  { country: 'Ireland', cities: ['Dublin'], tld: 'ie' },
  { country: 'Belgium', cities: ['Brussels', 'Antwerp'], tld: 'be' },
  { country: 'Norway', cities: ['Oslo'], tld: 'no' },
  { country: 'Austria', cities: ['Vienna'], tld: 'at' },
  { country: 'Portugal', cities: ['Lisbon', 'Porto'], tld: 'pt' },
  { country: 'Singapore', cities: ['Singapore'], tld: 'sg' },
  { country: 'United Arab Emirates', cities: ['Dubai', 'Abu Dhabi'], tld: 'ae' },
  { country: 'Finland', cities: ['Helsinki'], tld: 'fi' },
];

const INDUSTRIES = [
  'Artificial Intelligence', 'SaaS', 'Manufacturing', 'Healthcare', 'Logistics',
  'Renewable Energy', 'Financial Services', 'Automotive', 'Pharmaceuticals', 'Retail',
  'Telecommunications', 'Construction', 'Aerospace', 'Food & Beverage', 'Chemicals',
  'Cybersecurity', 'Education', 'Real Estate', 'Media', 'Agriculture',
  'Consumer Electronics', 'Insurance', 'Hospitality', 'Mining',
];

const COMPANY_PREFIXES = [
  'Nova', 'Cloud', 'Medi', 'Electro', 'Green', 'Secure', 'Data', 'Bright', 'Quantum', 'Orbit',
  'Vertex', 'Helio', 'Iron', 'Lumen', 'Atlas', 'Pulse', 'Nimbus', 'Forge', 'Delta', 'Zenith',
  'Apex', 'Cobalt', 'Ember', 'Northwind', 'Silva', 'Terra', 'Vega', 'Onyx', 'Kestrel', 'Sable',
];
const COMPANY_SUFFIXES = [
  'AI', 'Systems', 'Labs', 'Works', 'Dynamics', 'Group', 'Technologies', 'Industries',
  'Solutions', 'Networks', 'Robotics', 'Analytics',
];

const KEYWORDS = [
  'automation', 'sustainability', 'cloud migration', 'compliance', 'expansion',
  'digital transformation', 'cost reduction', 'hiring', 'partnerships', 'export',
  'data privacy', 'supply chain', 'customer retention', 'product launch', 'esg',
  'machine learning', 'iot', 'logistics', 'certification', 'rebrand',
  'market entry', 'procurement reform', 'esg reporting', 'trade shows',
];

/** Weighted pick: entries are [value, weight]. */
function weighted(entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

function buildCompanies() {
  const companies = [];
  const seen = new Set();
  // 240 companies over 2418 people gives ~10 contacts each — enough for the
  // Company facet to be useful without any single company dominating.
  while (companies.length < 240) {
    const name = `${pick(COMPANY_PREFIXES)}${pick(COMPANY_SUFFIXES)}`;
    if (seen.has(name)) continue;
    seen.add(name);
    // The first N are pinned to Germany so the spec's worked example always has
    // a real population behind it rather than depending on the dice.
    const place = companies.length < GUARANTEED_GERMAN_COMPANIES ? COUNTRIES[0] : pick(COUNTRIES);
    companies.push({
      name,
      domain: `${name.toLowerCase()}.${place.tld}`,
      country: place.country,
      cities: place.cities,
      industry: pick(INDUSTRIES),
      headcount: weighted([
        ['1-10', 6], ['11-50', 14], ['51-200', 22], ['201-500', 20],
        ['501-1000', 16], ['1001-5000', 14], ['5000+', 8],
      ]),
    });
  }
  return companies;
}

function confidenceFor(verification) {
  // Verified records are trustworthy, invalid ones are not; the spread is what
  // makes the >=50/70/90 chips meaningfully different from each other.
  if (verification === 'verified') return intBetween(82, 99);
  if (verification === 'needs_verification') return intBetween(58, 84);
  return intBetween(20, 55);
}

function isoDaysAgo(days) {
  const base = Date.UTC(2026, 7, 16); // 2026-08-16
  return new Date(base - days * 86400000).toISOString().slice(0, 10);
}

function generate() {
  const companies = buildCompanies();
  const people = [];

  for (let index = 0; index < TOTAL; index += 1) {
    const company = companies[index % companies.length];
    const department = pick(DEPARTMENTS);
    const title = pick(TITLES_BY_DEPARTMENT[department]);
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const verification = weighted([
      ['verified', 62], ['needs_verification', 29], ['invalid', 9],
    ]);
    const confidence = confidenceFor(verification);
    const city = pick(company.cities);

    people.push({
      id: `pcx-person-${String(index + 1).padStart(5, '0')}`,
      firstName,
      lastName,
      title,
      seniority: seniorityForTitle(title),
      department,
      company: company.name,
      companyDomain: company.domain,
      companyHeadcount: company.headcount,
      industry: company.industry,
      country: company.country,
      location: `${city}, ${company.country}`,
      workEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@${company.domain}`,
      phone: random() < 0.55 ? `+${intBetween(1, 99)} ${intBetween(10, 99)} ${intBetween(1000000, 9999999)}` : null,
      linkedinUrl:
        random() < 0.7
          ? `https://www.linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${index}`
          : null,
      verification,
      confidence,
      platformScore: Math.max(0, Math.min(100, confidence + intBetween(-12, 12))),
      source: weighted([['user_import', 34], ['licensed_dataset', 44], ['enrichment', 22]]),
      keywords: pickN(KEYWORDS, intBetween(1, 3)),
      buyingIntent: weighted([['high', 18], ['medium', 30], ['low', 32], ['none', 20]]),
      fetchedAt: isoDaysAgo(intBetween(0, 180)),
      lastActiveAt: isoDaysAgo(intBetween(0, 365)),
    });
  }

  return people;
}

/**
 * Guarantees the spec's worked example — "verified marketing managers in
 * Germany" — returns a useful number of rows. Left to chance it would land on
 * one or two records, which makes the acceptance demo look broken.
 */
function ensureWorkedExample(people) {
  const german = people.filter((person) => person.country === 'Germany');
  for (const person of german.slice(0, WORKED_EXAMPLE_ROWS)) {
    person.department = 'Marketing';
    person.title = 'Marketing Manager';
    person.seniority = 'Manager';
    person.verification = 'verified';
    person.confidence = Math.max(person.confidence, 82);
  }
}

/**
 * Nudges confidence until the mean is exactly TARGET_MEAN_CONFIDENCE, without
 * pushing any record outside its verification band's plausible range. The
 * running sum is tracked incrementally — recomputing the mean each step would
 * be O(n^2) over 2418 records.
 */
function calibrateConfidence(people) {
  const target = Math.round(TARGET_MEAN_CONFIDENCE * people.length);
  let sum = people.reduce((total, person) => total + person.confidence, 0);

  const limit = people.length * 100;
  let guard = 0;
  while (sum !== target && guard < limit) {
    const person = people[guard % people.length];
    const ceiling = person.verification === 'invalid' ? 55 : 99;
    const floor = person.verification === 'invalid' ? 20 : 40;

    if (sum < target && person.confidence < ceiling) {
      person.confidence += 1;
      sum += 1;
    } else if (sum > target && person.confidence > floor) {
      person.confidence -= 1;
      sum -= 1;
    }
    guard += 1;
  }

  if (sum !== target) {
    throw new Error(`Could not calibrate mean confidence to ${TARGET_MEAN_CONFIDENCE}`);
  }
}

function assertDistributions(people) {
  const fail = (message) => {
    throw new Error(`Seed assertion failed: ${message}`);
  };

  if (people.length !== TOTAL) fail(`expected ${TOTAL} records, got ${people.length}`);
  if (new Set(people.map((p) => p.id)).size !== TOTAL) fail('ids are not unique');

  const distinct = (key) => new Set(people.map((p) => p[key]));
  for (const [key, vocab] of [
    ['seniority', SENIORITIES],
    ['department', DEPARTMENTS],
    ['companyHeadcount', HEADCOUNT_BANDS],
    ['verification', VERIFICATION_STATUSES],
    ['source', DATA_SOURCES],
    ['buyingIntent', BUYING_INTENTS],
  ]) {
    const present = distinct(key);
    for (const value of vocab) {
      if (!present.has(value)) fail(`${key} never takes the value "${value}"`);
    }
  }

  for (const key of ['title', 'company', 'country', 'location', 'industry']) {
    if (distinct(key).size < 20) fail(`${key} has fewer than 20 distinct values`);
  }
  if (new Set(people.flatMap((p) => p.keywords)).size < 20) fail('fewer than 20 distinct keywords');

  for (const person of people) {
    if (person.confidence < 0 || person.confidence > 100) fail(`${person.id} confidence out of range`);
    if (person.platformScore < 0 || person.platformScore > 100) fail(`${person.id} score out of range`);
  }

  const mean = people.reduce((sum, p) => sum + p.confidence, 0) / people.length;
  if (Math.round(mean) !== TARGET_MEAN_CONFIDENCE) {
    fail(`mean confidence rounds to ${Math.round(mean)}, expected ${TARGET_MEAN_CONFIDENCE}`);
  }

  // The worked example from the spec must actually return rows.
  const worked = people.filter(
    (p) =>
      p.country === 'Germany' &&
      p.verification === 'verified' &&
      p.title.toLowerCase().includes('marketing manager')
  );
  if (worked.length === 0) fail('no verified Marketing Managers in Germany');
}

const people = generate();
ensureWorkedExample(people);
calibrateConfidence(people);
assertDistributions(people);

writeFileSync(OUT, `${JSON.stringify(people)}\n`, 'utf8');
console.log(
  `Wrote ${people.length} people to ${OUT} ` +
    `(mean confidence ${Math.round(people.reduce((s, p) => s + p.confidence, 0) / people.length)})`
);
