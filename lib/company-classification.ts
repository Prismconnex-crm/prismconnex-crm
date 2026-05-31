export const COMPANY_EMPLOYEE_RANGES = [
  "1-10",
  "11-20",
  "21-50",
  "51-100",
  "101-200",
  "51-200",
  "201-500",
  "501-1000",
  "1001-2000",
  "2001-5000",
  "1001-5000",
  "5001-10000",
  "10001+",
  "1001+",
] as const;

export const COMPANY_LOCATION_REGIONS = [
  "Americas",
  "Europe",
  "Africa & Middle East",
  "Asia-Pacific",
] as const;

export const COMPANY_CATEGORIES = [
  "information technology & services",
  "construction",
  "marketing and advertising",
  "real estate",
  "health, wellness & fitness",
  "management consulting",
  "computer software",
  "internet",
  "retail",
  "financial services",
  "consumer services",
  "hospital & health care",
  "automotive",
  "restaurants",
  "education management",
  "agriculture",
  "design",
  "hospitality",
  "accounting",
  "trade show events",
] as const;

export type CompanyRegion = (typeof COMPANY_LOCATION_REGIONS)[number];

const REGION_ALIASES: Record<CompanyRegion, readonly string[]> = {
  "Asia-Pacific": [
    "Australia",
    "Bangladesh",
    "Bangalore",
    "Bengaluru",
    "Beijing",
    "Cambodia",
    "Chennai",
    "China",
    "Colombo",
    "Hong Kong",
    "Hyderabad",
    "India",
    "Indonesia",
    "Islamabad",
    "Japan",
    "Karachi",
    "Korea",
    "Lahore",
    "Malaysia",
    "Melbourne",
    "Mumbai",
    "Myanmar",
    "Nepal",
    "New Delhi",
    "New Zealand",
    "Pakistan",
    "Philippines",
    "Shanghai",
    "Singapore",
    "South Korea",
    "Sri Lanka",
    "Sydney",
    "Taiwan",
    "Thailand",
    "Tokyo",
    "Vietnam",
  ],
  "Africa & Middle East": [
    "Abu Dhabi",
    "Bahrain",
    "Cairo",
    "Doha",
    "Dubai",
    "Egypt",
    "Israel",
    "Jeddah",
    "Johannesburg",
    "Jordan",
    "Kenya",
    "Kuwait",
    "Morocco",
    "Nigeria",
    "Oman",
    "Qatar",
    "Riyadh",
    "Saudi Arabia",
    "South Africa",
    "Turkey",
    "U A E",
    "UAE",
    "United Arab Emirates",
  ],
  Europe: [
    "Amsterdam",
    "Berlin",
    "Denmark",
    "England",
    "France",
    "Germany",
    "Ireland",
    "Italy",
    "London",
    "Netherlands",
    "Norway",
    "Poland",
    "Portugal",
    "Spain",
    "Sweden",
    "Switzerland",
    "U K",
    "UK",
    "United Kingdom",
  ],
  Americas: [
    "Austin",
    "Boston",
    "Brazil",
    "Canada",
    "Chicago",
    "Dallas",
    "Denver",
    "Los Angeles",
    "Mexico",
    "Miami",
    "New York",
    "San Diego",
    "Seattle",
    "Toronto",
    "U S A",
    "USA",
    "United States",
  ],
};

function normalizeLocation(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function locationContainsAlias(normalizedLocation: string, alias: string) {
  const normalizedAlias = normalizeLocation(alias);

  if (!normalizedAlias) {
    return false;
  }

  return ` ${normalizedLocation} `.includes(` ${normalizedAlias} `);
}

export function inferCompanyRegion(headquarters: string | null | undefined): CompanyRegion | null {
  const normalizedLocation = normalizeLocation(headquarters ?? "");

  if (!normalizedLocation) {
    return null;
  }

  for (const region of COMPANY_LOCATION_REGIONS) {
    if (REGION_ALIASES[region].some((alias) => locationContainsAlias(normalizedLocation, alias))) {
      return region;
    }
  }

  return null;
}
