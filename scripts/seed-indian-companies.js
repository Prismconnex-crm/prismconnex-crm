/**
 * seed-indian-companies.js
 * 
 * Generates and inserts 1,890,000 Indian companies into the PrismConnex CRM database.
 * These represent the ~1.89 million active companies registered under
 * India's Ministry of Corporate Affairs (MCA).
 * 
 * Performance: Uses WAL mode, batched inserts of 1000 rows per transaction.
 * Estimated runtime: 2-4 hours depending on hardware.
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({ log: ["error"] });

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const TOTAL_COMPANIES = 1_890_000;
const BATCH_SIZE = 1000;
const LOG_EVERY = 10_000;

// ═══════════════════════════════════════════════════════════════
// INDIAN COMPANY NAME GENERATORS
// ═══════════════════════════════════════════════════════════════

// Common Indian surnames / founder names used in company names
const FOUNDER_NAMES = [
  "Sharma", "Patel", "Gupta", "Singh", "Kumar", "Agarwal", "Jain", "Shah",
  "Reddy", "Mehta", "Verma", "Chopra", "Malhotra", "Bhatia", "Kapoor",
  "Sinha", "Mishra", "Bansal", "Goel", "Mittal", "Tiwari", "Saxena",
  "Rastogi", "Khanna", "Tandon", "Bajaj", "Maheshwari", "Choudhary",
  "Arora", "Sethi", "Doshi", "Trivedi", "Nair", "Menon", "Pillai",
  "Iyer", "Rao", "Naidu", "Hegde", "Shetty", "Bhatt", "Desai",
  "Gandhi", "Modi", "Thakur", "Chauhan", "Pandey", "Dubey", "Dwivedi",
  "Ahuja", "Oberoi", "Grover", "Luthra", "Anand", "Bose", "Chatterjee",
  "Mukherjee", "Das", "Sen", "Roy", "Ghosh", "Dey", "Sarkar",
  "Venkatesh", "Subramaniam", "Krishnamurthy", "Raghavan", "Sundaram",
  "Ranganathan", "Natarajan", "Gopalakrishnan", "Ramamurthy", "Seshadri",
];

// Industry-specific prefixes
const INDUSTRY_PREFIXES = [
  "Bharat", "Desh", "Hindustan", "National", "Indian", "Swadeshi",
  "Jai", "Shri", "Sai", "Om", "Ganesh", "Lakshmi", "Vishnu",
  "Krishna", "Shiva", "Durga", "Saraswati", "Hanuman", "Balaji",
  "Golden", "Silver", "Diamond", "Pearl", "Royal", "Imperial",
  "Supreme", "Premier", "Elite", "Classic", "Pioneer", "Modern",
  "New", "Star", "Sun", "Moon", "Global", "Universal", "United",
  "Apex", "Prime", "Alpha", "Omega", "Metro", "Mega", "Super",
  "Reliable", "Trusted", "Quality", "Standard", "Dynamic", "Progressive",
  "Advanced", "Rising", "Emerging", "Growing", "Evergreen", "Pinnacle",
];

// Domain-specific words per category
const CATEGORY_WORDS = {
  "information technology & services": ["Tech", "Soft", "Info", "Digi", "Cyber", "Net", "Data", "Cloud", "AI", "Systems", "Solutions", "Infotech", "Computech", "Webtech", "Coders", "Logic", "Byte", "Binary"],
  "construction": ["Build", "Infra", "Construct", "Estate", "Cement", "Steel", "Engineers", "Builders", "Housing", "Realty", "Structures", "Foundation", "Skyline", "Tower"],
  "marketing and advertising": ["Media", "Ads", "Creative", "Brand", "Vision", "Promo", "Campaign", "Reach", "Impact", "Market", "Digital Media", "Communications"],
  "real estate": ["Realty", "Properties", "Homes", "Land", "Estates", "Residences", "Developers", "Township", "Housing", "Infra", "Plots", "Builders"],
  "health, wellness & fitness": ["Health", "Wellness", "Fit", "Care", "Life", "Vital", "Heal", "Cure", "Ayu", "Yoga", "Medic", "Pharma", "Nutri"],
  "management consulting": ["Consult", "Advisory", "Strategy", "Management", "Partners", "Associates", "Advisors", "Solutions", "Insights", "Ventures"],
  "computer software": ["Soft", "Apps", "Code", "Dev", "Prog", "Logic", "Digital", "Platform", "Ware", "Labs", "Studio", "Matrix"],
  "internet": ["Net", "Web", "Online", "Digital", "Portal", "Cloud", "Connect", "Link", "Hub", "Dot", "Click", "Stream"],
  "retail": ["Mart", "Store", "Shop", "Bazaar", "Market", "Trade", "Retail", "Merchants", "Emporium", "Gallery", "Sales", "Depot"],
  "financial services": ["Fin", "Capital", "Money", "Credit", "Fund", "Wealth", "Investment", "Finance", "Banking", "Securities", "Asset", "Equity"],
  "consumer services": ["Services", "Care", "Support", "Help", "Assist", "Solutions", "Plus", "Pro", "Quick", "Express", "Direct", "First"],
  "hospital & health care": ["Hospital", "Clinic", "Medicare", "Health", "Medical", "Care", "Diagnostic", "Lab", "Surgical", "Ortho", "Neuro", "Cardio"],
  "automotive": ["Auto", "Motors", "Vehicles", "Cars", "Wheels", "Drive", "Moto", "Transport", "Garage", "Parts", "Engines", "Automobiles"],
  "restaurants": ["Foods", "Kitchen", "Dine", "Taste", "Spice", "Curry", "Tandoor", "Dhaba", "Rasoi", "Bhojnalaya", "Catering", "Flavours"],
  "education management": ["Edu", "Academy", "Institute", "Learning", "School", "Study", "Knowledge", "Training", "Skills", "Scholar", "Wisdom", "Vidya"],
  "agriculture": ["Agri", "Farm", "Krishi", "Seeds", "Harvest", "Green", "Organic", "Crop", "Soil", "Bio", "Agro", "Kisan", "Land"],
  "design": ["Design", "Studio", "Creative", "Art", "Craft", "Aesthetic", "Visual", "Graphics", "Decor", "Interiors", "Pattern", "Canvas"],
  "hospitality": ["Hotel", "Resort", "Inn", "Lodge", "Stay", "Hospitality", "Tourism", "Travel", "Heritage", "Palace", "Comfort", "Suites"],
  "accounting": ["Accounts", "Audit", "Tax", "Ledger", "Books", "CA", "Chartered", "Fiscal", "Revenue", "Compliance", "Statutory", "Filing"],
  "trade show events": ["Events", "Expo", "Exhibition", "Fair", "Convention", "Summit", "Conclave", "Meet", "Show", "Conference", "Forum", "Festival"],
};

// Company entity suffixes
const ENTITY_TYPES = [
  "Pvt Ltd", "Pvt Ltd", "Pvt Ltd", "Pvt Ltd",   // 40% - most common
  "Ltd", "Ltd", "Ltd",                            // 30%
  "LLP",                                          // 10%
  "Industries", "Enterprises",                     // 20%
];

// ═══════════════════════════════════════════════════════════════
// INDIAN CITIES & STATES (weighted by commercial activity)
// ═══════════════════════════════════════════════════════════════

const INDIAN_LOCATIONS = [
  // Metro cities (55% of companies)
  { city: "Mumbai", state: "Maharashtra", weight: 14 },
  { city: "Delhi", state: "Delhi", weight: 12 },
  { city: "Bengaluru", state: "Karnataka", weight: 10 },
  { city: "Hyderabad", state: "Telangana", weight: 6 },
  { city: "Chennai", state: "Tamil Nadu", weight: 5 },
  { city: "Kolkata", state: "West Bengal", weight: 4 },
  { city: "Pune", state: "Maharashtra", weight: 4 },
  
  // Tier-1 cities (25% of companies)
  { city: "Ahmedabad", state: "Gujarat", weight: 3 },
  { city: "Jaipur", state: "Rajasthan", weight: 2.5 },
  { city: "Lucknow", state: "Uttar Pradesh", weight: 2 },
  { city: "Chandigarh", state: "Punjab", weight: 1.5 },
  { city: "Noida", state: "Uttar Pradesh", weight: 2 },
  { city: "Gurugram", state: "Haryana", weight: 2.5 },
  { city: "Kochi", state: "Kerala", weight: 1.5 },
  { city: "Indore", state: "Madhya Pradesh", weight: 1.5 },
  { city: "Surat", state: "Gujarat", weight: 2 },
  { city: "Nagpur", state: "Maharashtra", weight: 1 },
  { city: "Vadodara", state: "Gujarat", weight: 1 },
  { city: "Coimbatore", state: "Tamil Nadu", weight: 1.5 },
  { city: "Visakhapatnam", state: "Andhra Pradesh", weight: 1 },
  
  // Tier-2 cities (20% of companies)
  { city: "Bhopal", state: "Madhya Pradesh", weight: 0.8 },
  { city: "Thiruvananthapuram", state: "Kerala", weight: 0.8 },
  { city: "Patna", state: "Bihar", weight: 0.7 },
  { city: "Bhubaneswar", state: "Odisha", weight: 0.7 },
  { city: "Dehradun", state: "Uttarakhand", weight: 0.5 },
  { city: "Ranchi", state: "Jharkhand", weight: 0.5 },
  { city: "Guwahati", state: "Assam", weight: 0.5 },
  { city: "Mangalore", state: "Karnataka", weight: 0.5 },
  { city: "Mysuru", state: "Karnataka", weight: 0.5 },
  { city: "Rajkot", state: "Gujarat", weight: 0.5 },
  { city: "Ludhiana", state: "Punjab", weight: 0.5 },
  { city: "Amritsar", state: "Punjab", weight: 0.4 },
  { city: "Madurai", state: "Tamil Nadu", weight: 0.5 },
  { city: "Varanasi", state: "Uttar Pradesh", weight: 0.4 },
  { city: "Agra", state: "Uttar Pradesh", weight: 0.4 },
  { city: "Nashik", state: "Maharashtra", weight: 0.4 },
  { city: "Aurangabad", state: "Maharashtra", weight: 0.4 },
  { city: "Jodhpur", state: "Rajasthan", weight: 0.3 },
  { city: "Udaipur", state: "Rajasthan", weight: 0.3 },
  { city: "Raipur", state: "Chhattisgarh", weight: 0.4 },
  { city: "Kanpur", state: "Uttar Pradesh", weight: 0.5 },
  { city: "Faridabad", state: "Haryana", weight: 0.4 },
  { city: "Ghaziabad", state: "Uttar Pradesh", weight: 0.5 },
  { city: "Kolhapur", state: "Maharashtra", weight: 0.3 },
  { city: "Vijayawada", state: "Andhra Pradesh", weight: 0.4 },
  { city: "Tiruchirappalli", state: "Tamil Nadu", weight: 0.3 },
  { city: "Salem", state: "Tamil Nadu", weight: 0.3 },
  { city: "Hubli", state: "Karnataka", weight: 0.3 },
  { city: "Siliguri", state: "West Bengal", weight: 0.2 },
  { city: "Jalandhar", state: "Punjab", weight: 0.3 },
];

// Build weighted location picker
let locationPool = [];
for (const loc of INDIAN_LOCATIONS) {
  const count = Math.round(loc.weight * 10);
  for (let i = 0; i < count; i++) locationPool.push(loc);
}

// ═══════════════════════════════════════════════════════════════
// CATEGORY DISTRIBUTION (matches plan)
// ═══════════════════════════════════════════════════════════════

const CATEGORY_DISTRIBUTION = [
  { category: "information technology & services", pct: 15 },
  { category: "construction", pct: 10 },
  { category: "financial services", pct: 9 },
  { category: "real estate", pct: 8 },
  { category: "retail", pct: 7 },
  { category: "management consulting", pct: 6 },
  { category: "hospital & health care", pct: 5 },
  { category: "automotive", pct: 5 },
  { category: "agriculture", pct: 5 },
  { category: "education management", pct: 4 },
  { category: "consumer services", pct: 4 },
  { category: "marketing and advertising", pct: 3 },
  { category: "hospitality", pct: 3 },
  { category: "design", pct: 2 },
  { category: "accounting", pct: 2 },
  { category: "computer software", pct: 2 },
  { category: "internet", pct: 2 },
  { category: "health, wellness & fitness", pct: 2 },
  { category: "trade show events", pct: 1 },
  { category: "restaurants", pct: 5 },
];

// Build weighted category picker
let categoryPool = [];
for (const c of CATEGORY_DISTRIBUTION) {
  for (let i = 0; i < c.pct; i++) categoryPool.push(c.category);
}

// ═══════════════════════════════════════════════════════════════
// EMPLOYEE RANGE DISTRIBUTION (realistic for India)
// ═══════════════════════════════════════════════════════════════

const EMPLOYEE_RANGES = [
  { range: "1-10", weight: 40 },       // Most companies are micro
  { range: "11-20", weight: 20 },
  { range: "21-50", weight: 15 },
  { range: "51-100", weight: 8 },
  { range: "101-200", weight: 5 },
  { range: "201-500", weight: 4 },
  { range: "501-1000", weight: 3 },
  { range: "1001-5000", weight: 3 },
  { range: "5001-10000", weight: 1 },
  { range: "10001+", weight: 1 },
];

let empPool = [];
for (const e of EMPLOYEE_RANGES) {
  for (let i = 0; i < e.weight; i++) empPool.push(e.range);
}

// ═══════════════════════════════════════════════════════════════
// REVENUE RANGES
// ═══════════════════════════════════════════════════════════════

const REVENUE_RANGES = [
  { range: "< ₹1 Cr", weight: 35 },
  { range: "₹1 - 10 Cr", weight: 25 },
  { range: "₹10 - 50 Cr", weight: 15 },
  { range: "₹50 - 100 Cr", weight: 8 },
  { range: "₹100 - 500 Cr", weight: 7 },
  { range: "₹500 Cr - ₹1000 Cr", weight: 5 },
  { range: "₹1000 Cr+", weight: 3 },
  { range: "$10M - $25M", weight: 1 },
  { range: "$25M - $50M", weight: 0.5 },
  { range: "$50M - $100M", weight: 0.3 },
  { range: "$100M - $500M", weight: 0.15 },
  { range: "$500M - $1B", weight: 0.05 },
];

let revPool = [];
for (const r of REVENUE_RANGES) {
  const count = Math.max(1, Math.round(r.weight * 2));
  for (let i = 0; i < count; i++) revPool.push(r.range);
}

// ═══════════════════════════════════════════════════════════════
// TRUST SIGNALS
// ═══════════════════════════════════════════════════════════════

const TRUST_SIGNALS = [
  "MCA Registered, Active Status",
  "MCA Registered, ISO Certified",
  "MCA Registered, MSME Certified",
  "MCA Registered, GST Registered",
  "MCA Registered, Active Status, DIPP Recognized",
  "MCA Registered, Startup India Recognized",
  "MCA Registered, CMMI Level 3",
  "MCA Registered, Active Status, Trade License",
  "MCA Registered, FSSAI Licensed",
  "MCA Registered, RERA Registered",
];

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Simple hash for unique-ish IDs
function simpleId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateCompanyName(category, index) {
  const style = randInt(1, 6);
  let name;
  
  const founder = pick(FOUNDER_NAMES);
  const prefix = pick(INDUSTRY_PREFIXES);
  const words = CATEGORY_WORDS[category] || ["Services", "Solutions", "Enterprises"];
  const word = pick(words);
  const entity = pick(ENTITY_TYPES);
  const founder2 = pick(FOUNDER_NAMES);
  
  switch (style) {
    case 1: // "Sharma Tech Pvt Ltd"
      name = `${founder} ${word} ${entity}`;
      break;
    case 2: // "Bharat Infosystems Ltd"  
      name = `${prefix} ${word} ${entity}`;
      break;
    case 3: // "Sharma & Patel Associates Pvt Ltd"
      name = `${founder} & ${founder2} ${word} ${entity}`;
      break;
    case 4: // "Sri Ganesh Industries"
      name = `Sri ${founder} ${word} ${entity}`;
      break;
    case 5: // "Patel Trading Co"
      name = `${founder} ${word} Co`;
      break;
    case 6: // "Modern Sharma Enterprises Pvt Ltd"
      name = `${prefix} ${founder} ${entity}`;
      break;
  }
  
  // Append index to ensure uniqueness
  return `${name} ${index}`;
}

function generateDomain(name, index) {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .slice(0, 2)
    .join("");
  return `${clean}${index}.co.in`;
}

function generateDescription(name, category, city, state) {
  const descs = [
    `${name} is a ${category} company based in ${city}, ${state}, India. Registered under the Ministry of Corporate Affairs.`,
    `Leading ${category} firm headquartered in ${city}, ${state}. ${name} provides quality services across India.`,
    `${name} operates in the ${category} sector from ${city}, ${state}, India. Committed to excellence and growth.`,
    `Based in ${city}, ${state}, ${name} is an active company in the ${category} industry registered with MCA.`,
    `${name}, headquartered in ${city}, delivers comprehensive ${category} solutions across Indian markets.`,
  ];
  return pick(descs);
}

function generateTags(category) {
  const baseTags = {
    "information technology & services": ["IT Services", "Software", "Consulting", "Digital", "Cloud", "Data", "Automation", "AI"],
    "construction": ["Construction", "Infrastructure", "Civil Engineering", "Building", "Real Estate", "Cement", "Steel"],
    "financial services": ["Finance", "Banking", "NBFC", "Insurance", "Mutual Funds", "Lending", "Fintech"],
    "real estate": ["Real Estate", "Property", "Housing", "Land Development", "Township", "Commercial", "Residential"],
    "retail": ["Retail", "FMCG", "Consumer", "E-commerce", "Wholesale", "Distribution", "Trading"],
    "management consulting": ["Consulting", "Strategy", "Advisory", "Management", "Operations", "HR", "Business"],
    "hospital & health care": ["Healthcare", "Hospital", "Medical", "Diagnostics", "Pharma", "Clinical", "Patient Care"],
    "automotive": ["Automotive", "Automobile", "EV", "Parts", "Manufacturing", "Transport", "Vehicles"],
    "agriculture": ["Agriculture", "Farming", "Agritech", "Seeds", "Fertilizers", "Organic", "Crop"],
    "education management": ["Education", "EdTech", "Training", "Coaching", "School", "University", "Skill Development"],
    "consumer services": ["Consumer", "Services", "Home Services", "Maintenance", "Support", "Lifestyle"],
    "marketing and advertising": ["Marketing", "Advertising", "Digital Marketing", "Branding", "PR", "Media"],
    "hospitality": ["Hospitality", "Hotels", "Tourism", "Travel", "Restaurants", "Catering", "Events"],
    "design": ["Design", "UI/UX", "Graphics", "Interior", "Architecture", "Creative", "Visual"],
    "accounting": ["Accounting", "Audit", "Tax", "Compliance", "GST", "CA Firm", "Bookkeeping"],
    "computer software": ["Software", "SaaS", "Product", "Engineering", "Development", "Platform"],
    "internet": ["Internet", "Web", "Digital", "Online", "SaaS", "Platform", "App"],
    "health, wellness & fitness": ["Health", "Wellness", "Fitness", "Yoga", "Ayurveda", "Gym", "Nutrition"],
    "trade show events": ["Events", "Exhibition", "Trade Show", "Conference", "MICE", "Convention"],
    "restaurants": ["Food", "Restaurant", "Catering", "QSR", "Cafe", "Cuisine", "Dining"],
  };
  
  const tags = baseTags[category] || ["Business", "Services", "India"];
  // Pick 3-5 random tags
  const count = randInt(3, 5);
  const selected = [];
  const copy = [...tags];
  for (let i = 0; i < Math.min(count, copy.length); i++) {
    const idx = randInt(0, copy.length - 1);
    selected.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return selected.join(", ");
}

function generateHighlights(category, city) {
  const highlights = [
    `Active MCA registration, ${city} headquartered`,
    `Growing ${category} firm in ${city}`,
    `Established presence in ${city} market`,
    `Expanding operations across India`,
    `Strong ${city}-based client network`,
  ];
  return pick(highlights);
}

function generateInsights(category) {
  const insights = [
    `Emerging player in India's ${category} sector`,
    `Part of India's growing ${category} industry`,
    `Contributing to India's ${category} ecosystem`,
    `Active participant in India's ${category} market`,
    `Positioned for growth in Indian ${category}`,
  ];
  return pick(insights);
}

// ═══════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  PrismConnex CRM - Indian Companies Seed Script        ║");
  console.log("║  Target: 1,890,000 companies (MCA registered)          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("");

  // Get workspace
  const workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    console.error("❌ No workspace found! Run the app first to create one.");
    process.exit(1);
  }
  const wid = workspace.id;
  console.log(`✓ Workspace: ${wid}`);

  // Configure SQLite for maximum insert throughput
  console.log("⚙ Configuring SQLite for bulk inserts...");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 60000;");
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
  await prisma.$queryRawUnsafe("PRAGMA cache_size = -64000;");  // 64MB cache
  await prisma.$queryRawUnsafe("PRAGMA temp_store = MEMORY;");
  console.log("✓ SQLite configured (WAL mode, 64MB cache, memory temp)");

  const startTime = Date.now();
  let inserted = 0;
  let batchNum = 0;

  console.log(`\n🚀 Starting insertion of ${TOTAL_COMPANIES.toLocaleString()} companies...`);
  console.log(`   Batch size: ${BATCH_SIZE} | Log every: ${LOG_EVERY.toLocaleString()}\n`);

  while (inserted < TOTAL_COMPANIES) {
    const batchStart = Date.now();
    const remaining = TOTAL_COMPANIES - inserted;
    const currentBatchSize = Math.min(BATCH_SIZE, remaining);
    const batch = [];

    for (let i = 0; i < currentBatchSize; i++) {
      const globalIndex = inserted + i + 1;
      const category = pick(categoryPool);
      const location = pick(locationPool);
      const empRange = pick(empPool);
      const revenue = pick(revPool);
      const name = generateCompanyName(category, globalIndex);
      const domain = generateDomain(name, globalIndex);
      const score = randInt(85, 100); // High scores for Indian priority

      batch.push({
        workspaceId: wid,
        name: name,
        category: category,
        description: generateDescription(name, category, location.city, location.state),
        domain: domain,
        website: `https://${domain}`,
        founded: String(randInt(1950, 2024)),
        employeeRange: empRange,
        headquarters: `${location.city}, ${location.state}, India`,
        region: "Asia-Pacific",
        revenueRange: revenue,
        engagementScore: score,
        trustSignals: pick(TRUST_SIGNALS),
        tags: generateTags(category),
        email: `info@${domain}`,
        phone: `+91 ${randInt(70, 99)}${randInt(10, 99)} ${randInt(100, 999)} ${randInt(100, 999)}`,
        highlights: generateHighlights(category, location.city),
        insights: generateInsights(category),
      });
    }

    // Insert batch
    try {
      await prisma.company.createMany({ data: batch });
    } catch (err) {
      console.error(`❌ Batch ${batchNum} failed:`, err.message);
      // Retry once after a short delay
      await new Promise(r => setTimeout(r, 2000));
      try {
        await prisma.company.createMany({ data: batch });
      } catch (retryErr) {
        console.error(`❌ Batch ${batchNum} retry failed:`, retryErr.message);
        console.log("   Skipping batch and continuing...");
      }
    }

    inserted += currentBatchSize;
    batchNum++;

    // Progress logging
    if (inserted % LOG_EVERY === 0 || inserted === TOTAL_COMPANIES) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = Math.round(inserted / (Date.now() - startTime) * 1000);
      const pct = ((inserted / TOTAL_COMPANIES) * 100).toFixed(1);
      const eta = rate > 0 ? Math.round((TOTAL_COMPANIES - inserted) / rate) : "?";
      
      console.log(
        `  📊 ${inserted.toLocaleString().padStart(11)} / ${TOTAL_COMPANIES.toLocaleString()} ` +
        `(${pct}%) | ${rate.toLocaleString()} rows/sec | ` +
        `Elapsed: ${elapsed}s | ETA: ${eta}s`
      );
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  ✅ COMPLETED                                           ║`);
  console.log(`║  Inserted: ${inserted.toLocaleString().padEnd(10)} companies                  ║`);
  console.log(`║  Time:     ${totalTime.padEnd(10)} minutes                       ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
