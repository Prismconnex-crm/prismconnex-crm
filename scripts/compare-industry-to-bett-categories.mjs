/**
 * Cross-checks the derived industry against BETT's own category tag.
 *
 * The two vocabularies are different on purpose: BETT publishes a handful of
 * broad zones ("Learning & Teaching Tech", "Equipment & Hardware"), while
 * EventExhibitor.industry holds the finer sector the company actually works in.
 * So a mismatch is not automatically an error — "Education Technology" sitting
 * under "Learning & Teaching Tech" is a refinement, not a contradiction.
 *
 * What this looks for is the opposite: a derived sector that BETT's tag makes
 * implausible, e.g. a company tagged "Equipment & Hardware" that we classified
 * as a consultancy. Those are worth a human look, and they are the only rows
 * this prints.
 *
 * Read-only. It changes nothing; it just says where to look.
 *
 *   node scripts/compare-industry-to-bett-categories.mjs
 */
import { PrismaClient } from '@prisma/client';

const EVENT_SLUG = 'bett-show-london-2027-01-20';

/**
 * Sectors that sit comfortably under each BETT zone. A derived sector outside
 * its zone's list is reported, not corrected — the tag is evidence, not proof,
 * and some companies genuinely span zones.
 */
const PLAUSIBLE = {
  'Equipment & Hardware': [
    'IT Hardware & Devices', 'Audio Visual & Display', 'Furniture & Learning Spaces',
    'Printing & Imaging', 'Connectivity & Networking', 'STEM & Robotics',
    'Information Technology & Services', 'Sports & Physical Education',
    'Special Educational Needs', 'Safeguarding & Student Wellbeing',
  ],
  'Learning & Teaching Tech': [
    'Education Technology', 'Artificial Intelligence', 'Publishing & Learning Content',
    'Assessment & Examinations', 'STEM & Robotics', 'Language Learning',
    'Special Educational Needs', 'Teacher Training & Development',
    'School Data & Analytics', 'Arts, Music & Creative', 'Design & Creative Software',
    'Sports & Physical Education', 'Schools & Education Providers',
  ],
  'Management Solutions': [
    'School Management Software', 'School Data & Analytics', 'Safeguarding & Student Wellbeing',
    'Information Technology & Services', 'Cybersecurity', 'Connectivity & Networking',
    'Education Technology', 'Assessment & Examinations', 'Student Transport',
    'Facilities & Building Management', 'Consulting & Professional Services',
    'Artificial Intelligence', 'Printing & Imaging', 'Office Supplies & Stationery',
  ],
  'STEAM & Robotics': [
    'STEM & Robotics', 'Education Technology', 'Arts, Music & Creative',
    'Design & Creative Software', 'Publishing & Learning Content',
  ],
  'SEND Village (SEND Village)': [
    'Special Educational Needs', 'Safeguarding & Student Wellbeing', 'Education Technology',
    'Health & Medical', 'Publishing & Learning Content',
  ],
};

/**
 * Zones that say nothing about sector, so a sector can never contradict them.
 * "Startup Zone" is a stage of company, "Global Showcase" and "North America"
 * are country pavilions, and "Higher Education Zone" is an audience — a
 * furniture maker and an AI company can both stand in any of them.
 */
const NOT_SECTOR_ZONES = new Set([
  'Startup Zone',
  'Global Showcase',
  'Higher Education Zone',
  'North America',
  // Catch-alls in practice rather than categories. "Learning & Teaching Tech"
  // holds 92 of 236 tagged exhibitors and covers everything from Microsoft to a
  // greenscreen kit; "Equipment & Hardware" covers a translator device and an
  // office-supplies distributor alike. Judging a specific sector against either
  // produced 30 "mismatches" of which none was actually wrong, so they are
  // treated as uninformative rather than used as evidence.
  'Learning & Teaching Tech',
  'Equipment & Hardware',
]);

const prisma = new PrismaClient();

const rows = await prisma.eventExhibitor.findMany({
  where: { eventSlug: EVENT_SLUG, NOT: { categories: { isEmpty: true } } },
  select: { companyName: true, industry: true, categories: true, industryEvidence: true },
  orderBy: { companyName: 'asc' },
});

const zones = {};
rows.forEach((row) => {
  row.categories.forEach((category) => {
    zones[category] = (zones[category] ?? 0) + 1;
  });
});

console.log(`${rows.length} exhibitors carry a BETT category tag.\n`);
console.log("BETT's own zones:");
Object.keys(zones)
  .sort((a, b) => zones[b] - zones[a])
  .forEach((zone) => console.log(`  ${String(zones[zone]).padStart(3)}  ${zone}`));

const unclassified = rows.filter((row) => !row.industry);
const questionable = rows.filter((row) => {
  if (!row.industry) return false;
  // Only judge against zones that describe a sector, and only where we have a
  // plausibility list for one of them.
  const known = row.categories.filter(
    (category) => PLAUSIBLE[category] && !NOT_SECTOR_ZONES.has(category)
  );
  if (!known.length) return false;
  return !known.some((category) => PLAUSIBLE[category].includes(row.industry));
});

console.log(`\n${questionable.length} derived sector(s) look implausible for their BETT zone:`);
questionable.forEach((row) =>
  console.log(
    `  ${row.companyName.slice(0, 38).padEnd(40)}${(row.industry ?? '').padEnd(36)}BETT: ${row.categories.join(', ')}`
  )
);

console.log(`\n${unclassified.length} exhibitor(s) have a BETT tag but no derived sector:`);
unclassified.forEach((row) =>
  console.log(`  ${row.companyName.slice(0, 38).padEnd(40)}BETT: ${row.categories.join(', ')}`)
);

await prisma.$disconnect();
