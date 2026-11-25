/**
 * Industry for an exhibitor at ANY trade show — the all-sector counterpart of lib/events/industry.ts, whose
 * vocabulary is scoped to an education show (BETT) and cannot place a MEDICA or ADIPEC exhibitor.
 *
 * Same discipline as that classifier:
 *  - a sector is chosen only on phrases found in the company's OWN name and text (its description, its
 *    directory categories), and the phrases that decided it are returned as evidence;
 *  - a weak or tied result is not guessed — it falls through.
 *
 * Fallback, stated as such: an exhibitor whose own text decides nothing gets the sector of the show it is
 * exhibiting at (from the Find Shows catalog category), with source "show-category" and evidence naming the
 * show, so the profile never presents it as the company's own words.
 *
 * Keywords include common German, French, Spanish and Italian forms, because most directory and company copy
 * in this dataset is not English. Matching is accent-insensitive and on word starts, so "pharma" also matches
 * "pharmaceutical" but "art" cannot fire inside "start".
 */

export const GENERAL_INDUSTRIES = [
  'Aerospace & Defence',
  'Agriculture & Farming',
  'Arts, Crafts & Collectibles',
  'Automation & Robotics',
  'Automotive & Transport',
  'Building & Construction',
  'Chemicals & Materials',
  'Cosmetics & Beauty',
  'Cybersecurity',
  'Education & Training',
  'Electronics & Electrical',
  'Energy & Utilities',
  'Environment & Waste Management',
  'Fashion, Textiles & Apparel',
  'Financial Services',
  'Food & Beverage',
  'Furniture & Interiors',
  'Gaming & Entertainment',
  'Government & Associations',
  'Health & Medical',
  'Home & Garden',
  'Hospitality & Catering',
  'Industrial Machinery & Engineering',
  'Information Technology & Software',
  'Jewellery & Watches',
  'Logistics & Supply Chain',
  'Marine & Maritime',
  'Media, Printing & Publishing',
  'Metals & Mining',
  'Oil & Gas',
  'Packaging',
  'Pets & Veterinary',
  'Pharmaceuticals & Biotech',
  'Plastics & Rubber',
  'Professional Services & Consulting',
  'Real Estate & Property',
  'Retail & Consumer Goods',
  'Safety & Security',
  'Sports, Leisure & Outdoor',
  'Telecommunications',
  'Travel & Tourism',
] as const;

export type GeneralIndustry = (typeof GENERAL_INDUSTRIES)[number];

type Rule = { industry: GeneralIndustry; strong: string[]; weak?: string[] };

/** Strong: close to decisive alone. Weak: consistent with the sector, but said by others too. */
const RULES: Rule[] = [
  { industry: 'Aerospace & Defence', strong: ['aerospace', 'aircraft', 'aviation', 'avionics', 'defence', 'defense', 'military', 'luftfahrt', 'aeronautic', 'drone', 'uav', 'satellite', 'space launch'], weak: ['airline', 'airport', 'cabin interior'] },
  { industry: 'Agriculture & Farming', strong: ['agricultur', 'agri', 'farm', 'farming', 'livestock', 'dairy farm', 'tractor', 'crop protection', 'fertili', 'seed', 'landwirtschaft', 'agricole', 'agricola', 'irrigation', 'greenhouse', 'horticultur', 'poultry', 'cattle', 'veehouderij', 'aquaculture', 'fisheries'], weak: ['harvest', 'grain', 'feed'] },
  { industry: 'Arts, Crafts & Collectibles', strong: ['antique', 'antiquit', 'collectible', 'gallery', 'art gallery', 'patchwork', 'quilting', 'knitting', 'yarn', 'handmade', 'craft supplies', 'kunsthandwerk', 'artisan'], weak: ['art', 'craft', 'painting'] },
  { industry: 'Automation & Robotics', strong: ['automation', 'robot', 'robotic', 'automatisierung', 'cobot', 'plc', 'motion control', 'machine vision', 'industrial control'], weak: ['sensor', 'actuator', 'drive'] },
  { industry: 'Automotive & Transport', strong: ['automotive', 'auto parts', 'car parts', 'vehicle', 'aftermarket', 'brake', 'tyre', 'tire', 'truck', 'motorcycle', 'caravan', 'motorhome', 'camper', 'rail', 'railway', 'bus', 'fahrzeug', 'kfz', 'automobile', 'ev charging', 'electric vehicle', 'motorsport', 'racing'], weak: ['engine', 'garage', 'dealer', 'mobility'] },
  { industry: 'Building & Construction', strong: ['construction', 'building material', 'concrete', 'cement', 'roofing', 'insulation', 'window', 'door', 'facade', 'flooring', 'tiles', 'scaffold', 'plumbing', 'hvac', 'heating', 'ventilation', 'air conditioning', 'bau', 'baustoff', 'batiment', 'construccion', 'edilizia', 'architect', 'renovation', 'masonry', 'asphalt', 'glass processing', 'tunnel'], weak: ['building', 'contractor', 'installer', 'stone'] },
  { industry: 'Chemicals & Materials', strong: ['chemical', 'chemie', 'chimie', 'quimica', 'adhesive', 'sealant', 'coating', 'paint', 'pigment', 'resin', 'solvent', 'lubricant', 'composite', 'silicone', 'polymer', 'magnetic material'], weak: ['material', 'additive'] },
  { industry: 'Cosmetics & Beauty', strong: ['cosmetic', 'kosmetik', 'beauty', 'skincare', 'skin care', 'hair care', 'haircare', 'salon', 'nail', 'fragrance', 'perfume', 'parfum', 'makeup', 'aesthetic', 'spa'], weak: ['wellness'] },
  { industry: 'Cybersecurity', strong: ['cybersecurity', 'cyber security', 'infosec', 'information security', 'threat detection', 'firewall', 'penetration testing', 'siem', 'zero trust', 'identity management'], weak: ['security'] },
  { industry: 'Education & Training', strong: ['education', 'school', 'university', 'college', 'e-learning', 'elearning', 'edtech', 'training provider', 'academy', 'learning management', 'curriculum', 'bildung', 'ecole', 'formation', 'universidad'], weak: ['training', 'course', 'student', 'learning'] },
  { industry: 'Electronics & Electrical', strong: ['electronic', 'elektronik', 'semiconductor', 'pcb', 'printed circuit', 'component', 'connector', 'cable', 'wire harness', 'transformer', 'switchgear', 'led', 'lighting', 'battery', 'power supply', 'electrical', 'elektro', 'embedded', 'display technology'], weak: ['electric'] },
  { industry: 'Energy & Utilities', strong: ['energy', 'energie', 'renewable', 'solar', 'photovoltaic', 'wind power', 'wind turbine', 'hydrogen', 'power plant', 'power generation', 'utility', 'utilities', 'grid', 'nuclear', 'carbon capture', 'biomass', 'pellet', 'heat pump', 'energia'], weak: ['power', 'electricity'] },
  { industry: 'Environment & Waste Management', strong: ['recycling', 'waste', 'water treatment', 'wastewater', 'environmental', 'umwelt', 'environnement', 'circular economy', 'sustainability consulting', 'pest control', 'cleaning', 'hygiene', 'sanitation'], weak: ['sustainab', 'eco', 'water'] },
  { industry: 'Fashion, Textiles & Apparel', strong: ['fashion', 'apparel', 'clothing', 'garment', 'textile', 'fabric', 'footwear', 'shoe', 'lingerie', 'swimwear', 'mode', 'moda', 'textil', 'denim', 'knitwear', 'leather', 'handbag', 'eyewear'], weak: ['wear', 'collection', 'accessories'] },
  { industry: 'Financial Services', strong: ['bank', 'banking', 'insurance', 'fintech', 'payment', 'payments', 'accounting software', 'investment', 'asset management', 'leasing', 'versicherung', 'finance'], weak: ['financial', 'credit', 'loan'] },
  { industry: 'Food & Beverage', strong: ['food', 'beverage', 'drink', 'wine', 'winery', 'vineyard', 'brewery', 'beer', 'spirits', 'coffee', 'tea', 'bakery', 'confectionery', 'chocolate', 'snack', 'dairy', 'cheese', 'meat', 'seafood', 'olive oil', 'juice', 'ingredient', 'flavour', 'flavor', 'lebensmittel', 'getranke', 'alimentaire', 'alimentos', 'alimentari', 'feinkost', 'nutrition', 'nutraceutical', 'gelato', 'ice cream', 'organic food'], weak: ['taste', 'restaurant', 'kitchen'] },
  { industry: 'Furniture & Interiors', strong: ['furniture', 'mobel', 'meuble', 'mueble', 'mobili', 'interior design', 'upholstery', 'mattress', 'bedding', 'lighting design', 'home decor', 'decor', 'kitchen design', 'bathroom', 'sanitary ware', 'woodworking'], weak: ['interior', 'design', 'wood'] },
  { industry: 'Gaming & Entertainment', strong: ['casino', 'gaming', 'slot machine', 'board game', 'video game', 'toy', 'toys', 'amusement', 'theme park', 'attraction', 'comic', 'cosplay', 'licensing', 'entertainment', 'event production', 'stage lighting', 'audio visual', 'pro audio', 'musical instrument', 'music'], weak: ['fun', 'play', 'show'] },
  { industry: 'Government & Associations', strong: ['ministry', 'government', 'municipality', 'city council', 'chamber of commerce', 'trade association', 'federation', 'trade agency', 'embassy', 'export promotion', 'verband', 'association', 'council'], weak: ['national', 'public sector'] },
  { industry: 'Health & Medical', strong: ['medical', 'medizin', 'medical device', 'hospital', 'clinic', 'healthcare', 'health care', 'diagnostic', 'surgical', 'orthopaedic', 'orthopedic', 'dental', 'dentist', 'rehabilitation', 'physiotherapy', 'therapy', 'care home', 'nursing', 'disability', 'mobility aid', 'wheelchair', 'laboratory', 'optical', 'hearing'], weak: ['health', 'patient', 'care'] },
  { industry: 'Home & Garden', strong: ['garden', 'gardening', 'garten', 'jardin', 'giardino', 'outdoor living', 'pool', 'swimming pool', 'hot tub', 'sauna', 'landscaping', 'barbecue', 'bbq', 'household', 'housewares', 'home improvement', 'fireplace', 'stove'], weak: ['home', 'house'] },
  { industry: 'Hospitality & Catering', strong: ['hotel', 'hospitality', 'catering', 'foodservice', 'food service', 'restaurant equipment', 'commercial kitchen', 'gastronomie', 'gastronomy', 'horeca', 'hotellerie', 'bar equipment', 'vending'], weak: ['restaurant', 'chef', 'guest'] },
  { industry: 'Industrial Machinery & Engineering', strong: ['machinery', 'machine tool', 'maschinenbau', 'maschinen', 'cnc', 'machining', 'welding', 'cutting', 'laser', 'pump', 'valve', 'compressor', 'hydraulic', 'pneumatic', 'bearing', 'gear', 'fastener', 'tooling', 'mould', 'mold', 'industrial equipment', 'engineering', 'metalworking', 'sheet metal', 'forging', 'casting', 'testing equipment', 'measurement', 'metrology', 'manufacturing'], weak: ['industrial', 'machine', 'precision', 'equipment'] },
  { industry: 'Information Technology & Software', strong: ['software', 'saas', 'cloud', 'data center', 'data centre', 'it services', 'it solutions', 'artificial intelligence', 'machine learning', 'big data', 'analytics platform', 'erp', 'crm', 'app development', 'web development', 'digital transformation', 'hosting', 'devops', 'iot', 'blockchain', 'informatique'], weak: ['digital', 'platform', 'technology', 'tech', 'data', 'online'] },
  { industry: 'Jewellery & Watches', strong: ['jewel', 'jewelry', 'jewellery', 'diamond', 'gemstone', 'gold', 'silver', 'watch', 'watches', 'clock', 'bijou', 'schmuck', 'gioielli', 'joyeria', 'pearl'], weak: ['luxury'] },
  { industry: 'Logistics & Supply Chain', strong: ['logistics', 'logistik', 'logistique', 'freight', 'shipping', 'forwarding', 'warehouse', 'warehousing', 'intralogistics', 'supply chain', 'courier', 'parcel', 'fulfilment', 'fulfillment', 'cold chain', 'container', 'pallet', 'forklift', 'material handling', 'storage system', 'self storage'], weak: ['transport', 'delivery', 'storage'] },
  { industry: 'Marine & Maritime', strong: ['marine', 'maritime', 'boat', 'yacht', 'shipyard', 'shipbuilding', 'offshore', 'vessel', 'harbour', 'harbor', 'nautic', 'subsea', 'workboat', 'cruise'], weak: ['sea', 'ship', 'port'] },
  { industry: 'Media, Printing & Publishing', strong: ['publisher', 'publishing', 'printing', 'print', 'printer', 'label', 'signage', 'sign making', 'screen print', 'broadcast', 'media', 'magazine', 'newspaper', 'book', 'books', 'verlag', 'editions', 'editorial', 'advertising', 'marketing agency', 'photography', 'film production'], weak: ['content', 'marketing', 'creative'] },
  { industry: 'Metals & Mining', strong: ['mining', 'mine', 'mineral', 'quarry', 'steel', 'aluminium', 'aluminum', 'metal', 'metals', 'stahl', 'metallurg', 'foundry', 'ore', 'copper'], weak: ['iron'] },
  { industry: 'Oil & Gas', strong: ['natural gas', 'oil and gas', 'oil & gas', 'petroleum', 'petrochemical', 'refinery', 'upstream', 'downstream', 'drilling', 'pipeline', 'lng', 'oilfield'], weak: ['offshore', 'oil', 'gas'] },
  { industry: 'Packaging', strong: ['packaging', 'verpackung', 'emballage', 'embalaje', 'imballaggio', 'carton', 'corrugated', 'bottle', 'closure', 'labelling', 'packaging machine', 'flexible packaging', 'film', 'box', 'boxes', 'bag', 'bags', 'pouch'], weak: ['pack'] },
  { industry: 'Pets & Veterinary', strong: ['pet', 'pets', 'pet food', 'veterinary', 'vet', 'animal health', 'equine', 'horse', 'dog', 'cat', 'tierarzt', 'heimtier', 'aquarium'], weak: ['animal'] },
  { industry: 'Pharmaceuticals & Biotech', strong: ['pharma', 'pharmaceutical', 'biotech', 'biotechnology', 'drug', 'api manufacturer', 'active pharmaceutical', 'excipient', 'cdmo', 'cmo', 'clinical trial', 'vaccine', 'generic', 'life science', 'bioprocess', 'arzneimittel', 'farmaceutic'], weak: ['laboratory', 'research'] },
  { industry: 'Plastics & Rubber', strong: ['plastic', 'plastics', 'kunststoff', 'plastique', 'plastico', 'injection moulding', 'injection molding', 'extrusion', 'thermoforming', 'rubber', 'elastomer', 'polyethylene', 'pvc', 'masterbatch'], weak: ['moulding', 'molding'] },
  { industry: 'Professional Services & Consulting', strong: ['consulting', 'consultancy', 'consultant', 'law firm', 'legal services', 'recruitment', 'staffing', 'hr services', 'human resources', 'outsourcing', 'certification', 'inspection', 'audit', 'franchise', 'business services', 'beratung', 'conseil'], weak: ['services', 'solutions', 'advisory'] },
  { industry: 'Real Estate & Property', strong: ['real estate', 'property', 'properties', 'immobilien', 'immobilier', 'inmobiliaria', 'developer', 'housing', 'homes for sale', 'apartment', 'facility management', 'property management'], weak: ['estate'] },
  { industry: 'Retail & Consumer Goods', strong: ['retail', 'retailer', 'e-commerce', 'ecommerce', 'consumer goods', 'gift', 'gifts', 'souvenir', 'homeware', 'stationery', 'point of sale', 'pos system', 'shopfitting', 'wholesale', 'distributor', 'store'], weak: ['shop', 'brand', 'products'] },
  { industry: 'Safety & Security', strong: ['safety', 'security', 'fire protection', 'fire safety', 'firefighting', 'fire', 'ppe', 'protective equipment', 'workwear', 'access control', 'cctv', 'video surveillance', 'alarm', 'locks', 'emergency services', 'rescue', 'sicherheit', 'securite', 'seguridad'], weak: ['protection', 'secure'] },
  { industry: 'Sports, Leisure & Outdoor', strong: ['sport', 'sports', 'fitness', 'gym', 'golf', 'fishing', 'hunting', 'camping', 'outdoor', 'bicycle', 'bike', 'cycling', 'ski', 'hiking', 'climbing', 'tennis', 'football', 'boating', 'archery', 'firearm'], weak: ['leisure', 'active'] },
  { industry: 'Telecommunications', strong: ['telecom', 'telecommunication', 'mobile network', 'network operator', 'broadband', 'fibre', 'fiber optic', '5g', 'satellite communication', 'wireless', 'antenna', 'telekommunikation', 'connectivity'], weak: ['network', 'mobile'] },
  { industry: 'Travel & Tourism', strong: ['travel', 'tourism', 'tourist', 'tour operator', 'travel agency', 'destination', 'airline', 'tourismus', 'tourisme', 'turismo', 'resort', 'holiday', 'vacation', 'cruise line'], weak: ['trip', 'tour', 'visit'] },
];

const STRONG = 3;
const WEAK = 1;
/** A name hit is identifying: "Booster Robotics Co." is a robotics company. */
const NAME_FACTOR = 2;
const MIN_SCORE = 3;

function normalize(text: string | null | undefined): string {
  return ` ${(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

/**
 * Word match. A phrase of 5+ letters matches as a word start ("pharma" → "pharmaceutical"); a short one only
 * as a whole word, plural allowed — otherwise "bus" fires on "business", "tea" on "team", "spa" on "space".
 */
function mentions(haystack: string, phrase: string): boolean {
  const p = normalize(phrase).trim();
  if (p.length >= 5 || p.includes(' ')) return haystack.includes(` ${p}`);
  return haystack.includes(` ${p} `) || haystack.includes(` ${p}s `) || haystack.includes(` ${p}es `);
}

export type GeneralClassification = {
  industry: GeneralIndustry | null;
  evidence: string[];
  score: number;
  runnerUp: GeneralIndustry | null;
};

/** The sector the company's own words decide, or null when they do not decide one clearly. */
export function classifyGeneralIndustry(text: string | null, companyName?: string | null): GeneralClassification {
  const body = normalize(text);
  const name = normalize(companyName);
  const scored = RULES.map((rule) => {
    let score = 0;
    const evidence: string[] = [];
    const seen: string[] = [];
    const add = (phrase: string, weight: number) => {
      const inName = mentions(name, phrase);
      const inBody = mentions(body, phrase);
      if (!inName && !inBody) return;
      // "jewel" and "jewelry" are one piece of evidence, not two.
      const bare = normalize(phrase).trim();
      if (seen.some((s) => s.startsWith(bare) || bare.startsWith(s))) return;
      seen.push(bare);
      // A name hit counts double — but a weak word stays weak: "Technology" in a name is not a sector.
      score += inName ? weight * NAME_FACTOR : weight;
      evidence.push(inName ? `name:${phrase}` : phrase);
    };
    rule.strong.forEach((p) => add(p, STRONG));
    (rule.weak ?? []).forEach((p) => add(p, WEAK));
    return { industry: rule.industry, score, evidence };
  }).sort((a, b) => b.score - a.score);

  const [best, second] = scored;
  const runnerUp = second && second.score > 0 ? second.industry : null;
  // Clear winner only: enough evidence, and ahead of the runner-up by a margin, not a tie.
  if (!best || best.score < MIN_SCORE || (second && best.score - second.score < 2 && best.score < second.score * 1.5)) {
    return { industry: null, evidence: best?.evidence ?? [], score: best?.score ?? 0, runnerUp };
  }
  return { industry: best.industry, evidence: best.evidence.slice(0, 6), score: best.score, runnerUp };
}

/** Find Shows catalog category → the sector a show's exhibitors work in, for the stated fallback. */
const SHOW_CATEGORY_SECTOR: Record<string, GeneralIndustry> = {
  Agriculture: 'Agriculture & Farming',
  Automotive: 'Automotive & Transport',
  Beverage: 'Food & Beverage',
  Building: 'Building & Construction',
  'Cloud Computing': 'Information Technology & Software',
  Construction: 'Building & Construction',
  Cybersecurity: 'Cybersecurity',
  Electronics: 'Electronics & Electrical',
  Energy: 'Energy & Utilities',
  Engineering: 'Industrial Machinery & Engineering',
  Environment: 'Environment & Waste Management',
  Fashion: 'Fashion, Textiles & Apparel',
  Food: 'Food & Beverage',
  Healthcare: 'Health & Medical',
  'Information Technology': 'Information Technology & Software',
  Manufacturing: 'Industrial Machinery & Engineering',
  Medical: 'Health & Medical',
  Packaging: 'Packaging',
  Plastics: 'Plastics & Rubber',
  Rubber: 'Plastics & Rubber',
  Safety: 'Safety & Security',
  Security: 'Safety & Security',
  Technology: 'Information Technology & Software',
  Textiles: 'Fashion, Textiles & Apparel',
};

export function sectorForShowCategory(category: string | null | undefined): GeneralIndustry | null {
  return category ? SHOW_CATEGORY_SECTOR[category] ?? null : null;
}

export type IndustryDecision = { industry: string; evidence: string[]; source: string } | null;

/**
 * The value to store: the company's own text first; otherwise the show's sector, labelled as the show's.
 * A show whose catalog category is "General" (or unmapped) gives no fallback — the field stays empty.
 */
export function decideExhibitorIndustry(input: {
  companyName: string;
  description: string | null;
  categories: string[];
  descriptionSource: string | null;
  showName: string | null;
  showCategories: string[];
}): IndustryDecision {
  const text = [input.description, ...input.categories].filter(Boolean).join(' . ');
  const own = classifyGeneralIndustry(text, input.companyName);
  if (own.industry) {
    return { industry: own.industry, evidence: own.evidence, source: input.descriptionSource ? `own-text:${input.descriptionSource}` : 'own-text' };
  }
  // The show's first category that maps to a sector; "General" is skipped rather than turned into one.
  const showSector = input.showCategories.map(sectorForShowCategory).find(Boolean) ?? null;
  if (showSector && input.showName) {
    return { industry: showSector, evidence: [`exhibits at ${input.showName}`], source: 'show-category' };
  }
  return null;
}
