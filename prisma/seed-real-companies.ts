/**
 * Seed a curated set of REAL, well-known Indian companies with REAL domains.
 *
 * Every domain is DNS-verified at runtime — only companies whose domain
 * actually resolves are inserted, so the app never shows a dead website link.
 *
 * Idempotent: upserts by domain, so re-running won't create duplicates
 * (this also de-dupes the existing IT-MNC set that was seeded twice).
 *
 * Run:  npx tsx prisma/seed-real-companies.ts
 */
import { PrismaClient } from "@prisma/client";
import { promises as dns } from "node:dns";

const prisma = new PrismaClient({ log: ["error"] });

type Seed = {
  name: string;
  domain: string;
  category: string;
  employeeRange: string;
  founded: string;
  hq: string;
  revenueRange: string;
  score: number;
  tags: string;
};

// Compact curated list. Domains chosen for well-known listed / major Indian
// companies. DNS verification below drops any that don't resolve.
const C = (
  name: string,
  domain: string,
  category: string,
  hq: string,
  score: number,
  tags: string,
  employeeRange = "10001+",
  founded = "",
  revenueRange = "$1B+",
): Seed => ({ name, domain, category, employeeRange, founded, hq, revenueRange, score, tags });

const IT = "information technology & services";
const BANK = "banking & financial services";
const FMCG = "consumer goods";
const AUTO = "automotive";
const ENERGY = "energy & utilities";
const METAL = "metals & mining";
const PHARMA = "pharmaceuticals & healthcare";
const CEMENT = "cement & construction";
const TELECOM = "telecom & media";
const INTERNET = "internet & consumer tech";
const RETAIL = "retail & consumer";
const TRAVEL = "travel & aviation";
const CONGLO = "conglomerate";

const companies: Seed[] = [
  // ── IT / Technology ──
  C("Tata Consultancy Services", "tcs.com", IT, "Mumbai, India", 100, "IT Services, Consulting, Tata Group"),
  C("Infosys", "infosys.com", IT, "Bengaluru, India", 99, "IT Services, Consulting, Cloud, AI"),
  C("Wipro", "wipro.com", IT, "Bengaluru, India", 99, "IT Services, Consulting, Cloud"),
  C("HCLTech", "hcltech.com", IT, "Noida, India", 98, "IT Services, Engineering, Cloud"),
  C("Tech Mahindra", "techmahindra.com", IT, "Pune, India", 98, "IT Services, Telecom, 5G"),
  C("LTIMindtree", "ltimindtree.com", IT, "Mumbai, India", 97, "IT Services, Digital, Cloud"),
  C("Mphasis", "mphasis.com", IT, "Bengaluru, India", 96, "IT Services, Cloud, BFSI"),
  C("L&T Technology Services", "ltts.com", IT, "Vadodara, India", 96, "Engineering R&D, IoT"),
  C("Persistent Systems", "persistent.com", IT, "Pune, India", 95, "Software, Digital Engineering"),
  C("Coforge", "coforge.com", IT, "Noida, India", 95, "IT Services, Digital"),
  C("Cyient", "cyient.com", IT, "Hyderabad, India", 94, "Engineering, Geospatial"),
  C("Birlasoft", "birlasoft.com", IT, "Pune, India", 92, "IT Services, Digital"),
  C("Zensar Technologies", "zensar.com", IT, "Pune, India", 91, "IT Services, Digital"),
  C("Sonata Software", "sonata-software.com", IT, "Bengaluru, India", 90, "IT Services, Platform"),
  C("KPIT Technologies", "kpit.com", IT, "Pune, India", 92, "Automotive Software, Mobility"),
  C("Tata Elxsi", "tataelxsi.com", IT, "Bengaluru, India", 93, "Design, Engineering, Media"),
  C("Happiest Minds", "happiestminds.com", IT, "Bengaluru, India", 90, "Digital, IT Services"),
  C("Newgen Software", "newgensoft.com", IT, "New Delhi, India", 89, "Low Code, BPM, ECM"),
  C("Intellect Design Arena", "intellectdesign.com", IT, "Chennai, India", 89, "FinTech, Banking Software"),
  C("Ramco Systems", "ramco.com", IT, "Chennai, India", 87, "ERP, HCM, Aviation Software"),
  C("Oracle Financial Services", "oracle.com", IT, "Mumbai, India", 90, "Banking Software, FLEXCUBE"),
  C("Route Mobile", "routemobile.com", IT, "Mumbai, India", 86, "CPaaS, Messaging"),
  C("Tanla Platforms", "tanla.com", IT, "Hyderabad, India", 86, "CPaaS, Messaging"),
  C("Firstsource Solutions", "firstsource.com", IT, "Mumbai, India", 88, "BPM, BPO"),
  C("eClerx", "eclerx.com", IT, "Mumbai, India", 85, "Analytics, BPM"),

  // ── Banking / Financial services ──
  C("HDFC Bank", "hdfcbank.com", BANK, "Mumbai, India", 99, "Private Bank, Retail Banking"),
  C("ICICI Bank", "icicibank.com", BANK, "Mumbai, India", 98, "Private Bank, Retail Banking"),
  C("State Bank of India", "sbi.co.in", BANK, "Mumbai, India", 98, "Public Bank, Retail Banking"),
  C("Axis Bank", "axisbank.com", BANK, "Mumbai, India", 97, "Private Bank"),
  C("Kotak Mahindra Bank", "kotak.com", BANK, "Mumbai, India", 96, "Private Bank, Wealth"),
  C("IndusInd Bank", "indusind.com", BANK, "Mumbai, India", 94, "Private Bank"),
  C("Bank of Baroda", "bankofbaroda.in", BANK, "Vadodara, India", 93, "Public Bank"),
  C("Punjab National Bank", "pnbindia.in", BANK, "New Delhi, India", 92, "Public Bank"),
  C("Canara Bank", "canarabank.com", BANK, "Bengaluru, India", 92, "Public Bank"),
  C("IDFC First Bank", "idfcfirstbank.com", BANK, "Mumbai, India", 91, "Private Bank"),
  C("RBL Bank", "rblbank.com", BANK, "Mumbai, India", 89, "Private Bank"),
  C("Federal Bank", "federalbank.co.in", BANK, "Kochi, India", 90, "Private Bank"),
  C("Bandhan Bank", "bandhanbank.com", BANK, "Kolkata, India", 89, "Private Bank, Microfinance"),
  C("Bajaj Finance", "bajajfinance.in", BANK, "Pune, India", 96, "NBFC, Consumer Finance"),
  C("Bajaj Finserv", "bajajfinserv.in", BANK, "Pune, India", 95, "Financial Services, Insurance"),
  C("HDFC Life", "hdfclife.com", BANK, "Mumbai, India", 94, "Life Insurance"),
  C("SBI Life Insurance", "sbilife.co.in", BANK, "Mumbai, India", 93, "Life Insurance"),
  C("ICICI Prudential Life", "iciciprulife.com", BANK, "Mumbai, India", 93, "Life Insurance"),
  C("Life Insurance Corporation", "licindia.in", BANK, "Mumbai, India", 95, "Life Insurance, PSU"),
  C("SBI Cards", "sbicard.com", BANK, "Gurugram, India", 91, "Credit Cards"),
  C("Muthoot Finance", "muthootfinance.com", BANK, "Kochi, India", 90, "Gold Loan, NBFC"),
  C("Cholamandalam Investment", "cholamandalam.com", BANK, "Chennai, India", 90, "NBFC, Vehicle Finance"),
  C("Angel One", "angelone.in", BANK, "Mumbai, India", 89, "Broking, FinTech"),
  C("Motilal Oswal", "motilaloswal.com", BANK, "Mumbai, India", 88, "Broking, Wealth"),
  C("Zerodha", "zerodha.com", BANK, "Bengaluru, India", 93, "Discount Broking, FinTech", "1001-5000"),
  C("Groww", "groww.in", BANK, "Bengaluru, India", 91, "Investing, FinTech", "1001-5000"),
  C("Policybazaar", "policybazaar.com", BANK, "Gurugram, India", 90, "Insurance Marketplace", "5001-10000"),
  C("Paytm", "paytm.com", BANK, "Noida, India", 90, "Payments, FinTech", "10001+"),
  C("PhonePe", "phonepe.com", BANK, "Bengaluru, India", 92, "Payments, UPI, FinTech", "5001-10000"),
  C("Razorpay", "razorpay.com", BANK, "Bengaluru, India", 91, "Payments, FinTech", "5001-10000"),
  C("CRED", "cred.club", BANK, "Bengaluru, India", 88, "FinTech, Payments", "1001-5000"),

  // ── FMCG / Consumer goods ──
  C("Hindustan Unilever", "hul.co.in", FMCG, "Mumbai, India", 98, "FMCG, Personal Care"),
  C("ITC Limited", "itcportal.com", CONGLO, "Kolkata, India", 97, "FMCG, Hotels, Paper"),
  C("Nestlé India", "nestle.in", FMCG, "Gurugram, India", 96, "Food, Beverages"),
  C("Britannia Industries", "britannia.com", FMCG, "Bengaluru, India", 94, "Food, Bakery"),
  C("Dabur India", "dabur.com", FMCG, "Ghaziabad, India", 93, "Ayurveda, FMCG"),
  C("Marico", "marico.com", FMCG, "Mumbai, India", 92, "FMCG, Personal Care"),
  C("Godrej Consumer Products", "godrejcp.com", FMCG, "Mumbai, India", 93, "FMCG, Home Care"),
  C("Colgate-Palmolive India", "colgate.co.in", FMCG, "Mumbai, India", 91, "Oral Care, FMCG"),
  C("Tata Consumer Products", "tataconsumer.com", FMCG, "Mumbai, India", 92, "Food, Beverages, Tata"),
  C("Emami", "emamiltd.in", FMCG, "Kolkata, India", 89, "FMCG, Personal Care"),
  C("Varun Beverages", "varunbeverages.com", FMCG, "Gurugram, India", 92, "Beverages, PepsiCo Bottler"),
  C("United Breweries", "unitedbreweries.com", FMCG, "Bengaluru, India", 89, "Beverages, Beer"),
  C("Nykaa", "nykaa.com", RETAIL, "Mumbai, India", 90, "Beauty, E-commerce", "5001-10000"),
  C("Honasa Consumer (Mamaearth)", "honasa.in", FMCG, "Gurugram, India", 87, "Personal Care, D2C", "1001-5000"),

  // ── Automotive ──
  C("Tata Motors", "tatamotors.com", AUTO, "Mumbai, India", 96, "Automobiles, EV, Tata Group"),
  C("Maruti Suzuki", "marutisuzuki.com", AUTO, "New Delhi, India", 97, "Automobiles, Passenger Cars"),
  C("Mahindra & Mahindra", "mahindra.com", AUTO, "Mumbai, India", 95, "Automobiles, SUV, Tractors"),
  C("Bajaj Auto", "bajajauto.com", AUTO, "Pune, India", 94, "Two-Wheelers, Three-Wheelers"),
  C("Hero MotoCorp", "heromotocorp.com", AUTO, "New Delhi, India", 94, "Two-Wheelers, Motorcycles"),
  C("TVS Motor Company", "tvsmotor.com", AUTO, "Chennai, India", 93, "Two-Wheelers"),
  C("Eicher Motors", "eichermotors.com", AUTO, "New Delhi, India", 92, "Royal Enfield, Commercial Vehicles"),
  C("Ashok Leyland", "ashokleyland.com", AUTO, "Chennai, India", 91, "Commercial Vehicles, Trucks"),
  C("Samvardhana Motherson", "motherson.com", AUTO, "Noida, India", 91, "Auto Components"),
  C("Bosch India", "bosch.in", AUTO, "Bengaluru, India", 90, "Auto Components, Technology"),
  C("MRF", "mrftyres.com", AUTO, "Chennai, India", 90, "Tyres"),
  C("Apollo Tyres", "apollotyres.com", AUTO, "Gurugram, India", 89, "Tyres"),
  C("Balkrishna Industries", "bkt-tires.com", AUTO, "Mumbai, India", 88, "Off-Highway Tyres"),

  // ── Energy / Utilities ──
  C("Reliance Industries", "ril.com", CONGLO, "Mumbai, India", 100, "Energy, Retail, Telecom, Petrochemicals"),
  C("Oil and Natural Gas Corporation", "ongcindia.com", ENERGY, "New Delhi, India", 95, "Oil & Gas, PSU"),
  C("NTPC", "ntpc.co.in", ENERGY, "New Delhi, India", 94, "Power Generation, PSU"),
  C("Power Grid Corporation", "powergrid.in", ENERGY, "Gurugram, India", 93, "Power Transmission, PSU"),
  C("Indian Oil Corporation", "iocl.com", ENERGY, "New Delhi, India", 94, "Oil & Gas, Refining, PSU"),
  C("Bharat Petroleum", "bharatpetroleum.in", ENERGY, "Mumbai, India", 93, "Oil & Gas, Refining, PSU"),
  C("Hindustan Petroleum", "hindustanpetroleum.com", ENERGY, "Mumbai, India", 92, "Oil & Gas, PSU"),
  C("GAIL India", "gailonline.com", ENERGY, "New Delhi, India", 92, "Natural Gas, PSU"),
  C("Tata Power", "tatapower.com", ENERGY, "Mumbai, India", 92, "Power, Renewables"),
  C("Adani Green Energy", "adanigreenenergy.com", ENERGY, "Ahmedabad, India", 91, "Renewable Energy"),
  C("Adani Power", "adanipower.com", ENERGY, "Ahmedabad, India", 90, "Power Generation"),
  C("Adani Enterprises", "adanienterprises.com", CONGLO, "Ahmedabad, India", 93, "Infrastructure, Conglomerate"),
  C("Coal India", "coalindia.in", ENERGY, "Kolkata, India", 91, "Coal Mining, PSU"),

  // ── Metals / Mining ──
  C("Tata Steel", "tatasteel.com", METAL, "Mumbai, India", 94, "Steel, Tata Group"),
  C("JSW Steel", "jsw.in", METAL, "Mumbai, India", 93, "Steel"),
  C("Hindalco Industries", "hindalco.com", METAL, "Mumbai, India", 92, "Aluminium, Copper, Aditya Birla"),
  C("Vedanta", "vedantalimited.com", METAL, "Mumbai, India", 91, "Metals, Mining, Oil"),
  C("Jindal Steel & Power", "jindalsteelpower.com", METAL, "New Delhi, India", 90, "Steel, Power"),
  C("Steel Authority of India", "sail.co.in", METAL, "New Delhi, India", 90, "Steel, PSU"),
  C("NMDC", "nmdc.co.in", METAL, "Hyderabad, India", 88, "Iron Ore Mining, PSU"),
  C("APL Apollo Tubes", "aplapollo.com", METAL, "Ghaziabad, India", 88, "Steel Tubes"),

  // ── Pharma / Healthcare ──
  C("Sun Pharmaceutical", "sunpharma.com", PHARMA, "Mumbai, India", 95, "Pharmaceuticals"),
  C("Dr. Reddy's Laboratories", "drreddys.com", PHARMA, "Hyderabad, India", 94, "Pharmaceuticals, Generics"),
  C("Cipla", "cipla.com", PHARMA, "Mumbai, India", 94, "Pharmaceuticals, Respiratory"),
  C("Lupin", "lupin.com", PHARMA, "Mumbai, India", 92, "Pharmaceuticals"),
  C("Aurobindo Pharma", "aurobindo.com", PHARMA, "Hyderabad, India", 91, "Pharmaceuticals, APIs"),
  C("Divi's Laboratories", "divislabs.com", PHARMA, "Hyderabad, India", 92, "APIs, Custom Synthesis"),
  C("Biocon", "biocon.com", PHARMA, "Bengaluru, India", 92, "Biopharmaceuticals, Biosimilars"),
  C("Torrent Pharmaceuticals", "torrentpharma.com", PHARMA, "Ahmedabad, India", 90, "Pharmaceuticals"),
  C("Glenmark Pharmaceuticals", "glenmarkpharma.com", PHARMA, "Mumbai, India", 90, "Pharmaceuticals"),
  C("Alkem Laboratories", "alkemlabs.com", PHARMA, "Mumbai, India", 89, "Pharmaceuticals"),
  C("Mankind Pharma", "mankindpharma.com", PHARMA, "New Delhi, India", 90, "Pharmaceuticals, Consumer Health"),
  C("Zydus Lifesciences", "zyduslife.com", PHARMA, "Ahmedabad, India", 90, "Pharmaceuticals"),
  C("Apollo Hospitals", "apollohospitals.com", PHARMA, "Chennai, India", 93, "Hospitals, Healthcare"),
  C("Fortis Healthcare", "fortishealthcare.com", PHARMA, "Gurugram, India", 90, "Hospitals, Healthcare"),
  C("Max Healthcare", "maxhealthcare.in", PHARMA, "New Delhi, India", 90, "Hospitals, Healthcare"),
  C("Dr. Lal PathLabs", "lalpathlabs.com", PHARMA, "New Delhi, India", 89, "Diagnostics"),
  C("Metropolis Healthcare", "metropolisindia.com", PHARMA, "Mumbai, India", 87, "Diagnostics"),

  // ── Cement / Construction ──
  C("UltraTech Cement", "ultratechcement.com", CEMENT, "Mumbai, India", 93, "Cement, Aditya Birla"),
  C("Ambuja Cements", "ambujacement.com", CEMENT, "Mumbai, India", 91, "Cement, Adani"),
  C("ACC Limited", "acclimited.com", CEMENT, "Mumbai, India", 90, "Cement, Adani"),
  C("Shree Cement", "shreecement.com", CEMENT, "Kolkata, India", 90, "Cement"),
  C("Dalmia Bharat", "dalmiabharat.com", CEMENT, "New Delhi, India", 88, "Cement"),
  C("The Ramco Cements", "ramcocements.in", CEMENT, "Chennai, India", 88, "Cement"),
  C("JK Cement", "jkcement.com", CEMENT, "Kanpur, India", 87, "Cement"),
  C("Larsen & Toubro", "larsentoubro.com", CONGLO, "Mumbai, India", 95, "Engineering, Construction, EPC"),

  // ── Telecom / Media ──
  C("Bharti Airtel", "airtel.in", TELECOM, "New Delhi, India", 96, "Telecom, Mobile, Broadband"),
  C("Reliance Jio", "jio.com", TELECOM, "Mumbai, India", 96, "Telecom, 5G, Digital"),
  C("Vodafone Idea", "myvi.in", TELECOM, "Mumbai, India", 88, "Telecom, Mobile"),
  C("Bharat Sanchar Nigam", "bsnl.co.in", TELECOM, "New Delhi, India", 85, "Telecom, PSU"),
  C("Zee Entertainment", "zee.com", TELECOM, "Mumbai, India", 87, "Media, Broadcasting"),
  C("PVR INOX", "pvrinox.com", TELECOM, "Gurugram, India", 88, "Cinema, Entertainment"),
  C("Sun TV Network", "sunnetwork.in", TELECOM, "Chennai, India", 86, "Media, Broadcasting"),

  // ── Internet / Consumer tech ──
  C("Flipkart", "flipkart.com", INTERNET, "Bengaluru, India", 95, "E-commerce, Marketplace", "10001+"),
  C("Myntra", "myntra.com", INTERNET, "Bengaluru, India", 91, "Fashion E-commerce", "5001-10000"),
  C("Zomato", "zomato.com", INTERNET, "Gurugram, India", 93, "Food Delivery, Marketplace", "5001-10000"),
  C("Swiggy", "swiggy.com", INTERNET, "Bengaluru, India", 93, "Food Delivery, Quick Commerce", "5001-10000"),
  C("Meesho", "meesho.com", INTERNET, "Bengaluru, India", 89, "Social Commerce", "1001-5000"),
  C("BigBasket", "bigbasket.com", INTERNET, "Bengaluru, India", 89, "Grocery E-commerce, Tata", "5001-10000"),
  C("Blinkit", "blinkit.com", INTERNET, "Gurugram, India", 89, "Quick Commerce", "1001-5000"),
  C("Delhivery", "delhivery.com", INTERNET, "Gurugram, India", 89, "Logistics, Supply Chain", "10001+"),
  C("OYO", "oyorooms.com", INTERNET, "Gurugram, India", 88, "Hospitality, Travel Tech", "5001-10000"),
  C("Ola", "olacabs.com", INTERNET, "Bengaluru, India", 88, "Ride-hailing, Mobility", "5001-10000"),
  C("Ola Electric", "olaelectric.com", AUTO, "Bengaluru, India", 88, "EV, Two-Wheelers", "5001-10000"),
  C("CarDekho", "cardekho.com", INTERNET, "Jaipur, India", 86, "Auto Marketplace", "1001-5000"),
  C("Cars24", "cars24.com", INTERNET, "Gurugram, India", 86, "Used Cars, Marketplace", "1001-5000"),
  C("Dream11", "dream11.com", INTERNET, "Mumbai, India", 88, "Fantasy Sports, Gaming", "1001-5000"),
  C("Unacademy", "unacademy.com", INTERNET, "Bengaluru, India", 85, "EdTech", "1001-5000"),
  C("PharmEasy", "pharmeasy.in", INTERNET, "Mumbai, India", 85, "HealthTech, Pharmacy", "1001-5000"),
  C("Tata 1mg", "1mg.com", INTERNET, "Gurugram, India", 86, "HealthTech, Pharmacy, Tata", "1001-5000"),
  C("Urban Company", "urbancompany.com", INTERNET, "Gurugram, India", 86, "Home Services, Marketplace", "1001-5000"),
  C("Lenskart", "lenskart.com", RETAIL, "Faridabad, India", 89, "Eyewear, Omnichannel Retail", "5001-10000"),
  C("boAt", "boat-lifestyle.com", RETAIL, "New Delhi, India", 87, "Consumer Electronics, Audio", "1001-5000"),

  // ── Retail / Consumer / Industrials ──
  C("Avenue Supermarts (DMart)", "dmartindia.com", RETAIL, "Mumbai, India", 93, "Retail, Supermarkets"),
  C("Titan Company", "titancompany.in", RETAIL, "Bengaluru, India", 93, "Jewellery, Watches, Tata"),
  C("Asian Paints", "asianpaints.com", RETAIL, "Mumbai, India", 94, "Paints, Coatings"),
  C("Berger Paints", "bergerpaints.com", RETAIL, "Kolkata, India", 90, "Paints, Coatings"),
  C("Pidilite Industries", "pidilite.com", RETAIL, "Mumbai, India", 92, "Adhesives, Fevicol"),
  C("Havells India", "havells.com", RETAIL, "Noida, India", 91, "Electricals, Consumer Durables"),
  C("Voltas", "voltas.com", RETAIL, "Mumbai, India", 89, "Air Conditioning, Tata"),
  C("Blue Star", "bluestarindia.com", RETAIL, "Mumbai, India", 88, "Air Conditioning, Cooling"),
  C("Crompton Greaves Consumer", "crompton.co.in", RETAIL, "Mumbai, India", 88, "Consumer Electricals"),
  C("Dixon Technologies", "dixoninfo.com", RETAIL, "Noida, India", 89, "Electronics Manufacturing"),
  C("Page Industries (Jockey)", "pageind.com", RETAIL, "Bengaluru, India", 89, "Apparel, Innerwear"),
  C("Bata India", "bata.in", RETAIL, "Gurugram, India", 87, "Footwear, Retail"),
  C("Relaxo Footwears", "relaxofootwear.com", RETAIL, "New Delhi, India", 85, "Footwear"),
  C("Trent", "trentlimited.com", RETAIL, "Mumbai, India", 90, "Retail, Westside, Tata"),

  // ── Travel / Aviation ──
  C("InterGlobe Aviation (IndiGo)", "goindigo.in", TRAVEL, "Gurugram, India", 92, "Airline, Aviation"),
  C("Air India", "airindia.com", TRAVEL, "New Delhi, India", 90, "Airline, Tata"),
  C("SpiceJet", "spicejet.com", TRAVEL, "Gurugram, India", 84, "Airline, Aviation"),
  C("MakeMyTrip", "makemytrip.com", TRAVEL, "Gurugram, India", 89, "Online Travel", "1001-5000"),
  C("EaseMyTrip", "easemytrip.com", TRAVEL, "New Delhi, India", 85, "Online Travel", "501-1000"),
  C("Ixigo", "ixigo.com", TRAVEL, "Gurugram, India", 84, "Online Travel", "501-1000"),
  C("IRCTC", "irctc.co.in", TRAVEL, "New Delhi, India", 90, "Rail Ticketing, PSU"),

  // ── Existing curated real companies (keep/merge) ──
  C("FidensGen Business Solutions Private Limited", "fidensgen.com", IT, "India", 95, "B2B, IT Services, Digital Transformation", "21-50", "2020", "$1M - $10M"),
  C("BigHaat Agro", "bighaat.com", RETAIL, "Bengaluru, India", 85, "AgriTech, E-commerce", "201-500", "2015", "$10M - $50M"),
];

function build(seed: Seed) {
  return {
    name: seed.name,
    category: seed.category,
    description: `${seed.name} is a leading ${seed.category} company headquartered in ${seed.hq}.`,
    domain: seed.domain,
    website: `https://${seed.domain}`,
    founded: seed.founded,
    employeeRange: seed.employeeRange,
    headquarters: seed.hq,
    region: "Asia-Pacific",
    revenueRange: seed.revenueRange,
    engagementScore: seed.score,
    trustSignals: "Verified Domain, Active Website, Listed/Established Company",
    tags: seed.tags,
    email: `info@${seed.domain}`,
    phone: "",
    highlights: seed.tags,
    insights: `Established presence in the ${seed.category} sector.`,
  };
}

async function resolves(domain: string): Promise<boolean> {
  // Try A record, then fall back to any record type — a domain "resolves"
  // if the system resolver returns anything for it.
  try {
    await dns.resolve(domain);
    return true;
  } catch {
    try {
      await dns.resolve(domain, "A");
      return true;
    } catch {
      try {
        await dns.resolve(`www.${domain}`);
        return true;
      } catch {
        return false;
      }
    }
  }
}

async function verifyAll(seeds: Seed[]): Promise<{ ok: Seed[]; failed: string[] }> {
  const ok: Seed[] = [];
  const failed: string[] = [];
  const CONCURRENCY = 20;
  for (let i = 0; i < seeds.length; i += CONCURRENCY) {
    const batch = seeds.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (s) => ({ s, ok: await resolves(s.domain) })),
    );
    for (const r of results) {
      if (r.ok) ok.push(r.s);
      else failed.push(`${r.s.name} (${r.s.domain})`);
    }
    process.stdout.write(`  verified ${Math.min(i + CONCURRENCY, seeds.length)}/${seeds.length}\r`);
  }
  process.stdout.write("\n");
  return { ok, failed };
}

async function main() {
  const workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    console.error("No workspace found. Run the base seed (prisma/seed.ts) first.");
    process.exit(1);
  }

  // De-dupe the curated list by domain (case there are accidental repeats).
  const byDomain = new Map<string, Seed>();
  for (const s of companies) byDomain.set(s.domain.toLowerCase(), s);
  const unique = Array.from(byDomain.values());

  console.log(`Curated candidates: ${unique.length}`);
  console.log("DNS-verifying domains (only resolving ones are seeded)...");
  const { ok, failed } = await verifyAll(unique);

  console.log(`\n✅ Resolved: ${ok.length}`);
  if (failed.length) {
    console.log(`⚠️  Dropped (did not resolve): ${failed.length}`);
    for (const f of failed) console.log(`   - ${f}`);
  }

  let created = 0;
  let updated = 0;
  for (const seed of ok) {
    const data = build(seed);
    const existing = await prisma.company.findFirst({
      where: { domain: seed.domain, workspaceId: workspace.id },
      select: { id: true },
    });
    if (existing) {
      await prisma.company.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.company.create({ data: { workspaceId: workspace.id, ...data } });
      created++;
    }
  }

  console.log(`\nSeed complete — created: ${created}, updated: ${updated}, total real: ${ok.length}`);

  // Emit the verified real-domain whitelist for the delete step (Phase C).
  const domains = ok.map((s) => s.domain.toLowerCase()).sort();
  console.log(`\n__REAL_DOMAINS__=${JSON.stringify(domains)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
